/**
 * PermissionGuard
 * Verifica que el usuario autenticado (ya validado por JwtGuard)
 * tenga el permiso requerido según el decorador @RequirePermission().
 *
 * Flujo:
 * 1. Lee el permiso requerido del metadata del route handler.
 * 2. Obtiene el user_id del payload JWT (request.user.sub).
 * 3. Consulta la tabla usuario_permisos en Supabase.
 * 4. Si tiene el permiso → permite; si no → 403 Forbidden.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la ruta no tiene @RequirePermission, se permite sin verificar
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('No se pudo identificar al usuario.');
    }

    // Consulta: ¿tiene el usuario el permiso requerido?
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('usuario_permisos')
      .select('permiso_id, permisos!inner(nombre)')
      .eq('usuario_id', userId)
      .eq('permisos.nombre', requiredPermission)
      .maybeSingle();

    if (error || !data) {
      throw new ForbiddenException(
        `No tienes el permiso requerido: ${requiredPermission}`,
      );
    }

    return true;
  }
}
