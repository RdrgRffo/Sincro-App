# API — Notificaciones In-App (`/api/in-app-notifications`)

## Resumen

Gestión de notificaciones dentro de la aplicación: listado paginado, marcado como leídas, conteo de no leídas y eliminación.

---

## Endpoints

### `GET /api/in-app-notifications`

Lista paginada de todas las notificaciones del usuario autenticado.

**Autenticación:** Requerida (sin permiso específico)

**Query params:**

| Parámetro | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `page`    | number | Página actual (default: 1)           |
| `limit`   | number | Items por página (default: 20)       |

**Respuesta:**
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "message": "string",
      "type": "string",
      "isRead": false,
      "createdAt": "ISO8601"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### `GET /api/in-app-notifications/unread`

Obtiene todas las notificaciones no leídas del usuario.

**Autenticación:** Requerida

---

### `GET /api/in-app-notifications/unread-count`

Obtiene el número de notificaciones no leídas.

**Autenticación:** Requerida

**Respuesta:**
```json
{
  "data": {
    "count": 5
  }
}
```

---

### `PATCH /api/in-app-notifications/:id/read`

Marca una notificación como leída.

**Autenticación:** Requerida

> Solo el propietario de la notificación puede marcarla como leída.

---

### `POST /api/in-app-notifications/read-all`

Marca todas las notificaciones del usuario como leídas.

**Autenticación:** Requerida

---

### `DELETE /api/in-app-notifications`

Elimina todas las notificaciones del usuario autenticado.

**Autenticación:** Requerida

---

### `DELETE /api/in-app-notifications/:id`

Elimina una notificación específica del usuario.

**Autenticación:** Requerida

> Solo el propietario de la notificación puede eliminarla.
