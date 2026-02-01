# Planning API — Contrato Backend

## Base URL

```
/api/planning
```

Todos los endpoints (salvo preferencias) requieren `authMiddleware`. Permisos por ruta se indican en cada sección.

---

## 1. Riesgos de cobertura

**`GET /api/planning/coverage-risks`**

- **Permiso:** `schedules:view`

### Query

| Parámetro      | Tipo   | Obligatorio | Descripción        |
|----------------|--------|-------------|--------------------|
| `from`         | ISO date | Sí        | Inicio del rango   |
| `to`           | ISO date | Sí        | Fin del rango      |
| `branchId`     | string | No          | Filtra sucursal    |
| `departmentId` | string | No          | Filtra departamento|

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "severity": "high",
      "reasons": ["Turno descubierto"],
      "schedule": {
        "id": "sch_1",
        "title": "Mañana",
        "startDatetime": "2026-05-12T08:00:00.000Z",
        "endDatetime": "2026-05-12T16:00:00.000Z",
        "branch": { "id": "b1", "name": "Centro" }
      }
    }
  ]
}
```

---

## 2. Disponibilidad por empleado

**`GET /api/planning/availability`**

- **Permiso:** `schedules:view`
- **Query:** mismo rango que §1 (`from`, `to`, `branchId`, `departmentId`).

### Response (200)

`data`: array de `{ userId, userName, email, branch, department, skills, status, schedulesCount, absencesCount, days[] }` con `days[].date` y `days[].status` en `available` | `busy` | `absence`.

---

## 3. Matriz de disponibilidad

**`GET /api/planning/availability-matrix`**

- **Permiso:** `schedules:view`
- **Query:** igual que §1.

### Response (200)

```json
{
  "success": true,
  "data": {
    "days": ["2026-06-01T00:00:00.000Z"],
    "rows": [
      {
        "id": "user_1",
        "name": "Ana",
        "branch": { "id": "b1", "name": "Centro" },
        "department": { "id": "d1", "name": "Cocina" },
        "skills": [],
        "days": [
          { "date": "2026-06-01T00:00:00.000Z", "status": "available", "schedules": [] }
        ]
      }
    ]
  }
}
```

---

## 4. Sustitutos sugeridos

**`GET /api/planning/substitutes`**

- **Permiso:** `schedules:view`
- **Query:** `from`, `to`, `branchId`, `departmentId`, `scheduleId` (opcional), `skillIds` (lista separada por comas, opcional).

---

## 5. Equity (carga / horas)

**`GET /api/planning/equity`**

- **Permiso:** `schedules:view`
- **Query:** rango §1.

### Response (200)

Array de `{ id, name, branch, department, totalHours, overtimeEstimate, weekendShifts, urgentShifts, approvedAbsences, rejectedAbsences }`.

---

## 6. Línea de tiempo

**`GET /api/planning/timeline`**

- **Permiso:** `schedules:view`
- **Query:** rango §1.

Eventos unificados: `holiday`, `absence`, `schedule` con `at`, `title`, `severity`, etc.

---

## 7. Modo crisis (resumen)

**`GET /api/planning/crisis`**

- **Permiso:** `schedules:view`
- **Query:** rango §1.

### Response (200)

`{ highRisks, mediumRisks, overloaded, today }` — subconjuntos derivados de cobertura, equity y timeline.

---

## 8. Impacto de ausencias (calendario)

**`GET /api/planning/absence-impact`**

- **Permiso:** `absences:read`
- **Query:** `employeeId` (opcional; default actor), `startDate`, `endDate`.

### Response (200)

`employee`, `overlappingAbsences`, `assignedSchedules`, `holidays`, `likelihood`, `summary`.

---

## 9. Vista previa de plantilla

**`GET /api/planning/template-preview`**

- **Permiso:** `schedules:view`
- **Query:** rango §1 + `skillIds` (coma) + `minCoverage` (1–10, default 1).

---

## 10. Comentarios de entidad

**`GET /api/planning/comments`**

- **Permiso:** `schedules:view`
- **Query:** `entityType`, `entityId`.

**`POST /api/planning/comments`**

- **Permiso:** `schedules:view`
- **Body:** `entityType`, `entityId`, `body`.

---

## 11. Preferencias de notificación (planning)

**`GET /api/planning/notification-preferences`**

- Autenticado (sin permiso extra explícito en router).

**`PATCH /api/planning/notification-preferences`**

- Autenticado.
- **Body:** flags booleanos opcionales (`scheduleChanges`, `absenceUpdates`, `departmentAbsenceRequests`, `dailySummary`, `weeklySummary`, `criticalAlertsOnly`).

---

## Errores comunes

| Código | Cuándo |
|--------|--------|
| `FORBIDDEN` | Rama solicitada fuera del scope visible del actor |
| `BAD_REQUEST` | Rango de fechas inválido o comentario vacío |
| `NOT_FOUND` | Empleado inexistente |
