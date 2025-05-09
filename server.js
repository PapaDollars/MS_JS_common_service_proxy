// service-proxy/server.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Charger les variables d'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL || 'http://localhost:8888';
const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:8761';
const ENVIRONMENT = process.env.NODE_ENV || 'dev';

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'service-proxy' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    // Permettre les requêtes sans origine (comme les appels API)
    if (!origin) return callback(null, true);
    
    // Vérifier si l'origine est autorisée
    if (app.locals.config && app.locals.config.cors && app.locals.config.cors.allowedOrigins) {
      if (app.locals.config.cors.allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
    }
    
    callback(new Error('Non autorisé par CORS'));
  },
  credentials: true
}));

// Limiter le taux de requêtes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json());

// Middleware pour ajouter un ID de corrélation à chaque requête
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

// Middleware pour vérifier l'authentification JWT pour les routes protégées
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET || app.locals.config.jwt.secret, (err, user) => {
      if (err) {
        logger.error(`Erreur d'authentification JWT: ${err.message}`, { correlationId: req.correlationId });
        return res.status(403).json({ error: 'Token invalide ou expiré' });
      }
      
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authentification requise' });
  }
};

// Fonction pour obtenir l'URL du service depuis le registre
const getServiceUrl = async (serviceName) => {
  try {
    const response = await axios.get(`${REGISTRY_SERVICE_URL}/services/${serviceName}`);
    const instances = response.data;
    
    if (instances && instances.length > 0) {
      // Sélectionner une instance active (stratégie simple de round-robin)
      const activeInstances = instances.filter(instance => instance.status === 'UP');
      if (activeInstances.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeInstances.length);
        return activeInstances[randomIndex].url;
      }
    }
    throw new Error(`Aucune instance active trouvée pour le service ${serviceName}`);
  } catch (error) {
    logger.error(`Erreur lors de la récupération de l'URL du service ${serviceName}: ${error.message}`);
    throw error;
  }
};

// Fonction pour charger la configuration
const loadConfig = async () => {
  try {
    const response = await axios.get(`${CONFIG_SERVICE_URL}/config/service-proxy/${ENVIRONMENT}`);
    app.locals.config = response.data;
    logger.info('Configuration chargée avec succès');
    
    // Configurer les routes en fonction de la configuration
    setupRoutes();
  } catch (error) {
    logger.error(`Erreur lors du chargement de la configuration: ${error.message}`);
    setTimeout(loadConfig, 10000); // Réessayer après 10 secondes
  }
};

// Fonction pour configurer les routes dynamiquement
const setupRoutes = () => {
  const { routes } = app.locals.config;
  
  if (!routes) {
    logger.error('Aucune route trouvée dans la configuration');
    return;
  }
  
  // Supprimer les routes existantes (sauf les routes système)
  app._router.stack = app._router.stack.filter(layer => {
    return !layer.route || layer.route.path === '/health';
  });
  
  // Configurer les nouvelles routes
  Object.keys(routes).forEach(key => {
    const route = routes[key];
    
    logger.info(`Configuration de la route: ${route.path} -> ${route.serviceUrl}`);
    
    app.use(route.path, createProxyMiddleware({
      target: route.serviceUrl,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        return path.replace(route.path, '');
      },
      onProxyReq: (proxyReq, req, res) => {
        // Ajouter des en-têtes personnalisés à la requête proxifiée
        proxyReq.setHeader('x-correlation-id', req.correlationId);
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.id);
          proxyReq.setHeader('x-user-role', req.user.role);
        }
      },
      onError: (err, req, res) => {
        logger.error(`Erreur de proxy pour ${req.url}: ${err.message}`, { correlationId: req.correlationId });
        res.status(500).json({ error: 'Erreur lors de la communication avec le service' });
      }
    }));
  });
  
  // Configurer les routes protégées
  if (app.locals.config.protectedRoutes) {
    app.locals.config.protectedRoutes.forEach(routePath => {
      logger.info(`Configuration de la route protégée: ${routePath}`);
      app.use(routePath, authenticateJWT);
    });
  }
};

// Route de santé pour les health checks
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  logger.info(`Service API Gateway démarré sur le port ${PORT}`);
  
  // Charger la configuration initiale
  loadConfig();
  
  // S'enregistrer auprès du service de découverte
  registerWithDiscoveryService();
});

// Fonction pour s'enregistrer auprès du service de découverte
const registerWithDiscoveryService = async () => {
  try {
    const response = await axios.post(`${REGISTRY_SERVICE_URL}/register`, {
      name: 'service-proxy',
      host: process.env.HOST || 'localhost',
      port: PORT,
      healthCheckUrl: `http://${process.env.HOST || 'localhost'}:${PORT}/health`
    });
    
    const serviceId = response.data.id;
    logger.info(`Enregistré avec succès auprès du service de découverte, ID: ${serviceId}`);
    
    // Envoyer des heartbeats périodiques
    setInterval(async () => {
      try {
        await axios.put(`${REGISTRY_SERVICE_URL}/heartbeat/${serviceId}`);
      } catch (error) {
        logger.error(`Erreur lors de l'envoi du heartbeat: ${error.message}`);
      }
    }, 30000); // Toutes les 30 secondes
    
    // Désinscription lors de l'arrêt de l'application
    const cleanup = async () => {
      try {
        await axios.delete(`${REGISTRY_SERVICE_URL}/unregister/${serviceId}`);
        logger.info('Désinscrit avec succès du service de découverte');
        process.exit(0);
      } catch (error) {
        logger.error(`Erreur lors de la désinscription: ${error.message}`);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (error) {
    logger.error(`Erreur lors de l'enregistrement auprès du service de découverte: ${error.message}`);
    setTimeout(registerWithDiscoveryService, 10000); // Réessayer après 10 secondes
  }
};

