# API — Sucursales (`/api/branches`)

## Resumen

CRUD completo de sucursales con soft-delete, gestión de festivos por sucursal y asignación de managers.

---

## Endpoints

### `GET /api/branches`

Lista todas las sucursales activas.

**Permiso:** `branches:view`

**Query params:**

| Parámetro | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `includeInactive` | boolean | Si es `true`, incluye sucursales desactivadas |

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

### `POST /api/branches`

Crea una nueva sucursal.

**Permiso:** `branches:create`

**Body:**
```json
{
  "name": "string (requerido)",
  "code": "string (requerido, único)"
}
```

**Respuesta:** `201 Created` con la sucursal creada.

---

### `PATCH /api/branches/:branchId`

Actualiza una sucursal.

**Permiso:** `branches:update`

**Body:** (todos opcionales)
```json
{
  "name": "string",
  "code": "string"
}
```

---

### `DELETE /api/branches/:branchId`

Soft-delete de una sucursal (marca `isActive = false`).

**Permiso:** `branches:delete`

---

### `PATCH /api/branches/:branchId/reactivate`

Reactivar una sucursal desactivada.

**Permiso:** `branches:update`

---

### `DELETE /api/branches/:branchId/permanent`

Eliminación física permanente de una sucursal.

**Permiso:** `branches:delete`

---

### `GET /api/branches/:branchId/holidays`

Lista los festivos de una sucursal.

**Permiso:** `branches:view`

**Query params:**

| Parámetro | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `year`    | number | Filtra por año (opcional)            |

---

### `POST /api/branches/:branchId/holidays`

Crea un festivo para una sucursal.

**Permiso:** `branches:holidays:manage`

**Body:**
```json
{
  "date": "YYYY-MM-DD (requerido)",
  "name": "string (requerido)",
  "isRecurring": false
}
```

> Valida que no exista otro festivo activo en la misma fecha para la sucursal.

---

### `PATCH /api/branches/:branchId/holidays/bulk`

Actualización masiva de festivos.

**Permiso:** `branches:holidays:manage`

---

### `DELETE /api/branches/:branchId/holidays/bulk`

Eliminación masiva de festivos.

**Permiso:** `branches:holidays:manage`

---

### `PATCH /api/branches/:branchId/holidays/:holidayId`

Actualiza un festivo específico.

**Permiso:** `branches:holidays:manage`

---

### `DELETE /api/branches/:branchId/holidays/:holidayId`

Elimina un festivo específico.

**Permiso:** `branches:holidays:manage`

---

### `PATCH /api/branches/:branchId/manager`

Asigna un manager a la sucursal (Single Transaction Pattern).

**Permiso:** `branches:update`

**Body:**
```json
{
  "userId": "string (requerido)"
}
```

---

### `DELETE /api/branches/:branchId/manager`

Elimina el manager de la sucursal.

**Permiso:** `branches:update`
