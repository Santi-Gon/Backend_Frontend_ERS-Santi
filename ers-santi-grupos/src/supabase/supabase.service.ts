import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * SupabaseService — provee dos clientes:
 *
 * getAnonClient()  → clave pública (anon), respeta RLS
 *                    Usado para operaciones del lado del usuario.
 *
 * getAdminClient() → clave service_role, bypasea RLS
 *                    Usado para operaciones administrativas.
 *                    ⚠️ Solo usar en el backend, nunca exponer al cliente.
 */
@Injectable()
export class SupabaseService {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;

    this.anonClient = createClient(url, anonKey);
    this.adminClient = createClient(url, serviceKey, {
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
