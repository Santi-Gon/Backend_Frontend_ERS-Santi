# 📚 ERS-Santi Backend — Guía Completa

> **Stack:** NestJS + Supabase (PostgreSQL)
> **Base URL:** `http://localhost:3000/api/v1`
> **Para arrancar:** `npm run start:dev` desde la carpeta `ers-santi-backend`

---

## 🗂️ Mapa completo de archivos

```
ers-santi-backend/
├── .env                                   ← Variables de entorno (keys de Supabase)
├── src/
│   ├── main.ts                            ← Punto de entrada de la aplicación
│   ├── app.module.ts                      ← Módulo raíz (conecta todo)
│   │
│   ├── common/                            ← Código compartido por todos los módulos
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts   ← Formato estándar de respuesta JSON
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts              ← Verifica que el token JWT sea válido
│   │   │   └── permission.guard.ts       ← Verifica que el usuario tenga el permiso
│   │   └── decorators/
│   │       └── require-permission.decorator.ts ← Decorador @RequirePermission('x')
│   │
│   ├── supabase/
│   │   ├── supabase.module.ts            ← Registra SupabaseService globalmente
│   │   └── supabase.service.ts           ← Crea y provee los clientes de Supabase
│   │
│   ├── auth/
│   │   ├── auth.module.ts                ← Módulo de autenticación
│   │   ├── auth.controller.ts            ← Define las rutas /auth/login y /auth/register
│   │   ├── auth.service.ts               ← Lógica de login y registro
│   │   └── dto/
│   │       ├── login.dto.ts              ← Valida el body del login
│   │       └── register.dto.ts           ← Valida el body del registro
│   │
│   └── users/
│       ├── users.module.ts               ← Módulo de usuarios
│       ├── users.controller.ts           ← Define la ruta /users/add (protegida)
│       ├── users.service.ts              ← Lógica de creación de usuario por admin
│       └── dto/
│           └── create-user.dto.ts        ← Valida el body del endpoint /users/add
```

---

## 📄 Explicación detallada de cada archivo

---

### `.env` — Variables de entorno

Este archivo **nunca se sube a Git** (está en `.gitignore`). Contiene las credenciales
secretas para conectarse a Supabase. Sin este archivo el proyecto no arranca.

```env
SUPABASE_URL=...             # URL de tu proyecto de Supabase
SUPABASE_ANON_KEY=...        # Clave pública, para Auth del lado del usuario
SUPABASE_SERVICE_ROLE_KEY=.. # Clave secreta, para operaciones de administrador
SUPABASE_JWT_SECRET=...      # Secreto para verificar la firma de los tokens JWT
PORT=3000                    # Puerto donde corre el servidor
```

> **¿Dónde encontrar estas claves?**
> Supabase Dashboard → tu proyecto → ⚙️ Project Settings → API

---

### `src/main.ts` — Punto de entrada

Es el primer archivo que ejecuta Node.js. Se encarga de:

1. **Crear la aplicación NestJS**
2. **Prefijo global `/api/v1`** → todas las rutas empiezan con esto
3. **CORS** → permite peticiones desde `http://localhost:4200` (Angular) y `localhost:3000`
4. **ValidationPipe global** → valida automáticamente todos los DTOs en todos los
   endpoints. Si el body no cumple las reglas, devuelve error 400 antes de entrar al controller.
   - `whitelist: true` → ignora campos extra en el body
   - `forbidNonWhitelisted: true` → si alguien manda un campo desconocido, devuelve error
   - `transform: true` → convierte tipos automáticamente (ej.: string a número)
5. **ResponseInterceptor global** → envuelve todas las respuestas en el formato estándar

---

### `src/app.module.ts` — Módulo raíz

Es el "índice" de la aplicación. Solo importa los demás módulos y los conecta:

- `ConfigModule.forRoot({ isGlobal: true })` → carga el `.env` y lo hace disponible
  en TODA la app sin necesidad de importarlo en cada módulo
- `SupabaseModule` → hace disponible el cliente de Supabase en toda la app
- `AuthModule` → activa las rutas de login y registro
- `UsersModule` → activa la ruta de creación de usuarios por admin

---

