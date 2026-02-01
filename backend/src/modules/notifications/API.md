# API — Notificaciones (`/api/notifications`)

## Resumen

Gestión de logs de notificaciones, reenvío de notificaciones fallidas, envío manual de resúmenes (viernes/lunes) y anuncios a webhooks de Teams.

---

## Endpoints

### `GET /api/notifications/logs`

Lista paginada de logs de notificaciones.

**Permiso:** `webhooks:view`

**Query params:**

| Parámetro | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `page`    | number | Página actual (default: 1)           |
| `limit`   | number | Items por página (default: 20, max: 100) |
| `type`    | string | Filtra por tipo de notificación      |
| `status`  | string | Filtra por estado (success/error)    |

**Scope:** El listado respeta el ámbito del usuario (solo logs de su sede a menos que tenga `canBypassWebhookScope`).

**Respuesta:**
```json
{
  "data": [
    {
      "id": "string",
      "type": "string",
      "status": "success | error",
      "message": "string | null",
      "sentAt": "ISO8601",
      "webhookConfig": { "id": "string", "name": "string" },
      "sentBy": { "id": "string", "name": "string" }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### `POST /api/notifications/resend/:logId`

Reenvía una notificación fallida.

**Permiso:** `webhooks:manage` o `notifications:send`

> Valida que el log pertenezca al ámbito del usuario.

---

### `POST /api/notifications/friday-summary`

Envía manualmente el resumen de planificación del viernes a los webhooks especificados.

**Permiso:** `webhooks:manage` o `notifications:send`

**Body:**
```json
{
  "webhookConfigIds": ["string", "string", "..."]
}
```

> Si no se especifican `webhookConfigIds`, se envían a todos los webhooks del ámbito del usuario.

---

### `POST /api/notifications/absence-summary`

Envía manualmente el resumen de ausencias del lunes a los webhooks especificados.

**Permiso:** `webhooks:manage` o `notifications:send`

**Body:**
```json
{
  "webhookConfigIds": ["string", "string", "..."]
}
```

> Si no se especifican `webhookConfigIds`, se envían a todos los webhooks del ámbito del usuario.

---

### `POST /api/notifications/announce`

Envía un anuncio manual a los webhooks especificados.

**Permiso:** `webhooks:manage` o `notifications:send`

**Body:**
```json
{
  "message": "string (requerido)",
  "webhookConfigIds": ["string", "string", "..."]
}
```

> Si no se especifican `webhookConfigIds`, se envía a todos los webhooks del ámbito del usuario.
