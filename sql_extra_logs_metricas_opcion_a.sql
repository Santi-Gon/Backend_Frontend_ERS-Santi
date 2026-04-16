-- ============================================================
-- Logs centralizados + metricas (Opcion A) para Supabase/Postgres
-- ============================================================

CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id TEXT,
    service_name TEXT NOT NULL,      -- gateway | users | grupos | tickets
    endpoint TEXT NOT NULL,          -- ruta recibida
    method TEXT NOT NULL,            -- GET/POST/PATCH/DELETE...
    user_id UUID NULL,               -- sub del JWT si existe
    ip TEXT NULL,
    status_code INT NOT NULL,
    duration_ms INT NOT NULL CHECK (duration_ms >= 0),
    error_message TEXT NULL,
    error_stack TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
    ON request_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_service_endpoint_method
    ON request_logs (service_name, endpoint, method, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_status
    ON request_logs (status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_user
    ON request_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_trace
    ON request_logs (trace_id);

-- ============================================================
-- Consultas de metricas (Opcion A)
-- ============================================================

-- 1) Numero de requests por endpoint (ventana de tiempo)
-- Cambia el intervalo segun necesites: 1 hour, 1 day, 7 days...
-- SELECT
--   service_name,
--   endpoint,
--   method,
--   COUNT(*) AS total_requests
-- FROM request_logs
-- WHERE created_at >= now() - interval '1 day'
-- GROUP BY service_name, endpoint, method
-- ORDER BY total_requests DESC;

-- 2) Tiempo de respuesta promedio por endpoint
-- SELECT
--   service_name,
--   endpoint,
--   method,
--   ROUND(AVG(duration_ms)::numeric, 2) AS avg_duration_ms,
--   MAX(duration_ms) AS max_duration_ms,
--   MIN(duration_ms) AS min_duration_ms,
--   COUNT(*) AS total_requests
-- FROM request_logs
-- WHERE created_at >= now() - interval '1 day'
-- GROUP BY service_name, endpoint, method
-- ORDER BY avg_duration_ms DESC;

-- 3) Top endpoints con mas errores (HTTP >= 500)
-- SELECT
--   service_name,
--   endpoint,
--   method,
--   COUNT(*) AS total_errors
-- FROM request_logs
-- WHERE status_code >= 500
--   AND created_at >= now() - interval '1 day'
-- GROUP BY service_name, endpoint, method
-- ORDER BY total_errors DESC;
