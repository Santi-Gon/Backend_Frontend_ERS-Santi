import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  IsOptional,
  IsDateString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido.' })
  nombre_completo: string;

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
   * El admin le asigna una contraseña temporal al usuario.
   * El usuario deberá cambiarla en su primer acceso (flujo futuro).
   */
  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres.' })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'La contraseña debe contener al menos un símbolo especial.',
  })
  contrasenia: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido.' })
  @Matches(/^[0-9]{10}$/, {
    message: 'El teléfono debe tener exactamente 10 dígitos numéricos.',
  })
  telefono: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsDateString({}, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD.' })
  @IsOptional()
  fecha_nacimiento?: string;

  /**
   * Lista de nombres de permisos a asignar al nuevo usuario.
   * Ejemplo: ['ticket_view', 'ticket_add']
   * Si se omite, el usuario se crea sin permisos.
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permisos_iniciales?: string[];
}
