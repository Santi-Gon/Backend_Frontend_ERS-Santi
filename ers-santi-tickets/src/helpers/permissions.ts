import type { FastifyInstance } from 'fastify';

// ─────────────────────────────────────────────────────────────────────────────
// Funciones de permisos reutilizables en todas las rutas de tickets
// ─────────────────────────────────────────────────────────────────────────────

/** Verifica si el usuario tiene un permiso global (tabla usuario_permisos) */
export async function isGlobalAdmin(
  fastify: FastifyInstance,
  userId: string,
): Promise<boolean> {
  return fastify.hasPermission(userId, 'users_delete');
}

/** Verifica si el usuario es el líder del grupo */
export async function isGroupLeader(
  fastify: FastifyInstance,
  grupoId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await fastify.supabase.admin
    .from('grupos')
    .select('id')
    .eq('id', grupoId)
    .eq('lider_id', userId)
    .maybeSingle();
  return !!data;
}

/** Verifica si el usuario es miembro del grupo */
export async function isGroupMember(
  fastify: FastifyInstance,
  grupoId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await fastify.supabase.admin
    .from('grupo_usuarios')
    .select('grupo_id')
    .eq('grupo_id', grupoId)
    .eq('usuario_id', userId)
    .maybeSingle();
  return !!data;
}

/**
 * Verifica si el usuario tiene un permiso CONTEXTUAL en el grupo
 * (tabla grupo_usuario_permisos — diferente al permiso global)
 */
export async function hasGroupPermission(
  fastify: FastifyInstance,
  grupoId: string,
  userId: string,
  permission: string,
): Promise<boolean> {
  const { data } = await fastify.supabase.admin
    .from('grupo_usuario_permisos')
    .select('permisos!inner(nombre)')
    .eq('grupo_id', grupoId)
    .eq('usuario_id', userId)
    .eq('permisos.nombre', permission)
    .maybeSingle();
  return !!data;
}

/**
 * Admin global (users_delete) O líder del grupo → puede ver/gestionar
 * TODOS los tickets del grupo sin necesitar permisos contextuales
 */
export async function canSeeAll(
  fastify: FastifyInstance,
  grupoId: string,
  userId: string,
): Promise<boolean> {
  const [admin, leader] = await Promise.all([
    isGlobalAdmin(fastify, userId),
    isGroupLeader(fastify, grupoId, userId),
  ]);
  return admin || leader;
}
