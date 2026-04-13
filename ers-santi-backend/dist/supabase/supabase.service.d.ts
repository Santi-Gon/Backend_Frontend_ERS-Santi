import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private configService;
    private anonClient;
    private adminClient;
    constructor(configService: ConfigService);
    getAnonClient(): SupabaseClient;
    getAdminClient(): SupabaseClient;
}
