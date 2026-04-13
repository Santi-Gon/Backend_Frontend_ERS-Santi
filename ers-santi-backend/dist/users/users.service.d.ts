import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
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
    getMe(userId: string): Promise<{
        permisos: any[];
        id: any;
        nombre_completo: any;
        usuario: any;
        email: any;
        telefono: any;
        direccion: any;
        fecha_nacimiento: any;
        activo: any;
        fecha_creacion: any;
    }>;
    updateMe(userId: string, userEmail: string, dto: UpdateMeDto): Promise<{
        message: string;
        user: {
            id: any;
            nombre_completo: any;
            usuario: any;
            email: any;
            telefono: any;
            direccion: any;
            fecha_nacimiento: any;
            activo: any;
            fecha_creacion: any;
        };
    }>;
    updatePassword(userId: string, userEmail: string, dto: UpdatePasswordDto): Promise<{
        message: string;
    }>;
    deactivateMe(userId: string): Promise<{
        message: string;
    }>;
    getAllUsers(): Promise<{
        permisos: string[];
        id: any;
        nombre_completo: any;
        usuario: any;
        email: any;
        telefono: any;
        activo: any;
        fecha_creacion: any;
    }[]>;
    updateUserAdmin(targetId: string, dto: UpdateUserAdminDto): Promise<{
        message: string;
        user: {
            id: any;
            nombre_completo: any;
            usuario: any;
            email: any;
            activo: any;
            fecha_creacion: any;
        };
    }>;
    deleteUserAdmin(adminId: string, targetId: string): Promise<{
        message: string;
    }>;
    updatePermissions(targetId: string, dto: UpdatePermissionsDto): Promise<{
        message: string;
        permisos_asignados: string[];
    }>;
}
