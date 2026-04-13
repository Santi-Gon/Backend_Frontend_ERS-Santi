import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
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
