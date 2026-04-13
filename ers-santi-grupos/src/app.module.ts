import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { GruposModule } from './grupos/grupos.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env globalmente
    ConfigModule.forRoot({ isGlobal: true }),

    // Cliente Supabase disponible en todos los módulos (@Global)
    SupabaseModule,

    // Microservicio de Grupos
    GruposModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
