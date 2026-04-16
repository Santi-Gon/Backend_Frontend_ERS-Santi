"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
function extractUserIdFromAuthHeader(authHeader) {
    if (!authHeader?.startsWith('Bearer '))
        return null;
    try {
        const token = authHeader.slice(7);
        const payloadPart = token.split('.')[1];
        if (!payloadPart)
            return null;
        const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);
        return payload.sub ?? null;
    }
    catch {
        return null;
    }
}
async function requestLogsPlugin(fastify) {
    const serviceName = process.env.SERVICE_NAME ?? 'gateway';
    fastify.addHook('onRequest', async (req) => {
        req._requestStartAt = Date.now();
        req._traceId = req.id;
    });
    fastify.addHook('onResponse', async (req, reply) => {
        if (req.method === 'OPTIONS')
            return;
        if (req._errorLogged)
            return;
        const startedAt = req._requestStartAt ?? Date.now();
        const duration = Math.max(0, Date.now() - startedAt);
        const userId = extractUserIdFromAuthHeader(req.headers.authorization);
        await fastify.supabaseAdmin.from('request_logs').insert({
            trace_id: req._traceId ?? req.id,
            service_name: serviceName,
            endpoint: req.routeOptions?.url ?? req.url,
            method: req.method,
            user_id: userId,
            ip: req.ip,
            status_code: reply.statusCode,
            duration_ms: duration,
            error_message: reply.statusCode >= 500 ? 'HTTP error response' : null,
            error_stack: null,
        });
    });
    fastify.addHook('onError', async (req, reply, error) => {
        if (req.method === 'OPTIONS')
            return;
        req._errorLogged = true;
        const startedAt = req._requestStartAt ?? Date.now();
        const duration = Math.max(0, Date.now() - startedAt);
        const userId = extractUserIdFromAuthHeader(req.headers.authorization);
        await fastify.supabaseAdmin.from('request_logs').insert({
            trace_id: req._traceId ?? req.id,
            service_name: serviceName,
            endpoint: req.routeOptions?.url ?? req.url,
            method: req.method,
            user_id: userId,
            ip: req.ip,
            status_code: reply.statusCode || 500,
            duration_ms: duration,
            error_message: error.message ?? 'Unhandled error',
            error_stack: error.stack?.slice(0, 5000) ?? null,
        });
    });
}
exports.default = (0, fastify_plugin_1.default)(requestLogsPlugin, {
    name: 'request-logs-plugin',
    dependencies: ['supabase-plugin'],
});
