# API — Departamentos (`/api/departments`)

## Resumen

CRUD completo de departamentos con soft-delete, asignación de managers, relación con sucursales y consulta de miembros.

---

## Endpoints

### `GET /api/departments`

Lista todos los departamentos activos.

**Permiso:** `departments:view`

**Respuesta:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "code": "string",
      "isActive": true,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

### `POST /api/departments`

Crea un nuevo departamento.

**Permiso:** `departments:create`

**Body:**
```json
{
  "name": "string (requerido)",
  "code": "string (requerido, único)"
}
```

**Respuesta:** `201 Created` con el departamento creado.

---

### `PATCH /api/departments/:departmentId`

Actualiza un departamento.

**Permiso:** `departments:update`

**Body:** (todos opcionales)
```json
{
  "name": "string",
  "code": "string"
}
```

---

### `DELETE /api/departments/:departmentId`

Soft-delete de un departamento (marca `isActive = false`).

**Permiso:** `departments:delete`

---

### `PATCH /api/departments/:departmentId/reactivate`

Reactivar un departamento desactivado.

**Permiso:** `departments:update`

---

### `DELETE /api/departments/:departmentId/permanent`

Eliminación física permanente de un departamento.

**Permiso:** `departments:delete`

---

### `GET /api/departments/:departmentId/branches`

Lista las sucursales asociadas a un departamento.

**Permiso:** `departments:view`

---

### `GET /api/departments/:departmentId/members`

Lista los miembros (usuarios) de un departamento.

**Permiso:** `departments:view`

---

### `PATCH /api/departments/:departmentId/manager`

Asigna un manager al departamento.

**Permiso:** `departments:update`

**Body:**
```json
{
  "userId": "string (requerido)"
}
```

> Valida que el usuario no esté asignado como manager a más de 5 departamentos.

---

### `DELETE /api/departments/:departmentId/manager`

Elimina el manager del departamento.

**Permiso:** `departments:update`
