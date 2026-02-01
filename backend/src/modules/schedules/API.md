# Schedules API — Contrato Backend para Frontend

> **Última actualización:** 28 mayo 2026

## Base URL

```
/api/schedules
```

---

## 1. Listar turnos

**`GET /api/schedules`**

- **Permiso:** `schedules:view`
- **Roles y alcance:**
  - `admin`: ve todas las sucursales (puede filtrar por `branchId`)
  - `general_manager`: solo ve su sucursal asignada
  - `department_manager`: solo ve su sucursal asignada
  - `employee`: solo ve su sucursal y sus propios turnos asignados

### Query Parameters

| Parámetro | Tipo   | Obligatorio | Descripción |
|-----------|--------|-------------|-------------|
| `from`    | string | No          | Fecha inicio del rango (ISO) |
| `to`      | string | No          | Fecha fin del rango (ISO) |
| `userId`  | string | No          | Filtrar por usuario asignado |
| `type`    | string | No          | Filtrar por tipo (value del scheduleType) |
| `branchId`| string | No          | Filtrar por sucursal (solo admin) |

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "sched_123",
      "title": "Guardia mañana",
      "description": "Atención al público",
      "startDatetime": "2026-06-15T08:00:00.000Z",
      "endDatetime": "2026-06-15T15:00:00.000Z",
      "type": "guardia",
      "color": "#FF5733",
      "scheduleTypeId": "st_123",
      "scheduleType": { "id": "st_123", "value": "guardia", "label": "Guardia", "color": "#FF5733" },
      "location": "Planta baja",
      "notes": "Traer identificación",
      "isLastMinute": false,
      "hoursPerDay": 7,
      "confirmed": true,
      "branchId": "branch_xyz",
      "branch": { "id": "branch_xyz", "name": "Sucursal Centro", "code": "CENTRO" },
      "createdBy": { "id": "user_admin", "name": "Admin" },
      "assignments": [
        {
          "user": {
            "id": "user_abc",
            "name": "Juan Pérez",
            "email": "juan@empresa.com",
            "avatarUrl": null,
            "department": { "id": "dept_123", "name": "Ventas" },
            "companyPhone": "922123456",
            "auxiliaryPhone": null
          }
        }
      ],
      "createdAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

---

## 2. Obtener turno por ID

**`GET /api/schedules/:id`**

- **Permiso:** `schedules:view`
- **Roles y alcance:**
  - `admin`: puede ver cualquier turno
  - `general_manager`: solo turnos de su sucursal
  - `department_manager`: solo turnos de su sucursal
  - `employee`: solo turnos de su sucursal

### Response (200)

```json
{
  "success": true,
  "data": { ... }
}
```

---

## 3. Obtener turnos semanales

**`GET /api/schedules/week/:year/:week`**

- **Permiso:** `schedules:view`
- **Roles y alcance:**
  - `admin`: ve todas las sucursales (puede filtrar por `branchId`)
  - `general_manager`: solo ve su sucursal asignada
  - `department_manager`: solo ve su sucursal asignada
  - `employee`: solo ve su sucursal y sus propios turnos

### Query Parameters

| Parámetro      | Tipo   | Obligatorio | Descripción |
|----------------|--------|-------------|-------------|
| `branchId`     | string | No          | Filtrar por sucursal (solo admin) |
| `departmentId` | string | No          | Filtrar por departamento |
| `userId`       | string | No          | Filtrar por usuario asignado |

### Response (200)

```json
{
  "success": true,
  "data": {
    "year": 2026,
    "week": 25,
    "weekStart": "2026-06-15T00:00:00.000Z",
    "weekEnd": "2026-06-21T23:59:59.999Z",
    "total": 3,
    "items": [
      {
        "id": "sched_123",
        "title": "Guardia mañana",
        "startDatetime": "2026-06-15T08:00:00.000Z",
        "endDatetime": "2026-06-15T15:00:00.000Z",
        "type": "guardia",
        "color": "#FF5733",
        "scheduleTypeId": "st_123",
        "location": "Planta baja",
        "notes": null,
        "isLastMinute": false,
        "hoursPerDay": 7,
        "branchId": "branch_xyz",
        "assignees": [
          {
            "id": "user_abc",
            "name": "Juan Pérez",
            "email": "juan@empresa.com",
            "avatarUrl": null,
            "department": { "id": "dept_123", "name": "Ventas" },
            "companyPhone": "922123456",
            "auxiliaryPhone": null
          }
        ]
      }
    ]
  }
}
```

---

## 4. Crear turno

**`POST /api/schedules`**

- **Permiso:** `schedules:create`

### Request Body

