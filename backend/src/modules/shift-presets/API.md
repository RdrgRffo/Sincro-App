# API — Plantillas de Turno (`/api/shift-presets`)

## Resumen

CRUD completo de plantillas de turno con soft-delete/reactivación, aplicación a rango de fechas y previsualización.

---

## Endpoints

### `GET /api/shift-presets`

Lista todas las plantillas activas.

**Permiso:** `shift_presets:read`

**Respuesta:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string | null",
      "isActive": true,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

### `GET /api/shift-presets/:id`

Obtiene una plantilla por ID, incluyendo sus entries (turnos predefinidos).

**Permiso:** `shift_presets:read`

---

### `POST /api/shift-presets`

Crea una nueva plantilla de turno.

**Permiso:** `shift_presets:create`

**Body:**
```json
{
  "name": "string (requerido)",
  "description": "string (opcional)",
  "entries": [
    {
      "dayOfWeek": 0,
      "scheduleTypeId": "string",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "maxEmployees": 5
    }
  ]
}
```

> `dayOfWeek`: 0=domingo, 1=lunes, ..., 6=sábado

**Respuesta:** `201 Created` con la plantilla creada.

---

### `PATCH /api/shift-presets/:id`

Actualiza una plantilla y sus entries.

**Permiso:** `shift_presets:update`

**Body:** (todos opcionales)
```json
{
  "name": "string",
  "description": "string",
  "entries": [
    {
      "dayOfWeek": 0,
      "scheduleTypeId": "string",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "maxEmployees": 5
    }
  ]
}
```

---

### `DELETE /api/shift-presets/:id`

Soft-delete de una plantilla (marca `isActive = false`).

**Permiso:** `shift_presets:delete`

---

### `PATCH /api/shift-presets/:id/reactivate`

Reactivar una plantilla desactivada.

**Permiso:** `shift_presets:update`

---

### `POST /api/shift-presets/:id/apply`

Aplica una plantilla a un rango de fechas, creando los turnos correspondientes.

**Permiso:** `shift_presets:create`

**Body:**
```json
{
  "startDate": "YYYY-MM-DD (requerido)",
  "endDate": "YYYY-MM-DD (requerido)",
  "branchId": "string (requerido)",
  "departmentId": "string (requerido)"
}
```

> Crea schedules para todos los días del rango según la plantilla.

---

### `POST /api/shift-presets/:id/preview`

Previsualiza los turnos que se generarían al aplicar la plantilla sin crearlos realmente.

**Permiso:** `shift_presets:read`

**Body:**
```json
{
  "startDate": "YYYY-MM-DD (requerido)",
  "endDate": "YYYY-MM-DD (requerido)"
}
```

**Respuesta:** Lista de entries que se aplicarían para cada día del rango.
