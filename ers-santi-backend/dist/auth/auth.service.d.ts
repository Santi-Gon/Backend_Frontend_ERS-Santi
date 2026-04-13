import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    login(dto: LoginDto): Promise<{
        access_token: string;
        token_type: string;
        user: {
            id: any;
            nombre_completo: any;
            usuario: any;
            email: any;
            telefono: any;
            fecha_creacion: any;
        };
        permissions: any[];
    }>;
    register(dto: RegisterDto): Promise<{
        message: string;
        user: {
            id: any;
            nombre_completo: any;
            usuario: any;
            email: any;
            fecha_creacion: any;
        };
        permisos_asignados: any[];
    }>;
}
