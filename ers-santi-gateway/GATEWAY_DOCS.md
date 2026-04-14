# 🌉 Guía de Pruebas — API Gateway

> **Base URL Frontend (Nueva):** `http://localhost:3003/api/v1`
> **Herramienta:** El Frontend en Angular o Thunder Client/Postman
>
> **Prerequisitos antes de probar:**
> 1. Asegúrate de tener los 3 microservicios corriendo en sus terminales (`3000`, `3001`, `3002`).
> 2. Todas las peticiones del frontend deben dirigirse ahora a **3003** en lugar de los puertos individuales.

---

## 🔒 1. Demostración de Seguridad Interna (El Candado)

Los microservicios ya no aceptarán conexiones directas (sin el Gateway). Puedes comprobarlo intentando acceder a cualquier microservicio en su puerto directamente sin enviar el secreto interno:

**Prueba (Postman / Thunder Client):**
```
Método: GET
URL:    http://localhost:3000/api/v1/users (Directo al Backend)
HEADER: (Sin el X-Internal-Secret)
```
**Resultado esperado (403 Forbidden):**
```json
{
  "statusCode": 403,
  "intOpCode": 1,
  "data": [{ "message": "Acceso no autorizado. Usa el API Gateway." }]
}
```
Esto demuestra que nadie puede evitar el Gateway ni hacer peticiones maliciosas directamente a tus APIs traseras.

---

## 🚏 2. Flujos Exitosos a través del Gateway

Ahora todo debe hacerse usando el puerto del **Gateway (3003)**. El Gateway validará el CORS, aplicará un límite de seguridad (Rate Limit) y proxy-ea automáticamente al microservicio destino el header oculto `X-Internal-Secret`.

> [!IMPORTANT]
> **Sobre el Token de Autorización:**
> Sí, **sí necesitas enviar el header `Authorization: Bearer <tú_token>`** en todas las peticiones a rutas protegidas a través del Gateway (exactamente igual a como lo hacías directo a los microservicios). El Gateway simplemente dejará pasar ese header hasta el microservicio, que será el encargado de validar la firma del token.

A continuación, los ejemplos completos (con JSON bodies) para que pruebes los flujos principales pasando por el Gateway:

### A. Login (Redirige a Users :3000)
*No requiere token.*

```
Método: POST
URL:    http://localhost:3003/api/v1/auth/login
Header: Content-Type: application/json

Body:
{
  "identifier": "sandra.lopez@ers.com",
  "contrasenia": "password123"
}
```
*(Debería devolverte el token JWT de manera exitosa)*

### B. Listar Grupos (Redirige a Grupos :3001)
*Requiere token.*

```
Método: GET
URL:    http://localhost:3003/api/v1/grupos
Header: Authorization: Bearer <tu_token_aqui>
```
*(Debería devolver la lista vacía o con los grupos a los que perteneces)*

### C. Crear Grupo (Redirige a Grupos :3001)
*Requiere token y el permiso users_delete global (o permisos en admin)*

```
Método: POST
URL:    http://localhost:3003/api/v1/grupos
Header: Authorization: Bearer <tu_token_aqui>
        Content-Type: application/json

Body:
{
  "nombre": "Grupo de Operaciones",
  "descripcion": "Gestión diaria de incidencias"
}
```

### D. Catálogos de Tickets (Redirige a Tickets :3002)
*Requiere token.*

```
Método: GET
URL:    http://localhost:3003/api/v1/catalogos/estados
Header: Authorization: Bearer <tu_token_aqui>
```
*(Debería devolver los estados de "Pendiente", "En progreso", etc.)*

### E. Crear Ticket mediante el Gateway (Redirige a Tickets :3002)
*Requiere token y pertenecer al grupo con permiso `ticket_add`*

```
Método: POST
URL:    http://localhost:3003/api/v1/tickets
Header: Authorization: Bearer <tu_token_aqui>
        Content-Type: application/json

Body:
{
  "grupo_id":         "<UUID_DEL_GRUPO_DONDE_SI_ESTES>",
  "titulo":           "Revisión de Servidores vía Gateway",
  "descripcion":      "Probando que el Gateway routee bien los POSTs y bodies JSON.",
  "prioridad_nombre": "Alta",
  "estado_nombre":    "pendiente"
}
```

---

## 🛡️ 3. Prueba de Seguridad (Rate Limiting)

El Gateway protege los servicios contra saturación.
Para probarlo, manda la misma petición (por ejemplo el health check del propio gateway) **más de 100 veces en menos de 1 minuto** (fácil con el "Run Runner" de Postman).

```
Método: GET
URL:    http://localhost:3003/api/v1/health
```

A la petición #101, recibirás:
```json
{
  "statusCode": 429,
  "intOpCode": 1,
  "data": [{ "message": "Demasiadas peticiones. Por favor, inténtelo de nuevo en un minuto." }]
}
```

---

## 🛠️ Conexión con el Frontend de Angular

A partir de este punto, **tu archivo de configuración en Angular** `(environment.ts o la variable baseUrl)` debe apuntar ÚNICAMENTE al API Gateway:

```typescript
// frontend/src/environments/environment.ts
export const environment = {
  production: false,
  // 🟢 TODO APP DEBE APUNTAR AQUÍ (AUTH, USERS, GRUPOS Y TICKETS)
  apiUrl: 'http://localhost:3003/api/v1' 
};
```

¡Todo funcionará transparente y de manera mucho más segura!
