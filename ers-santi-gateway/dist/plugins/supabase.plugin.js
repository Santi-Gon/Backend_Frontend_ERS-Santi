"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const supabase_js_1 = require("@supabase/supabase-js");
async function supabasePlugin(fastify) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error('Faltan variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para logging.');
    }
    const client = (0, supabase_js_1.createClient)(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    fastify.decorate('supabaseAdmin', client);
}
exports.default = (0, fastify_plugin_1.default)(supabasePlugin, { name: 'supabase-plugin' });
