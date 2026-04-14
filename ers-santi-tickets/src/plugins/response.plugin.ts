import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyError } from 'fastify';

// ── Equivalente al ResponseInterceptor de NestJS ─────────────────────────────
// Todas las respuestas exitosas se envuelven en { statusCode, intOpCode, data }
// Los errores también se devuelven en el mismo formato.

async function responsePlugin(fastify: FastifyInstance) {

  // ── 1. Respuestas exitosas: preSerialization ─────────────────────────────
  // Este hook se ejecuta ANTES de que Fastify convierta el objeto a JSON.
  // Transformamos cualquier objeto retornado por un handler.
  fastify.addHook(
    'preSerialization',
    async function (
      _req: FastifyRequest,
      reply: FastifyReply,
      payload: unknown,
    ) {
      // No tocar respuestas de error (se manejan en setErrorHandler)
      if (reply.statusCode >= 400) return payload;

      // Si ya tiene el formato { statusCode, intOpCode, data }, no volver a envolver
      if (
        payload !== null &&
        typeof payload === 'object' &&
        'statusCode' in (payload as object)
      ) {
        return payload;
      }

      // Envolver en el formato estándar
      return {
        statusCode: reply.statusCode,
        intOpCode: 0,
        data: Array.isArray(payload) ? payload : [payload],
      };
    },
  );

  // ── 2. Errores: setErrorHandler ───────────────────────────────────────────
  // Maneja cualquier error lanzado dentro de un handler o preHandler.
  // Incluye errores de validación del schema JSON de Fastify.
  fastify.setErrorHandler(function (
    error: FastifyError,
    _req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const statusCode = error.statusCode ?? 500;

    // Los errores de validación de JSON Schema traen error.validation
    let message: string;
    if (error.validation && error.validation.length > 0) {
      message = error.validation
        .map((v) => v.message ?? 'Campo inválido')
        .join(', ');
    } else {
      message = error.message ?? 'Error interno del servidor.';
    }

    reply.code(statusCode).send({
      statusCode,
      intOpCode: 1,
      data: [{ message }],
    });
  });

  // ── 3. Rutas no encontradas: setNotFoundHandler ───────────────────────────
  fastify.setNotFoundHandler(function (req: FastifyRequest, reply: FastifyReply) {
    reply.code(404).send({
      statusCode: 404,
      intOpCode: 1,
      data: [{ message: `Cannot ${req.method} ${req.url}` }],
    });
  });
}

export default fp(responsePlugin, { name: 'response-plugin' });
