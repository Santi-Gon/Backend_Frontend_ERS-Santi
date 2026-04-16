import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateLiderDto } from './dto/update-lider.dto';
import { UpdateGroupMemberPermissionsDto } from './dto/update-group-member-permissions.dto';

@Injectable()
export class GruposService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Permisos contextuales (tabla `grupo_usuario_permisos`) que recibe
   * todo miembro al unirse al grupo (incluido el creador al crear el grupo).
   * Deben existir filas con estos `nombre` en la tabla `permisos`.
   * Sin `ticket_delete` por defecto (mínimo privilegio).
   */
  private static readonly DEFAULT_GROUP_MEMBER_PERMISSION_NAMES = [
    'ticket_view',
    'ticket_add',
    'ticket_edit',
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Inserta la plantilla de permisos en el grupo para el usuario.
   * Lanza InternalServerErrorException si falla o faltan permisos en catálogo.
   */
  private async applyDefaultGroupMemberPermissions(
    grupoId: string,
    usuarioId: string,
  ): Promise<void> {
    const admin = this.supabaseService.getAdminClient();
    const names = [...GruposService.DEFAULT_GROUP_MEMBER_PERMISSION_NAMES];

    const { data: permRows, error: permErr } = await admin
      .from('permisos')
      .select('id')
      .in('nombre', names);

    if (permErr) {
      throw new InternalServerErrorException(
        `Error al cargar permisos por defecto del grupo: ${permErr.message}`,
      );
    }

    const ids = (permRows ?? []).map((p: { id: string }) => p.id);
    if (ids.length < names.length) {
      throw new InternalServerErrorException(
        `Faltan permisos en el catálogo (se esperaban: ${names.join(', ')}).`,
      );
    }

    const rows = ids.map((permiso_id) => ({
      grupo_id: grupoId,
      usuario_id: usuarioId,
      permiso_id,
    }));

    const { error: insErr } = await admin
      .from('grupo_usuario_permisos')
      .insert(rows);

    if (insErr) {
      throw new InternalServerErrorException(
        `Error al asignar permisos por defecto en el grupo: ${insErr.message}`,
      );
    }
  }

  /** Verifica si el usuario tiene un permiso global en la tabla usuario_permisos */
  private async hasPermission(userId: string, permission: string): Promise<boolean> {
    const admin = this.supabaseService.getAdminClient();
    const { data } = await admin
      .from('usuario_permisos')
      .select('permisos!inner(nombre)')
      .eq('usuario_id', userId)
      .eq('permisos.nombre', permission)
      .maybeSingle();
    return !!data;
  }

  /** Verifica si el usuario es el líder del grupo */
  private async isGroupLeader(grupoId: string, userId: string): Promise<boolean> {
    const admin = this.supabaseService.getAdminClient();
    const { data } = await admin
      .from('grupos')
      .select('id')
      .eq('id', grupoId)
      .eq('lider_id', userId)
      .maybeSingle();
    return !!data;
  }

  /** Verifica si el usuario es el creador del grupo */
  private async isGroupCreator(grupoId: string, userId: string): Promise<boolean> {
    const admin = this.supabaseService.getAdminClient();
    const { data } = await admin
      .from('grupos')
      .select('id')
      .eq('id', grupoId)
      .eq('creador_id', userId)
      .maybeSingle();
    return !!data;
  }

  /** Verifica si el usuario es miembro del grupo */
  private async isGroupMember(grupoId: string, userId: string): Promise<boolean> {
    const admin = this.supabaseService.getAdminClient();
    const { data } = await admin
      .from('grupo_usuarios')
      .select('grupo_id')
      .eq('grupo_id', grupoId)
      .eq('usuario_id', userId)
      .maybeSingle();
    return !!data;
  }

  /**
   * Lanza ForbiddenException si el usuario NO es líder del grupo
   * Y TAMPOCO tiene el permiso global 'groups_edit'.
   * Un admin (groups_edit) puede gestionar cualquier grupo.
   */
  private async assertLeaderOrAdmin(grupoId: string, userId: string): Promise<void> {
    const [isLeader, canEdit] = await Promise.all([
      this.isGroupLeader(grupoId, userId),
      this.hasPermission(userId, 'groups_edit'),
    ]);
    if (!isLeader && !canEdit) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción. Solo el líder del grupo o un administrador pueden hacerlo.',
      );
    }
  }

  /**
   * Creador, líder o admin global (users_delete) pueden gestionar permisos
   * internos de miembros.
   */
  private async assertCanManageGroupPermissions(
    grupoId: string,
    userId: string,
  ): Promise<{ isCreator: boolean; isLeader: boolean; isAdmin: boolean }> {
    const [isCreator, isLeader, isAdmin] = await Promise.all([
      this.isGroupCreator(grupoId, userId),
      this.isGroupLeader(grupoId, userId),
      this.hasPermission(userId, 'users_delete'),
    ]);

    if (!isCreator && !isLeader && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar permisos internos de este grupo.',
      );
    }

    return { isCreator, isLeader, isAdmin };
  }

  /**
   * Enriquece un array de grupos con:
   *  - autor (nombre del líder)
   *  - integrantes (count)
   *  - members (array de nombres)
   *  - tickets (count de la tabla tickets)
   */
  private async enrichGrupos(grupos: any[]) {
    if (grupos.length === 0) return [];

    const admin = this.supabaseService.getAdminClient();
    const grupoIds = grupos.map((g) => g.id);

    // ── 1. Miembros de los grupos ────────────────────────────────────────────
    const { data: membersData } = await admin
      .from('grupo_usuarios')
      .select('grupo_id, usuarios(id, nombre_completo)')
      .in('grupo_id', grupoIds);

    const membersMap: Record<string, Array<{ id: string; nombre_completo: string }>> = {};
    for (const m of membersData ?? []) {
      const gid = m.grupo_id as string;
      if (!membersMap[gid]) membersMap[gid] = [];
      const u = m.usuarios as any;
      if (u) membersMap[gid].push({ id: u.id, nombre_completo: u.nombre_completo });
    }

    // ── 2. Nombres de los líderes ────────────────────────────────────────────
    const liderIds = [
      ...new Set(grupos.map((g) => g.lider_id).filter(Boolean)),
    ] as string[];

    const { data: lideresData } = await admin
      .from('usuarios')
      .select('id, nombre_completo')
      .in('id', liderIds);

    const lideresMap: Record<string, string> = {};
    for (const l of lideresData ?? []) lideresMap[l.id] = l.nombre_completo;

    // ── 3. Conteo de tickets por grupo ───────────────────────────────────────
    //    La tabla tickets puede no tener registros aún, se maneja gracefully.
    const ticketsCountMap: Record<string, number> = {};
    const { data: ticketsData } = await admin
      .from('tickets')
      .select('grupo_id')
      .in('grupo_id', grupoIds);

    for (const t of ticketsData ?? []) {
      const gid = t.grupo_id as string;
      if (!ticketsCountMap[gid]) ticketsCountMap[gid] = 0;
      ticketsCountMap[gid]++;
    }

    // ── 4. Combinar todo ─────────────────────────────────────────────────────
    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      descripcion: g.descripcion ?? null,
      autor: g.lider_id ? (lideresMap[g.lider_id] ?? null) : null,
      lider_id: g.lider_id ?? null,
      creador_id: g.creador_id ?? null,
      integrantes: (membersMap[g.id] ?? []).length,
      tickets: ticketsCountMap[g.id] ?? 0,
      members: (membersMap[g.id] ?? []).map((m) => m.nombre_completo),
      creado_en: g.creado_en,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. GET /grupos
  //    Usuario ve SOLO sus grupos (donde es miembro).
  //    Admin (users_delete) ve TODOS los grupos.
  // ─────────────────────────────────────────────────────────────────────────────
  async getGrupos(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    const isAdmin = await this.hasPermission(userId, 'users_delete');

    let gruposData: any[];

    if (isAdmin) {
      // Admin ve todo
      const { data, error } = await admin
        .from('grupos')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) {
        throw new InternalServerErrorException(
          `Error al obtener grupos: ${error.message}`,
        );
      }
      gruposData = data ?? [];
    } else {
      // Usuario normal: solo grupos donde es miembro
      const { data: memberData, error: memberError } = await admin
        .from('grupo_usuarios')
        .select('grupo_id')
        .eq('usuario_id', userId);

      if (memberError) {
        throw new InternalServerErrorException(
          `Error al obtener membresías: ${memberError.message}`,
        );
      }

      const grupoIds = (memberData ?? []).map((r: any) => r.grupo_id);
      if (grupoIds.length === 0) return [];

      const { data, error } = await admin
        .from('grupos')
        .select('*')
        .in('id', grupoIds)
        .order('creado_en', { ascending: false });

      if (error) {
        throw new InternalServerErrorException(
          `Error al obtener grupos: ${error.message}`,
        );
      }
      gruposData = data ?? [];
    }

    return this.enrichGrupos(gruposData);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. POST /grupos  (requiere permiso global groups_add)
  //    Crea el grupo y automáticamente agrega al creador como líder y primer miembro.
  // ─────────────────────────────────────────────────────────────────────────────
  async createGrupo(userId: string, dto: CreateGrupoDto) {
    const admin = this.supabaseService.getAdminClient();

    // Crear el grupo con creador_id y lider_id apuntando al usuario actual
    const { data: grupo, error: grupoError } = await admin
      .from('grupos')
      .insert({
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        creador_id: userId,
        lider_id: userId,
      })
      .select('*')
      .single();

    if (grupoError) {
      throw new InternalServerErrorException(
        `Error al crear el grupo: ${grupoError.message}`,
      );
    }

    // Agregar al creador como primer miembro
    const { error: memberError } = await admin
      .from('grupo_usuarios')
      .insert({ grupo_id: grupo.id, usuario_id: userId });

    if (memberError) {
      // Revertir: eliminar el grupo recién creado
      await admin.from('grupos').delete().eq('id', grupo.id);
      throw new InternalServerErrorException(
        `Error al asignarte como miembro del grupo: ${memberError.message}`,
      );
    }

    try {
      await this.applyDefaultGroupMemberPermissions(grupo.id, userId);
    } catch (e) {
      await admin.from('grupo_usuarios').delete().eq('grupo_id', grupo.id).eq('usuario_id', userId);
      await admin.from('grupos').delete().eq('id', grupo.id);
      throw e;
    }

    // Obtener nombre del creador para la respuesta
    const { data: creador } = await admin
      .from('usuarios')
      .select('nombre_completo')
      .eq('id', userId)
      .single();

    return {
      message: `Grupo "${grupo.nombre}" creado correctamente. Eres el líder.`,
      grupo: {
        id: grupo.id,
        nombre: grupo.nombre,
        descripcion: grupo.descripcion,
        autor: creador?.nombre_completo ?? null,
        lider_id: grupo.lider_id,
        creador_id: grupo.creador_id,
        integrantes: 1,
        tickets: 0,
        members: [creador?.nombre_completo ?? userId],
        creado_en: grupo.creado_en,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GET /grupos/:id
  //    Solo miembros del grupo o admins (users_delete) pueden ver el detalle.
  // ─────────────────────────────────────────────────────────────────────────────
  async getGrupoById(userId: string, grupoId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: grupo, error: grupoError } = await admin
      .from('grupos')
      .select('*')
      .eq('id', grupoId)
      .maybeSingle();

    if (grupoError) {
      throw new InternalServerErrorException(
        `Error al buscar el grupo: ${grupoError.message}`,
      );
    }
    if (!grupo) throw new NotFoundException('Grupo no encontrado.');

    // Verificar acceso: debe ser miembro o admin
    const [isMember, isAdmin] = await Promise.all([
      this.isGroupMember(grupoId, userId),
      this.hasPermission(userId, 'users_delete'),
    ]);

    if (!isMember && !isAdmin) {
      throw new ForbiddenException('No eres miembro de este grupo.');
    }

    const enriched = await this.enrichGrupos([grupo]);
    return enriched[0];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PATCH /grupos/:id
  //    Solo el líder del grupo o um admin (groups_edit) pueden editar.
  // ─────────────────────────────────────────────────────────────────────────────
  async updateGrupo(userId: string, grupoId: string, dto: UpdateGrupoDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('grupos')
      .select('id, nombre')
      .eq('id', grupoId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Grupo no encontrado.');

    await this.assertLeaderOrAdmin(grupoId, userId);

    const updateData: Record<string, any> = {};
    if (dto.nombre !== undefined) updateData.nombre = dto.nombre;
    if (dto.descripcion !== undefined) updateData.descripcion = dto.descripcion;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const { data: updated, error: updateError } = await admin
      .from('grupos')
      .update(updateData)
      .eq('id', grupoId)
      .select('id, nombre, descripcion, lider_id, creador_id, creado_en')
      .single();

    if (updateError) {
      throw new InternalServerErrorException(
        `Error al actualizar el grupo: ${updateError.message}`,
      );
    }

    return {
      message: `Grupo "${updated.nombre}" actualizado correctamente.`,
      grupo: updated,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. DELETE /grupos/:id  (requiere permiso global groups_delete)
  //    Hard delete — CASCADE limpia grupo_usuarios y grupo_usuario_permisos.
  // ─────────────────────────────────────────────────────────────────────────────
  async deleteGrupo(grupoId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('grupos')
      .select('id, nombre')
      .eq('id', grupoId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Grupo no encontrado.');

    const { error } = await admin.from('grupos').delete().eq('id', grupoId);

    if (error) {
      throw new InternalServerErrorException(
        `Error al eliminar el grupo: ${error.message}`,
      );
    }

    return {
      message: `Grupo "${existing.nombre}" eliminado permanentemente.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. POST /grupos/:id/miembros
  //    El frontend busca por email. Solo líder o admin (groups_edit) pueden añadir.
  // ─────────────────────────────────────────────────────────────────────────────
  async addMember(userId: string, grupoId: string, dto: AddMemberDto) {
    const admin = this.supabaseService.getAdminClient();

    // Verificar que el grupo existe
    const { data: grupo } = await admin
      .from('grupos')
      .select('id, nombre')
      .eq('id', grupoId)
      .maybeSingle();

    if (!grupo) throw new NotFoundException('Grupo no encontrado.');

    // Solo líder o admin puede agregar miembros
    await this.assertLeaderOrAdmin(grupoId, userId);

    // Buscar el usuario por email en la tabla pública
    const { data: targetUser } = await admin
      .from('usuarios')
      .select('id, nombre_completo, activo')
      .eq('email', dto.email)
      .maybeSingle();

    if (!targetUser) {
      throw new NotFoundException(
        `No se encontró ningún usuario con el email "${dto.email}".`,
      );
    }

    if (!targetUser.activo) {
      throw new BadRequestException(
        'El usuario está inactivo y no puede unirse a grupos.',
      );
    }

    // Verificar que no sea ya miembro
    const alreadyMember = await this.isGroupMember(grupoId, targetUser.id);
    if (alreadyMember) {
      throw new BadRequestException(
        `"${targetUser.nombre_completo}" ya es miembro de este grupo.`,
      );
    }

    const { error } = await admin
      .from('grupo_usuarios')
      .insert({ grupo_id: grupoId, usuario_id: targetUser.id });

    if (error) {
      throw new InternalServerErrorException(
        `Error al agregar el miembro: ${error.message}`,
      );
    }

    try {
      await this.applyDefaultGroupMemberPermissions(grupoId, targetUser.id);
    } catch (e) {
      await admin
        .from('grupo_usuarios')
        .delete()
        .eq('grupo_id', grupoId)
        .eq('usuario_id', targetUser.id);
      throw e;
    }

    return {
      message: `"${targetUser.nombre_completo}" fue agregado al grupo "${grupo.nombre}" correctamente.`,
      miembro: {
        id: targetUser.id,
        nombre_completo: targetUser.nombre_completo,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. DELETE /grupos/:id/miembros/:uid
  //    Solo líder o admin (groups_edit). No se puede remover al líder activo.
  // ─────────────────────────────────────────────────────────────────────────────
  async removeMember(userId: string, grupoId: string, targetUserId: string) {
    const admin = this.supabaseService.getAdminClient();

    // Verificar que el grupo existe y obtener lider_id
    const { data: grupo } = await admin
      .from('grupos')
      .select('id, nombre, lider_id')
      .eq('id', grupoId)
      .maybeSingle();

    if (!grupo) throw new NotFoundException('Grupo no encontrado.');

    // Solo líder o admin puede remover miembros
    await this.assertLeaderOrAdmin(grupoId, userId);

    // No se puede remover al líder actual
    if (grupo.lider_id === targetUserId) {
      throw new BadRequestException(
        'No puedes remover al líder activo del grupo. Cambia el líder primero con PATCH /grupos/:id/lider.',
      );
    }

    // Verificar que el usuario objetivo sea miembro
    const isMember = await this.isGroupMember(grupoId, targetUserId);
    if (!isMember) {
      throw new NotFoundException('El usuario no es miembro de este grupo.');
    }

    // Obtener nombre del usuario objetivo para la respuesta
    const { data: targetUser } = await admin
      .from('usuarios')
      .select('nombre_completo')
      .eq('id', targetUserId)
      .maybeSingle();

    const { error } = await admin
      .from('grupo_usuarios')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('usuario_id', targetUserId);

    if (error) {
      throw new InternalServerErrorException(
        `Error al remover el miembro: ${error.message}`,
      );
    }

    return {
      message: `"${targetUser?.nombre_completo ?? targetUserId}" fue removido del grupo "${grupo.nombre}".`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. PATCH /grupos/:id/lider
  //    Solo líder actual o admin (groups_edit). El nuevo líder debe ser miembro.
  // ─────────────────────────────────────────────────────────────────────────────
  async updateLider(userId: string, grupoId: string, dto: UpdateLiderDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data: grupo } = await admin
      .from('grupos')
      .select('id, nombre, lider_id')
      .eq('id', grupoId)
      .maybeSingle();

    if (!grupo) throw new NotFoundException('Grupo no encontrado.');

    // Solo admin global puede cambiar el líder
    const isGlobalAdmin = await this.hasPermission(userId, 'users_delete');
    if (!isGlobalAdmin) {
      throw new ForbiddenException(
        'Solo un administrador global puede cambiar el líder del grupo.',
      );
    }

    // El nuevo líder ya es el líder
    if (grupo.lider_id === dto.usuario_id) {
      throw new BadRequestException('El usuario ya es el líder de este grupo.');
    }

    // El nuevo líder debe ser miembro del grupo
    const isMember = await this.isGroupMember(grupoId, dto.usuario_id);
    if (!isMember) {
      throw new BadRequestException(
        'El nuevo líder debe ser miembro del grupo antes de ser designado.',
      );
    }

    // Obtener nombre del nuevo líder
    const { data: newLider } = await admin
      .from('usuarios')
      .select('nombre_completo')
      .eq('id', dto.usuario_id)
      .maybeSingle();

    const { data: updated, error } = await admin
      .from('grupos')
      .update({ lider_id: dto.usuario_id })
      .eq('id', grupoId)
      .select('id, nombre, lider_id')
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Error al cambiar el líder: ${error.message}`,
      );
    }

    return {
      message: `"${newLider?.nombre_completo ?? dto.usuario_id}" es ahora el líder del grupo "${updated.nombre}".`,
      grupo: {
        id: updated.id,
        nombre: updated.nombre,
        lider_id: updated.lider_id,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. GET /grupos/:id/permisos-miembros
  //    Solo creador, líder o admin global (users_delete).
  // ─────────────────────────────────────────────────────────────────────────────
  async getGroupMemberPermissions(userId: string, grupoId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: grupo } = await admin
      .from('grupos')
      .select('id, nombre')
      .eq('id', grupoId)
      .maybeSingle();

    if (!grupo) throw new NotFoundException('Grupo no encontrado.');

    await this.assertCanManageGroupPermissions(grupoId, userId);

    const { data: membersData, error: membersError } = await admin
      .from('grupo_usuarios')
      .select('usuario_id, usuarios(id, nombre_completo, email)')
      .eq('grupo_id', grupoId);

    if (membersError) {
      throw new InternalServerErrorException(
        `Error al obtener miembros del grupo: ${membersError.message}`,
      );
    }

    const targetPermissionNames = [
      'ticket_view',
      'ticket_add',
      'ticket_edit',
      'ticket_delete',
    ];

    const { data: availablePermissions, error: availablePermissionsError } = await admin
      .from('permisos')
      .select('id, nombre, descripcion')
      .in('nombre', targetPermissionNames)
      .order('nombre', { ascending: true });

    if (availablePermissionsError) {
      throw new InternalServerErrorException(
        `Error al obtener catálogo de permisos: ${availablePermissionsError.message}`,
      );
    }

    const { data: assignedRows, error: assignedError } = await admin
      .from('grupo_usuario_permisos')
      .select('usuario_id, permisos!inner(nombre)')
      .eq('grupo_id', grupoId);

    if (assignedError) {
      throw new InternalServerErrorException(
        `Error al obtener permisos del grupo: ${assignedError.message}`,
      );
    }

    const permissionsByUserId: Record<string, string[]> = {};
    for (const row of assignedRows ?? []) {
      const uid = row.usuario_id as string;
      const permissionName = (row.permisos as any)?.nombre as string | undefined;
      if (!permissionName) continue;
      if (!permissionsByUserId[uid]) permissionsByUserId[uid] = [];
      permissionsByUserId[uid].push(permissionName);
    }

    const members = (membersData ?? []).map((m: any) => {
      const user = m.usuarios as any;
      return {
        id: m.usuario_id,
        nombre_completo: user?.nombre_completo ?? 'Sin nombre',
        email: user?.email ?? null,
        permission_names: permissionsByUserId[m.usuario_id] ?? [],
      };
    });

    return {
      grupo: {
        id: grupo.id,
        nombre: grupo.nombre,
      },
      available_permissions: availablePermissions ?? [],
      members,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. PATCH /grupos/:id/miembros/:uid/permisos
  //     Creador, líder o admin global pueden editar.
  //     Restricción: si quien edita es el creador, no puede editarse a sí mismo.
  // ─────────────────────────────────────────────────────────────────────────────
  async updateGroupMemberPermissions(
    userId: string,
    grupoId: string,
    targetUserId: string,
    dto: UpdateGroupMemberPermissionsDto,
  ) {
    const admin = this.supabaseService.getAdminClient();

    const { data: grupo } = await admin
      .from('grupos')
      .select('id, nombre')
      .eq('id', grupoId)
      .maybeSingle();
    if (!grupo) throw new NotFoundException('Grupo no encontrado.');

    const access = await this.assertCanManageGroupPermissions(grupoId, userId);
    if (access.isCreator && userId === targetUserId) {
      throw new ForbiddenException(
        'El creador del grupo no puede editar sus propios permisos internos.',
      );
    }

    const isTargetMember = await this.isGroupMember(grupoId, targetUserId);
    if (!isTargetMember) {
      throw new BadRequestException('El usuario objetivo no pertenece a este grupo.');
    }

    const requestedNames = [...new Set(dto.permission_names ?? [])];
    const allowedPermissionNames = [
      'ticket_view',
      'ticket_add',
      'ticket_edit',
      'ticket_delete',
    ];

    const invalidNames = requestedNames.filter(
      (name) => !allowedPermissionNames.includes(name),
    );
    if (invalidNames.length > 0) {
      throw new BadRequestException(
        `Permisos no permitidos para contexto de grupo: ${invalidNames.join(', ')}`,
      );
    }

    const { data: permRows, error: permError } = await admin
      .from('permisos')
      .select('id, nombre')
      .in('nombre', requestedNames);

    if (permError) {
      throw new InternalServerErrorException(
        `Error al validar permisos solicitados: ${permError.message}`,
      );
    }

    if (requestedNames.length > 0 && (permRows ?? []).length !== requestedNames.length) {
      throw new BadRequestException(
        'Uno o más permisos solicitados no existen en el catálogo.',
      );
    }

    const { error: clearError } = await admin
      .from('grupo_usuario_permisos')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('usuario_id', targetUserId);

    if (clearError) {
      throw new InternalServerErrorException(
        `Error al limpiar permisos actuales: ${clearError.message}`,
      );
    }

    if ((permRows ?? []).length > 0) {
      const insertRows = (permRows ?? []).map((p: any) => ({
        grupo_id: grupoId,
        usuario_id: targetUserId,
        permiso_id: p.id,
      }));

      const { error: insertError } = await admin
        .from('grupo_usuario_permisos')
        .insert(insertRows);

      if (insertError) {
        throw new InternalServerErrorException(
          `Error al guardar permisos del miembro: ${insertError.message}`,
        );
      }
    }

    const { data: targetUser } = await admin
      .from('usuarios')
      .select('id, nombre_completo')
      .eq('id', targetUserId)
      .maybeSingle();

    return {
      message: `Permisos internos actualizados para "${targetUser?.nombre_completo ?? targetUserId}" en el grupo "${grupo.nombre}".`,
      member: {
        id: targetUserId,
        nombre_completo: targetUser?.nombre_completo ?? null,
        permission_names: requestedNames,
      },
    };
  }
}
