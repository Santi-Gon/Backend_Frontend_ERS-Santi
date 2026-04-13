/**
 * SupabaseService
 * Provee dos clientes Supabase:
 *
 * - getAnonClient()  → Usa la anon key. Para operaciones de Auth del usuario
 *                      (signIn, signUp). Respeta las RLS policies.
 *
 * - getAdminClient() → Usa la service_role key. Para operaciones administrativas
 *                      (crear usuarios, leer cualquier tabla, bypassear RLS).
 *                      ⚠️ SOLO usar en el backend, NUNCA exponer al cliente.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    )!;

    this.anonClient = createClient(url, anonKey);
    this.adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getAnonClient(): SupabaseClient {
    return this.anonClient;
  }

  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }
}
