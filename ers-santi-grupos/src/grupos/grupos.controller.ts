import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GruposService } from './grupos.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateLiderDto } from './dto/update-lider.dto';
import { UpdateGroupMemberPermissionsDto } from './dto/update-group-member-permissions.dto';

@Controller('grupos')
@UseGuards(JwtGuard)
export class GruposController {
  constructor(private gruposService: GruposService) {}

  // ── GET /grupos ───────────────────────────────────────────────────────────
  // Usuario ve sus grupos. Admin (users_delete) ve todos.
  @Get()
  getGrupos(@Req() req: any) {
    return this.gruposService.getGrupos(req.user.sub);
  }

  // ── POST /grupos ──────────────────────────────────────────────────────────
  // Requiere permiso global groups_add.
  // El creador se convierte automáticamente en líder y primer miembro.
  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('groups_add')
  @HttpCode(HttpStatus.CREATED)
  createGrupo(@Req() req: any, @Body() dto: CreateGrupoDto) {
    return this.gruposService.createGrupo(req.user.sub, dto);
  }

  // ── PATCH /grupos/:id/lider ───────────────────────────────────────────────
  // IMPORTANTE: Declarado ANTES de PATCH /:id para evitar colisiones de rutas.
  // Solo líder del grupo o admin (groups_edit) pueden cambiar el líder.
  @Patch(':id/lider')
  updateLider(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLiderDto,
  ) {
    return this.gruposService.updateLider(req.user.sub, id, dto);
  }

  // ── GET /grupos/:id ───────────────────────────────────────────────────────
  // Solo miembros del grupo o admins (users_delete) pueden ver el detalle.
  @Get(':id')
  getGrupoById(@Req() req: any, @Param('id') id: string) {
    return this.gruposService.getGrupoById(req.user.sub, id);
  }

  // ── PATCH /grupos/:id ─────────────────────────────────────────────────────
  // Solo líder o admin (groups_edit) pueden editar nombre y descripción.
  @Patch(':id')
  updateGrupo(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGrupoDto,
  ) {
    return this.gruposService.updateGrupo(req.user.sub, id, dto);
  }

  // ── DELETE /grupos/:id ────────────────────────────────────────────────────
  // Requiere permiso global groups_delete (hard delete con CASCADE).
  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('groups_delete')
  deleteGrupo(@Param('id') id: string) {
    return this.gruposService.deleteGrupo(id);
  }

  // ── POST /grupos/:id/miembros ─────────────────────────────────────────────
  // Busca por email. Solo líder o admin (groups_edit) pueden agregar miembros.
  @Post(':id/miembros')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.gruposService.addMember(req.user.sub, id, dto);
  }

  // ── DELETE /grupos/:id/miembros/:uid ──────────────────────────────────────
  // Solo líder o admin (groups_edit) pueden remover miembros.
  // No se puede remover al líder activo (cambiar líder primero).
  @Delete(':id/miembros/:uid')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('uid') uid: string,
  ) {
    return this.gruposService.removeMember(req.user.sub, id, uid);
  }

  // ── GET /grupos/:id/permisos-miembros ──────────────────────────────────────
  // Solo creador, líder o admin global pueden gestionar permisos internos.
  @Get(':id/permisos-miembros')
  getGroupMemberPermissions(@Req() req: any, @Param('id') id: string) {
    return this.gruposService.getGroupMemberPermissions(req.user.sub, id);
  }

  // ── PUT /grupos/:id/miembros/:uid/permisos ─────────────────────────────────
  // Solo creador, líder o admin global pueden editar permisos internos.
  @Patch(':id/miembros/:uid/permisos')
  updateGroupMemberPermissions(
    @Req() req: any,
    @Param('id') id: string,
    @Param('uid') uid: string,
    @Body() dto: UpdateGroupMemberPermissionsDto,
  ) {
    return this.gruposService.updateGroupMemberPermissions(req.user.sub, id, uid, dto);
  }
}
