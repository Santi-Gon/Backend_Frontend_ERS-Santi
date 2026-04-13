import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @IsEmail({}, { message: 'El email debe ser un correo electrónico válido.' })
  @IsNotEmpty({ message: 'El email del usuario es requerido.' })
  email: string;
}
