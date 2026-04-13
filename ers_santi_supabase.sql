-- ============================================================
--  ERS-Santi · Supabase Schema
--  Generado: 2026-03-24
--  Motor:    PostgreSQL (Supabase)
-- ============================================================
-- NOTA: Supabase gestiona la autenticación (email + contraseña)
-- a través de auth.users. La tabla `usuarios` almacena el perfil
-- extendido y referencia auth.users(id).
-- En producción NO almacenes contraseñas en texto plano;
-- usa Supabase Auth y omite el campo `contrasenia`.
-- ============================================================

-- ── Habilitar extensión UUID ─────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
--  LIMPIAR (útil para re-ejecutar en desarrollo)
-- ============================================================
DROP TABLE IF EXISTS grupo_usuario_permisos CASCADE;

DROP TABLE IF EXISTS grupo_usuarios CASCADE;

DROP TABLE IF EXISTS usuario_permisos CASCADE;

DROP TABLE IF EXISTS grupos CASCADE;

DROP TABLE IF EXISTS permisos CASCADE;

DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================
--  1. USUARIOS
--     Perfil extendido. En producción: id → auth.users(id)
-- ============================================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    nombre_completo TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    contrasenia TEXT NOT NULL, -- hash bcrypt en producción
    telefono TEXT, -- TEXT, no INT (acepta +52, 0xx...)
    direccion TEXT,
    fecha_nacimiento DATE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  2. PERMISOS
