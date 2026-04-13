import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Crea un usuario nuevo desde la perspectiva de un administrador.
   *
   * Diferencias con el autoregistro (/auth/register):
   * 1. Requiere JWT + permiso `users_add` (verificado en el guard).
   * 2. Permite asignar permisos iniciales en el mismo request.
   * 3. El admin puede crear usuarios para terceros con cualquier email.
   *
   * Flujo:
   * 1. Verificar unicidad del username.
   * 2. Crear usuario en Supabase Auth (admin API).
   * 3. Insertar perfil extendido en `usuarios`.
   * 4. Si se enviaron permisos_iniciales, resolverlos por nombre y asignarlos.
   * 5. En caso de error en cualquier paso, limpiar lo creado anteriormente.
   */
  async addUser(dto: CreateUserDto) {
    const admin = this.supabaseService.getAdminClient();

    // ── 1. Verificar unicidad del username ──────────────────────────────────
    const { data: existing } = await admin
      .from('usuarios')
      .select('id')
      .eq('usuario', dto.usuario)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('El nombre de usuario ya está en uso.');
    }

    // ── 2. Crear usuario en Supabase Auth ───────────────────────────────────
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

    // ── 3. Insertar perfil en la tabla `usuarios` ───────────────────────────
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
        'Error al guardar el perfil del usuario.',
      );
    }

    // ── 4. Asignar permisos iniciales ───────────────────────────────────────
    let permisosAsignados: string[] = [];

    if (dto.permisos_iniciales && dto.permisos_iniciales.length > 0) {
      // Resolver los nombres de permisos a sus UUIDs
      const { data: permisosData, error: permisosError } = await admin
        .from('permisos')
        .select('id, nombre')
        .in('nombre', dto.permisos_iniciales);

      if (permisosError) {
        // No es un error fatal; el usuario ya fue creado. Solo lo logueamos.
        console.warn(
          'No se pudieron resolver los permisos iniciales:',
          permisosError.message,
        );
      } else if (permisosData && permisosData.length > 0) {
        const inserts = permisosData.map((p) => ({
          usuario_id: newUserId,
          permiso_id: p.id,
        }));

        const { error: assignError } = await admin
          .from('usuario_permisos')
          .insert(inserts);

        if (assignError) {
          console.warn(
            'No se pudieron asignar los permisos iniciales:',
            assignError.message,
          );
        } else {
          permisosAsignados = permisosData.map((p) => p.nombre as string);
        }
      }
    }

    return {
      message: 'Usuario creado correctamente por el administrador.',
      user: perfil,
      permisos_asignados: permisosAsignados,
    };
  }
}
