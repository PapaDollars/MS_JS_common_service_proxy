/**
 * Configuration des routes par défaut
 * Cette configuration sera remplacée par celle du service de configuration
 */
const defaultRoutesConfig = [
    {
      id: 'service-users',
      uri: 'lb://service-users',
      predicates: [
        'Path=/api/users/**'
      ],
      filters: [
        'StripPrefix=0'
      ]
    },
    {
      id: 'emergent24-ticket',
      uri: 'lb://emergent24-ticket-backend',
      predicates: [
        'Path=/api/tickets/**'
      ],
      filters: [
        'StripPrefix=0'
      ]
    }
  ];
  
  module.exports = defaultRoutesConfig;