### `src/common/interceptors/response.interceptor.ts` — Formato estándar

Un **interceptor** es código que se ejecuta ANTES y DESPUÉS de cada petición.
Este interceptor envuelve AUTOMÁTICAMENTE la respuesta de CUALQUIER endpoint
en el formato acordado. El service solo devuelve el dato útil, y el interceptor
lo empaqueta:

**Lo que devuelve el service:**
```json
{ "access_token": "eyJ...", "user": {...}, "permissions": [...] }
```

**Lo que recibe el cliente gracias al interceptor:**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "access_token": "eyJ...", "user": {...}, "permissions": [...] }]
}
```

> `intOpCode: 0` siempre significa éxito. En el futuro puedes usar valores > 0
> para representar errores de negocio específicos sin cambiar el HTTP status code.

---

### `src/common/guards/jwt.guard.ts` — Verificador de token

Un **guard** es un portero: decide si una petición puede pasar o no.

Este guard protege rutas que requieren autenticación. Funciona así:
1. Lee el header `Authorization: Bearer <token>`
2. Extrae el token JWT
3. Verifica la firma del token usando `SUPABASE_JWT_SECRET` del `.env`
   (si alguien falsificara un token sin conocer el secreto, la verificación fallaría)
4. Si el token es válido → adjunta el payload decodificado en `request.user`
   (esto incluye el `sub` que es el UUID del usuario en Supabase)
5. Si el token es inválido o no existe → devuelve error `401 Unauthorized`

---

### `src/common/guards/permission.guard.ts` — Verificador de permisos

Se ejecuta DESPUÉS del JwtGuard. Accede al `request.user.sub` que dejó el JwtGuard
(el UUID del usuario autenticado) y hace una consulta a la base de datos para verificar
que ese usuario tenga el permiso requerido en la tabla `usuario_permisos`.

Ejemplo de flujo para `POST /users/add`:
```
Request llega
   → JwtGuard: ¿el token es válido? Sí → continúa, adjunta user.sub = "UUID del admin"
   → PermissionGuard: ¿el usuario "UUID del admin" tiene el permiso "users_add"?
       Consulta la BD → Sí → permite
       No → devuelve 403 Forbidden
