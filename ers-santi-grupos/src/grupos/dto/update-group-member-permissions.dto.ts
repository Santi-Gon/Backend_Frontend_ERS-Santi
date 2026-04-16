import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateGroupMemberPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permission_names!: string[];
}
