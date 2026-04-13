import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

/**
 * UsersController
 *
 * JwtGuard aplicado a NIVEL DE CLASE → todas las rutas requieren JWT válido.
 *
 * Estructura de rutas — IMPORTANTE el orden:
 * Las rutas con segmento fijo ('me', 'me/password', 'add') deben
 * declararse ANTES que las rutas con parámetro dinámico (':id')
 * para evitar colisiones de routing en Express.
 *
 * Rutas propias (solo JWT):
 *   GET    /users/me
 *   PATCH  /users/me
 *   PATCH  /users/me/password
 *   DELETE /users/me
 *
 * Rutas de administrador (JWT + permiso específico):
 *   GET    /users                  → users_view
 *   POST   /users/add              → users_add
 *   PATCH  /users/:id              → users_edit
 *   DELETE /users/:id              → users_delete
 *   PUT    /users/:id/permissions  → users_edit
 */
@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ══ Rutas propias (cualquier usuario autenticado) ══════════════════════════

  /**
   * GET /api/v1/users/me
   * Devuelve el perfil completo del usuario autenticado + permisos + rol derivado.
   */
  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.sub);
  }

  /**
   * PATCH /api/v1/users/me
   * Actualiza datos del perfil propio. Solo los campos enviados son modificados.
   */
  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(req.user.sub, req.user.email, dto);
  }

  /**
   * PATCH /api/v1/users/me/password
   * Cambia la contraseña propia. Requiere enviar la contraseña actual para verificación.
   */
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  updatePassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(
      req.user.sub,
      req.user.email,
      dto,
    );
  }

  /**
   * DELETE /api/v1/users/me
   * Da de baja la cuenta propia (soft delete: activo = false).
   * Solo un administrador puede reactivarla con PATCH /users/:id { activo: true }
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deactivateMe(@Req() req: any) {
    return this.usersService.deactivateMe(req.user.sub);
  }

  // ══ Rutas de administrador (JWT + permiso requerido) ══════════════════════

  /**
   * GET /api/v1/users
   * Lista todos los usuarios con sus permisos y rol derivado.
   * Requiere: users_view
   */
  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('users_view')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  /**
   * POST /api/v1/users/add
   * Crea un nuevo usuario (admin crea para terceros).
   * Requiere: users_add
   */
  @Post('add')
  @UseGuards(PermissionGuard)
  @RequirePermission('users_add')
  addUser(@Body() dto: CreateUserDto) {
    return this.usersService.addUser(dto);
  }

  /**
   * PATCH /api/v1/users/:id
   * Edita nombre, email y/o estado (activo) de un usuario.
   * Requiere: users_edit
   */
  @Patch(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('users_edit')
  updateUserAdmin(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.usersService.updateUserAdmin(id, dto);
  }

  /**
   * DELETE /api/v1/users/:id
   * Eliminación permanente (hard delete) de un usuario.
   * No se puede usar sobre la propia cuenta.
   * Requiere: users_delete
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionGuard)
  @RequirePermission('users_delete')
  deleteUserAdmin(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deleteUserAdmin(req.user.sub, id);
  }

  /**
   * PUT /api/v1/users/:id/permissions
   * Reemplaza TODOS los permisos de un usuario con el array enviado.
   * Para quitar todos los permisos: { "permisos": [] }
   * Requiere: users_edit
   */
  @Put(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('users_edit')
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.usersService.updatePermissions(id, dto);
  }
}
