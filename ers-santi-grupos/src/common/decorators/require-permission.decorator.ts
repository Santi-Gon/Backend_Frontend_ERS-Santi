import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

/**
 * Decorador que marca un endpoint con el permiso requerido.
 * El PermissionGuard lo lee con Reflector para verificar en la BD.
 *
 * Uso: @RequirePermission('groups_edit')
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
