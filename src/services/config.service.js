const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL || 'http://localhost:8888';

/**
 * Service pour interagir avec le service de configuration
 */
const configService = {
  /**
   * Récupérer la configuration du service
   * @returns {Promise} Configuration du service
   */
  async getConfig() {
    try {
      const response = await axios.get(`${CONFIG_SERVICE_URL}/service-proxy/default`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération de la configuration:', error.message);
      // Retourner une configuration par défaut en cas d'erreur
      return {
        name: 'service-proxy',
        properties: {
          routes: [
            {
              id: 'auth-service',
              uri: 'http://localhost:8082',
              predicates: ['Path=/api/auth/**'],
              filters: []
            },
            {
              id: 'user-service',
              uri: 'http://localhost:8081',
              predicates: ['Path=/api/users/**'],
              filters: []
            },
            {
              id: 'ticket-service',
              uri: 'http://localhost:8082',
              predicates: ['Path=/api/tickets/**'],
              filters: []
            }
          ]
        }
      };
    }
  }
};

module.exports = configService;