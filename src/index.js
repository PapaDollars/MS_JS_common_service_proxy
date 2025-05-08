const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const authMiddleware = require('./middleware/auth.middleware');
const serviceDiscovery = require('./utils/service-discovery');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL || 'http://localhost:8001';
const REGISTER_SERVICE_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8002';

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialisation du service discovery
serviceDiscovery.init(REGISTER_SERVICE_URL);

// Route admin protégée
app.use('/admin', authMiddleware.verifyAdmin);

// Routes proxy pour les différents services
app.use('/api/users', createProxyMiddleware({
  target: 'http://localhost:8003', // Service utilisateur 
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/'
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`Proxy request to users service: ${req.method} ${req.path}`);
  }
}));

app.use('/api/event-emergent', createProxyMiddleware({
  target: 'http://localhost:8004', // Service event-emergent
  changeOrigin: true,
  pathRewrite: {
    '^/api/event-emergent': '/'
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`Proxy request to event-emergent service: ${req.method} ${req.path}`);
  }
}));

// Démarrage du serveur
app.listen(PORT, async () => {
  logger.info(`Service Proxy démarré sur le port ${PORT}`);
  
  // S'enregistrer auprès du service de configuration
  try {
    await axios.post(`${CONFIG_SERVICE_URL}/api/config/register`, {
      name: 'service-proxy',
      host: 'localhost',
      port: PORT,
      healthUrl: `http://localhost:${PORT}/health`
    });
    logger.info('Enregistré avec succès auprès du service de configuration');
  } catch (error) {
    logger.error('Erreur lors de l\'enregistrement auprès du service de configuration', error);
  }
});