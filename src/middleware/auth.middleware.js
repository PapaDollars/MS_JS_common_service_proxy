const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

/**
 * Middleware d'authentification
 * Vérifie le token JWT dans l'en-tête Authorization
 */
const authMiddleware = (req, res, next) => {
  // Récupérer le token de l'en-tête Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentification requise'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ajouter les informations utilisateur à la requête
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expiré'
      });
    }
    
    return res.status(401).json({
      message: 'Token invalide'
    });
  }
};

module.exports = authMiddleware;