```json
{
  "title": "Guardia tarde",
  "description": "Cobertura de tarde",
  "startDatetime": "2026-06-16T15:00:00.000Z",
  "endDatetime": "2026-06-16T22:00:00.000Z",
  "scheduleTypeId": "st_123",
  "color": "#33FF57",
  "location": "Planta primera",
  "notes": "Puerta trasera",
  "branchId": "branch_xyz",
  "assigneeIds": ["user_abc", "user_def"],
  "hoursPerDay": 7,
  "confirmed": false
}
```

> También acepta `scheduleType.id` o `type.id` en lugar de `scheduleTypeId`, y `branch.id` en lugar de `branchId`.

### Response (201)

```json
{
  "success": true,
  "data": { ... },
  "message": "Guardia creada"
}
```

---

## 5. Actualizar turno

**`PATCH /api/schedules/:id`**

- **Permiso:** `schedules:update`

### Request Body (todos opcionales)

```json
{
  "title": "Guardia tarde extendida",
  "endDatetime": "2026-06-16T23:00:00.000Z",
  "assigneeIds": ["user_abc"],
  "reason": "Cambio de horario por necesidad del servicio"
}
```

### Response (200)

```json
{
  "success": true,
  "data": { ... },
  "message": "Guardia actualizada"
}
```

---

## 6. Eliminar turno

**`DELETE /api/schedules/:id`**

- **Permiso:** `schedules:delete`

### Request Body (opcional)

```json
{
  "reason": "Cancelado por falta de personal"
}
```

### Response (200)

```json
{
  "success": true,
  "data": null,
  "message": "Guardia eliminada"
}
```

---

## 7. Resumen semanal de horas (propias)

**`GET /api/schedules/my-weekly-summary/:year/:week`**

- **Permiso:** `schedules:view`
- **Roles:** todos

> Alias compatible: `GET /api/schedules/weekly-summary/me/:year/:week`

### Response (200)

```json
{
  "success": true,
  "data": {
    "userId": "user_abc",
    "year": 2026,
    "week": 25,
    "totalHours": 42.5,
    "baseHours": 40,
    "overtimeHours": 2.5,
    "dailyBreakdown": "{\"2026-06-15\":8,\"2026-06-16\":8.5,\"2026-06-17\":8,\"2026-06-18\":9,\"2026-06-19\":9}",
    "calculatedAt": "2026-06-20T00:00:00.000Z"
  }
}
```

---

## 8. Alertas de turnos (sin personal)

**`GET /api/schedules/alerts`**

- **Permiso:** `schedules:view`

### Query

Sin parámetros.

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "alert_1",
      "type": "unassigned",
      "schedule": {
        "id": "sched_123",
        "title": "Guardia mañana",
        "startDatetime": "2026-06-15T08:00:00.000Z",
        "endDatetime": "2026-06-15T15:00:00.000Z",
        "branch": { "id": "branch_xyz", "name": "Sucursal Centro" }
      },
      "reason": "no assignees",
      "createdAt": "2026-06-14T09:00:00.000Z"
    }
  ]
}
```

Descripción: Devuelve alertas generadas por la lógica de `getScheduleAlerts` (turnos sin asignar, asignaciones únicas, reasignaciones necesarias). Los ítems contienen el turno implicado y la razón.

---

## 9. Resumen semanal del equipo

**`GET /api/schedules/team-weekly-summary/:year/:week`**

- **Permiso:** `schedules:view`
- **Roles:** admin, general_manager (scope: su branch), department_manager (scope: su depto)

### Query Parameters

| Parámetro      | Tipo   | Obligatorio | Descripción |
|----------------|--------|-------------|-------------|
| `branchId`     | string | No          | Filtrar por sucursal (solo admin) |
| `departmentId` | string | No          | Filtrar por departamento |

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "userId": "user_abc",
      "userName": "Juan Pérez",
      "totalHours": 42.5,
      "baseHours": 40,
      "overtimeHours": 2.5
    },
    {
      "userId": "user_def",
      "userName": "María García",
      "totalHours": 38,
      "baseHours": 40,
      "overtimeHours": 0
    }
  ]
}
```

---

## Reglas de negocio

1. **Solapamiento**: No se permite crear/actualizar un turno si alguno de los asignados ya tiene otro turno en el mismo rango horario.
2. **Festivos**: No se puede asignar trabajo en días festivos (a menos que `confirmed: true` o el tipo sea `vacaciones`, `ausencia`, `otro`, `excepcion`).
3. **Último minuto**: Si el turno se crea con menos de 24h de antelación, se marca como `isLastMinute: true`.
4. **Permisos por sucursal**: Los managers solo pueden gestionar turnos de su propia sucursal.
5. **Auditoría**: Cada operación (crear, actualizar, eliminar) genera un registro de auditoría.
6. **Notificaciones**: Los cambios disparan notificaciones a los webhooks configurados.
7. **Tiempo real**: Los cambios se publican vía WebSocket para actualización en vivo del frontend.
8. **Resumen semanal**: Se calcula automáticamente al crear/modificar turnos. El desglose diario se almacena como JSON.
