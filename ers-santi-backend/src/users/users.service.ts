import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class UsersService {
  constructor(private supabaseService: SupabaseService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: Derivar rol a partir de la lista de permisos
  // Lógica acordada:
  //   Admin  → tiene 'users_delete' (el permiso más privilegiado del sistema)
  //   Editor → tiene algún permiso de _add, _edit o _delete (pero no users_delete)
  //   Viewer → solo tiene permisos de _view o ninguno
  // ─────────────────────────────────────────────────────────────────────────────
  private deriveRol(permissions: string[]): 'Admin' | 'Editor' | 'Viewer' {
    if (permissions.includes('users_delete')) return 'Admin';
    if (
      permissions.some(
        (p) =>
          p.endsWith('_add') || p.endsWith('_edit') || p.endsWith('_delete'),
      )
    )
      return 'Editor';
    return 'Viewer';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /users/add  (admin crea un usuario)
  // ─────────────────────────────────────────────────────────────────────────────
  async addUser(dto: CreateUserDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('usuarios')
      .select('id')
      .eq('usuario', dto.usuario)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('El nombre de usuario ya está en uso.');
    }

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: dto.email,
        password: dto.contrasenia,
        email_confirm: true,
        user_metadata: {
          nombre_completo: dto.nombre_completo,
          usuario: dto.usuario,
        },
      });

    if (authError || !authData.user) {
      if (authError?.message?.toLowerCase().includes('already')) {
        throw new BadRequestException('El email ya está registrado.');
      }
      throw new InternalServerErrorException(
        authError?.message ?? 'Error al crear el usuario en Auth.',
      );
    }

    const newUserId = authData.user.id;

    const { data: perfil, error: perfilError } = await admin
      .from('usuarios')
      .insert({
        id: newUserId,
        nombre_completo: dto.nombre_completo,
        usuario: dto.usuario,
        email: dto.email,
        telefono: dto.telefono,
        direccion: dto.direccion ?? null,
        fecha_nacimiento: dto.fecha_nacimiento ?? null,
      })
      .select('id, nombre_completo, usuario, email, fecha_creacion')
      .single();

    if (perfilError) {
      await admin.auth.admin.deleteUser(newUserId);
      throw new InternalServerErrorException(
        `Error al guardar el perfil: ${perfilError.message}`,
      );
    }

    let permisosAsignados: string[] = [];

    // Si el admin no especificó permisos, asignamos el mínimo por defecto (ticket_view).
    // Si especificó permisos, usamos exactamente los que pidió (pueden ser más o menos).
    const DEFAULT_PERMISSIONS = ['ticket_view'];
    const permisosParaAsignar =
      dto.permisos_iniciales && dto.permisos_iniciales.length > 0
        ? dto.permisos_iniciales
        : DEFAULT_PERMISSIONS;

    const { data: permisosData } = await admin
      .from('permisos')
      .select('id, nombre')
      .in('nombre', permisosParaAsignar);

    if (permisosData && permisosData.length > 0) {
      const inserts = permisosData.map((p) => ({
        usuario_id: newUserId,
        permiso_id: p.id,
      }));
      await admin.from('usuario_permisos').insert(inserts);
      permisosAsignados = permisosData.map((p) => p.nombre as string);
    }

    return {
      message: 'Usuario creado correctamente por el administrador.',
      user: perfil,
      permisos_asignados: permisosAsignados,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // GET /users/me  (perfil propio)
  // ─────────────────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: perfil, error } = await admin
      .from('usuarios')
      .select(
        'id, nombre_completo, usuario, email, telefono, direccion, fecha_nacimiento, activo, fecha_creacion',
      )
      .eq('id', userId)
      .single();

    if (error || !perfil) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const { data: permsData } = await admin
      .from('usuario_permisos')
      .select('permisos(nombre)')
      .eq('usuario_id', userId);

    const permissions = (permsData ?? [])
      .map((p: any) => p.permisos?.nombre)
      .filter(Boolean);

    return {
      ...perfil,
      permisos: permissions,
      rol: this.deriveRol(permissions),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /users/me  (actualizar perfil propio)
  // ─────────────────────────────────────────────────────────────────────────────
  async updateMe(userId: string, userEmail: string, dto: UpdateMeDto) {
    const admin = this.supabaseService.getAdminClient();

    // Verificar unicidad del nuevo username (excluyendo al propio usuario)
    if (dto.usuario) {
      const { data: usernameConflict } = await admin
        .from('usuarios')
        .select('id')
        .eq('usuario', dto.usuario)
        .neq('id', userId)
        .maybeSingle();

      if (usernameConflict) {
        throw new BadRequestException('El nombre de usuario ya está en uso.');
      }
    }

    // Si cambia el email, verificar unicidad y actualizar en Supabase Auth
    if (dto.email && dto.email !== userEmail) {
      const { data: emailConflict } = await admin
        .from('usuarios')
        .select('id')
        .eq('email', dto.email)
        .neq('id', userId)
        .maybeSingle();

      if (emailConflict) {
        throw new BadRequestException('El email ya está en uso por otra cuenta.');
      }

      const { error: authEmailError } =
        await admin.auth.admin.updateUserById(userId, {
          email: dto.email,
          email_confirm: true,
        });

      if (authEmailError) {
        throw new InternalServerErrorException(
          `Error al actualizar el email: ${authEmailError.message}`,
        );
      }
    }

    // Construir objeto de actualización solo con campos enviados
    const updateData: Record<string, any> = {};
    if (dto.nombre_completo !== undefined) updateData.nombre_completo = dto.nombre_completo;
    if (dto.usuario !== undefined)         updateData.usuario = dto.usuario;
    if (dto.email !== undefined)           updateData.email = dto.email;
    if (dto.telefono !== undefined)        updateData.telefono = dto.telefono;
    if (dto.direccion !== undefined)       updateData.direccion = dto.direccion;
    if (dto.fecha_nacimiento !== undefined) updateData.fecha_nacimiento = dto.fecha_nacimiento;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const { data: updated, error: updateError } = await admin
      .from('usuarios')
      .update(updateData)
      .eq('id', userId)
      .select(
        'id, nombre_completo, usuario, email, telefono, direccion, fecha_nacimiento, activo, fecha_creacion',
      )
      .single();

    if (updateError) {
      throw new InternalServerErrorException(
        `Error al actualizar el perfil: ${updateError.message}`,
      );
    }

    return {
      message: 'Perfil actualizado correctamente.',
      user: updated,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /users/me/password  (cambiar contraseña propia)
  // ─────────────────────────────────────────────────────────────────────────────
  async updatePassword(
    userId: string,
    userEmail: string,
    dto: UpdatePasswordDto,
  ) {
    const admin = this.supabaseService.getAdminClient();
    const anon = this.supabaseService.getAnonClient();

    // Verificar contraseña actual intentando hacer login
    const { error: verifyError } = await anon.auth.signInWithPassword({
      email: userEmail,
      password: dto.contrasenia_actual,
    });

    if (verifyError) {
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }

    // Actualizar contraseña en Supabase Auth
    const { error: updateError } =
      await admin.auth.admin.updateUserById(userId, {
        password: dto.nueva_contrasenia,
      });

    if (updateError) {
      throw new InternalServerErrorException(
        `Error al actualizar la contraseña: ${updateError.message}`,
      );
    }

    return {
      message: 'Contraseña actualizada correctamente.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /users/me  (soft delete — baja propia)
  // Pone activo = false. Solo un admin puede reactivarla con PATCH /users/:id
  // ─────────────────────────────────────────────────────────────────────────────
  async deactivateMe(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin
      .from('usuarios')
      .update({ activo: false })
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException(
        `Error al dar de baja la cuenta: ${error.message}`,
      );
    }

    return {
      message:
        'Tu cuenta ha sido dada de baja. Contacta al administrador para reactivarla.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /users  (admin — listar todos los usuarios)
  // Eficiente: 2 queries en lugar de N+1
  // ─────────────────────────────────────────────────────────────────────────────
  async getAllUsers() {
    const admin = this.supabaseService.getAdminClient();

    // Query 1: todos los usuarios
    const { data: users, error: usersError } = await admin
      .from('usuarios')
      .select('id, nombre_completo, usuario, email, telefono, activo, fecha_creacion')
      .order('fecha_creacion', { ascending: false });

    if (usersError) {
      throw new InternalServerErrorException(
        `Error al obtener usuarios: ${usersError.message}`,
      );
    }

    // Query 2: todos los permisos de todos los usuarios en una sola consulta
    const { data: allPerms, error: permsError } = await admin
      .from('usuario_permisos')
      .select('usuario_id, permisos(nombre)');

    if (permsError) {
      throw new InternalServerErrorException(
        `Error al obtener permisos: ${permsError.message}`,
      );
    }

    // Construir mapa: userId → [nombre_permiso1, nombre_permiso2, ...]
    const permsMap: Record<string, string[]> = {};
    for (const entry of allPerms ?? []) {
      const uid = entry.usuario_id as string;
      const pname = (entry.permisos as any)?.nombre as string;
      if (!permsMap[uid]) permsMap[uid] = [];
      if (pname) permsMap[uid].push(pname);
    }

    // Combinar usuarios con sus permisos y rol derivado
    return (users ?? []).map((u) => ({
      ...u,
      permisos: permsMap[u.id] ?? [],
      rol: this.deriveRol(permsMap[u.id] ?? []),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /users/:id  (admin edita datos de otro usuario)
  // ─────────────────────────────────────────────────────────────────────────────
  async updateUserAdmin(targetId: string, dto: UpdateUserAdminDto) {
    const admin = this.supabaseService.getAdminClient();

    // Verificar que el usuario exista
    const { data: existing } = await admin
      .from('usuarios')
      .select('id, email, nombre_completo')
      .eq('id', targetId)
      .maybeSingle();

    if (!existing) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Si cambia el email, verificar unicidad y actualizar en Auth
    if (dto.email && dto.email !== (existing.email as string)) {
      const { data: emailConflict } = await admin
        .from('usuarios')
        .select('id')
        .eq('email', dto.email)
        .neq('id', targetId)
        .maybeSingle();

      if (emailConflict) {
        throw new BadRequestException('El email ya está en uso por otro usuario.');
      }

      const { error: authEmailError } =
        await admin.auth.admin.updateUserById(targetId, {
          email: dto.email,
          email_confirm: true,
        });

      if (authEmailError) {
        throw new InternalServerErrorException(
          `Error al actualizar el email en Auth: ${authEmailError.message}`,
        );
      }
    }

    const updateData: Record<string, any> = {};
    if (dto.nombre_completo !== undefined) updateData.nombre_completo = dto.nombre_completo;
    if (dto.email !== undefined)           updateData.email = dto.email;
    if (dto.activo !== undefined)          updateData.activo = dto.activo;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const { data: updated, error: updateError } = await admin
      .from('usuarios')
      .update(updateData)
      .eq('id', targetId)
      .select('id, nombre_completo, usuario, email, activo, fecha_creacion')
      .single();

    if (updateError) {
      throw new InternalServerErrorException(
        `Error al actualizar el usuario: ${updateError.message}`,
      );
    }

    return {
      message: 'Usuario actualizado correctamente.',
      user: updated,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /users/:id  (admin — eliminar permanentemente)
  // Hard delete: borra de public.usuarios (CASCADE limpia tablas relacionadas)
  // y luego de Supabase Auth.
  // ─────────────────────────────────────────────────────────────────────────────
  async deleteUserAdmin(adminId: string, targetId: string) {
    // Prevenir auto-eliminación del admin
    if (adminId === targetId) {
      throw new ForbiddenException(
        'No puedes eliminar tu propia cuenta. Usa DELETE /users/me para darte de baja.',
      );
    }

    const admin = this.supabaseService.getAdminClient();

    // Verificar que el usuario exista y guardar nombre para la respuesta
    const { data: existing } = await admin
      .from('usuarios')
      .select('id, nombre_completo')
      .eq('id', targetId)
      .maybeSingle();

    if (!existing) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // 1. Eliminar de public.usuarios (ON DELETE CASCADE limpia:
    //    usuario_permisos, grupo_usuarios, grupo_usuario_permisos, historial_tickets, comentarios)
    const { error: dbError } = await admin
      .from('usuarios')
      .delete()
      .eq('id', targetId);

    if (dbError) {
      throw new InternalServerErrorException(
        `Error al eliminar el usuario de la BD: ${dbError.message}`,
      );
    }

    // 2. Eliminar de Supabase Auth
    const { error: authError } =
      await admin.auth.admin.deleteUser(targetId);

    if (authError) {
      // La BD ya está limpia; solo logueamos el error de Auth
      console.error(
        '[Users] Usuario eliminado de BD pero falló en Auth:',
        authError.message,
      );
    }

    return {
      message: `Usuario "${existing.nombre_completo}" eliminado permanentemente.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /users/:id/permissions  (admin — reemplaza TODOS los permisos de un usuario)
  // ─────────────────────────────────────────────────────────────────────────────
  async updatePermissions(targetId: string, dto: UpdatePermissionsDto) {
    const admin = this.supabaseService.getAdminClient();

    // Verificar que el usuario exista
    const { data: existing } = await admin
      .from('usuarios')
      .select('id, nombre_completo')
      .eq('id', targetId)
      .maybeSingle();

    if (!existing) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // 1. Eliminar todos los permisos actuales del usuario
    const { error: deleteError } = await admin
      .from('usuario_permisos')
      .delete()
      .eq('usuario_id', targetId);

    if (deleteError) {
      throw new InternalServerErrorException(
        `Error al limpiar permisos actuales: ${deleteError.message}`,
      );
    }

    // 2. Si el array está vacío, terminamos (usuario sin permisos)
    if (!dto.permisos || dto.permisos.length === 0) {
      return {
        message: `Todos los permisos de "${existing.nombre_completo}" han sido removidos.`,
        permisos_asignados: [],
        rol: 'Viewer',
      };
    }

    // 3. Resolver nombres de permisos a UUIDs en la tabla permisos
    const { data: permisosData, error: resolveError } = await admin
      .from('permisos')
      .select('id, nombre')
      .in('nombre', dto.permisos);

    if (resolveError) {
      throw new InternalServerErrorException(
        `Error al resolver permisos: ${resolveError.message}`,
      );
    }

    // 4. Insertar los nuevos permisos
    if (permisosData && permisosData.length > 0) {
      const inserts = permisosData.map((p) => ({
        usuario_id: targetId,
        permiso_id: p.id,
      }));

      const { error: insertError } = await admin
        .from('usuario_permisos')
        .insert(inserts);

      if (insertError) {
        throw new InternalServerErrorException(
          `Error al asignar nuevos permisos: ${insertError.message}`,
        );
      }
    }

    const assigned = (permisosData ?? []).map((p) => p.nombre as string);

    return {
      message: `Permisos de "${existing.nombre_completo}" actualizados correctamente.`,
      permisos_asignados: assigned,
      rol: this.deriveRol(assigned),
    };
  }
}
