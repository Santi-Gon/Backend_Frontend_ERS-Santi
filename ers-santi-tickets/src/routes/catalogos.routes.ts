import type { FastifyInstance } from 'fastify';
import { createError } from '../helpers/errors';

export async function catalogosRoutes(fastify: FastifyInstance) {
  // GET /catalogos/estados
  // Devuelve los 4 estados ordenados: pendiente, en progreso, revisión, finalizada
  fastify.get(
    '/catalogos/estados',
    { preHandler: [fastify.authenticate] },
    async () => {
      const { data, error } = await fastify.supabase.admin
        .from('estados')
        .select('id, nombre, color, orden')
        .order('orden', { ascending: true });

      if (error) throw createError(500, `Error al obtener estados: ${error.message}`);
      return data ?? [];
    },
  );

  // GET /catalogos/prioridades
  // Devuelve las 3 prioridades: Alta, Media, Baja
  fastify.get(
    '/catalogos/prioridades',
    { preHandler: [fastify.authenticate] },
    async () => {
      const { data, error } = await fastify.supabase.admin
        .from('prioridades')
        .select('id, nombre, orden')
        .order('orden', { ascending: true });

      if (error) throw createError(500, `Error al obtener prioridades: ${error.message}`);
      return data ?? [];
    },
  );
}
