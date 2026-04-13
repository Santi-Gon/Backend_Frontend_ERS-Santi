import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env globalmente
    ConfigModule.forRoot({ isGlobal: true }),

    // Cliente Supabase disponible en todos los módulos (@Global)
    SupabaseModule,

    // Módulo de autenticación
    AuthModule,

    // Módulo de usuarios (solo admin por ahora)
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

