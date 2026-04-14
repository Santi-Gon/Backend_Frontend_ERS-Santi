import fp from 'fastify-plugin';
import httpProxy from '@fastify/http-proxy';
import type { FastifyInstance } from 'fastify';

/**
 * Proxy Plugin
 * Redirige de forma transparente las peticiones del frontend a los microservicios,
 * inyectando de forma oculta el X-Internal-Secret para burlar sus locks de cors/seguridad.
 */
async function proxyPlugin(fastify: FastifyInstance) {
  const secret = process.env.INTERNAL_SECRET;
  const usersUrl = process.env.MS_USERS_URL;
  const gruposUrl = process.env.MS_GRUPOS_URL;
  const ticketsUrl = process.env.MS_TICKETS_URL;

  if (!secret || !usersUrl || !gruposUrl || !ticketsUrl) {
    throw new Error('Faltan variables de entorno necesarias para el Proxy.');
  }

  // Helper para inyectar el Header de confianza
  const inyectarSecreto = {
    'x-internal-secret': secret,
  };

  // ── 1. Rutas de Auth y Usuarios -> a ers-santi-backend (3000) ──────────
  await fastify.register(httpProxy, {
    upstream: usersUrl,
    prefix: '/api/v1/auth',
    rewritePrefix: '/api/v1/auth', // Proxy 1 a 1 transparente
    replyOptions: { rewriteRequestHeaders: (req, headers) => ({ ...headers, ...inyectarSecreto }) }
  });

  await fastify.register(httpProxy, {
    upstream: usersUrl,
    prefix: '/api/v1/users',
    rewritePrefix: '/api/v1/users',
    replyOptions: { rewriteRequestHeaders: (req, headers) => ({ ...headers, ...inyectarSecreto }) }
  });

  // ── 2. Rutas de Grupos -> a ers-santi-grupos (3001) ────────────────────
  await fastify.register(httpProxy, {
    upstream: gruposUrl,
    prefix: '/api/v1/grupos',
    rewritePrefix: '/api/v1/grupos',
    replyOptions: { rewriteRequestHeaders: (req, headers) => ({ ...headers, ...inyectarSecreto }) }
  });

  // ── 3. Rutas de Tickets y Catálogos -> a ers-santi-tickets (3002) ──────
  await fastify.register(httpProxy, {
    upstream: ticketsUrl,
    prefix: '/api/v1/catalogos',
    rewritePrefix: '/api/v1/catalogos',
    replyOptions: { rewriteRequestHeaders: (req, headers) => ({ ...headers, ...inyectarSecreto }) }
  });

  await fastify.register(httpProxy, {
    upstream: ticketsUrl,
    prefix: '/api/v1/tickets',
    rewritePrefix: '/api/v1/tickets',
    replyOptions: { rewriteRequestHeaders: (req, headers) => ({ ...headers, ...inyectarSecreto }) }
  });
}

export default fp(proxyPlugin, {
  name: 'proxy-plugin',
});
