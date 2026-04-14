import fp from 'fastify-plugin';
import { jwtVerify, createRemoteJWKSet, decodeProtectedHeader } from 'jose';
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
  const jwtSecret   = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseUrl) throw new Error('❌ SUPABASE_URL no definida en .env');
  if (!jwtSecret)   throw new Error('❌ SUPABASE_JWT_SECRET no definida en .env');

  // ── Para proyectos Supabase nuevos: ES256/RS256 vía JWKS ─────────────────
  // Misma URL que usa el NestJS guard
  const JWKS = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );

  // ── Para proyectos Supabase actuales/legacy: HS256 vía JWT secret ─────────
  const HS256_SECRET = new TextEncoder().encode(jwtSecret);

  // ─────────────────────────────────────────────────────────────────────────
  // authenticate: detecta el algoritmo del token y verifica correctamente
  //
  // Supabase projects firmaban con HS256 (JWT secret).
  // Proyectos nuevos (2024+) usan ES256 con JWKS.
  // Este plugin maneja ambos — igual que el NestJS JwtGuard.
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
        // Leer el header del token SIN verificar la firma, solo para saber el algoritmo
        const header = decodeProtectedHeader(token);
        const alg = header.alg;

        let payload: any;

        if (alg === 'HS256') {
          // Supabase legacy/actual: verificar con el JWT secret (clave simétrica)
          const result = await jwtVerify(token, HS256_SECRET, {
            algorithms: ['HS256'],
          });
          payload = result.payload;
        } else {
          // Supabase nuevo: ES256 / RS256 via clave pública (JWKS)
          const result = await jwtVerify(token, JWKS);
          payload = result.payload;
        }

        req.user = payload as any;
      } catch {
        return reply.code(401).send({
          statusCode: 401,
          intOpCode: 1,
          data: [{ message: 'Token inválido o expirado.' }],
        });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // hasPermission: consulta usuario_permisos (permisos GLOBALES del usuario)
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
  dependencies: ['supabase-plugin'],
});
