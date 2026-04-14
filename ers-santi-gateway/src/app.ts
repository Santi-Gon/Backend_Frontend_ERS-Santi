import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimitPlugin from './plugins/rate-limit.plugin';
import proxyPlugin from './plugins/proxy.plugin';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    },
  });

  // ── CORS ────────────────────────────────────────────────────────────────
  // El gateway es el ÚNICO punto de acceso desde el Frontend.
  // Solo permite al frontend (4200) comunicarse con él.
  await app.register(cors, {
    origin: ['http://localhost:4200'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Rate Limiting (Seguridad: DDOS / Abuso) ─────────────────────────────
  await app.register(rateLimitPlugin);

  // ── Proxy transparente hacia los microservicios ──────────────────────────
  await app.register(proxyPlugin);

  // ── Health Check propio del Gateway ─────────────────────────────────────
  app.get('/api/v1/health', async () => ({
    service: 'ers-santi-gateway',
    status: 'ok',
    port: process.env.PORT ?? 3003,
  }));

  return app;
}
