# 🧪 Guía de Pruebas — Microservicio de Tickets (Fastify)

> **Base URL:** `http://localhost:3002/api/v1`
> **Herramienta:** Thunder Client, Hoppscotch o Postman
>
> **Prerequisitos antes de empezar:**
> 1. Los tres microservicios corriendo (`ers-santi-backend :3000`, `ers-santi-grupos :3001`, `ers-santi-tickets :3002`)
> 2. El SQL de seed data ejecutado en Supabase (estados y prioridades)
> 3. Un usuario con permisos contextuales en `grupo_usuario_permisos`

---

## PASO 0 — Setup inicial en Supabase

Verifica que los catálogos tienen datos. Si no, ejecuta esto en el SQL Editor de Supabase:

```sql
INSERT INTO estados (nombre, color, orden) VALUES
  ('pendiente',   '#6b7280', 1),
  ('en progreso', '#3b82f6', 2),
  ('revisión',    '#f59e0b', 3),
  ('finalizada',  '#22c55e', 4);

INSERT INTO prioridades (nombre, orden) VALUES
  ('Alta',  1),
  ('Media', 2),
  ('Baja',  3);
```

Para que un usuario pueda crear tickets en un grupo, necesita el permiso contextual.
Ejecuta esto en Supabase reemplazando los UUIDs con los reales:

```sql
-- Dar ticket_add + ticket_edit + ticket_delete en un grupo a tu usuario admin
INSERT INTO grupo_usuario_permisos (grupo_id, usuario_id, permiso_id)
SELECT
    '<UUID_DEL_GRUPO>',
    '<UUID_DEL_USUARIO>',
    p.id
FROM permisos p
WHERE p.nombre IN ('ticket_add', 'ticket_edit', 'ticket_delete', 'ticket_view')
ON CONFLICT DO NOTHING;
```

---

## PASO 1 — Obtener Token

Login en el microservicio de **users** (no tickets):

```
Método: POST
URL:    http://localhost:3000/api/v1/auth/login
Header: Content-Type: application/json

Body:
{
  "identifier": "tu_usuario_o_email",
  "contrasenia": "tu_password"
}
```

Copia el `access_token` y úsalo en todos los siguientes requests como:
```
Authorization: Bearer <access_token>
```

---

## ─── BLOQUE 1: CATÁLOGOS ─────────────────────────────────────────────────────

### 1️⃣ GET /catalogos/estados — Ver todos los estados

```
Método: GET
URL:    http://localhost:3002/api/v1/catalogos/estados
Header: Authorization: Bearer <token>
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [
    { "id": "uuid", "nombre": "pendiente",   "color": "#6b7280", "orden": 1 },
    { "id": "uuid", "nombre": "en progreso", "color": "#3b82f6", "orden": 2 },
    { "id": "uuid", "nombre": "revisión",    "color": "#f59e0b", "orden": 3 },
    { "id": "uuid", "nombre": "finalizada",  "color": "#22c55e", "orden": 4 }
  ]
}
```

---

### 2️⃣ GET /catalogos/prioridades — Ver todas las prioridades

```
Método: GET
URL:    http://localhost:3002/api/v1/catalogos/prioridades
Header: Authorization: Bearer <token>
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [
    { "id": "uuid", "nombre": "Alta",  "orden": 1 },
    { "id": "uuid", "nombre": "Media", "orden": 2 },
    { "id": "uuid", "nombre": "Baja",  "orden": 3 }
  ]
}
```

---

## ─── BLOQUE 2: CRUD DE TICKETS ───────────────────────────────────────────────

### 3️⃣ POST /tickets — Crear un ticket

Requiere `ticket_add` en `grupo_usuario_permisos` para ese grupo (o ser admin global).

```
Método: POST
URL:    http://localhost:3002/api/v1/tickets
Header: Authorization: Bearer <token>
        Content-Type: application/json

Body (completo):
{
  "grupo_id":         "<UUID_DEL_GRUPO>",
  "titulo":           "Error en login de usuarios",
  "descripcion":      "El botón de login no responde en mobile.",
  "prioridad_nombre": "Alta",
  "estado_nombre":    "pendiente",
  "asignado_id":      "<UUID_DEL_USUARIO_ASIGNADO>",
  "fecha_final":      "2026-05-01T00:00:00Z"
}
```

**Body mínimo (solo campos requeridos):**
```json
{
  "grupo_id":         "<UUID_DEL_GRUPO>",
  "titulo":           "Revisar documentación",
  "prioridad_nombre": "Media"
}
```

> Estado por defecto: `"pendiente"` si no se envía `estado_nombre`

