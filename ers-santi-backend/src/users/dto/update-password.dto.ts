import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es requerida.' })
  contrasenia_actual: string;

  @IsString()
  @MinLength(10, { message: 'La nueva contraseña debe tener al menos 10 caracteres.' })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'La nueva contraseña debe contener al menos un símbolo especial.',
  })
  nueva_contrasenia: string;
}
