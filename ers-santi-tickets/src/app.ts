import Fastify from 'fastify';
import cors from '@fastify/cors';
import supabasePlugin from './plugins/supabase.plugin';
import jwtPlugin from './plugins/jwt.plugin';
import responsePlugin from './plugins/response.plugin';
import { catalogosRoutes } from './routes/catalogos.routes';
import { ticketsRoutes } from './routes/tickets.routes';

// buildApp: crea y configura la instancia de Fastify.
// Equivalente a inicializar NestFactory.create() + registrar módulos.
export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        // pino-pretty formatea los logs de forma legible en desarrollo
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    },
  });

  // ── CORS ────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: [
      'http://localhost:4200', // Angular frontend
      'http://localhost:3000', // Users microservice
      'http://localhost:3001', // Groups microservice
      'http://localhost:3002', // This microservice
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Plugins (orden importa: supabase antes que jwt) ─────────────────────
  await app.register(responsePlugin);   // 1. Formato de respuesta estándar
  await app.register(supabasePlugin);   // 2. Cliente Supabase
  await app.register(jwtPlugin);        // 3. JWT + hasPermission (depende de supabase)

  // ── Rutas ─────────────────────────────────────────────────────────────
  await app.register(catalogosRoutes, { prefix: '/api/v1' });
  await app.register(ticketsRoutes,   { prefix: '/api/v1' });

  // ── Health check ──────────────────────────────────────────────────────
  app.get('/api/v1/health', async () => ({
    service: 'ers-santi-tickets',
    status: 'ok',
    port: process.env.PORT ?? 3002,
  }));

  return app;
}
