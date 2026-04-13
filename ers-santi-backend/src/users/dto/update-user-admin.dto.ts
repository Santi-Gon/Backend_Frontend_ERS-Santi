import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

/**
 * Solo un administrador usa este DTO.
 * No incluye `usuario` (username) porque cambiar el username de otro
 * usuario genera confusión; el propio usuario puede cambiarlo desde /users/me.
 */
export class UpdateUserAdminDto {
  @IsString()
  @IsOptional()
  nombre_completo?: string;

  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
