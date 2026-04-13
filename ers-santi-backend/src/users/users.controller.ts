import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users/add
   * Acceso: Solo administradores con permiso `users_add`
   *
   * Guards aplicados en orden:
   * 1. JwtGuard     → verifica que el token sea válido
   * 2. PermissionGuard → verifica que el usuario tenga `users_add`
   */
  @Post('add')
  @UseGuards(JwtGuard, PermissionGuard)
  @RequirePermission('users_add')
  addUser(@Body() dto: CreateUserDto) {
    return this.usersService.addUser(dto);
  }
}
