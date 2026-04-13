import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

@Module({
  controllers: [UsersController],
  /**
   * UsersService  → lógica de negocio
   * JwtGuard      → valida el JWT; necesita ConfigService (inyectado automáticamente
   *                 porque ConfigModule.forRoot({ isGlobal: true }) está en AppModule)
   * PermissionGuard → verifica permisos en BD; necesita Reflector + SupabaseService
   *                   (SupabaseService es global gracias a @Global() en SupabaseModule)
   */
  providers: [UsersService, JwtGuard, PermissionGuard],
})
export class UsersModule {}

