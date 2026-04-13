import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  Matches,
} from 'class-validator';

/**
 * Todos los campos son opcionales.
 * El usuario solo envía lo que quiere cambiar (PATCH semántico).
 */
export class UpdateMeDto {
  @IsString()
  @IsOptional()
  nombre_completo?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'El usuario solo puede contener letras, números, puntos y guiones bajos.',
  })
  usuario?: string;

  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{10}$/, {
    message: 'El teléfono debe tener exactamente 10 dígitos numéricos.',
  })
  telefono?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsDateString({}, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD.' })
  @IsOptional()
  fecha_nacimiento?: string;
}
