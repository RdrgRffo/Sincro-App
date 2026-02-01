# Users API — Contrato Backend para Frontend

> **Última actualización:** 13 mayo 2026

## Base URL

```
/api/users
```

---

## 1. Listar usuarios

**`GET /api/users`**

- **Permiso:** `users:view`

### Query Parameters

| Parámetro       | Tipo   | Obligatorio | Descripción |
|-----------------|--------|-------------|-------------|
| `page`          | number | No          | Página (default: 1) |
| `limit`         | number | No          | Items por página (default: 20, max: 500) |
| `search`        | string | No          | Búsqueda por nombre o email |
| `email`         | string | No          | Filtrar por email exacto |
| `roleId`        | string | No          | Filtrar por ID de rol |
| `role`          | string | No          | Filtrar por nombre de rol (`admin`, `general_manager`, `department_manager`, `employee`) |
| `status`        | string | No          | Filtrar por estado (`active`, `disabled`, `locked`) |
| `departmentId`  | string | No          | Filtrar por departamento |
| `employeeId`    | string | No          | Filtrar por ID de empleado |
| `branchId`      | string | No          | Filtrar por sucursal |
| `lastLoginFrom` | string | No          | Fecha inicio último login (ISO) |
| `lastLoginTo`   | string | No          | Fecha fin último login (ISO) |
| `createdFrom`   | string | No          | Fecha inicio creación (ISO) |
| `createdTo`     | string | No          | Fecha fin creación (ISO) |
| `sortBy`        | string | No          | Campo de ordenación (default: `createdAt`) |
| `sortOrder`     | string | No          | `asc` o `desc` (default: `desc`) |

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "user_abc123",
      "employeeId": "EMP-001",
      "name": "Juan Pérez",
      "email": "juan@empresa.com",
      "roleName": "employee",
      "status": "active",
      "avatarUrl": null,
      "companyPhone": "922123456",
      "auxiliaryPhone": null,
      "branchId": "branch_xyz",
      "departmentId": "dept_123",
      "department": { "id": "dept_123", "name": "Ventas" },
      "branch": { "id": "branch_xyz", "name": "Sucursal Centro", "code": "CENTRO" },
      "forcePasswordChange": false,
      "lastLoginAt": "2026-05-06T10:00:00.000Z",
      "createdAt": "2026-01-15T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## 2. Obtener usuario por ID

**`GET /api/users/:id`**

- **Permiso:** `users:view`

### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "user_abc123",
    "employeeId": "EMP-001",
    "name": "Juan Pérez",
    "email": "juan@empresa.com",
    "roleName": "employee",
    "status": "active",
    "avatarUrl": null,
    "companyPhone": "922123456",
    "auxiliaryPhone": null,
    "branchId": "branch_xyz",
    "departmentId": "dept_123",
    "department": { "id": "dept_123", "name": "Ventas" },
    "branch": { "id": "branch_xyz", "name": "Sucursal Centro", "code": "CENTRO" },
    "forcePasswordChange": false,
    "lastLoginAt": "2026-05-06T10:00:00.000Z",
    "createdAt": "2026-01-15T08:00:00.000Z"
  }
}
```

---

## 3. Crear usuario

**`POST /api/users`**

- **Permiso:** `users:create`

### Request Body

```json
{
  "name": "María García",
  "email": "maria@empresa.com",
  "password": "Password123",
  "branchId": "branch_xyz",
  "employeeId": "EMP-002",
  "roleId": "role_dept_manager",
  "departmentId": "dept_123",
  "companyPhone": "922654321",
  "auxiliaryPhone": null,
  "avatarUrl": null,
  "status": "active"
}
```

### Response (201)

```json
{
  "success": true,
  "data": { ... },
  "message": "Usuario creado"
}
```

---

## 4. Importar usuarios CSV

**`POST /api/users/import`**

- **Permiso:** `users:create`
- **Content-Type:** `multipart/form-data`

### Request

| Campo  | Tipo | Descripción |
|--------|------|-------------|
| `file` | File | Archivo CSV con columnas: name, email, password, branchId, employeeId, roleId, departmentId, companyPhone |

### Response (200)

```json
{
  "success": true,
  "data": {
    "imported": 10,
    "errors": 2,
    "errorDetails": [
      { "row": 3, "message": "Email duplicado: pedro@empresa.com" },
      { "row": 7, "message": "Sucursal no encontrada: branch_xxx" }
    ]
  },
  "message": "Importación completada"
}
```

---

## 5. Actualizar usuario

**`PATCH /api/users/:id`**

- **Permiso:** `users:update`

### Request Body (todos opcionales)

```json
{
  "name": "María García López",
  "email": "maria.nueva@empresa.com",
  "branchId": "branch_abc",
  "departmentId": "dept_456",
  "companyPhone": "922654322",
  "avatarUrl": "https://...",
  "status": "active"
}
```

### Response (200)

```json
{
  "success": true,
  "data": { ... },
  "message": "Usuario actualizado"
}
```

---

## 6. Cambiar estado

**`PATCH /api/users/:id/status`**

- **Permiso:** `users:update`

### Request Body

```json
{
  "status": "disabled"
}
```

Valores: `active`, `disabled`, `locked`

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Estado actualizado a disabled"
}
```

---

## 7. Cambiar rol

**`PATCH /api/users/:id/role`**

- **Permiso:** `users:update`

### Request Body

```json
{
  "roleId": "role_admin",
  "role": "admin"
}
```

> Se puede enviar `roleId` o `role` (nombre del rol).

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Rol actualizado"
}
```

---

## 8. Resetear contraseña

**`POST /api/users/:id/reset-password`**

- **Permiso:** `users:update`

### Request Body

```json
{
  "newPassword": "NuevaPass123"
}
```

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Contraseña restablecida. El usuario deberá cambiarla en el próximo inicio de sesión"
}
```

---

## 9. Forzar cambio de contraseña

**`POST /api/users/:id/force-password-change`**

- **Permiso:** `users:update`

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Cambio de contraseña forzado"
}
```

---

## 10. Eliminar usuario (soft-delete)

**`DELETE /api/users/:id`**

- **Permiso:** `users:manage`

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Usuario eliminado"
}
```

---

## 11. Obtener turnos de un usuario

**`GET /api/users/:id/schedules`**

- **Permiso:** `schedules:view`

### Query Parameters

| Parámetro | Tipo   | Obligatorio | Descripción |
|-----------|--------|-------------|-------------|
| `from`    | string | No          | Fecha inicio (ISO) |
| `to`      | string | No          | Fecha fin (ISO) |

### Response (200)

```json
{
  "success": true,
  "data": [ ... ]
}

---

## 12. Reactivar usuario

**`POST /api/users/:id/reactivate`**

- **Permiso:** `users:update`

### Parámetros

- `:id` — ID del usuario a reactivar (path parameter).

### Body

No requiere body.

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Usuario reactivado"
}
```

Descripción: Restaura un usuario previamente desactivado. Registra auditoría con la acción `REACTIVATE_USER`.
```
