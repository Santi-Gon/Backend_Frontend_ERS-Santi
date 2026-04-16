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
exports.RequestLogInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const supabase_service_1 = require("../../supabase/supabase.service");
let RequestLogInterceptor = class RequestLogInterceptor {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    intercept(context, next) {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const startedAt = Date.now();
        const serviceName = process.env.SERVICE_NAME ?? 'users';
        const endpoint = req.route?.path ?? req.originalUrl ?? req.url;
        const method = req.method;
        const ip = req.ip;
        const insertLog = async (payload) => {
            const duration = Math.max(0, Date.now() - startedAt);
            const userId = req?.user?.sub ?? null;
            await this.supabaseService.getAdminClient().from('request_logs').insert({
                trace_id: req.headers?.['x-request-id'] ?? null,
                service_name: serviceName,
                endpoint,
                method,
                user_id: userId,
                ip,
                status_code: payload.statusCode,
                duration_ms: duration,
                error_message: payload.errorMessage ?? null,
                error_stack: payload.errorStack ?? null,
            });
        };
        return next.handle().pipe((0, rxjs_1.tap)(async () => {
            if (method === 'OPTIONS')
                return;
            await insertLog({
                statusCode: res.statusCode,
                errorMessage: res.statusCode >= 500 ? 'HTTP error response' : null,
                errorStack: null,
            });
        }), (0, rxjs_1.catchError)((error) => {
            if (method !== 'OPTIONS') {
                void insertLog({
                    statusCode: error?.status ?? 500,
                    errorMessage: error?.message ?? 'Unhandled error',
                    errorStack: error?.stack?.slice(0, 5000) ?? null,
                });
            }
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
};
exports.RequestLogInterceptor = RequestLogInterceptor;
exports.RequestLogInterceptor = RequestLogInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], RequestLogInterceptor);
//# sourceMappingURL=request-log.interceptor.js.map