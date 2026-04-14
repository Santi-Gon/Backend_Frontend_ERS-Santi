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

## 🚏 2. Flujo Exitoso a través del Gateway

Ahora, usando el puerto del **Gateway (3003)**. El Gateway validará el CORS, aplicará un límite de seguridad (Rate Limit) y proxy-ea automáticamente el header oculto `X-Internal-Secret`.

### A. Login (Redirige a Users :3000)
```
Método: POST
URL:    http://localhost:3003/api/v1/auth/login
```
*(Debería devolverte el token JWT de manera exitosa)*

### B. Listar Grupos (Redirige a Grupos :3001)
```
Método: GET
URL:    http://localhost:3003/api/v1/grupos
HEADER: Authorization: Bearer <tokendeA>
```
*(Debería devolver la lista de grupos a los que perteneces)*

### C. Catálogos y Tickets (Redirige a Tickets :3002)
```
Método: GET
URL:    http://localhost:3003/api/v1/catalogos/estados
HEADER: Authorization: Bearer <tokendeA>
```
*(Debería devolver los estados de "Pendiente", "En progreso", etc.)*

---

## 🛡️ 3. Prueba de Seguridad (Rate Limiting)

El Gateway protege los servicios contra saturación.

Para probarlo, manda la misma petición (por ejemplo el health check del propio gateway) **101 veces en menos de 1 minuto**.

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

A partir de este punto, **tu archivo de configuración en Angular** `(environment.ts o la variable baseUrl)` debe apuntar UNICAMENTE al API Gateway:

```typescript
// frontend/src/environments/environment.ts
export const environment = {
  production: false,
  // 🟢 TODO FLIRTEA AQUÍ (USERS, GRUPOS Y TICKETS)
  apiUrl: 'http://localhost:3003/api/v1' 
};
```

¡Todo funcionará transparente y de manera segura!
