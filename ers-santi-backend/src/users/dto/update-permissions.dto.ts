import { IsArray, IsString } from 'class-validator';

export class UpdatePermissionsDto {
  /**
   * Lista completa de nombres de permisos que tendrá el usuario.
   * El backend REEMPLAZA todos los permisos actuales con este array.
   * Para eliminar todos los permisos, enviar un array vacío: []
   */
  @IsArray({ message: 'permisos debe ser un array.' })
  @IsString({ each: true, message: 'Cada permiso debe ser un string.' })
  permisos: string[];
}
