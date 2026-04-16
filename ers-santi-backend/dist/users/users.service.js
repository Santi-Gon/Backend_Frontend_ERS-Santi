"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let UsersService = class UsersService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async addUser(dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('usuarios')
            .select('id')
            .eq('usuario', dto.usuario)
            .maybeSingle();
        if (existing) {
            throw new common_1.BadRequestException('El nombre de usuario ya está en uso.');
        }
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
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
                throw new common_1.BadRequestException('El email ya está registrado.');
            }
            throw new common_1.InternalServerErrorException(authError?.message ?? 'Error al crear el usuario en Auth.');
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
            throw new common_1.InternalServerErrorException(`Error al guardar el perfil: ${perfilError.message}`);
        }
        let permisosAsignados = [];
        const DEFAULT_PERMISSIONS = ['ticket_view'];
        const permisosParaAsignar = dto.permisos_iniciales && dto.permisos_iniciales.length > 0
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
            permisosAsignados = permisosData.map((p) => p.nombre);
        }
        return {
            message: 'Usuario creado correctamente por el administrador.',
            user: perfil,
            permisos_asignados: permisosAsignados,
        };
    }
    async getMe(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: perfil, error } = await admin
            .from('usuarios')
            .select('id, nombre_completo, usuario, email, telefono, direccion, fecha_nacimiento, activo, fecha_creacion')
            .eq('id', userId)
            .single();
        if (error || !perfil) {
            throw new common_1.NotFoundException('Usuario no encontrado.');
        }
        const { data: permsData } = await admin
            .from('usuario_permisos')
            .select('permisos(nombre)')
            .eq('usuario_id', userId);
        const permissions = (permsData ?? [])
            .map((p) => p.permisos?.nombre)
            .filter(Boolean);
        return {
            ...perfil,
            permisos: permissions,
        };
    }
    async updateMe(userId, userEmail, dto) {
        const admin = this.supabaseService.getAdminClient();
        if (dto.usuario) {
            const { data: usernameConflict } = await admin
                .from('usuarios')
                .select('id')
                .eq('usuario', dto.usuario)
                .neq('id', userId)
                .maybeSingle();
            if (usernameConflict) {
                throw new common_1.BadRequestException('El nombre de usuario ya está en uso.');
            }
        }
        if (dto.email && dto.email !== userEmail) {
            const { data: emailConflict } = await admin
                .from('usuarios')
                .select('id')
                .eq('email', dto.email)
                .neq('id', userId)
                .maybeSingle();
            if (emailConflict) {
                throw new common_1.BadRequestException('El email ya está en uso por otra cuenta.');
            }
            const { error: authEmailError } = await admin.auth.admin.updateUserById(userId, {
                email: dto.email,
                email_confirm: true,
            });
            if (authEmailError) {
                throw new common_1.InternalServerErrorException(`Error al actualizar el email: ${authEmailError.message}`);
            }
        }
        const updateData = {};
        if (dto.nombre_completo !== undefined)
            updateData.nombre_completo = dto.nombre_completo;
        if (dto.usuario !== undefined)
            updateData.usuario = dto.usuario;
        if (dto.email !== undefined)
            updateData.email = dto.email;
        if (dto.telefono !== undefined)
            updateData.telefono = dto.telefono;
        if (dto.direccion !== undefined)
            updateData.direccion = dto.direccion;
        if (dto.fecha_nacimiento !== undefined)
            updateData.fecha_nacimiento = dto.fecha_nacimiento;
        if (Object.keys(updateData).length === 0) {
            throw new common_1.BadRequestException('No se enviaron campos para actualizar.');
        }
        const { data: updated, error: updateError } = await admin
            .from('usuarios')
            .update(updateData)
            .eq('id', userId)
            .select('id, nombre_completo, usuario, email, telefono, direccion, fecha_nacimiento, activo, fecha_creacion')
            .single();
        if (updateError) {
            throw new common_1.InternalServerErrorException(`Error al actualizar el perfil: ${updateError.message}`);
        }
        return {
            message: 'Perfil actualizado correctamente.',
            user: updated,
        };
    }
    async updatePassword(userId, userEmail, dto) {
        const admin = this.supabaseService.getAdminClient();
        const anon = this.supabaseService.getAnonClient();
        const { error: verifyError } = await anon.auth.signInWithPassword({
            email: userEmail,
            password: dto.contrasenia_actual,
        });
        if (verifyError) {
            throw new common_1.BadRequestException('La contraseña actual es incorrecta.');
        }
        const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
            password: dto.nueva_contrasenia,
        });
        if (updateError) {
            throw new common_1.InternalServerErrorException(`Error al actualizar la contraseña: ${updateError.message}`);
        }
        return {
            message: 'Contraseña actualizada correctamente.',
        };
    }
    async deactivateMe(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { error } = await admin
            .from('usuarios')
            .update({ activo: false })
            .eq('id', userId);
        if (error) {
            throw new common_1.InternalServerErrorException(`Error al dar de baja la cuenta: ${error.message}`);
        }
        return {
            message: 'Tu cuenta ha sido dada de baja. Contacta al administrador para reactivarla.',
        };
    }
    async getAllUsers() {
        const admin = this.supabaseService.getAdminClient();
        const { data: users, error: usersError } = await admin
            .from('usuarios')
            .select('id, nombre_completo, usuario, email, telefono, activo, fecha_creacion')
            .order('fecha_creacion', { ascending: false });
        if (usersError) {
            throw new common_1.InternalServerErrorException(`Error al obtener usuarios: ${usersError.message}`);
        }
        const { data: allPerms, error: permsError } = await admin
            .from('usuario_permisos')
            .select('usuario_id, permisos(nombre)');
        if (permsError) {
            throw new common_1.InternalServerErrorException(`Error al obtener permisos: ${permsError.message}`);
        }
        const permsMap = {};
        for (const entry of allPerms ?? []) {
            const uid = entry.usuario_id;
            const pname = entry.permisos?.nombre;
            if (!permsMap[uid])
                permsMap[uid] = [];
            if (pname)
                permsMap[uid].push(pname);
        }
        return (users ?? []).map((u) => ({
            ...u,
            permisos: permsMap[u.id] ?? [],
        }));
    }
    async updateUserAdmin(targetId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('usuarios')
            .select('id, email, nombre_completo')
            .eq('id', targetId)
            .maybeSingle();
        if (!existing) {
            throw new common_1.NotFoundException('Usuario no encontrado.');
        }
        if (dto.email && dto.email !== existing.email) {
            const { data: emailConflict } = await admin
                .from('usuarios')
                .select('id')
                .eq('email', dto.email)
                .neq('id', targetId)
                .maybeSingle();
            if (emailConflict) {
                throw new common_1.BadRequestException('El email ya está en uso por otro usuario.');
            }
            const { error: authEmailError } = await admin.auth.admin.updateUserById(targetId, {
                email: dto.email,
                email_confirm: true,
            });
            if (authEmailError) {
                throw new common_1.InternalServerErrorException(`Error al actualizar el email en Auth: ${authEmailError.message}`);
            }
        }
        const updateData = {};
        if (dto.nombre_completo !== undefined)
            updateData.nombre_completo = dto.nombre_completo;
        if (dto.email !== undefined)
            updateData.email = dto.email;
        if (dto.activo !== undefined)
            updateData.activo = dto.activo;
        if (Object.keys(updateData).length === 0) {
            throw new common_1.BadRequestException('No se enviaron campos para actualizar.');
        }
        const { data: updated, error: updateError } = await admin
            .from('usuarios')
            .update(updateData)
            .eq('id', targetId)
            .select('id, nombre_completo, usuario, email, activo, fecha_creacion')
            .single();
        if (updateError) {
            throw new common_1.InternalServerErrorException(`Error al actualizar el usuario: ${updateError.message}`);
        }
        return {
            message: 'Usuario actualizado correctamente.',
            user: updated,
        };
    }
    async deleteUserAdmin(adminId, targetId) {
        if (adminId === targetId) {
            throw new common_1.ForbiddenException('No puedes eliminar tu propia cuenta. Usa DELETE /users/me para darte de baja.');
        }
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('usuarios')
            .select('id, nombre_completo')
            .eq('id', targetId)
            .maybeSingle();
        if (!existing) {
            throw new common_1.NotFoundException('Usuario no encontrado.');
        }
        const { error: dbError } = await admin
            .from('usuarios')
            .delete()
            .eq('id', targetId);
        if (dbError) {
            throw new common_1.InternalServerErrorException(`Error al eliminar el usuario de la BD: ${dbError.message}`);
        }
        const { error: authError } = await admin.auth.admin.deleteUser(targetId);
        if (authError) {
            console.error('[Users] Usuario eliminado de BD pero falló en Auth:', authError.message);
        }
        return {
            message: `Usuario "${existing.nombre_completo}" eliminado permanentemente.`,
        };
    }
    async updatePermissions(targetId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('usuarios')
            .select('id, nombre_completo')
            .eq('id', targetId)
            .maybeSingle();
        if (!existing) {
            throw new common_1.NotFoundException('Usuario no encontrado.');
        }
        const { error: deleteError } = await admin
            .from('usuario_permisos')
            .delete()
            .eq('usuario_id', targetId);
        if (deleteError) {
            throw new common_1.InternalServerErrorException(`Error al limpiar permisos actuales: ${deleteError.message}`);
        }
        if (!dto.permisos || dto.permisos.length === 0) {
            return {
                message: `Todos los permisos de "${existing.nombre_completo}" han sido removidos.`,
                permisos_asignados: [],
            };
        }
        const { data: permisosData, error: resolveError } = await admin
            .from('permisos')
            .select('id, nombre')
            .in('nombre', dto.permisos);
        if (resolveError) {
            throw new common_1.InternalServerErrorException(`Error al resolver permisos: ${resolveError.message}`);
        }
        if (permisosData && permisosData.length > 0) {
            const inserts = permisosData.map((p) => ({
                usuario_id: targetId,
                permiso_id: p.id,
            }));
            const { error: insertError } = await admin
                .from('usuario_permisos')
                .insert(inserts);
            if (insertError) {
                throw new common_1.InternalServerErrorException(`Error al asignar nuevos permisos: ${insertError.message}`);
            }
        }
        const assigned = (permisosData ?? []).map((p) => p.nombre);
        return {
            message: `Permisos de "${existing.nombre_completo}" actualizados correctamente.`,
            permisos_asignados: assigned,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map