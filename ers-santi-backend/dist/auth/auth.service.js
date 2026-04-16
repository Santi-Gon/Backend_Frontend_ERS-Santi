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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let AuthService = class AuthService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async login(dto) {
        const admin = this.supabaseService.getAdminClient();
        const anon = this.supabaseService.getAnonClient();
        let email = dto.identifier;
        if (!dto.identifier.includes('@')) {
            const { data: usuarioData, error: usuarioError } = await admin
                .from('usuarios')
                .select('email')
                .eq('usuario', dto.identifier)
                .maybeSingle();
            if (usuarioError || !usuarioData) {
                throw new common_1.UnauthorizedException('Credenciales incorrectas.');
            }
            email = usuarioData.email;
        }
        const { data: authData, error: authError } = await anon.auth.signInWithPassword({
            email,
            password: dto.contrasenia,
        });
        if (authError || !authData.session) {
            throw new common_1.UnauthorizedException('Credenciales incorrectas.');
        }
        const { data: perfil, error: perfilError } = await admin
            .from('usuarios')
            .select('id, nombre_completo, usuario, email, telefono, fecha_creacion')
            .eq('id', authData.user.id)
            .single();
        if (perfilError || !perfil) {
            throw new common_1.InternalServerErrorException('No se pudo obtener el perfil del usuario.');
        }
        const { data: permisosData, error: permisosError } = await admin
            .from('usuario_permisos')
            .select('permisos(nombre)')
            .eq('usuario_id', authData.user.id);
        if (permisosError) {
            throw new common_1.InternalServerErrorException('No se pudieron obtener los permisos.');
        }
        const permissions = (permisosData ?? []).map((p) => p.permisos?.nombre).filter(Boolean);
        return {
            access_token: authData.session.access_token,
            token_type: 'Bearer',
            user: perfil,
            permissions,
        };
    }
    async register(dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('usuarios')
            .select('id')
            .eq('usuario', dto.usuario)
            .maybeSingle();
        if (existing) {
            throw new common_1.BadRequestException('El nombre de usuario ya está en uso.');
        }
        if (dto.fecha_nacimiento) {
            const hoy = new Date();
            const nacimiento = new Date(dto.fecha_nacimiento);
            let edad = hoy.getFullYear() - nacimiento.getFullYear();
            const mes = hoy.getMonth() - nacimiento.getMonth();
            if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                edad--;
            }
            if (edad < 18) {
                throw new common_1.BadRequestException('Debes ser mayor de 18 años para registrarte.');
            }
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
            console.error('[Auth] Error creando usuario en Supabase Auth:', authError);
            throw new common_1.InternalServerErrorException(authError?.message ?? 'Error al registrar el usuario.');
        }
        const { data: perfil, error: perfilError } = await admin
            .from('usuarios')
            .insert({
            id: authData.user.id,
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
            console.error('[Auth] Error insertando perfil en tabla usuarios:', perfilError);
            console.error('[Auth] Código de error:', perfilError.code);
            console.error('[Auth] Mensaje de error:', perfilError.message);
            console.error('[Auth] Detalle de error:', perfilError.details);
            await admin.auth.admin.deleteUser(authData.user.id);
            throw new common_1.InternalServerErrorException(`Error al guardar el perfil: ${perfilError.message}`);
        }
        const DEFAULT_PERMISSIONS = ['ticket_view'];
        const { data: defaultPermsData } = await admin
            .from('permisos')
            .select('id, nombre')
            .in('nombre', DEFAULT_PERMISSIONS);
        if (defaultPermsData && defaultPermsData.length > 0) {
            const inserts = defaultPermsData.map((p) => ({
                usuario_id: authData.user.id,
                permiso_id: p.id,
            }));
            await admin.from('usuario_permisos').insert(inserts);
        }
        return {
            message: 'Usuario registrado correctamente.',
            user: perfil,
            permisos_asignados: defaultPermsData?.map((p) => p.nombre) ?? [],
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], AuthService);
//# sourceMappingURL=auth.service.js.map