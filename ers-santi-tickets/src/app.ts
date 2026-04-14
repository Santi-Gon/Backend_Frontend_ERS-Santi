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
    origin: ['http://localhost:4200', 'http://localhost:3003'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
  });

  // ── Plugins (orden importa: supabase antes que jwt) ─────────────────
  await app.register(responsePlugin);   // 1. Formato de respuesta estándar
  await app.register(supabasePlugin);   // 2. Cliente Supabase
  await app.register(jwtPlugin);        // 3. JWT + hasPermission (depende de supabase)

  // ── Seguridad: solo el API Gateway puede hablar con este servicio ──────────
  // Se ejecuta antes de cualquier handler (incluye rutas de tickets y catalogos).
  // El health check (/api/v1/health) queda igualmente restringido al gateway.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS') return; // preflight CORS pasa sin verificar
    const secret = req.headers['x-internal-secret'];
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      return reply.code(403).send({
        statusCode: 403,
        intOpCode: 1,
        data: [{ message: 'Acceso no autorizado. Usa el API Gateway.' }],
      });
    }
  });

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
