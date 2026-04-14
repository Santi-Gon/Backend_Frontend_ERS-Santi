import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';

// ── Extiende FastifyInstance para que TypeScript sepa que existe fastify.supabase ──
declare module 'fastify' {
  interface FastifyInstance {
    supabase: {
      /** Cliente anónimo (respeta RLS de Supabase) */
      anon: SupabaseClient;
      /** Cliente de servicio (bypasa RLS, solo usar en el backend) */
      admin: SupabaseClient;
    };
  }
}

async function supabasePlugin(fastify: FastifyInstance) {
  const url       = process.env.SUPABASE_URL;
  const anonKey   = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      '❌ Faltan variables de entorno de Supabase. Verifica tu .env (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)',
    );
  }

  const anonClient = createClient(url, anonKey);

  const adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // decorate: agrega fastify.supabase a la instancia global
  fastify.decorate('supabase', {
    anon: anonClient,
    admin: adminClient,
  });
}

// fp() hace que el plugin sea accesible fuera de su scope (como @Global en NestJS)
export default fp(supabasePlugin, { name: 'supabase-plugin' });
