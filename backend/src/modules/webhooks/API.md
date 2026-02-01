# Webhooks API — Contrato Backend para Frontend

> **Última actualización:** 13 mayo 2026

## Base URL

```
/api/webhooks
```

---

## 1. Listar webhooks

**`GET /api/webhooks`**

- **Permiso:** `webhooks:view`
- Sin `webhooks:manage` (p. ej. gerente general), la respuesta solo incluye webhooks de su sede (`branchId` o departamento vinculado a esa sede). Los webhooks “globales” (sin sede ni departamento) no se listan para ese rol.

### Query Parameters

| Parámetro      | Tipo   | Obligatorio | Descripción |
|----------------|--------|-------------|-------------|
| `departmentId` | string | No          | Filtrar por departamento |
| `branchId`     | string | No          | Filtrar por sucursal |

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "wh_123",
      "name": "Slack General",
      "webhookUrl": "https://hooks.slack.com/services/...",
      "enabled": true,
      "notifyModifications": true,
      "notifyLastMinute": true,
      "fridayReminderEnabled": true,
      "mondayAbsenceReminderEnabled": true,
      "fridayReminderTime": "12:00",
      "departmentId": null,
      "branchId": "branch_xyz",
      "department": null,
      "branch": { "id": "branch_xyz", "name": "Sucursal Centro" },
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 2. Crear webhook

**`POST /api/webhooks`**

- **Permiso:** `webhooks:manage`

### Request Body

```json
{
  "name": "Teams RRHH",
  "webhookUrl": "https://outlook.office.com/webhook/...",
  "enabled": true,
  "notifyModifications": true,
  "notifyLastMinute": true,
  "fridayReminderEnabled": true,
  "mondayAbsenceReminderEnabled": true,
  "fridayReminderTime": "12:00",
  "departmentId": null,
  "branchId": "branch_xyz"
}
```

- `departmentId` (opcional): Si se especifica, el webhook solo notificará eventos de ese departamento.
- `branchId` (opcional): Si se especifica, el webhook solo notificará eventos de esa sucursal.
- Si ambos son `null`, el webhook es global (notifica todos los eventos).

### Response (201)

```json
{
  "success": true,
  "data": {
    "id": "wh_123",
    "name": "Teams RRHH",
    "webhookUrl": "https://outlook.office.com/webhook/...",
    "enabled": true,
    "notifyModifications": true,
    "notifyLastMinute": true,
    "fridayReminderEnabled": true,
    "mondayAbsenceReminderEnabled": true,
    "fridayReminderTime": "12:00",
    "departmentId": null,
    "branchId": "branch_xyz",
    "department": null,
    "branch": { "id": "branch_xyz", "name": "Sucursal Centro" },
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "message": "Webhook creado"
}
```

---

## 3. Actualizar webhook

**`PATCH /api/webhooks/:id`**

- **Permiso:** `webhooks:manage`

### Request Body (todos opcionales)

```json
{
  "name": "Teams RRHH Actualizado",
  "enabled": false
}
```

### Response (200)

```json
{
  "success": true,
  "data": { ... },
  "message": "Webhook actualizado"
}
```

---

## 4. Eliminar webhook

**`DELETE /api/webhooks/:id`**

- **Permiso:** `webhooks:manage`

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Webhook eliminado"
}
```

---

## 5. Probar webhook

**`POST /api/webhooks/:id/test`**

- **Permiso:** `webhooks:manage`

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Mensaje de prueba enviado correctamente"
}
```

### Response (500)

```json
{
  "success": false,
  "error": "Error al enviar: Connection refused"
}
```
