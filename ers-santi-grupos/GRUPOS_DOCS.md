# 🧪 Guía de Pruebas — Microservicio de Grupos

> **Base URL:** `http://localhost:3001/api/v1`
> **Herramienta recomendada:** Thunder Client (VS Code) o Hoppscotch
>
> **Prerequisito:** El microservicio de **Users** (`http://localhost:3000/api/v1`) debe estar corriendo
> para hacer login y obtener el token JWT.

---

## PASO 0 — Obtener token

Todas las rutas de grupos requieren JWT. Haz login en el microservicio de users:

```
Método: POST
URL:    http://localhost:3000/api/v1/auth/login
Header: Content-Type: application/json

Body:
{
  "identifier": "admin",
  "contrasenia": "TuPasswordAqui"
}
```

Copia el `access_token` de la respuesta. En todos los siguientes endpoints agrega:
```
Authorization: Bearer <access_token>
```

---

## ─── BLOQUE 1: CRUD DE GRUPOS ────────────────────────────────────────────────

### 1️⃣ GET /grupos — Ver mis grupos

**Usuario normal** (sin `users_delete`) → solo ve grupos donde es miembro.
**Admin** (tiene `users_delete`) → ve todos los grupos del sistema.

```
Método: GET
URL:    http://localhost:3001/api/v1/grupos
Header: Authorization: Bearer <token>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [
    {
      "id": "uuid-del-grupo",
      "nombre": "Desarrollo Frontend",
      "descripcion": "Equipo encargado de la interfaz.",
      "autor": "Juan Pérez",
      "lider_id": "uuid-del-lider",
      "creador_id": "uuid-del-creador",
      "integrantes": 3,
      "tickets": 5,
      "members": ["Juan Pérez", "María Gómez", "Carlos Ruiz"],
      "creado_en": "2026-04-13T..."
    }
  ]
}
```

**Si el usuario no está en ningún grupo → `"data": []`**

---

### 2️⃣ POST /grupos — Crear un grupo

Requiere `groups_add`. El creador se convierte en **líder** y **primer miembro** automáticamente.

```
Método: POST
URL:    http://localhost:3001/api/v1/grupos
Header: Authorization: Bearer <token_con_groups_add>
        Content-Type: application/json

Body:
{
  "nombre": "Backend Services",
  "descripcion": "Equipo de APIs y base de datos."
}
```

**Body mínimo (sin descripción):**
```json
{
  "nombre": "QA Automation"
}
```

**Respuesta esperada (201):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Grupo \"Backend Services\" creado correctamente. Eres el líder.",
    "grupo": {
      "id": "nuevo-uuid",
      "nombre": "Backend Services",
      "descripcion": "Equipo de APIs y base de datos.",
      "autor": "Admin Principal",
      "lider_id": "tu-uuid",
      "creador_id": "tu-uuid",
      "integrantes": 1,
      "tickets": 0,
      "members": ["Admin Principal"],
      "creado_en": "2026-04-13T..."
    }
  }]
}
```

**Errores a validar:**
- Sin `nombre` → 400 "El nombre del grupo es requerido."
- `nombre` de 1 carácter → 400 "El nombre debe tener al menos 2 caracteres."
- Token sin `groups_add` → 403 Forbidden

> 💾 **Guarda el UUID del grupo creado** — lo necesitas para las siguientes pruebas.

---

### 3️⃣ GET /grupos/:id — Ver detalle de un grupo

Solo miembros del grupo o admin pueden verlo.

```
Método: GET
URL:    http://localhost:3001/api/v1/grupos/<UUID_DEL_GRUPO>
Header: Authorization: Bearer <token>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "id": "...",
    "nombre": "Backend Services",
    "descripcion": "Equipo de APIs y base de datos.",
    "autor": "Admin Principal",
    "lider_id": "...",
    "creador_id": "...",
    "integrantes": 1,
    "tickets": 0,
    "members": ["Admin Principal"],
    "creado_en": "..."
  }]
}
```

**Errores a validar:**
- UUID inexistente → 404 "Grupo no encontrado."
- Token de usuario que NO es miembro ni admin → 403 "No eres miembro de este grupo."

---

### 4️⃣ PATCH /grupos/:id — Editar nombre o descripción

Solo el líder del grupo o un admin con `groups_edit` pueden editar.

```
Método: PATCH
URL:    http://localhost:3001/api/v1/grupos/<UUID_DEL_GRUPO>
Header: Authorization: Bearer <token_lider_o_admin>
        Content-Type: application/json

Body (solo campos a modificar):
{
  "nombre": "Backend Services v2",
  "descripcion": "Equipo actualizado de APIs."
}
```

**Solo descripción:**
```json
{
  "descripcion": "Nueva descripción del equipo."
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Grupo \"Backend Services v2\" actualizado correctamente.",
    "grupo": {
      "id": "...",
      "nombre": "Backend Services v2",
      "descripcion": "Nueva descripción del equipo.",
      "lider_id": "...",
      "creador_id": "...",
      "creado_en": "..."
    }
  }]
}
```

**Errores a validar:**
- Body vacío `{}` → 400 "No se enviaron campos para actualizar."
- Token de miembro que NO es líder ni admin → 403 Forbidden
- UUID inexistente → 404 "Grupo no encontrado."

---

## ─── BLOQUE 2: GESTIÓN DE MIEMBROS ──────────────────────────────────────────

### 5️⃣ POST /grupos/:id/miembros — Agregar miembro por email

Solo el líder o un admin con `groups_edit` pueden agregar miembros. Busca por **email**.

```
Método: POST
URL:    http://localhost:3001/api/v1/grupos/<UUID_DEL_GRUPO>/miembros
Header: Authorization: Bearer <token_lider_o_admin>
        Content-Type: application/json

