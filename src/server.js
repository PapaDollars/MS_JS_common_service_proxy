const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');
const configService = require('./services/config.service');
const discoveryService = require('./services/discovery.service');
const logger = require('./middleware/logger.middleware');
const authMiddleware = require('./middleware/auth.middleware');
const proxyMiddleware = require('./middleware/proxy.middleware');

// Charger les variables d'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// Charger la configuration
let routesConfig = [];
let registeredPaths = [];

const initializeProxy = async () => {
  try {
    // Récupérer la configuration depuis le service de configuration
    const config = await configService.getServiceConfig('service-proxy');
    console.log('Configuration récupérée:', config);
    
    if (config && config.properties && config.properties.routes) {
      routesConfig = config.properties.routes;
      
      // Enregistrer le service dans le registre
      await discoveryService.registerService({
        name: process.env.SERVICE_NAME,
        instanceId: process.env.INSTANCE_ID,
        url: `http://localhost`,
        port: PORT,
        status: 'UP'
      });
      
      // Configurer les routes de proxy
      setupProxyRoutes(routesConfig);
    } else {
      console.error('Impossible de récupérer la configuration des routes');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du proxy:', error);
  }
};

// Configurer les routes de proxy
const setupProxyRoutes = (routes) => {
  routes.forEach(route => {
    const { id, uri, predicates, filters } = route;
    
    if (!predicates || !predicates.length) {
      return;
    }
    
    // Extraire le chemin de l'API
    const pathPredicate = predicates.find(p => p.startsWith('Path='));
    if (!pathPredicate) {
      return;
    }
    
    const path = pathPredicate.replace('Path=', '');
    
    // Déjà enregistré
    if (registeredPaths.includes(path)) {
      return;
    }
    
    registeredPaths.push(path);
    
    // Déterminer si l'authentification est requise
    const requiresAuth = !path.endsWith('/login') && !path.endsWith('/register');
    
    // Configurer le proxy pour cette route
    app.use(path, async (req, res, next) => {
      try {
        // Middleware d'authentification pour les routes protégées
        if (requiresAuth) {
          authMiddleware(req, res, (err) => {
            if (err) return next(err);
            proxyMiddleware(req, res, next, route);
          });
        } else {
          proxyMiddleware(req, res, next, route);
        }
      } catch (error) {
        console.error(`Erreur lors du proxy pour ${path}:`, error);
        res.status(500).json({
          message: 'Erreur interne du serveur proxy'
        });
      }
    });
    
    console.log(`Route configurée: ${path} -> ${uri}`);
  });
  
  // Route catch-all
  app.use('*', (req, res) => {
    res.status(404).json({
      message: 'Route non trouvée'
    });
  });
};

// Route de base
app.get('/', (req, res) => {
  res.json({
    message: 'Service proxy opérationnel',
    status: 'UP',
    routes: registeredPaths
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    routes: registeredPaths.length
  });
});

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`Service proxy démarré sur le port ${PORT}`);
  await initializeProxy();
  
  // Envoyer un heartbeat périodique au registre
  setInterval(() => {
    discoveryService.sendHeartbeat(process.env.SERVICE_NAME, process.env.INSTANCE_ID);
  }, 30000);
});

// Gérer la fermeture gracieuse
process.on('SIGINT', async () => {
  try {
    await discoveryService.deregisterService(process.env.SERVICE_NAME, process.env.INSTANCE_ID);
    console.log('Service désenregistré avec succès');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du désenregistrement:', error);
    process.exit(1);
  }
});