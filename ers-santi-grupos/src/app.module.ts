import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env globalmente
    ConfigModule.forRoot({ isGlobal: true }),

    // Cliente Supabase disponible en todos los módulos (@Global)
    SupabaseModule,

    // Los módulos de negocio se irán agregando aquí:
    // GruposModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
