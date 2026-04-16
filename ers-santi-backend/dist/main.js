"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.use((req, res, next) => {
        if (req.method === 'OPTIONS')
            return next();
        const secret = req.headers['x-internal-secret'];
        if (!secret || secret !== process.env.INTERNAL_SECRET) {
            return res.status(403).json({
                statusCode: 403,
                intOpCode: 1,
                data: [{ message: 'Acceso no autorizado. Usa el API Gateway.' }],
            });
        }
        next();
    });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`🚀 ERS-Santi Backend corriendo en: http://localhost:${port}/api/v1`);
}
bootstrap();
//# sourceMappingURL=main.js.map