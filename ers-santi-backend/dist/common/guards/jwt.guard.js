"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt = __importStar(require("jsonwebtoken"));
const jwksRsa = require("jwks-rsa");
let JwtGuard = class JwtGuard {
    configService;
    jwksClient;
    constructor(configService) {
        this.configService = configService;
        const supabaseUrl = this.configService.get('SUPABASE_URL');
        this.jwksClient = jwksRsa({
            jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 600000,
        });
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);
        if (!token) {
            throw new common_1.UnauthorizedException('No se proporcionó token de acceso.');
        }
        try {
            const payload = await this.verifyToken(token);
            request.user = payload;
            return true;
        }
        catch {
            throw new common_1.UnauthorizedException('Token inválido o expirado.');
        }
    }
    verifyToken(token) {
        return new Promise((resolve, reject) => {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded || typeof decoded === 'string') {
                return reject(new Error('Token malformado'));
            }
            const alg = decoded.header.alg;
            const kid = decoded.header.kid;
            if (alg === 'HS256') {
                const secret = this.configService.get('SUPABASE_JWT_SECRET');
                try {
                    const payload = jwt.verify(token, secret, {
                        algorithms: ['HS256'],
                    });
                    return resolve(payload);
                }
                catch (e) {
                    return reject(e);
                }
            }
            this.jwksClient.getSigningKey(kid, (err, key) => {
                if (err || !key) {
                    return reject(err ?? new Error(`Clave de firma no encontrada para kid: ${kid}`));
                }
                const publicKey = key.getPublicKey();
                try {
                    const payload = jwt.verify(token, publicKey, {
                        algorithms: [alg],
                    });
                    resolve(payload);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    extractToken(request) {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer '))
            return null;
        return authHeader.substring(7);
    }
};
exports.JwtGuard = JwtGuard;
exports.JwtGuard = JwtGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JwtGuard);
//# sourceMappingURL=jwt.guard.js.map