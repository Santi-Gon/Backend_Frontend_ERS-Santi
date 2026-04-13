import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    addUser(dto: CreateUserDto): Promise<{
        message: string;
        user: {
            id: any;
            nombre_completo: any;
            usuario: any;
            email: any;
            fecha_creacion: any;
        };
        permisos_asignados: string[];
    }>;
}