Body:
{
  "email": "uprueba@ers.com"
}
```

**Respuesta esperada (201):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "\"Usuario Prueba\" fue agregado al grupo \"Backend Services v2\" correctamente.",
    "miembro": {
      "id": "uuid-del-nuevo-miembro",
      "nombre_completo": "Usuario Prueba"
    }
  }]
}
```

**Errores a validar:**
- Email no registrado → 404 "No se encontró ningún usuario con el email..."
- Usuario ya es miembro → 400 "X ya es miembro de este grupo."
- Usuario inactivo → 400 "El usuario está inactivo..."
- Token sin permisos → 403 Forbidden
- Email inválido (sin @) → 400 validación

> Después de esto, haz `GET /grupos/:id` y verifica que `integrantes: 2` y aparece en `members`.

---

### 6️⃣ DELETE /grupos/:id/miembros/:uid — Remover a un miembro

Solo líder o admin con `groups_edit`. No se puede remover al líder activo.

> Usa el UUID del usuario que agregaste con el endpoint anterior.

```
Método: DELETE
URL:    http://localhost:3001/api/v1/grupos/<UUID_DEL_GRUPO>/miembros/<UUID_DEL_MIEMBRO>
Header: Authorization: Bearer <token_lider_o_admin>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "message": "\"Usuario Prueba\" fue removido del grupo \"Backend Services v2\"." }]
}
```

**Errores a validar:**
- Intentar remover al líder → 400 "No puedes remover al líder activo... Cambia el líder primero."
- UUID de miembro no perteneciente al grupo → 404 "El usuario no es miembro."
- Token sin permisos → 403 Forbidden

---

## ─── BLOQUE 3: LIDERAZGO ─────────────────────────────────────────────────────

### 7️⃣ PATCH /grupos/:id/lider — Cambiar el líder del grupo

Solo el líder actual o admin con `groups_edit`. El nuevo líder **debe ser miembro previo**.

> Primero agrega a `uprueba` como miembro (endpoint 5️⃣), luego cámbialo a líder.

```
Método: PATCH
URL:    http://localhost:3001/api/v1/grupos/<UUID_DEL_GRUPO>/lider
Header: Authorization: Bearer <token_lider_o_admin>
        Content-Type: application/json

Body:
{
  "usuario_id": "<UUID_DEL_NUEVO_LIDER>"
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "\"Usuario Prueba\" es ahora el líder del grupo \"Backend Services v2\".",
    "grupo": {
      "id": "...",
      "nombre": "Backend Services v2",
      "lider_id": "<UUID_DEL_NUEVO_LIDER>"
    }
  }]
}
```

**Errores a validar:**
- `usuario_id` que no es UUID válido → 400 validación
- Usuario que no es miembro del grupo → 400 "El nuevo líder debe ser miembro del grupo antes de ser designado."
- Usuario ya es el líder → 400 "El usuario ya es el líder de este grupo."
- UUID de grupo inexistente → 404 "Grupo no encontrado."
- Token sin permisos → 403 Forbidden

---

## ─── BLOQUE 4: ELIMINACIÓN ───────────────────────────────────────────────────

### 8️⃣ DELETE /grupos/:id — Eliminar grupo permanentemente

Requiere permiso global `groups_delete`. **Irreversible** — CASCADE elimina miembros y permisos contextuales.

> Úsalo con un grupo de prueba desechable.

```
Método: DELETE
URL:    http://localhost:3001/api/v1/grupos/<UUID_DEL_GRUPO>
Header: Authorization: Bearer <token_con_groups_delete>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "message": "Grupo \"Backend Services v2\" eliminado permanentemente." }]
}
```

**Errores a validar:**
- Token sin `groups_delete` → 403 Forbidden
- UUID inexistente → 404 "Grupo no encontrado."

---

## 📋 Secuencia de prueba recomendada

```
1.  Login con admin → copia token
2.  POST /grupos → crea "Backend Services"   (guarda UUID)
3.  GET  /grupos  → verifica que aparece (1 grupo)
4.  GET  /grupos/:id → detalle del grupo
5.  PATCH /grupos/:id → edita nombre/descripción
6.  POST /grupos/:id/miembros → agrega uprueba@ers.com
7.  GET  /grupos/:id → verifica integrantes: 2
8.  PATCH /grupos/:id/lider → cambia líder a uprueba
9.  DELETE /grupos/:id/miembros/:uid_admin → intenta remover al admin (ya no es líder, debe funcionar si eres admin)
10. DELETE /grupos/:id/miembros/:uid_lider → debe fallar (es el líder)
11. Crea un segundo grupo y prueba DELETE /grupos/:id con él
```

---

## 📋 Resumen de permisos requeridos

| Endpoint | Permiso / Condición |
|---|---|
| `GET /grupos` | Solo JWT (filtra por membresía) |
| `POST /grupos` | `groups_add` |
| `GET /grupos/:id` | JWT + ser miembro o tener `users_delete` |
| `PATCH /grupos/:id` | JWT + ser líder o tener `groups_edit` |
| `DELETE /grupos/:id` | `groups_delete` |
| `POST /grupos/:id/miembros` | JWT + ser líder o tener `groups_edit` |
| `DELETE /grupos/:id/miembros/:uid` | JWT + ser líder o tener `groups_edit` |
| `PATCH /grupos/:id/lider` | JWT + ser líder o tener `groups_edit` |

---

## 🔑 Permisos relevantes para grupos

```
groups_add      → Crear nuevos grupos
groups_edit     → Editar, agregar/remover miembros, cambiar líder
groups_delete   → Eliminar grupos permanentemente
users_delete    → Admin global: ver todos los grupos (aunque no sea miembro)
```