--     Catálogo de permisos del sistema.
-- ============================================================
CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    nombre TEXT NOT NULL UNIQUE, -- 'ticket_add', 'groups_edit', …
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  3. GRUPOS
-- ============================================================
CREATE TABLE grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    creador_id UUID REFERENCES usuarios (id) ON DELETE SET NULL,
    lider_id UUID REFERENCES usuarios (id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  4. GRUPO_USUARIOS  — membresía (¿quién está en el grupo?)
-- ============================================================
CREATE TABLE grupo_usuarios (
    grupo_id UUID NOT NULL REFERENCES grupos (id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (grupo_id, usuario_id)
);

-- ============================================================
--  5. USUARIO_PERMISOS  — permisos globales del sistema
-- ============================================================
CREATE TABLE usuario_permisos (
    usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, permiso_id)
);

-- ============================================================
--  6. GRUPO_USUARIO_PERMISOS
--     Permisos contextuales: lo que puede hacer un usuario
--     DENTRO de un grupo específico.
--     FK compuesta → garantiza que el usuario sea miembro.
-- ============================================================
CREATE TABLE grupo_usuario_permisos (
    grupo_id UUID NOT NULL,
    usuario_id UUID NOT NULL,
    permiso_id UUID NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
    PRIMARY KEY (
        grupo_id,
        usuario_id,
        permiso_id
    ),
    FOREIGN KEY (grupo_id, usuario_id) REFERENCES grupo_usuarios (grupo_id, usuario_id) ON DELETE CASCADE
);

-- ============================================================
--  ÍNDICES de apoyo
-- ============================================================
CREATE INDEX idx_gu_usuario ON grupo_usuarios (usuario_id);

CREATE INDEX idx_gup_usuario ON grupo_usuario_permisos (usuario_id);

CREATE INDEX idx_gup_grupo ON grupo_usuario_permisos (grupo_id);

CREATE INDEX idx_up_usuario ON usuario_permisos (usuario_id);

-- ============================================================
--  DATOS DE PRUEBA
-- ============================================================

-- ── UUIDs fijos para reproducibilidad ───────────────────────
-- Usuarios
DO $$ BEGIN
    -- Variables de usuarios
    DECLARE
        u1 UUID := 'a1000000-0000-0000-0000-000000000001';
        u2 UUID := 'a1000000-0000-0000-0000-000000000002';
        u3 UUID := 'a1000000-0000-0000-0000-000000000003';
        u4 UUID := 'a1000000-0000-0000-0000-000000000004';
        u5 UUID := 'a1000000-0000-0000-0000-000000000005';

        -- Permisos
        p_ticket_add    UUID := 'b0000000-0000-0000-0000-000000000001';
        p_ticket_edit   UUID := 'b0000000-0000-0000-0000-000000000002';
        p_ticket_delete UUID := 'b0000000-0000-0000-0000-000000000003';
        p_ticket_view   UUID := 'b0000000-0000-0000-0000-000000000004';
        p_groups_add    UUID := 'b0000000-0000-0000-0000-000000000005';
        p_groups_edit   UUID := 'b0000000-0000-0000-0000-000000000006';
        p_groups_delete UUID := 'b0000000-0000-0000-0000-000000000007';
        p_users_add     UUID := 'b0000000-0000-0000-0000-000000000008';
        p_users_edit    UUID := 'b0000000-0000-0000-0000-000000000009';
        p_users_delete  UUID := 'b0000000-0000-0000-0000-000000000010';
        p_users_view    UUID := 'b0000000-0000-0000-0000-000000000011';

        -- Grupos
        g1 UUID := 'c0000000-0000-0000-0000-000000000001';
        g2 UUID := 'c0000000-0000-0000-0000-000000000002';
        g3 UUID := 'c0000000-0000-0000-0000-000000000003';
    BEGIN

    -- ── Usuarios ──────────────────────────────────────────────
    INSERT INTO usuarios (id, nombre_completo, usuario, email, contrasenia, telefono, direccion, fecha_nacimiento)
    VALUES
        (u1, 'Juan Pérez',    'jperez',   'juan.perez@ers.com',    '$2b$12$HASH_SIMULADO_ADMIN',  '5551234567', 'Av. Reforma 100, CDMX',       '1990-05-15'),
        (u2, 'María Gómez',   'mgomez',   'maria.gomez@ers.com',   '$2b$12$HASH_SIMULADO_MARIA',  '5552345678', 'Calle Juárez 55, Guadalajara', '1993-08-22'),
        (u3, 'Carlos Ruiz',   'cruiz',    'carlos.ruiz@ers.com',   '$2b$12$HASH_SIMULADO_CARLOS', '5553456789', 'Blvd. Díaz Ordaz 200, MTY',   '1988-11-30'),
        (u4, 'Ana Flores',    'aflores',  'ana.flores@ers.com',    '$2b$12$HASH_SIMULADO_ANA',    '5554567890', 'Col. Centro, Puebla',          '1995-03-10'),
        (u5, 'Luis Torres',   'ltorres',  'luis.torres@ers.com',   '$2b$12$HASH_SIMULADO_LUIS',   '5555678901', 'Av. Universidad 300, CDMX',   '1991-07-18');

    -- ── Permisos (catálogo completo) ──────────────────────────
    INSERT INTO permisos (id, nombre, descripcion)
    VALUES
        (p_ticket_add,    'ticket_add',    'Crear nuevos tickets'),
        (p_ticket_edit,   'ticket_edit',   'Editar tickets existentes'),
        (p_ticket_delete, 'ticket_delete', 'Eliminar tickets'),
        (p_ticket_view,   'ticket_view',   'Ver tickets'),
        (p_groups_add,    'groups_add',    'Crear nuevos grupos'),
        (p_groups_edit,   'groups_edit',   'Editar grupos existentes'),
        (p_groups_delete, 'groups_delete', 'Eliminar grupos'),
        (p_users_add,     'users_add',     'Crear usuarios'),
        (p_users_edit,    'users_edit',    'Editar usuarios'),
        (p_users_delete,  'users_delete',  'Eliminar usuarios'),
        (p_users_view,    'users_view',    'Ver lista de usuarios');

    -- ── Grupos ────────────────────────────────────────────────
    INSERT INTO grupos (id, nombre, descripcion, creador_id, lider_id)
    VALUES
        (g1, 'Desarrollo Frontend', 'Equipo de interfaz de usuario',    u1, u1),
        (g2, 'Backend Services',    'Equipo de APIs y base de datos',   u2, u2),
        (g3, 'QA & Testing',        'Automatización de pruebas',        u3, u3);

    -- ── Membresías ────────────────────────────────────────────
    INSERT INTO grupo_usuarios (grupo_id, usuario_id)
    VALUES
        -- Grupo 1: Frontend
        (g1, u1), (g1, u2), (g1, u4),
        -- Grupo 2: Backend
        (g2, u2), (g2, u3), (g2, u5),
        -- Grupo 3: QA
        (g3, u3), (g3, u4), (g3, u1);

    -- ── Permisos globales del sistema ─────────────────────────
    -- Juan (admin total)
    INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES
        (u1, p_ticket_add), (u1, p_ticket_edit), (u1, p_ticket_delete), (u1, p_ticket_view),
        (u1, p_groups_add), (u1, p_groups_edit), (u1, p_groups_delete),
        (u1, p_users_add),  (u1, p_users_edit),  (u1, p_users_delete),  (u1, p_users_view);
    -- María (editor de tickets y grupos)
    INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES
        (u2, p_ticket_add), (u2, p_ticket_edit), (u2, p_ticket_view),
        (u2, p_groups_edit);
    -- Carlos (solo vista)
    INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES
        (u3, p_ticket_view);
    -- Ana (editor de tickets)
    INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES
        (u4, p_ticket_add), (u4, p_ticket_edit), (u4, p_ticket_view);
    -- Luis (vista + grupos)
    INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES
        (u5, p_ticket_view), (u5, p_groups_edit);

    -- ── Permisos contextuales por grupo ───────────────────────
    -- Grupo 1 (Frontend): Juan = todo, María = add+edit+view, Ana = view
    INSERT INTO grupo_usuario_permisos (grupo_id, usuario_id, permiso_id) VALUES
        (g1, u1, p_ticket_add),    (g1, u1, p_ticket_edit),
        (g1, u1, p_ticket_delete), (g1, u1, p_ticket_view),
        (g1, u2, p_ticket_add),    (g1, u2, p_ticket_edit),   (g1, u2, p_ticket_view),
        (g1, u4, p_ticket_view);

    -- Grupo 2 (Backend): María = add+edit+view, Carlos = view, Luis = edit+view
    INSERT INTO grupo_usuario_permisos (grupo_id, usuario_id, permiso_id) VALUES
        (g2, u2, p_ticket_add),  (g2, u2, p_ticket_edit),  (g2, u2, p_ticket_view),
        (g2, u3, p_ticket_view),
        (g2, u5, p_ticket_edit), (g2, u5, p_ticket_view);

    -- Grupo 3 (QA): Carlos = view, Ana = add+edit+view, Juan = todo
    INSERT INTO grupo_usuario_permisos (grupo_id, usuario_id, permiso_id) VALUES
        (g3, u3, p_ticket_view),
        (g3, u4, p_ticket_add), (g3, u4, p_ticket_edit), (g3, u4, p_ticket_view),
        (g3, u1, p_ticket_add), (g3, u1, p_ticket_edit), (g3, u1, p_ticket_delete), (g3, u1, p_ticket_view);

    END;
END $$;


-- ============================================================
--  QUERIES REQUERIDAS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Q1. LOGIN
--     Verifica credenciales (en producción usar Supabase Auth)
--     Reemplaza :email y :contrasenia con los valores del form.
-- ────────────────────────────────────────────────────────────
-- Q1a: Login por email
SELECT
    id,
    nombre_completo,
    usuario,
    email,
    fecha_creacion
FROM usuarios
WHERE email      = 'juan.perez@ers.com'
  AND contrasenia = '$2b$12$HASH_SIMULADO_ADMIN';   -- comparar con crypt() en prod

-- Q1b: Login por nombre de usuario
SELECT
    id,
    nombre_completo,
    usuario,
    email,
    fecha_creacion
FROM usuarios
WHERE usuario    = 'jperez'
  AND contrasenia = '$2b$12$HASH_SIMULADO_ADMIN';


-- ────────────────────────────────────────────────────────────
-- Q2. REGISTER USER (autoregistro)
--     El usuario se crea a sí mismo.
-- ────────────────────────────────────────────────────────────
INSERT INTO usuarios (
    nombre_completo,
    usuario,
    email,
    contrasenia,
    telefono,
    direccion,
    fecha_nacimiento
)
VALUES (
    'Nuevo Usuario',
    'nuevousuario',
    'nuevo@ers.com',
    '$2b$12$HASH_NUEVA_CONTRASENIA',   -- siempre hashear antes de insertar
    '5559876543',
    'Calle Falsa 123',
    '2000-01-01'
)
RETURNING id, nombre_completo, email, fecha_creacion;


-- ────────────────────────────────────────────────────────────
-- Q3. CREATE USER (admin crea un usuario)
--     Igual al register pero con control de rol/permisos.
--     Después del INSERT se pueden asignar permisos globales.
-- ────────────────────────────────────────────────────────────
WITH nuevo AS (
    INSERT INTO usuarios (nombre_completo, usuario, email, contrasenia, telefono)
    VALUES ('Sandra López', 'slopez', 'sandra.lopez@ers.com', '$2b$12$HASH', '5550001111')
    RETURNING id
)
INSERT INTO usuario_permisos (usuario_id, permiso_id)
SELECT nuevo.id, p.id
FROM nuevo, permisos p
WHERE p.nombre IN ('ticket_view', 'ticket_add');  -- permisos iniciales


-- ────────────────────────────────────────────────────────────
-- Q4. UPDATE USER PROFILE
--     El usuario actualiza sus propios datos de perfil.
-- ────────────────────────────────────────────────────────────
UPDATE usuarios
SET
    nombre_completo  = 'Juan Pérez Actualizado',
    telefono         = '5551112222',
    direccion        = 'Av. Nueva 500, CDMX',
    fecha_nacimiento = '1990-05-20'
WHERE id = 'a1000000-0000-0000-0000-000000000001'  -- id del usuario actual
RETURNING id, nombre_completo, email, telefono, direccion;


-- ────────────────────────────────────────────────────────────
-- Q5. UPDATE PASSWORD
--     Siempre guardar el hash, nunca la contraseña en texto.
-- ────────────────────────────────────────────────────────────
UPDATE usuarios
SET contrasenia = '$2b$12$NUEVO_HASH_CONTRASENIA'
WHERE id = 'a1000000-0000-0000-0000-000000000001'
RETURNING id, email;


-- ────────────────────────────────────────────────────────────
-- Q6. ASSIGN GLOBAL PERMISSION
--     Dar un permiso global a un usuario.
--     ON CONFLICT DO NOTHING evita duplicados.
-- ────────────────────────────────────────────────────────────
INSERT INTO usuario_permisos (usuario_id, permiso_id)
SELECT
    'a1000000-0000-0000-0000-000000000003',   -- usuario: Carlos
    id
FROM permisos
WHERE nombre = 'ticket_add'
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- Q7. REVOKE GLOBAL PERMISSION
--     Quitar un permiso global a un usuario.
-- ────────────────────────────────────────────────────────────
DELETE FROM usuario_permisos
WHERE usuario_id = 'a1000000-0000-0000-0000-000000000003'
  AND permiso_id = (SELECT id FROM permisos WHERE nombre = 'ticket_add');


-- ────────────────────────────────────────────────────────────
-- Q8. ASSIGN GROUP PERMISSION
--     Dar permiso a un usuario DENTRO de un grupo específico.
--     El usuario debe ser miembro primero (grupo_usuarios).
-- ────────────────────────────────────────────────────────────
-- Paso 1: agregar al grupo (si no está ya)
INSERT INTO grupo_usuarios (grupo_id, usuario_id)
VALUES (
    'c0000000-0000-0000-0000-000000000002',   -- grupo: Backend
    'a1000000-0000-0000-0000-000000000004'    -- usuario: Ana
)
ON CONFLICT DO NOTHING;

-- Paso 2: asignar permiso en ese grupo
INSERT INTO grupo_usuario_permisos (grupo_id, usuario_id, permiso_id)
SELECT
    'c0000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000004',
    p.id
FROM permisos p
WHERE p.nombre = 'ticket_edit'
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- Q9.  CONSULTAS ÚTILES DE APOYO
-- ────────────────────────────────────────────────────────────

-- Q9a: Todos los permisos globales de un usuario
SELECT p.nombre, p.descripcion
FROM usuario_permisos up
JOIN permisos p ON p.id = up.permiso_id
WHERE up.usuario_id = 'a1000000-0000-0000-0000-000000000001'
ORDER BY p.nombre;

-- Q9b: Permisos de un usuario en un grupo específico
SELECT p.nombre, p.descripcion
FROM grupo_usuario_permisos gup
JOIN permisos p ON p.id = gup.permiso_id
WHERE gup.usuario_id = 'a1000000-0000-0000-0000-000000000002'
  AND gup.grupo_id   = 'c0000000-0000-0000-0000-000000000001';

-- Q9c: Todos los miembros de un grupo con sus permisos en ese grupo
SELECT
    u.nombre_completo,
    u.email,
    STRING_AGG(p.nombre, ', ' ORDER BY p.nombre) AS permisos_en_grupo
FROM grupo_usuarios gu
JOIN usuarios u ON u.id = gu.usuario_id
LEFT JOIN grupo_usuario_permisos gup
    ON gup.grupo_id   = gu.grupo_id
   AND gup.usuario_id = gu.usuario_id
LEFT JOIN permisos p ON p.id = gup.permiso_id
WHERE gu.grupo_id = 'c0000000-0000-0000-0000-000000000001'
GROUP BY u.id, u.nombre_completo, u.email
ORDER BY u.nombre_completo;

-- Q9d: Todos los grupos a los que pertenece un usuario
SELECT
    g.nombre       AS grupo,
    g.descripcion,
    ul.nombre_completo AS lider,
    gu.fecha_ingreso
FROM grupo_usuarios gu
JOIN grupos g   ON g.id = gu.grupo_id
LEFT JOIN usuarios ul ON ul.id = g.lider_id
WHERE gu.usuario_id = 'a1000000-0000-0000-0000-000000000001';

-- Q9e: Verificar si un usuario tiene un permiso en un grupo
SELECT EXISTS (
    SELECT 1
    FROM grupo_usuario_permisos gup
    JOIN permisos p ON p.id = gup.permiso_id
    WHERE gup.usuario_id = 'a1000000-0000-0000-0000-000000000002'
      AND gup.grupo_id   = 'c0000000-0000-0000-0000-000000000001'
      AND p.nombre       = 'ticket_add'
) AS tiene_permiso;



-- ESTADOS de ticket
CREATE TABLE estados (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre    TEXT NOT NULL UNIQUE,  -- 'pendiente', 'en progreso', 'revisión', 'finalizada'
    color     TEXT NOT NULL,         -- '#6b7280' / '#3b82f6' / '#f59e0b' / '#22c55e'
    orden     INT  NOT NULL DEFAULT 0
);

-- PRIORIDADES de ticket
CREATE TABLE prioridades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    nombre TEXT NOT NULL UNIQUE, -- 'Alta', 'Media', 'Baja'
    orden INT NOT NULL -- 1=Alta, 2=Media, 3=Baja
);

-- TICKETS
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    grupo_id UUID NOT NULL REFERENCES grupos (id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    autor_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE SET NULL,
    asignado_id UUID REFERENCES usuarios (id) ON DELETE SET NULL,
    estado_id UUID NOT NULL REFERENCES estados (id),
    prioridad_id UUID NOT NULL REFERENCES prioridades (id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_final TIMESTAMPTZ
);

-- HISTORIAL de cambios de estado
CREATE TABLE historial_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    ticket_id UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios (id) ON DELETE SET NULL,
    accion TEXT NOT NULL, -- 'estado_cambiado', 'asignado', 'editado', 'creado'
    detalles JSONB, -- { "de": "pendiente", "a": "en progreso" }
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COMENTARIOS
CREATE TABLE comentarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    ticket_id UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE SET NULL,
    contenido TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);