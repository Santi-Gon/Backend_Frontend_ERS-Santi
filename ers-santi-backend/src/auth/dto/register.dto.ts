import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido.' })
  nombre_completo: string;

  /**
   * Nombre de usuario único (sin @, sin espacios).
   * Regex: solo letras, números, guiones bajos y puntos.
   */
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es requerido.' })
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message:
      'El usuario solo puede contener letras, números, puntos y guiones bajos.',
  })
  usuario: string;

  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El email es requerido.' })
  email: string;

  /**
   * Mínimo 10 caracteres + al menos un símbolo especial.
   * Espejo exacto de la validación en el frontend Angular.
   */
  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres.' })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'La contraseña debe contener al menos un símbolo especial.',
  })
  contrasenia: string;

  /**
   * Exactamente 10 dígitos numéricos.
   * Matches permite +52, 044... solo si se ajusta el regex.
   * Por ahora: formato Nacional (10 dígitos).
   */
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido.' })
  @Matches(/^[0-9]{10}$/, {
    message: 'El teléfono debe tener exactamente 10 dígitos numéricos.',
  })
  telefono: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  /**
   * Formato ISO 8601: YYYY-MM-DD
   * La validación de mayoría de edad se hace en el service.
   */
  @IsDateString({}, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD.' })
  @IsOptional()
  fecha_nacimiento?: string;
}
