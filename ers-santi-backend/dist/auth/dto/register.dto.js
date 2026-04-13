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
exports.RegisterDto = void 0;
const class_validator_1 = require("class-validator");
class RegisterDto {
    nombre_completo;
    usuario;
    email;
    contrasenia;
    telefono;
    direccion;
    fecha_nacimiento;
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre completo es requerido.' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "nombre_completo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre de usuario es requerido.' }),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9._]+$/, {
        message: 'El usuario solo puede contener letras, números, puntos y guiones bajos.',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "usuario", void 0);
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'El email no tiene un formato válido.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El email es requerido.' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10, { message: 'La contraseña debe tener al menos 10 caracteres.' }),
    (0, class_validator_1.Matches)(/[!@#$%^&*(),.?":{}|<>]/, {
        message: 'La contraseña debe contener al menos un símbolo especial.',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "contrasenia", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El teléfono es requerido.' }),
    (0, class_validator_1.Matches)(/^[0-9]{10}$/, {
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos.',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "telefono", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "direccion", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD.' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "fecha_nacimiento", void 0);
//# sourceMappingURL=register.dto.js.map