# Auth API — Contrato Backend para Frontend

## Base URL

```
/api/auth
```

---

## 1. Login

**`POST /api/auth/login`**

- **Auth:** No requiere
- **Permiso:** Ninguno
- **Rate limit:** 10 intentos por ventana de 15 minutos (por IP/email)

### Request Body

```json
{
  "identifier": "juan@empresa.com",
  "password": "MiPassword123"
}
```

> También acepta `email` en lugar de `identifier`.

### Response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
    "user": {
      "id": "user_abc123",
      "name": "Juan Pérez",
      "email": "juan@empresa.com",
      "roleName": "employee",
      "branchId": "branch_xyz",
      "departmentId": "dept_123",
      "avatarUrl": null,
      "employeeId": "EMP-001",
      "status": "active",
      "forcePasswordChange": false
    }
  },
  "message": "Login exitoso"
}
```

---

## 2. Refresh Token

**`POST /api/auth/refresh`**

- **Auth:** No requiere
- **Permiso:** Ninguno
- **Rate limit:** 20 solicitudes por ventana de 15 minutos (por IP)

### Request Body

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

### Response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "bnVldm8gcmVmcmVzaCB0...",
    "user": { ... }
  }
}
```

---

## 3. Logout

**`POST /api/auth/logout`**

- **Auth:** Requiere
- **Permiso:** Ninguno

### Request Body

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Sesión cerrada"
}
```

---

## 4. Obtener perfil actual

**`GET /api/auth/me`**

- **Auth:** Requiere
- **Permiso:** Ninguno

### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "user_abc123",
    "name": "Juan Pérez",
    "email": "juan@empresa.com",
    "roleName": "employee",
    "branchId": "branch_xyz",
    "departmentId": "dept_123",
    "avatarUrl": null,
    "employeeId": "EMP-001",
    "status": "active",
    "forcePasswordChange": false,
    "permissions": ["schedules:view", "absences:create", "absences:read", ...]
  }
}
```

---

## 5. Cambiar contraseña

**`PATCH /api/auth/change-password`**

- **Auth:** Requiere
- **Permiso:** Ninguno
- **Rate limit:** 5 intentos por ventana de 60 minutos (por usuario)

### Request Body

```json
{
  "currentPassword": "MiPassword123",
  "newPassword": "MiNuevoPassword456"
}
```

> `currentPassword` es opcional (si el usuario tiene `forcePasswordChange: true`).

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Contraseña actualizada correctamente"
}
```
