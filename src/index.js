const express = require('express');
const cors = require('cors');
const proxyMiddleware = require('./middleware/proxy.middleware');
const configService = require('./services/config.service');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Initialiser les routes de proxy
const initProxyRoutes = async () => {
  try {
    const config = await configService.getConfig();
    const routes = config.properties.routes || [];

    routes.forEach(route => {
      const { predicates } = route;
      const pathPredicate = predicates.find(p => p.startsWith('Path='));
      
      if (pathPredicate) {
        const path = pathPredicate.replace('Path=', '');
        app.use(path, (req, res, next) => proxyMiddleware(req, res, next, route));
      }
    });

    console.log('Routes de proxy initialisées avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des routes:', error);
  }
};

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`Service Proxy démarré sur le port ${PORT}`);
  await initProxyRoutes();
}); 