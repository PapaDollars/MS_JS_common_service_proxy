const { createProxyMiddleware } = require('http-proxy-middleware');
const discoveryService = require('../services/discovery.service');

/**
 * Middleware de proxy
 * Redirige les requêtes vers le service approprié
 */
const proxyMiddleware = async (req, res, next, route) => {
  try {
    const { id, uri } = route;
    
    // Extraire le nom du service de l'URI
    // Format attendu: lb://service-name
    const serviceName = uri.replace('lb://', '');
    
    // Rechercher les instances du service
    const instances = await discoveryService.findServiceInstances(serviceName);
    
    if (!instances || instances.length === 0) {
      return res.status(503).json({
        message: `Service ${serviceName} indisponible`
      });
    }
    
    // Sélectionner une instance (load balancing simple: round-robin)
    const instance = instances[Math.floor(Math.random() * instances.length)];
    
    // Construire l'URL cible
    const target = `${instance.url}:${instance.port}`;
    
    // Créer et appliquer le proxy
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (path) => {
        // Implémenter la logique de StripPrefix si nécessaire
        const filters = route.filters || [];
        const stripPrefixFilter = filters.find(f => f.startsWith('StripPrefix='));
        
        if (stripPrefixFilter) {
          const parts = path.split('/');
          const prefixCount = parseInt(stripPrefixFilter.replace('StripPrefix=', ''), 10);
          
          return '/' + parts.slice(prefixCount + 1).join('/');
        }
        
        return path;
      },
      onProxyReq: (proxyReq, req, res) => {
        // Transmettre le token et les en-têtes d'authentification
        if (req.user) {
          proxyReq.setHeader('X-User-Id', req.user.id);
          proxyReq.setHeader('X-User-Role', req.user.role);
        }
      },
      onError: (err, req, res) => {
        console.error('Erreur de proxy:', err);
        res.status(500).json({
          message: 'Erreur lors de la communication avec le service'
        });
      }
    });
    
    proxy(req, res, next);
  } catch (error) {
    console.error('Erreur dans le middleware de proxy:', error);
    res.status(500).json({
      message: 'Erreur interne du serveur proxy'
    });
  }
};

module.exports = proxyMiddleware;