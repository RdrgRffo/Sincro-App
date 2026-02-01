# API — Skills (`/api/skills`)

## Resumen

CRUD completo de habilidades con soft-delete/reactivación, estadísticas y asignación a usuarios.

---

## Endpoints

### `GET /api/skills`

Lista todas las skills activas.

**Permiso:** `skills:view`

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

### `GET /api/skills/stats`

Obtiene estadísticas de skills (número de usuarios por skill, etc.).

**Permiso:** `skills:view`

---

### `POST /api/skills`

Crea una nueva skill.

**Permiso:** `skills:create`

**Body:**
```json
{
  "name": "string (requerido)",
  "description": "string (opcional)"
}
```

**Respuesta:** `201 Created` con la skill creada.

---

### `PATCH /api/skills/:id`

Actualiza una skill.

**Permiso:** `skills:update`

**Body:** (todos opcionales)
```json
{
  "name": "string",
  "description": "string"
}
```

---

### `DELETE /api/skills/:id`

Soft-delete de una skill (marca `isActive = false`).

**Permiso:** `skills:delete`

---

### `PATCH /api/skills/:id/reactivate`

Reactivar una skill desactivada.

**Permiso:** `skills:update`

---

### `PUT /api/skills/users/:userId`

Asigna skills a un usuario (reemplaza todas las skills actuales).

**Permiso:** `skills:assign`

**Body:**
```json
{
  "skillIds": ["string", "string", "..."]
}
```
