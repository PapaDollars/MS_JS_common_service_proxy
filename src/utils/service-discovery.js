const axios = require('axios');

class ServiceDiscovery {
    constructor() {
        this.services = new Map();
        this.registerServiceUrl = null;
    }

    init(registerServiceUrl) {
        this.registerServiceUrl = registerServiceUrl;
        this.startPolling();
    }

    async startPolling() {
        try {
            const response = await axios.get(`${this.registerServiceUrl}/api/registry/services`);
            this.services = new Map(Object.entries(response.data));
            console.log('Services mis à jour:', this.services);
        } catch (error) {
            console.error('Erreur lors de la récupération des services:', error);
        }

        // Polling toutes les 30 secondes
        setTimeout(() => this.startPolling(), 30000);
    }

    getServiceUrl(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service ${serviceName} non trouvé`);
        }
        return `http://${service.host}:${service.port}`;
    }
}

module.exports = new ServiceDiscovery();