**Respuesta esperada (201):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Ticket \"Error en login de usuarios\" creado correctamente.",
    "ticket": {
      "id": "nuevo-uuid",
      "titulo": "Error en login de usuarios",
      "grupo_id": "...",
      "autor_id": "tu-uuid",
      "estado": { "nombre": "pendiente", "color": "#6b7280" },
      "prioridad": { "nombre": "Alta" },
      "autor": { "id": "...", "nombre_completo": "Tu Nombre" },
      "asignado": { "id": "...", "nombre_completo": "Nombre Asignado" },
      "creado_en": "2026-04-13T..."
    }
  }]
}
```

**Errores a validar:**
- Sin `grupo_id` → 400 validación
- Sin `titulo` → 400 validación
- `prioridad_nombre` inválido (ej: `"Muy Alta"`) → 400 "Prioridad no válida"
- Sin `ticket_add` en grupo → 403 Forbidden
- No ser miembro del grupo → 403

> 💾 **Guarda el UUID del ticket creado.**

---

### 4️⃣ GET /tickets/grupo/:grupoId — Ver tickets del grupo

```
Método: GET
URL:    http://localhost:3002/api/v1/tickets/grupo/<UUID_DEL_GRUPO>
Header: Authorization: Bearer <token>
```

**Sin body.** El backend filtra según quién pregunte:
- Admin o Líder → ve TODOS los tickets
- Miembro con `ticket_view` → solo los suyos (autor o asignado)

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [
    {
      "id": "...",
      "titulo": "Error en login de usuarios",
      "descripcion": "...",
      "estado": { "nombre": "pendiente", "color": "#6b7280" },
      "prioridad": { "nombre": "Alta" },
      "autor": { "id": "...", "nombre_completo": "Juan Pérez" },
      "asignado": { "id": "...", "nombre_completo": "María Gómez" },
      "creado_en": "...",
      "fecha_final": "..."
    }
  ]
}
```

**Errores:**
- No miembro del grupo → 403
- Miembro sin `ticket_view` → 403

---

### 5️⃣ GET /tickets/:id — Ver detalle completo

Incluye historial de cambios y comentarios del ticket.

```
Método: GET
URL:    http://localhost:3002/api/v1/tickets/<UUID_DEL_TICKET>
Header: Authorization: Bearer <token>
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "id": "...",
    "titulo": "Error en login de usuarios",
    "estado": { "nombre": "pendiente", "color": "#6b7280" },
    "prioridad": { "nombre": "Alta" },
    "autor": { "id": "...", "nombre_completo": "Juan Pérez" },
    "asignado": { "id": "...", "nombre_completo": "María Gómez" },
    "historial": [
      {
        "id": "...",
        "accion": "creado",
        "detalles": { "titulo": "Error en login de usuarios" },
        "creado_en": "...",
        "usuario": { "id": "...", "nombre_completo": "Juan Pérez" }
      }
    ],
    "comentarios": []
  }]
}
```

**Errores:**
- UUID inexistente → 404
- No miembro, no admin → 403
- Miembro regular pero sin ser autor/asignado → 403

---

### 6️⃣ PATCH /tickets/:id — Editar ticket

Solo el autor, el asignado o un admin pueden editar.
Requiere `ticket_edit` en `grupo_usuario_permisos`.
Solo envía los campos que quieres cambiar.

```
Método: PATCH
URL:    http://localhost:3002/api/v1/tickets/<UUID_DEL_TICKET>
Header: Authorization: Bearer <token>
        Content-Type: application/json

Body (parcial):
{
  "titulo":           "Error en login — CRÍTICO",
  "descripcion":      "Confirmado en iOS y Android.",
  "prioridad_nombre": "Alta",
  "asignado_id":      "<OTRO_UUID_DE_USUARIO>",
  "fecha_final":      "2026-04-20T00:00:00Z"
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Ticket \"Error en login — CRÍTICO\" actualizado correctamente.",
    "ticket": { ... }
  }]
}
```

**Errores:**
- Body vacío `{}` → 400 "No se enviaron campos"
- No ser autor ni asignado ni admin → 403
- Sin `ticket_edit` en grupo → 403

---

### 7️⃣ PATCH /tickets/:id/estado — Cambiar estado (Kanban)

Para el drag & drop del tablero Kanban. Mismos permisos que editar.

```
Método: PATCH
URL:    http://localhost:3002/api/v1/tickets/<UUID_DEL_TICKET>/estado
Header: Authorization: Bearer <token>
        Content-Type: application/json

Body:
{
  "estado_nombre": "en progreso"
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Estado cambiado de \"pendiente\" → \"en progreso\".",
    "ticket": {
      "id": "...",
      "titulo": "Error en login — CRÍTICO",
      "estado": { "nombre": "en progreso", "color": "#3b82f6" }
    }
  }]
}
```

**Errores:**
- Mismo estado que ya tiene → 400 "El ticket ya está en estado..."
- `estado_nombre` inválido (ej: `"completado"`) → 400
- Sin permisos → 403

> Prueba la secuencia completa: `pendiente` → `en progreso` → `revisión` → `finalizada`

