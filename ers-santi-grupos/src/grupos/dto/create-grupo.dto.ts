import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateGrupoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del grupo es requerido.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres.' })
  descripcion?: string;
}
