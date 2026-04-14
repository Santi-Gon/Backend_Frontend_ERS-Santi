import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

/**
 * Limitador de peticiones (Rate Limit).
 * Protege a todos los microservicios contra ataques de fuerza bruta y DDoS básicos.
 * Configuración: 100 peticiones máximo por minuto por IP.
 */
async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: 100,             // Límite de 100 peticiones
    timeWindow: '1 minute', // Por ventana de 1 minuto
    errorResponseBuilder: function (request, context) {
      return {
        statusCode: 429,
        intOpCode: 1,
        data: [{ 
          message: 'Demasiadas peticiones. Por favor, inténtelo de nuevo en un minuto.' 
        }]
      };
    },
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit-plugin',
});
