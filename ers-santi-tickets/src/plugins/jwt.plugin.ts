import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// ── Extiende FastifyRequest para tener request.user tipado ───────────────────
declare module 'fastify' {
  interface FastifyInstance {
    /** Prehandler que verifica el JWT. Úsalo en rutas protegidas. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

    /** Verifica si un usuario tiene un permiso global en usuario_permisos */
    hasPermission: (userId: string, permission: string) => Promise<boolean>;
  }

  interface FastifyRequest {
    user: {
      sub: string;
      email?: string;
      [key: string]: unknown;
    };
  }
}

async function jwtPlugin(fastify: FastifyInstance) {
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('❌ SUPABASE_URL no definida en .env');
  }

  // JWKS = la clave pública de Supabase para verificar tokens (ES256)
  // Se descarga automáticamente y se cachea
  const JWKS = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/jwks`),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // authenticate: equivalente al JwtGuard de NestJS
  // Se usa como preHandler en cada ruta protegida:
  // { preHandler: [fastify.authenticate] }
  // ─────────────────────────────────────────────────────────────────────────
  fastify.decorate(
    'authenticate',
    async function (req: FastifyRequest, reply: FastifyReply) {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          statusCode: 401,
          intOpCode: 1,
          data: [{ message: 'Token de autenticación requerido. Incluye Authorization: Bearer <token>' }],
        });
      }

      const token = authHeader.slice(7);

      try {
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload as any;
      } catch (err: any) {
        return reply.code(401).send({
          statusCode: 401,
          intOpCode: 1,
          data: [{ message: 'Token inválido o expirado.' }],
        });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // hasPermission: consulta usuario_permisos en Supabase
  // Equivalente al PermissionGuard de NestJS, pero como función helper
  // Uso: const canAdd = await fastify.hasPermission(req.user.sub, 'ticket_add');
  // ─────────────────────────────────────────────────────────────────────────
  fastify.decorate(
    'hasPermission',
    async function (userId: string, permission: string): Promise<boolean> {
      const { data } = await fastify.supabase.admin
        .from('usuario_permisos')
        .select('permisos!inner(nombre)')
        .eq('usuario_id', userId)
        .eq('permisos.nombre', permission)
        .maybeSingle();
      return !!data;
    },
  );
}

export default fp(jwtPlugin, {
  name: 'jwt-plugin',
  dependencies: ['supabase-plugin'], // garantiza que supabase esté listo primero
});
