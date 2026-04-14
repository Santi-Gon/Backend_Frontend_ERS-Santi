import type { FastifyInstance } from 'fastify';

type AccionHistorial =
  | 'creado'
  | 'editado'
  | 'estado_cambiado'
  | 'asignado'
  | 'comentado';

/**
 * Agrega una entrada al historial_tickets.
 * No lanza error si falla — el historial es non-crítico.
 */
export async function addHistorial(
  fastify: FastifyInstance,
  ticketId: string,
  userId: string,
  accion: AccionHistorial,
  detalles?: Record<string, unknown>,
): Promise<void> {
  try {
    await fastify.supabase.admin.from('historial_tickets').insert({
      ticket_id: ticketId,
      usuario_id: userId,
      accion,
      detalles: detalles ?? null,
    });
  } catch {
    // Non-critical: no propagamos errores del historial
  }
}
