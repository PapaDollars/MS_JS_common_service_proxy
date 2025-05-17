const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:8761/eureka';

/**
 * Service pour interagir avec le service de découverte
 */
const discoveryService = {
  /**
   * Enregistrer un service dans le registre
   * @param {Object} service - Informations du service
   * @returns {Promise} Résultat de l'enregistrement
   */
  async registerService(service) {
    try {
      const response = await axios.post(`${REGISTRY_SERVICE_URL}/apps`, service);
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement du service ${service.name}:`, error.message);
      throw error;
    }
  },
  
  /**
   * Désenregistrer un service du registre
   * @param {string} name - Nom du service
   * @param {string} instanceId - ID de l'instance
   * @returns {Promise} Résultat du désenregistrement
   */
  async deregisterService(name, instanceId) {
    try {
      const response = await axios.delete(`${REGISTRY_SERVICE_URL}/apps/${name}/${instanceId}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur lors du désenregistrement du service ${name}:`, error.message);
      throw error;
    }
  },
  
  /**
   * Envoyer un heartbeat au registre
   * @param {string} name - Nom du service
   * @param {string} instanceId - ID de l'instance
   * @returns {Promise} Résultat du heartbeat
   */
  async sendHeartbeat(name, instanceId) {
    try {
      const response = await axios.put(`${REGISTRY_SERVICE_URL}/apps/${name}/${instanceId}/heartbeat`);
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de l'envoi du heartbeat pour ${name}:`, error.message);
      // Ne pas propager l'erreur pour ne pas interrompre l'application
    }
  },
  
  /**
   * Rechercher les instances d'un service
   * @param {string} serviceName - Nom du service
   * @returns {Promise} Instances du service
   */
  async findServiceInstances(serviceName) {
    try {
      const response = await axios.get(`${REGISTRY_SERVICE_URL}/apps/${serviceName}`);
      return response.data.instances || [];
    } catch (error) {
      console.error(`Erreur lors de la recherche d'instances pour ${serviceName}:`, error.message);
      return [];
    }
  }
};

module.exports = discoveryService;