```

---

### `src/common/decorators/require-permission.decorator.ts` — @RequirePermission

Es una "etiqueta" que se pone sobre los endpoints para indicar qué permiso necesitan.

```typescript
@RequirePermission('users_add')
addUser() { ... }
```

El `PermissionGuard` lee esa etiqueta con `Reflector` y sabe qué permiso verificar.
Sin esta etiqueta, el guard deja pasar sin verificar permisos.

---

### `src/supabase/supabase.service.ts` — Clientes de Supabase

Crea y expone DOS clientes de Supabase:

| Cliente | Key que usa | Para qué sirve |
|---|---|---|
| `getAnonClient()` | `SUPABASE_ANON_KEY` | Login de usuarios vía Supabase Auth. Respeta las políticas RLS de la BD. |
| `getAdminClient()` | `SUPABASE_SERVICE_ROLE_KEY` | Operaciones administrativas: crear usuarios, leer cualquier tabla, bypassear RLS. ⚠️ Solo en el backend. |

> **¿Por qué dos clientes?** Porque no todas las operaciones tienen los mismos privilegios.
> El login lo hace el anon client porque estamos actuando "como el usuario".
> Crear usuarios o leer datos de otros usuarios lo hace el admin client porque
> tiene permisos totales sobre la BD.

### `src/supabase/supabase.module.ts` — Módulo global de Supabase

Registra `SupabaseService` como `@Global()` para que esté disponible en todos los
módulos sin necesidad de importar `SupabaseModule` en cada uno.

---

### `src/auth/dto/login.dto.ts` — Validación del body de login

Define las reglas que debe cumplir el body de `POST /auth/login`:

| Campo | Tipo | Regla |
|---|---|---|
| `identifier` | string | Requerido. Puede ser email o nombre de usuario. |
| `contrasenia` | string | Requerido. Mínimo 10 caracteres. |

---

### `src/auth/dto/register.dto.ts` — Validación del body de registro

| Campo | Tipo | Regla |
|---|---|---|
| `nombre_completo` | string | Requerido |
| `usuario` | string | Requerido. Solo letras, números, puntos y guiones bajos |
| `email` | string | Requerido. Formato email válido |
| `contrasenia` | string | Requerido. Min 10 chars + al menos un símbolo especial (!@#$...) |
| `telefono` | string | Requerido. Exactamente 10 dígitos numéricos |
| `direccion` | string | Opcional |
| `fecha_nacimiento` | string | Opcional. Formato YYYY-MM-DD. El service verifica 18+ años |

---

### `src/auth/auth.service.ts` — Lógica de autenticación

**Método `login(dto)`:**
1. Si `identifier` no tiene `@` → busca el email en `usuarios` por campo `usuario`
2. Llama a `supabase.auth.signInWithPassword({ email, password })`
3. Obtiene el perfil de `usuarios` (sin exponer datos sensibles)
4. Obtiene todos los permisos globales del usuario de `usuario_permisos`
5. Devuelve `access_token + user + permissions`

**Método `register(dto)`:**
1. Verifica que el `usuario` (username) sea único en la tabla `usuarios`
2. Valida mayoría de edad si se proporcionó `fecha_nacimiento`
3. Crea el usuario en Supabase Auth (Supabase hashea la contraseña con bcrypt)
4. Inserta el perfil en la tabla `usuarios` con el mismo UUID de Supabase Auth
5. **Mecanismo de rollback:** si el INSERT del perfil falla, borra el usuario de
   Supabase Auth para evitar datos huérfanos (usuario en Auth sin perfil en BD)

---

### `src/auth/auth.controller.ts` — Rutas de autenticación

Define que:
- `POST /auth/login` → llama a `authService.login(dto)`, devuelve HTTP 200
- `POST /auth/register` → llama a `authService.register(dto)`, devuelve HTTP 201

No aplica guards porque son rutas públicas.

---

### `src/users/dto/create-user.dto.ts` — Validación del body de /users/add

Similar a `register.dto.ts` pero con un campo extra:

| Campo | Tipo | Regla |
|---|---|---|
| `nombre_completo` | string | Requerido |
| `usuario` | string | Requerido. Solo letras, números, puntos y guiones bajos |
| `email` | string | Requerido. Formato email válido |
| `contrasenia` | string | Requerido. Min 10 chars + símbolo especial |
| `telefono` | string | Requerido. 10 dígitos numéricos |
| `direccion` | string | Opcional |
| `fecha_nacimiento` | string | Opcional. Formato YYYY-MM-DD |
| `permisos_iniciales` | string[] | **Opcional.** Lista de nombres de permisos a asignar. Ej: `["ticket_view", "users_add"]` |

---

### `src/users/users.service.ts` — Lógica de creación admin

**Método `addUser(dto)`:**
1. Verifica unicidad del username
2. Crea el usuario en Supabase Auth Admin API (bypasea confirmación de email)
3. Inserta el perfil en `usuarios`
4. Si se enviaron `permisos_iniciales`:
   - Busca los UUIDs de esos permisos en la tabla `permisos` por nombre
   - Inserta en `usuario_permisos` todos los pares `(usuario_id, permiso_id)`
5. Si el INSERT del perfil falla → rollback: borra el usuario de Auth

---

### `src/users/users.controller.ts` — Rutas de usuarios

Define que `POST /users/add` aplica en orden:
1. `JwtGuard` → verifica el token
2. `PermissionGuard` + `@RequirePermission('users_add')` → verifica el permiso

Solo si pasa ambas capas el request llega al `usersService.addUser(dto)`.

---

## 🧪 Guía de pruebas — Los 11 endpoints

> **Base URL:** `http://localhost:3000/api/v1`
> **Herramienta recomendada:** Thunder Client (extensión VS Code) o Hoppscotch (web)
>
> **Flujo general:** Siempre haz login primero → copia el `access_token` → úsalo en el header `Authorization: Bearer <token>` de los demás endpoints.

---

## PASO 0 — Preparación

Antes de empezar, asegúrate de tener:
1. El servidor corriendo: `npm run start:dev`
2. La cuenta admin creada (la que hiciste manualmente con todos los permisos)

