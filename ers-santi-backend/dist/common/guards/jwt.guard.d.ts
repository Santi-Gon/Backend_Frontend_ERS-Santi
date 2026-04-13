import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class JwtGuard implements CanActivate {
    private configService;
    private jwksClient;
    constructor(configService: ConfigService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private verifyToken;
    private extractToken;
}
