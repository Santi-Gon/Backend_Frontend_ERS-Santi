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
    // Leer el permiso requerido del decorador @RequirePermission
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la ruta no tiene @RequirePermission, no se verifica permiso
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('No se pudo identificar al usuario.');
    }

    const admin = this.supabaseService.getAdminClient();

    // Verificar si el usuario tiene el permiso requerido en usuario_permisos
    const { data, error } = await admin
      .from('usuario_permisos')
      .select('permisos!inner(nombre)')
      .eq('usuario_id', userId)
      .eq('permisos.nombre', requiredPermission)
      .maybeSingle();

    if (error) {
      throw new ForbiddenException('Error al verificar permisos.');
    }

    if (!data) {
      throw new ForbiddenException(
        `No tienes el permiso requerido: ${requiredPermission}`,
      );
    }

    return true;
  }
}
