import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: any): Promise<{
        permisos: any[];
        rol: "Admin" | "Editor" | "Viewer";
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
    updateMe(req: any, dto: UpdateMeDto): Promise<{
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
    updatePassword(req: any, dto: UpdatePasswordDto): Promise<{
        message: string;
    }>;
    deactivateMe(req: any): Promise<{
        message: string;
    }>;
    getAllUsers(): Promise<{
        permisos: string[];
        rol: "Admin" | "Editor" | "Viewer";
        id: any;
        nombre_completo: any;
        usuario: any;
        email: any;
        telefono: any;
        activo: any;
        fecha_creacion: any;
    }[]>;
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
    updateUserAdmin(id: string, dto: UpdateUserAdminDto): Promise<{
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
    deleteUserAdmin(req: any, id: string): Promise<{
        message: string;
    }>;
    updatePermissions(id: string, dto: UpdatePermissionsDto): Promise<{
        message: string;
        permisos_asignados: never[];
        rol: string;
    } | {
        message: string;
        permisos_asignados: string[];
        rol: "Admin" | "Editor" | "Viewer";
    }>;
}
