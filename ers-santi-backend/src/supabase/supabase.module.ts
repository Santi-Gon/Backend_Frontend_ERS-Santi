import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/**
 * @Global() hace que SupabaseService esté disponible en todos los módulos
 * sin necesidad de importar SupabaseModule en cada uno.
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
