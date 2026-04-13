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
exports.UpdateMeDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateMeDto {
    nombre_completo;
    usuario;
    email;
    telefono;
    direccion;
    fecha_nacimiento;
}
exports.UpdateMeDto = UpdateMeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMeDto.prototype, "nombre_completo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9._]+$/, {
        message: 'El usuario solo puede contener letras, números, puntos y guiones bajos.',
    }),
    __metadata("design:type", String)
], UpdateMeDto.prototype, "usuario", void 0);
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'El email no tiene un formato válido.' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMeDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[0-9]{10}$/, {
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos.',
    }),
    __metadata("design:type", String)
], UpdateMeDto.prototype, "telefono", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMeDto.prototype, "direccion", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD.' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateMeDto.prototype, "fecha_nacimiento", void 0);
//# sourceMappingURL=update-me.dto.js.map