---

## ─── BLOQUE 1: AUTH (público, sin token) ─────────────────────────────────

### 1️⃣ POST /auth/register — Registrar un usuario nuevo

```
Método: POST
URL:    http://localhost:3000/api/v1/auth/register
Header: Content-Type: application/json
```

**Body:**
```json
{
  "nombre_completo": "Usuario Prueba",
  "usuario": "uprueba",
  "email": "uprueba@ers.com",
  "contrasenia": "TestPass123!",
  "telefono": "5551112233",
  "direccion": "Calle Falsa 123",
  "fecha_nacimiento": "2000-05-20"
}
```

**Respuesta esperada (201):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Usuario registrado correctamente.",
    "user": {
      "id": "uuid-generado",
      "nombre_completo": "Usuario Prueba",
      "usuario": "uprueba",
      "email": "uprueba@ers.com",
      "fecha_creacion": "..."
    }
  }]
}
```

**Errores a validar:**
- Enviar sin el campo `contrasenia` → debe dar error 400
- Enviar `telefono: "123"` (menos de 10 dígitos) → debe dar error 400
- Registrar el mismo `usuario` dos veces → debe dar "El nombre de usuario ya está en uso."

---

### 2️⃣ POST /auth/login — Iniciar sesión

```
Método: POST
URL:    http://localhost:3000/api/v1/auth/login
Header: Content-Type: application/json
```

**Body con username:**
```json
{
  "identifier": "admin",
  "contrasenia": "AdminPass123!"
}
```

**Body con email (también funciona):**
```json
{
  "identifier": "admin@ers.com",
  "contrasenia": "AdminPass123!"
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "access_token": "eyJhbGci...",
    "token_type": "Bearer",
    "user": { "id": "...", "nombre_completo": "Admin Principal", ... },
    "permissions": ["ticket_view", "users_add", "users_delete", ...]
  }]
}
```

> ⚠️ **COPIA EL `access_token`** — lo necesitas para todos los siguientes endpoints.

---

## ─── BLOQUE 2: PERFIL PROPIO (requiere JWT) ──────────────────────────────

> Para todos estos endpoints agrega el header:
> `Authorization: Bearer <access_token_del_login>`

### 3️⃣ GET /users/me — Ver mi perfil

```
Método: GET
URL:    http://localhost:3000/api/v1/users/me
Header: Authorization: Bearer <token>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "id": "...",
    "nombre_completo": "Admin Principal",
    "usuario": "admin",
    "email": "admin@ers.com",
    "telefono": "4420000000",
    "direccion": null,
    "fecha_nacimiento": null,
    "activo": true,
    "fecha_creacion": "...",
    "permisos": ["ticket_view", "users_add", ...],
    "rol": "Admin"
  }]
}
```

---

### 4️⃣ PATCH /users/me — Actualizar mi perfil

```
Método: PATCH
URL:    http://localhost:3000/api/v1/users/me
Header: Authorization: Bearer <token>
        Content-Type: application/json
```

**Body (solo los campos que quieres cambiar):**
```json
{
  "nombre_completo": "Admin Principal Editado",
  "telefono": "5559998877",
  "direccion": "Av. Principal 500"
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Perfil actualizado correctamente.",
    "user": { "nombre_completo": "Admin Principal Editado", ... }
  }]
}
```

**Errores a validar:**
- Enviar `{}` (sin campos) → debe dar "No se enviaron campos para actualizar."
- Enviar `telefono: "123"` → debe dar error 400 de validación
- Intentar cambiar `usuario` a uno que ya existe → "El nombre de usuario ya está en uso."

---

### 5️⃣ PATCH /users/me/password — Cambiar mi contraseña

```
Método: PATCH
URL:    http://localhost:3000/api/v1/users/me/password
Header: Authorization: Bearer <token>
        Content-Type: application/json
