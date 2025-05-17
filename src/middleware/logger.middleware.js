/**
 * Middleware de journalisation
 * Enregistre les détails de chaque requête
 */
const loggerMiddleware = (req, res, next) => {
    const start = Date.now();
    
    // Enregistrer les informations de la requête
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // Capturer la fin de la requête pour calculer le temps de traitement
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  };
  
  module.exports = loggerMiddleware;