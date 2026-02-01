# API — Tipos de Turno (`/api/schedule-types`)

## Resumen

CRUD completo de tipos de turno con soft-delete/reactivación. Define las categorías de turnos (mañana, tarde, noche, etc.).

---

## Endpoints

### `GET /api/schedule-types`

Lista todos los tipos de turno activos.

**Permiso:** `schedule_types:read`

**Respuesta:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "code": "string",
      "description": "string | null",
      "color": "string | null",
      "isActive": true,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

### `GET /api/schedule-types/:id`

Obtiene un tipo de turno por ID.

**Permiso:** `schedule_types:read`

---

### `POST /api/schedule-types`

Crea un nuevo tipo de turno.

**Permiso:** `schedule_types:create`

**Body:**
```json
{
  "name": "string (requerido)",
  "code": "string (requerido, único)",
  "description": "string (opcional)",
  "color": "string (opcional, formato hex #RRGGBB)"
}
```

**Respuesta:** `201 Created` con el tipo de turno creado.

---

### `PUT /api/schedule-types/:id`

Actualiza un tipo de turno.

**Permiso:** `schedule_types:update`

**Body:** (todos opcionales)
```json
{
  "name": "string",
  "code": "string",
  "description": "string",
  "color": "string"
}
```

---

### `DELETE /api/schedule-types/:id`

Soft-delete de un tipo de turno (marca `isActive = false`).

**Permiso:** `schedule_types:delete`

---

### `PATCH /api/schedule-types/:id/reactivate`

Reactivar un tipo de turno desactivado.

**Permiso:** `schedule_types:update`
