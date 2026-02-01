# Roles API — Contrato Backend para Frontend

> **Última actualización:** 13 mayo 2026

## Base URL

```
/api/roles
```

---

## 1. Listar roles

**`GET /api/roles`**

- **Permiso:** `settings:view`

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "role_admin",
      "name": "admin",
      "description": "Administrador del sistema",
      "permissions": ["users:view", "users:create", "schedules:view", ...],
      "isSystem": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 2. Obtener rol por ID

**`GET /api/roles/:id`**

- **Permiso:** `settings:view`

### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "role_admin",
    "name": "admin",
    "description": "Administrador del sistema",
    "permissions": ["users:view", "users:create", ...],
    "isSystem": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## 3. Listar permisos disponibles

**`GET /api/roles/permissions`**

- **Permiso:** `settings:view`

### Response (200)

```json
{
  "success": true,
  "data": [
    "users:view",
    "users:create",
    "users:update",
    "users:delete",
    "schedules:view",
    "schedules:create",
    "schedules:update",
    "schedules:delete",
    "schedule_types:read",
    "schedule_types:create",
    "schedule_types:update",
    "schedule_types:delete",
    "branches:view",
    "branches:create",
    "branches:update",
    "branches:delete",
    "branches:holidays:manage",
    "departments:view",
    "departments:create",
    "departments:update",
    "departments:delete",
    "settings:view",
    "settings:update",
    "settings:manage",
    "audit:view",
    "absences:create",
    "absences:read",
    "absences:read-all",
    "absences:approve",
    "absences:cancel",
    "absences:delete",
    "webhooks:view",
    "webhooks:manage",
    "notifications:send",
    "notifications:view",
    "shift_presets:read",
    "shift_presets:create",
    "shift_presets:update",
    "shift_presets:delete",
    "skills:view",
    "skills:create",
    "skills:update",
    "skills:delete",
    "skills:assign"
  ]
}
```

---

## 4. Crear rol

**`POST /api/roles`**

- **Permiso:** `settings:manage`

### Request Body

```json
{
  "name": "supervisor",
  "description": "Supervisor de turnos",
  "permissions": ["schedules:view", "schedules:create", "users:view"]
}
```

### Response (201)

```json
{
  "success": true,
  "data": { ... },
  "message": "Role creado"
}
```

---

## 5. Actualizar rol

**`PATCH /api/roles/:id`**

- **Permiso:** `settings:manage`

### Request Body (todos opcionales)

```json
{
  "name": "supervisor_avanzado",
  "permissions": ["schedules:view", "schedules:create", "users:view", "audit:view"]
}
```

### Response (200)

```json
{
  "success": true,
  "data": { ... },
  "message": "Role actualizado"
}
```

---

## 6. Eliminar rol

**`DELETE /api/roles/:id`**

- **Permiso:** `settings:manage`

> No se pueden eliminar roles del sistema (`isSystem: true`).

### Response (200)

```json
{
  "success": true,
  "data": { "message": "Role eliminado" }
}
```