---

### 8️⃣ DELETE /tickets/:id — Eliminar ticket

Solo el **autor** del ticket o un **admin global**. Requiere `ticket_delete` contextual (excepto admin).

```
Método: DELETE
URL:    http://localhost:3002/api/v1/tickets/<UUID_DEL_TICKET>
Header: Authorization: Bearer <token>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "message": "Ticket \"Error en login — CRÍTICO\" eliminado permanentemente." }]
}
```

**Errores:**
- UUID inexistente → 404
- No ser autor ni admin → 403
- Sin `ticket_delete` en grupo → 403

---

## ─── BLOQUE 3: COMENTARIOS ───────────────────────────────────────────────────

### 9️⃣ POST /tickets/:id/comentarios — Agregar comentario

Cualquier miembro del grupo con `ticket_view` (o admin/líder) puede comentar.

```
Método: POST
URL:    http://localhost:3002/api/v1/tickets/<UUID_DEL_TICKET>/comentarios
Header: Authorization: Bearer <token>
        Content-Type: application/json

Body:
{
  "contenido": "Ya identifiqué el problema, es un bug en el interceptor de auth."
}
```

**Respuesta esperada (201):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Comentario agregado correctamente.",
    "comentario": {
      "id": "uuid-comentario",
      "contenido": "Ya identifiqué el problema...",
      "creado_en": "...",
      "autor": { "id": "...", "nombre_completo": "Juan Pérez" }
    }
  }]
}
```

> Después de esto, verifica con `GET /tickets/:id` que el comentario aparece en `comentarios[]`.

**Errores:**
- `contenido` vacío → 400 validación
- Sin acceso al ticket → 403

---

### 🔟 DELETE /tickets/:id/comentarios/:cId — Eliminar comentario

Solo el autor del comentario o un admin global.

```
Método: DELETE
URL:    http://localhost:3002/api/v1/tickets/<UUID_TICKET>/comentarios/<UUID_COMENTARIO>
Header: Authorization: Bearer <token>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "message": "Comentario eliminado correctamente." }]
}
```

---

## ─── BLOQUE 4: HEALTH CHECK ──────────────────────────────────────────────────

```
Método: GET
URL:    http://localhost:3002/api/v1/health
```

Sin token. Confirma que el servidor está activo:
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "service": "ers-santi-tickets", "status": "ok", "port": 3002 }]
}
```

---

## 📋 Secuencia de prueba recomendada

```
1.  GET  /catalogos/estados      → verifica que hay 4 estados
2.  GET  /catalogos/prioridades  → verifica que hay 3 prioridades
3.  POST /tickets                → crea ticket (guarda UUID)
4.  GET  /tickets/grupo/:id      → verifica que aparece (filtrado)
5.  GET  /tickets/:id            → detalle con historial = ["creado"]
6.  PATCH /tickets/:id           → edita título y prioridad
7.  GET  /tickets/:id            → historial ahora tiene 2 entradas
8.  PATCH /tickets/:id/estado    → cambia a "en progreso"
9.  GET  /tickets/:id            → historial tiene entrada "estado_cambiado"
10. POST /tickets/:id/comentarios→ agrega comentario
11. GET  /tickets/:id            → comentarios tiene 1 entrada
12. DELETE /tickets/:id/comentarios/:cId  → elimina comentario
13. DELETE /tickets/:id          → elimina ticket (admin o autor)
```

---

## 📊 Resumen de permisos

| Endpoint | Permiso / Condición |
|---|---|
| `GET /catalogos/*` | Solo JWT |
| `GET /tickets/grupo/:id` | Miembro del grupo. Filtrado según rol |
| `POST /tickets` | `ticket_add` en `grupo_usuario_permisos` \|\| admin global |
| `GET /tickets/:id` | admin/líder → siempre; miembro → solo el suyo + `ticket_view` |
| `PATCH /tickets/:id` | (autor \|\| asignado) + `ticket_edit` en grupo \|\| admin global |
| `PATCH /tickets/:id/estado` | Mismo que PATCH |
| `DELETE /tickets/:id` | (autor + `ticket_delete` en grupo) \|\| admin global |
| `POST /tickets/:id/comentarios` | Miembro con `ticket_view` en grupo \|\| admin/líder |
| `DELETE /tickets/:id/comentarios/:cId` | Autor del comentario \|\| admin global |

---

## 🔑 Permisos contextuales relevantes (en grupo_usuario_permisos)

```
ticket_view    → Ver tickets del grupo (y comentar)
ticket_add     → Crear nuevos tickets en el grupo
ticket_edit    → Editar tickets propios (autor o asignado) en el grupo
ticket_delete  → Eliminar tickets propios en el grupo
```

> **Nota**: Admin global (`users_delete`) y Líder del grupo omiten los permisos contextuales y tienen acceso completo.
