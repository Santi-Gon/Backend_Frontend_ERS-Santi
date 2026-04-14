import type { FastifyInstance } from 'fastify';
import { createError } from '../helpers/errors';
import {
  isGlobalAdmin,
  isGroupMember,
  hasGroupPermission,
  canSeeAll,
} from '../helpers/permissions';
import { addHistorial } from '../helpers/historial';

// ── Campos enriquecidos que usamos en todas las queries de tickets ───────────
const TICKET_SELECT = `
  id, titulo, descripcion, grupo_id, autor_id, asignado_id,
  estado_id, prioridad_id, creado_en, fecha_final,
  estado:estados(id, nombre, color),
  prioridad:prioridades(id, nombre),
  autor:usuarios!autor_id(id, nombre_completo),
  asignado:usuarios!asignado_id(id, nombre_completo)
`;

export async function ticketsRoutes(fastify: FastifyInstance) {
  // ── HELPERS LOCALES ──────────────────────────────────────────────────────────

  /** Resuelve nombre de estado → UUID, lanza 400 si no existe */
  async function resolveEstado(nombre: string): Promise<string> {
    const { data } = await fastify.supabase.admin
      .from('estados')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle();
    if (!data) throw createError(400, `Estado "${nombre}" no válido. Opciones: pendiente, en progreso, revisión, finalizada.`);
    return data.id;
  }

  /** Resuelve nombre de prioridad → UUID, lanza 400 si no existe */
  async function resolvePrioridad(nombre: string): Promise<string> {
    const { data } = await fastify.supabase.admin
      .from('prioridades')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle();
    if (!data) throw createError(400, `Prioridad "${nombre}" no válida. Opciones: Alta, Media, Baja.`);
    return data.id;
  }

  /** Obtiene ticket enriquecido o lanza 404 */
  async function getTicketOrFail(ticketId: string) {
    const { data } = await fastify.supabase.admin
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('id', ticketId)
      .maybeSingle();
    if (!data) throw createError(404, 'Ticket no encontrado.');
    return data as any;
  }

  /**
   * Verifica si el usuario puede VER este ticket:
   * admin/líder del grupo → sí
   * miembro con ticket_view contextual → solo si es autor o asignado
   */
  async function assertCanView(ticket: any, userId: string): Promise<void> {
    if (await canSeeAll(fastify, ticket.grupo_id, userId)) return;

    const isMember = await isGroupMember(fastify, ticket.grupo_id, userId);
    if (!isMember) throw createError(403, 'No eres miembro de este grupo.');

    const canView = await hasGroupPermission(fastify, ticket.grupo_id, userId, 'ticket_view');
    if (!canView) throw createError(403, 'No tienes permiso para ver tickets en este grupo.');

    if (ticket.autor_id !== userId && ticket.asignado_id !== userId) {
      throw createError(403, 'Solo puedes ver tus propios tickets (los que creaste o tienes asignados).');
    }
  }

  /**
   * Verifica si el usuario puede EDITAR este ticket:
   * admin global → sí siempre
   * (autor OR asignado) + ticket_edit contextual → sí
   */
  async function assertCanEdit(ticket: any, userId: string): Promise<void> {
    if (await isGlobalAdmin(fastify, userId)) return;

    if (ticket.autor_id !== userId && ticket.asignado_id !== userId) {
      throw createError(403, 'Solo el autor, el asignado o un admin pueden modificar este ticket.');
    }

    const canEdit = await hasGroupPermission(fastify, ticket.grupo_id, userId, 'ticket_edit');
    if (!canEdit) throw createError(403, 'No tienes permiso para editar tickets en este grupo.');
  }

  /**
   * Verifica que el usuario a asignar sea miembro del grupo.
   * Se llama cuando asignado_id no es null — permite null para desasignar.
   */
  async function assertAssignedIsMember(grupoId: string, asignadoId: string): Promise<void> {
    const esMiembro = await isGroupMember(fastify, grupoId, asignadoId);
    if (!esMiembro) {
      throw createError(400, 'El usuario a asignar no es miembro de este grupo. Solo se puede asignar un ticket a integrantes del grupo.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GET /tickets/grupo/:grupoId
  //    Admin/líder → todos los tickets del grupo
  //    Miembro con ticket_view → solo sus tickets (autor o asignado)
  //    Sin acceso → 403
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.get<{ Params: { grupoId: string } }>(
    '/tickets/grupo/:grupoId',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      const { grupoId } = req.params;
      const userId = req.user.sub;

      const [seeAll, isMember] = await Promise.all([
        canSeeAll(fastify, grupoId, userId),
        isGroupMember(fastify, grupoId, userId),
      ]);

      if (!seeAll && !isMember) {
        throw createError(403, 'No eres miembro de este grupo.');
      }

      let query = fastify.supabase.admin
        .from('tickets')
        .select(TICKET_SELECT)
        .eq('grupo_id', grupoId)
        .order('creado_en', { ascending: false });

      if (!seeAll) {
        // Miembro regular: verifica permiso contextual
        const canView = await hasGroupPermission(fastify, grupoId, userId, 'ticket_view');
        if (!canView) throw createError(403, 'No tienes permiso para ver tickets en este grupo.');

        // Solo ve los suyos
        query = query.or(`autor_id.eq.${userId},asignado_id.eq.${userId}`) as any;
      }

      const { data, error } = await query;
      if (error) throw createError(500, `Error al obtener tickets: ${error.message}`);

      return data ?? [];
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. POST /tickets
  //    Requiere ticket_add contextual en el grupo (o ser admin global)
  //    Establece autor_id = userId automáticamente
  //    El estado por defecto es 'pendiente'
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.post<{ Body: any }>(
    '/tickets',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['grupo_id', 'titulo', 'prioridad_nombre'],
          properties: {
            grupo_id:         { type: 'string' },
            titulo:           { type: 'string', minLength: 2, maxLength: 200 },
            descripcion:      { type: 'string', maxLength: 1000 },
            estado_nombre:    { type: 'string' },
            prioridad_nombre: { type: 'string' },
            asignado_id:      { type: 'string' },
            fecha_final:      { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const body = req.body as any;

      // Permiso: ticket_add contextual en el grupo (o admin global)
      const admin = await isGlobalAdmin(fastify, userId);
      if (!admin) {
        const isMember = await isGroupMember(fastify, body.grupo_id, userId);
        if (!isMember) throw createError(403, 'No eres miembro de este grupo.');

        const canAdd = await hasGroupPermission(fastify, body.grupo_id, userId, 'ticket_add');
        if (!canAdd) throw createError(403, 'No tienes permiso para crear tickets en este grupo.');
      }

      // Validar que el asignado (si se proporciona) sea miembro del grupo
      if (body.asignado_id) {
        await assertAssignedIsMember(body.grupo_id, body.asignado_id);
      }

      // Resolver estado y prioridad por nombre → UUID
      const estado_id = await resolveEstado(body.estado_nombre ?? 'pendiente');
      const prioridad_id = await resolvePrioridad(body.prioridad_nombre);

      const { data: ticket, error: ticketError } = await fastify.supabase.admin
        .from('tickets')
        .insert({
          grupo_id:    body.grupo_id,
          titulo:      body.titulo,
          descripcion: body.descripcion ?? null,
          autor_id:    userId,
          asignado_id: body.asignado_id ?? null,
          estado_id,
          prioridad_id,
          fecha_final: body.fecha_final ?? null,
        })
        .select(TICKET_SELECT)
        .single();

      if (ticketError) throw createError(500, `Error al crear el ticket: ${ticketError.message}`);

      // Historial: entrada de creación
      await addHistorial(fastify, ticket.id, userId, 'creado', { titulo: body.titulo });
      if (body.asignado_id) {
        await addHistorial(fastify, ticket.id, userId, 'asignado', {
          asignado_id: body.asignado_id,
        });
      }

      return reply.code(201).send({
        message: `Ticket "${ticket.titulo}" creado correctamente.`,
        ticket,
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. GET /tickets/:id
  //    Detalle completo con historial y comentarios
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/tickets/:id',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      const { id } = req.params;
      const userId = req.user.sub;

      const ticket = await getTicketOrFail(id);
      await assertCanView(ticket, userId);

      // Historial de cambios
      const { data: historial } = await fastify.supabase.admin
        .from('historial_tickets')
        .select(`
          id, accion, detalles, creado_en,
          usuario:usuarios!usuario_id(id, nombre_completo)
        `)
        .eq('ticket_id', id)
        .order('creado_en', { ascending: true });

      // Comentarios
      const { data: comentarios } = await fastify.supabase.admin
        .from('comentarios')
        .select(`
          id, contenido, creado_en,
          autor:usuarios!autor_id(id, nombre_completo)
        `)
        .eq('ticket_id', id)
        .order('creado_en', { ascending: true });

      return {
        ...ticket,
        historial:   historial   ?? [],
        comentarios: comentarios ?? [],
      };
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. PATCH /tickets/:id/estado   ← ANTES de PATCH /:id para evitar colisión
  //    Cambia solo el estado (para Kanban drag & drop)
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: any }>(
    '/tickets/:id/estado',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['estado_nombre'],
          properties: {
            estado_nombre: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { id } = req.params;
      const userId = req.user.sub;
      const { estado_nombre } = req.body as any;

      const ticket = await getTicketOrFail(id);
      await assertCanEdit(ticket, userId);

      const estadoAnterior = (ticket.estado as any)?.nombre ?? null;
      if (estadoAnterior === estado_nombre) {
        throw createError(400, `El ticket ya está en estado "${estado_nombre}".`);
      }

      const estado_id = await resolveEstado(estado_nombre);

      const { data: updated, error } = await fastify.supabase.admin
        .from('tickets')
        .update({ estado_id })
        .eq('id', id)
        .select(`
          id, titulo, creado_en, fecha_final,
          estado:estados(id, nombre, color),
          prioridad:prioridades(id, nombre)
        `)
        .single();

      if (error) throw createError(500, `Error al cambiar el estado: ${error.message}`);

      await addHistorial(fastify, id, userId, 'estado_cambiado', {
        de: estadoAnterior,
        a:  estado_nombre,
      });

      return {
        message: `Estado cambiado de "${estadoAnterior}" → "${estado_nombre}".`,
        ticket: updated,
      };
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. PATCH /tickets/:id
  //    Edición completa (todos los campos menos estado — usar /estado para eso)
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: any }>(
    '/tickets/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            titulo:           { type: 'string', minLength: 2, maxLength: 200 },
            descripcion:      { type: ['string', 'null'] },
            prioridad_nombre: { type: 'string' },
            asignado_id:      { type: ['string', 'null'] },
            fecha_final:      { type: ['string', 'null'] },
          },
          additionalProperties: false,
        },
      },
    },
    async (req) => {
      const { id } = req.params;
      const userId = req.user.sub;
      const body = req.body as any;

      const ticket = await getTicketOrFail(id);
      await assertCanEdit(ticket, userId);

      if (!body || Object.keys(body).length === 0) {
        throw createError(400, 'No se enviaron campos para actualizar.');
      }

      const updateData: Record<string, any> = {};
      const historialEntries: Array<{ accion: string; detalles: any }> = [];

      if (body.titulo !== undefined) {
        updateData.titulo = body.titulo;
        historialEntries.push({
          accion: 'editado',
          detalles: { campo: 'titulo', anterior: ticket.titulo, nuevo: body.titulo },
        });
      }
      if (body.descripcion !== undefined) {
        updateData.descripcion = body.descripcion;
        historialEntries.push({ accion: 'editado', detalles: { campo: 'descripcion' } });
      }
      if (body.prioridad_nombre !== undefined) {
        updateData.prioridad_id = await resolvePrioridad(body.prioridad_nombre);
        historialEntries.push({
          accion: 'editado',
          detalles: { campo: 'prioridad', nuevo: body.prioridad_nombre },
        });
      }
      if (body.asignado_id !== undefined) {
        // null = desasignar (permitido). UUID = validar que sea miembro del grupo
        if (body.asignado_id !== null) {
          await assertAssignedIsMember(ticket.grupo_id, body.asignado_id);
        }
        updateData.asignado_id = body.asignado_id;
        historialEntries.push({
          accion: 'asignado',
          detalles: { asignado_id: body.asignado_id },
        });
      }
      if (body.fecha_final !== undefined) {
        updateData.fecha_final = body.fecha_final;
        historialEntries.push({
          accion: 'editado',
          detalles: { campo: 'fecha_final', nuevo: body.fecha_final },
        });
      }

      const { data: updated, error } = await fastify.supabase.admin
        .from('tickets')
        .update(updateData)
        .eq('id', id)
        .select(TICKET_SELECT)
        .single();

      if (error) throw createError(500, `Error al actualizar el ticket: ${error.message}`);

      // Registrar todas las entradas de historial en paralelo
      await Promise.all(
        historialEntries.map((h) =>
          addHistorial(fastify, id, userId, h.accion as any, h.detalles),
        ),
      );

      return {
        message: `Ticket "${updated.titulo}" actualizado correctamente.`,
        ticket: updated,
      };
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. DELETE /tickets/:id
  //    admin global OR (autor + ticket_delete contextual)
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/tickets/:id',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      const { id } = req.params;
      const userId = req.user.sub;

      const ticket = await getTicketOrFail(id);

      const admin = await isGlobalAdmin(fastify, userId);
      if (!admin) {
        if (ticket.autor_id !== userId) {
          throw createError(403, 'Solo el autor o un admin pueden eliminar este ticket.');
        }
        const canDelete = await hasGroupPermission(fastify, ticket.grupo_id, userId, 'ticket_delete');
        if (!canDelete) {
          throw createError(403, 'No tienes permiso para eliminar tickets en este grupo.');
        }
      }

      const { error } = await fastify.supabase.admin
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) throw createError(500, `Error al eliminar el ticket: ${error.message}`);

      return { message: `Ticket "${ticket.titulo}" eliminado permanentemente.` };
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. POST /tickets/:id/comentarios
  //    Cualquier miembro que tenga ticket_view en el grupo puede comentar
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/tickets/:id/comentarios',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['contenido'],
          properties: {
            contenido: { type: 'string', minLength: 1, maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user.sub;
      const { contenido } = req.body as any;

      const ticket = await getTicketOrFail(id);

      // Admin/líder pueden siempre comentar
      const seeAll = await canSeeAll(fastify, ticket.grupo_id, userId);
      if (!seeAll) {
        const isMember = await isGroupMember(fastify, ticket.grupo_id, userId);
        if (!isMember) throw createError(403, 'No eres miembro de este grupo.');

        const canView = await hasGroupPermission(fastify, ticket.grupo_id, userId, 'ticket_view');
        if (!canView) throw createError(403, 'No tienes permiso para comentar en tickets de este grupo.');
      }

      const { data: comentario, error } = await fastify.supabase.admin
        .from('comentarios')
        .insert({ ticket_id: id, autor_id: userId, contenido })
        .select(`
          id, contenido, creado_en,
          autor:usuarios!autor_id(id, nombre_completo)
        `)
        .single();

      if (error) throw createError(500, `Error al agregar el comentario: ${error.message}`);

      await addHistorial(fastify, id, userId, 'comentado', {
        preview: contenido.slice(0, 80),
      });

      return reply.code(201).send({
        message: 'Comentario agregado correctamente.',
        comentario,
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. DELETE /tickets/:id/comentarios/:cId
  //     Solo el autor del comentario o un admin global pueden borrarlo
  // ─────────────────────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string; cId: string } }>(
    '/tickets/:id/comentarios/:cId',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      const { id, cId } = req.params;
      const userId = req.user.sub;

      const { data: comentario } = await fastify.supabase.admin
        .from('comentarios')
        .select('id, autor_id, ticket_id')
        .eq('id', cId)
        .eq('ticket_id', id)
        .maybeSingle();

      if (!comentario) throw createError(404, 'Comentario no encontrado.');

      const admin = await isGlobalAdmin(fastify, userId);
      if (!admin && comentario.autor_id !== userId) {
        throw createError(403, 'Solo el autor del comentario o un admin pueden eliminarlo.');
      }

      const { error } = await fastify.supabase.admin
        .from('comentarios')
        .delete()
        .eq('id', cId);

      if (error) throw createError(500, `Error al eliminar el comentario: ${error.message}`);

      return { message: 'Comentario eliminado correctamente.' };
    },
  );
}