```

**Body:**
```json
{
  "contrasenia_actual": "AdminPass123!",
  "nueva_contrasenia": "NuevoPass456!"
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "message": "Contraseña actualizada correctamente." }]
}
```

**Errores a validar:**
- Enviar `contrasenia_actual` incorrecta → "La contraseña actual es incorrecta."
- `nueva_contrasenia` menor a 10 caracteres → error 400 de validación
- `nueva_contrasenia` sin símbolo especial → error 400 de validación

> ⚠️ Si cambias la contraseña, el token actual sigue válido hasta que expire.
> En el siguiente login deberás usar la contraseña nueva.

---

### 6️⃣ DELETE /users/me — Dar de baja mi cuenta (soft delete)

> Úsalo con una cuenta de prueba, NO con el admin. Si lo haces con el admin
> quedará inactivo y tendrás que reactivarlo desde Supabase SQL Editor.

```
Método: DELETE
URL:    http://localhost:3000/api/v1/users/me
Header: Authorization: Bearer <token_de_uprueba>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Tu cuenta ha sido dada de baja. Contacta al administrador para reactivarla."
  }]
}
```

**Verificación:** Haz GET /users/me con ese mismo token → el usuario sigue existiendo pero `activo: false`. El admin puede reactivarlo con `PATCH /users/:id { "activo": true }`.

---

## ─── BLOQUE 3: ADMINISTRADOR (requiere JWT con permisos) ─────────────────

> Usa el token del **admin** para estos endpoints.
> El usuario `uprueba` no tendrá acceso y debe devolver 403.

### 7️⃣ GET /users — Listar todos los usuarios

```
Método: GET
URL:    http://localhost:3000/api/v1/users
Header: Authorization: Bearer <token_del_admin>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [
    {
      "id": "...",
      "nombre_completo": "Admin Principal",
      "usuario": "admin",
      "email": "admin@ers.com",
      "activo": true,
      "permisos": ["ticket_view", "users_add", ...],
      "rol": "Admin"
    },
    {
      "id": "...",
      "nombre_completo": "Usuario Prueba",
      "usuario": "uprueba",
      "activo": false,
      "permisos": [],
      "rol": "Viewer"
    }
  ]
}
```

**Error a validar:**
- Usar token de `uprueba` (sin `users_view`) → debe dar 403 Forbidden

---

### 8️⃣ POST /users/add — Crear usuario como admin

```
Método: POST
URL:    http://localhost:3000/api/v1/users/add
Header: Authorization: Bearer <token_del_admin>
        Content-Type: application/json
```

**Body:**
```json
{
  "nombre_completo": "María García",
  "usuario": "mgarcia",
  "email": "maria.garcia@ers.com",
  "contrasenia": "MariaPass123!",
  "telefono": "5554443322",
  "permisos_iniciales": ["ticket_view", "ticket_add"]
}
```

**Respuesta esperada (201):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Usuario creado correctamente por el administrador.",
    "user": { "id": "...", "nombre_completo": "María García", ... },
    "permisos_asignados": ["ticket_view", "ticket_add"]
  }]
}
```

---

### 9️⃣ PATCH /users/:id — Editar datos de un usuario

> Usa el UUID del usuario `uprueba` o `mgarcia` que creaste antes.

```
Método: PATCH
URL:    http://localhost:3000/api/v1/users/<UUID_del_usuario>
Header: Authorization: Bearer <token_del_admin>
        Content-Type: application/json
```

**Body — reactivar a uprueba y cambiarle el nombre:**
```json
{
  "nombre_completo": "Usuario Prueba Actualizado",
  "activo": true
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Usuario actualizado correctamente.",
    "user": { "nombre_completo": "Usuario Prueba Actualizado", "activo": true, ... }
  }]
}
```

**Errores a validar:**
- UUID que no existe → 404 Not Found
- Email duplicado → "El email ya está en uso por otro usuario."

---

### 🔟 PUT /users/:id/permissions — Reemplazar permisos de un usuario

```
Método: PUT
URL:    http://localhost:3000/api/v1/users/<UUID_de_mgarcia>
        (o del usuario que quieras modificar)
Header: Authorization: Bearer <token_del_admin>
        Content-Type: application/json
```

**Body — dar permisos completos de editor:**
```json
{
  "permisos": ["ticket_view", "ticket_add", "ticket_edit", "groups_add", "groups_edit"]
}
```

**Body — quitar TODOS los permisos:**
```json
{
  "permisos": []
}
```

