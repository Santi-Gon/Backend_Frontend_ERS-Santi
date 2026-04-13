import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const admin = this.supabaseService.getAdminClient();
    const anon = this.supabaseService.getAnonClient();

    // 1. Resolver email a partir del identificador
    //    Si contiene "@" asumimos que es email, de lo contrario buscamos por username.
    let email = dto.identifier;

    if (!dto.identifier.includes('@')) {
      const { data: usuarioData, error: usuarioError } = await admin
        .from('usuarios')
        .select('email')
        .eq('usuario', dto.identifier)
        .maybeSingle();

      if (usuarioError || !usuarioData) {
        // Mensaje genérico — no revelamos si el usuario existe o no
        throw new UnauthorizedException('Credenciales incorrectas.');
      }
      email = usuarioData.email as string;
    }

    // 2. Autenticar con Supabase Auth
    const { data: authData, error: authError } =
      await anon.auth.signInWithPassword({
        email,
        password: dto.contrasenia,
      });

    if (authError || !authData.session) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    // 3. Obtener perfil extendido desde la tabla `usuarios`
    const { data: perfil, error: perfilError } = await admin
      .from('usuarios')
      .select('id, nombre_completo, usuario, email, telefono, fecha_creacion')
      .eq('id', authData.user.id)
      .single();

    if (perfilError || !perfil) {
      throw new InternalServerErrorException(
        'No se pudo obtener el perfil del usuario.',
      );
    }

    // 4. Obtener permisos globales del usuario
    const { data: permisosData, error: permisosError } = await admin
      .from('usuario_permisos')
      .select('permisos(nombre)')
      .eq('usuario_id', authData.user.id);

    if (permisosError) {
      throw new InternalServerErrorException(
        'No se pudieron obtener los permisos.',
      );
    }

    // Aplanar la lista de permisos: [{ permisos: { nombre: 'ticket_add' } }] → ['ticket_add']
    const permissions = (permisosData ?? []).map(
      (p: any) => p.permisos?.nombre,
    ).filter(Boolean);

    return {
      access_token: authData.session.access_token,
      token_type: 'Bearer',
      user: perfil,
      permissions,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REGISTER (autoregistro público)
  // ─────────────────────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const admin = this.supabaseService.getAdminClient();

    // 1. Validar que el nombre de usuario no esté ya en uso
    const { data: existing } = await admin
      .from('usuarios')
      .select('id')
      .eq('usuario', dto.usuario)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('El nombre de usuario ya está en uso.');
    }

    // 2. Validar mayoría de edad si se envió fecha de nacimiento
    if (dto.fecha_nacimiento) {
      const hoy = new Date();
      const nacimiento = new Date(dto.fecha_nacimiento);
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
      }
      if (edad < 18) {
        throw new BadRequestException(
          'Debes ser mayor de 18 años para registrarte.',
        );
      }
    }

    // 3. Crear usuario en Supabase Auth
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: dto.email,
        password: dto.contrasenia,
        email_confirm: true, // En dev lo confirmamos automáticamente
        user_metadata: {
          nombre_completo: dto.nombre_completo,
          usuario: dto.usuario,
        },
      });

    if (authError || !authData.user) {
      // Supabase devuelve "User already registered" si el email existe
      if (authError?.message?.toLowerCase().includes('already')) {
        throw new BadRequestException('El email ya está registrado.');
      }
      console.error('[Auth] Error creando usuario en Supabase Auth:', authError);
      throw new InternalServerErrorException(
        authError?.message ?? 'Error al registrar el usuario.',
      );
    }

    // 4. Insertar perfil extendido en la tabla `usuarios`
    const { data: perfil, error: perfilError } = await admin
      .from('usuarios')
      .insert({
        id: authData.user.id, // ← mismo UUID que auth.users
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
      // Logueamos el error real de Supabase para diagnóstico
      console.error('[Auth] Error insertando perfil en tabla usuarios:', perfilError);
      console.error('[Auth] Código de error:', perfilError.code);
      console.error('[Auth] Mensaje de error:', perfilError.message);
      console.error('[Auth] Detalle de error:', perfilError.details);
      // Si el insert falló, eliminamos el usuario de auth para no dejar datos huérfanos
      await admin.auth.admin.deleteUser(authData.user.id);
      throw new InternalServerErrorException(
        `Error al guardar el perfil: ${perfilError.message}`,
      );
    }

    // 5. Asignar permisos básicos por defecto a todo usuario que se registra
    //    Solo ticket_view para mantener el principio de mínimo privilegio.
    //    Un administrador puede ampliar los permisos desde /users/:id/permissions
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
}

