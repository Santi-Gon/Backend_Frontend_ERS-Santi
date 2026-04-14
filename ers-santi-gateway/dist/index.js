"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const app_1 = require("./app");
async function bootstrap() {
    const app = await (0, app_1.buildApp)();
    const port = parseInt(process.env.PORT ?? '3003', 10);
    try {
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`🚀 ERS-Santi API Gateway corriendo en: http://localhost:${port}/api/v1`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
bootstrap();
