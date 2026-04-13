import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateGrupoDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres.' })
  descripcion?: string;
}