**Respuesta esperada (200):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "message": "Permisos de 'María García' actualizados correctamente.",
    "permisos_asignados": ["ticket_view", "ticket_add", "ticket_edit", ...],
    "rol": "Editor"
  }]
}
```

**Verificación del rol derivado:**
- Solo permisos `_view` → `rol: "Viewer"`
- Algún `_add`, `_edit` o `_delete` (sin `users_delete`) → `rol: "Editor"`
- Con `users_delete` → `rol: "Admin"`

---

### 1️⃣1️⃣ DELETE /users/:id — Eliminar usuario permanentemente

> ⚠️ Irreversible. Úsalo con una cuenta de prueba desechable.

```
Método: DELETE
URL:    http://localhost:3000/api/v1/users/<UUID_del_usuario_a_eliminar>
Header: Authorization: Bearer <token_del_admin>
```

**Sin body.** Respuesta esperada (200):
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{ "message": "Usuario 'María García' eliminado permanentemente." }]
}
```

**Errores a validar:**
- Intentar eliminar el propio UUID del admin → 403 "No puedes eliminar tu propia cuenta."
- UUID que no existe → 404 Not Found
- Token sin permiso `users_delete` → 403 Forbidden

---

## 📋 Resumen de permisos requeridos

| Endpoint | Permiso |
|---|---|
| POST /auth/login | Ninguno (público) |
| POST /auth/register | Ninguno (público) |
| GET /users/me | Solo JWT válido |
| PATCH /users/me | Solo JWT válido |
| PATCH /users/me/password | Solo JWT válido |
| DELETE /users/me | Solo JWT válido |
| GET /users | `users_view` |
| POST /users/add | `users_add` |
| PATCH /users/:id | `users_edit` |
| PUT /users/:id/permissions | `users_edit` |
| DELETE /users/:id | `users_delete` |

## 🔑 Nombres válidos para permisos

```
ticket_add    ticket_edit    ticket_delete    ticket_view
groups_add    groups_edit    groups_delete
users_add     users_edit     users_delete     users_view
```


### 1️⃣ Registro de usuario (público)

```
Método: POST
URL:    http://localhost:3000/api/v1/auth/register
Header: Content-Type: application/json
```

**Body JSON:**
```json
{
  "nombre_completo": "Ana López",
  "usuario": "alopez",
  "email": "ana.lopez@ers.com",
  "contrasenia": "MiPassword123!",
  "telefono": "5551234567",
  "direccion": "Av. Reforma 100, CDMX",
  "fecha_nacimiento": "2000-06-15"
}
```

**Respuesta esperada (201 Created):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Usuario registrado correctamente.",
    "user": {
      "id": "uuid-generado-por-supabase",
      "nombre_completo": "Ana López",
      "usuario": "alopez",
      "email": "ana.lopez@ers.com",
      "fecha_creacion": "2026-03-30T22:00:00Z"
    }
  }]
}
```

**Errores posibles:**
```json
// Si el username ya existe:
{ "statusCode": 400, "message": "El nombre de usuario ya está en uso." }

// Si el email ya existe en Supabase Auth:
{ "statusCode": 400, "message": "El email ya está registrado." }

// Si la contraseña no cumple los requisitos:
{ "statusCode": 400, "message": ["La contraseña debe tener al menos 10 caracteres."] }
```

---

### 2️⃣ Login (público)

```
Método: POST
URL:    http://localhost:3000/api/v1/auth/login
Header: Content-Type: application/json
```

**Body JSON — Login con nombre de usuario:**
```json
{
  "identifier": "alopez",
  "contrasenia": "MiPassword123!"
}
```

**Body JSON — Login con email (también funciona):**
```json
{
  "identifier": "ana.lopez@ers.com",
  "contrasenia": "MiPassword123!"
}
```

**Respuesta esperada (200 OK):**
```json
{
  "statusCode": 200,
  "intOpCode": 0,
  "data": [{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user": {
      "id": "uuid-del-usuario",
      "nombre_completo": "Ana López",
      "usuario": "alopez",
      "email": "ana.lopez@ers.com",
      "telefono": "5551234567",
      "fecha_creacion": "2026-03-30T22:00:00Z"
    },
    "permissions": ["ticket_view", "ticket_add"]
  }]
}
```

> ⚠️ **GUARDA EL `access_token`** — lo necesitas para el siguiente endpoint.

**Errores posibles:**
```json
// Credenciales incorrectas (usuario no existe o contraseña incorrecta):
{ "statusCode": 401, "message": "Credenciales incorrectas." }
```

---

### 3️⃣ Crear usuario como administrador (protegido)

> ⚠️ Para probar este endpoint necesitas hacer login con un usuario que tenga
> el permiso `users_add` (como Juan Pérez del seed de datos).

```
Método: POST
URL:    http://localhost:3000/api/v1/users/add
Headers:
  Content-Type:  application/json
  Authorization: Bearer <pega aquí el access_token del login>
