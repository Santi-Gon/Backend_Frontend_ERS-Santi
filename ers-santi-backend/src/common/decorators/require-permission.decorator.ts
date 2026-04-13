/**
 * RequirePermission decorator
 * Uso: @RequirePermission('users_add')
 * Se lee en el PermissionGuard para verificar que el usuario
 * autenticado tenga el permiso requerido.
 */
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
