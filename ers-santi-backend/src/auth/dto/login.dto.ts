import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  IsOptional,
  IsDateString,
} from 'class-validator';

/**
 * LoginDto
 * El campo `identifier` acepta tanto email como nombre de usuario.
 * El backend resuelve cuál es cuál antes de llamar a Supabase Auth.
 */
export class LoginDto {
  /**
   * Puede ser el email (juan@ers.com) o el nombre de usuario (jperez).
   * No exponemos qué tipo de dato busca el servidor → evita enumeración.
   */
  @IsString()
  @IsNotEmpty({ message: 'El identificador (email o usuario) es requerido.' })
  identifier: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres.' })
  contrasenia: string;
}