```

**Body JSON:**
```json
{
  "nombre_completo": "Roberto Sánchez",
  "usuario": "rsanchez",
  "email": "roberto.sanchez@ers.com",
  "contrasenia": "AdminPass456!",
  "telefono": "5559876543",
  "direccion": "Calle Hidalgo 200, Monterrey",
  "fecha_nacimiento": "1995-03-20",
  "permisos_iniciales": ["ticket_view", "ticket_add"]
}
```

**Body JSON — versión mínima (sin permisos ni campos opcionales):**
```json
{
  "nombre_completo": "Pedro Ramírez",
  "usuario": "pramirez",
  "email": "pedro.ramirez@ers.com",
  "contrasenia": "TempPass789!",
  "telefono": "5554443322"
}
```

**Respuesta esperada (201 Created):**
```json
{
  "statusCode": 201,
  "intOpCode": 0,
  "data": [{
    "message": "Usuario creado correctamente por el administrador.",
    "user": {
      "id": "nuevo-uuid",
      "nombre_completo": "Roberto Sánchez",
      "usuario": "rsanchez",
      "email": "roberto.sanchez@ers.com",
      "fecha_creacion": "2026-03-30T22:10:00Z"
    },
    "permisos_asignados": ["ticket_view", "ticket_add"]
  }]
}
```

**Errores posibles:**
```json
// Sin token o token inválido:
{ "statusCode": 401, "message": "No se proporcionó token de acceso." }

// Token válido pero sin permiso users_add:
{ "statusCode": 403, "message": "No tienes el permiso requerido: users_add" }

// Username duplicado:
{ "statusCode": 400, "message": "El nombre de usuario ya está en uso." }
```

---

## 🔑 Nombres de permisos disponibles

Estos son los valores válidos para el campo `permisos_iniciales`:

| Nombre del permiso | Descripción |
|---|---|
| `ticket_add` | Crear nuevos tickets |
| `ticket_edit` | Editar tickets existentes |
| `ticket_delete` | Eliminar tickets |
| `ticket_view` | Ver tickets |
| `groups_add` | Crear nuevos grupos |
| `groups_edit` | Editar grupos existentes |
| `groups_delete` | Eliminar grupos |
| `users_add` | Crear usuarios (acceso a este endpoint) |
| `users_edit` | Editar usuarios |
| `users_delete` | Eliminar usuarios |
| `users_view` | Ver lista de usuarios |

---

## ❓ Preguntas frecuentes

**¿El servidor se cae si cambio un archivo?**
No. `npm run start:dev` usa modo watch: detecta cambios y se reinicia automáticamente.

**¿Qué pasa si mando un campo extra en el body?**
NestJS lo rechaza con error 400 gracias a `forbidNonWhitelisted: true` en el `ValidationPipe`.
Esto es una medida de seguridad: evita que alguien inyecte campos no esperados.

**¿Por qué el login devuelve un array `data: [...]` si solo es un objeto?**
Por diseño del `ResponseInterceptor`: `data` siempre es un array para mantener
consistencia. Los endpoints que devuelvan listas de usuarios también usarán `data: [...]`.
En el frontend siempre leerás `response.data[0]` para respuestas singulares.

**¿Las contraseñas se guardan en texto plano?**
No. Supabase Auth las hashea internamente con bcrypt antes de guardarlas.
Nuestro código nunca toca ni almacena la contraseña en texto plano.
