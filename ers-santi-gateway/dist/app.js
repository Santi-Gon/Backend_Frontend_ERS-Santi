"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_plugin_1 = __importDefault(require("./plugins/rate-limit.plugin"));
const proxy_plugin_1 = __importDefault(require("./plugins/proxy.plugin"));
async function buildApp() {
    const app = (0, fastify_1.default)({
        logger: {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss' },
            },
        },
    });
    // ── CORS ────────────────────────────────────────────────────────────────
    // El gateway es el ÚNICO punto de acceso desde el Frontend.
    // Solo permite al frontend (4200) comunicarse con él.
    await app.register(cors_1.default, {
        origin: ['http://localhost:4200'],
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    // ── Rate Limiting (Seguridad: DDOS / Abuso) ─────────────────────────────
    await app.register(rate_limit_plugin_1.default);
    // ── Proxy transparente hacia los microservicios ──────────────────────────
    await app.register(proxy_plugin_1.default);
    // ── Health Check propio del Gateway ─────────────────────────────────────
    app.get('/api/v1/health', async () => ({
        service: 'ers-santi-gateway',
        status: 'ok',
        port: process.env.PORT ?? 3003,
    }));
    return app;
}
