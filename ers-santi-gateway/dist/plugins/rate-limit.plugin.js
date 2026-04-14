"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
/**
 * Limitador de peticiones (Rate Limit).
 * Protege a todos los microservicios contra ataques de fuerza bruta y DDoS básicos.
 * Configuración: 100 peticiones máximo por minuto por IP.
 */
async function rateLimitPlugin(fastify) {
    await fastify.register(rate_limit_1.default, {
        max: 100, // Límite de 100 peticiones
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
exports.default = (0, fastify_plugin_1.default)(rateLimitPlugin, {
    name: 'rate-limit-plugin',
});
