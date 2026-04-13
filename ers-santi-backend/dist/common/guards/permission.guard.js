"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const require_permission_decorator_1 = require("../decorators/require-permission.decorator");
const supabase_service_1 = require("../../supabase/supabase.service");
let PermissionGuard = class PermissionGuard {
    reflector;
    supabaseService;
    constructor(reflector, supabaseService) {
        this.reflector = reflector;
        this.supabaseService = supabaseService;
    }
    async canActivate(context) {
        const requiredPermission = this.reflector.getAllAndOverride(require_permission_decorator_1.PERMISSION_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredPermission)
            return true;
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.sub;
        if (!userId) {
            throw new common_1.ForbiddenException('No se pudo identificar al usuario.');
        }
        const { data, error } = await this.supabaseService
            .getAdminClient()
            .from('usuario_permisos')
            .select('permiso_id, permisos!inner(nombre)')
            .eq('usuario_id', userId)
            .eq('permisos.nombre', requiredPermission)
            .maybeSingle();
        if (error || !data) {
            throw new common_1.ForbiddenException(`No tienes el permiso requerido: ${requiredPermission}`);
        }
        return true;
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        supabase_service_1.SupabaseService])
], PermissionGuard);
//# sourceMappingURL=permission.guard.js.map