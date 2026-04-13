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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_me_dto_1 = require("./dto/update-me.dto");
const update_password_dto_1 = require("./dto/update-password.dto");
const update_user_admin_dto_1 = require("./dto/update-user-admin.dto");
const update_permissions_dto_1 = require("./dto/update-permissions.dto");
const jwt_guard_1 = require("../common/guards/jwt.guard");
const permission_guard_1 = require("../common/guards/permission.guard");
const require_permission_decorator_1 = require("../common/decorators/require-permission.decorator");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    getMe(req) {
        return this.usersService.getMe(req.user.sub);
    }
    updateMe(req, dto) {
        return this.usersService.updateMe(req.user.sub, req.user.email, dto);
    }
    updatePassword(req, dto) {
        return this.usersService.updatePassword(req.user.sub, req.user.email, dto);
    }
    deactivateMe(req) {
        return this.usersService.deactivateMe(req.user.sub);
    }
    getAllUsers() {
        return this.usersService.getAllUsers();
    }
    addUser(dto) {
        return this.usersService.addUser(dto);
    }
    updateUserAdmin(id, dto) {
        return this.usersService.updateUserAdmin(id, dto);
    }
    deleteUserAdmin(req, id) {
        return this.usersService.deleteUserAdmin(req.user.sub, id);
    }
    updatePermissions(id, dto) {
        return this.usersService.updatePermissions(id, dto);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_me_dto_1.UpdateMeDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Patch)('me/password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_password_dto_1.UpdatePasswordDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updatePassword", null);
__decorate([
    (0, common_1.Delete)('me'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "deactivateMe", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('users_view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Post)('add'),
    (0, common_1.UseGuards)(permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('users_add'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "addUser", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('users_edit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_admin_dto_1.UpdateUserAdminDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateUserAdmin", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('users_delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "deleteUserAdmin", null);
__decorate([
    (0, common_1.Put)(':id/permissions'),
    (0, common_1.UseGuards)(permission_guard_1.PermissionGuard),
    (0, require_permission_decorator_1.RequirePermission)('users_edit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_permissions_dto_1.UpdatePermissionsDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updatePermissions", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map