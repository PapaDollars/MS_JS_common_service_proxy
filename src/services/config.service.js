const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL || 'http://localhost:8888/config';

/**
 * Service pour interagir avec le service de configuration
 */
const configService = {
  /**
   * Récupérer la configuration d'un service
   * @param {string} serviceName - Nom du service
   * @param {string} profile - Profil de configuration (ex: dev, prod)
   * @returns {Promise} Configuration du service
   */
  async getServiceConfig(serviceName, profile = 'development') {
    try {
      const response = await axios.get(`${CONFIG_SERVICE_URL}/${serviceName}/${profile}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la récupération de la configuration pour ${serviceName}:`, error.message);
      throw error;
    }
  }
};

module.exports = configService;