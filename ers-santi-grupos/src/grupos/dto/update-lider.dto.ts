import { IsUUID, IsNotEmpty } from 'class-validator';

export class UpdateLiderDto {
  @IsUUID('4', { message: 'El ID del nuevo líder debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID del nuevo líder es requerido.' })
  usuario_id: string;
}
