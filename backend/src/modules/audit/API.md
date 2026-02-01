# API — Auditoría (`/api/audit`)

## Resumen

Listado paginado de logs de auditoría con filtros, detalle de actividad, exportación CSV y rollback de entidades.

---

## Endpoints

### `GET /api/audit`

Lista paginada de logs de auditoría.

**Permiso:** `audit:view`

**Query params:**

| Parámetro | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `page`    | number | Página actual (default: 1)           |
| `limit`   | number | Items por página (default: 20, max: 100) |
| `entity`  | string | Filtra por tipo de entidad (ej: User, Schedule) |
| `action`  | string | Filtra por acción (CREATE, UPDATE, DELETE) |
| `userId`  | string | Filtra por usuario que realizó la acción |
| `startDate` | string (ISO8601) | Fecha inicio del rango |
| `endDate`   | string (ISO8601) | Fecha fin del rango |

**Respuesta:**
```json
{
  "data": [
    {
      "id": "string",
      "entity": "string",
      "entityId": "string",
      "action": "CREATE | UPDATE | DELETE",
      "changes": { "campo": { "old": "valor", "new": "valor" } },
      "performedBy": { "id": "string", "name": "string" },
      "createdAt": "ISO8601"
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 20,
    "totalPages": 25
  }
}
```

---

### `GET /api/audit/export/csv`

Exporta los logs de auditoría a CSV.

**Permiso:** `audit:view`

**Query params:** Mismos filtros que `GET /api/audit`

**Respuesta:** Archivo CSV con headers: `id, entity, entityId, action, changes, performedBy, createdAt`

---

### `GET /api/audit/:id`

Obtiene el detalle completo de un log de auditoría.

**Permiso:** `audit:view`

---

### `POST /api/audit/:id/rollback`

Revierte los cambios registrados en un log de auditoría.

**Permiso:** `settings:update`

> **Importante:** El rollback requiere permiso `settings:update` (no `audit:view`), ya que es una operación destructiva que modifica datos.
