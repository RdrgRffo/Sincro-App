# Absences API — Contrato Backend para Frontend

> **Última actualización:** 13 mayo 2026  
> Sustituye el módulo histórico de vacaciones: mismo flujo de negocio sobre el modelo Prisma `Absence`.

## Base URL

```
/api/absences
```

Todas las rutas requieren autenticación (`authMiddleware`) y el permiso indicado en cada sección.

---

## 1. Crear solicitud de ausencia

**`POST /api/absences`**

- **Permiso:** `absences:create`

Request body (JSON): **`startDate`**, **`endDate`**, **`type`** (obligatorio; enum Prisma `AbsenceType`: `vacaciones`, `asuntos_propios`, `formacion`, `permiso_retribuido`, `cumpleanos`, `baja_medica`, `maternidad`, `paternidad`, `compensatorio`, `festivo`). Opcionales: `note`, `employeeId` (solo gestores con alcance). Validaciones: días laborables (lun–vie), fin ≥ inicio. Respuestas con `hasOverlap` / `colindante` y flujo recomendado (modal → confirmar o `DELETE` para deshacer). Rutas bajo `POST /api/absences` y permisos `absences:*`.

---

## 2. Listar solicitudes

**`GET /api/absences`**

- **Permisos:** `absences:read` (propias) + `absences:read-all` (alcance según rol)

Query: `status`, `employeeId`, `branchId`, `departmentId`, `from`, `to`, `search`, `sortBy`, `sortOrder`, `page`, `pageSize`. Respuesta paginada: `items`, `total`, `page`, `pageSize`, `totalPages`.

---

## 3. Detalle

**`GET /api/absences/:id`**

- **Permiso:** `absences:read` / `absences:read-all` según propiedad del registro

---

## 4. Aprobar / Rechazar

**`PATCH /api/absences/:id/approve`** · **`PATCH /api/absences/:id/reject`**

- **Permiso:** `absences:approve`

Body approve: `{ note? }`. Body reject: `{ rejectionReason }` (obligatorio).

---

## 5. Cancelar

**`DELETE /api/absences/:id`**

- **Permiso:** `absences:cancel` (ruta).  
  Empleado: solo propias pendientes/colindantes. Gestores: cancelación en alcance requiere además lógica de `absences:approve` en el servicio para actuar sobre solicitudes ajenas.

---

## 6. Calendario

**`GET /api/absences/calendar`**

- **Permiso:** `absences:read`

Query: `year` + `week` **o** `from` + `to`, más filtros opcionales `branchId`, `departmentId`, `employeeId`. Declarar esta ruta **antes** de `GET /:id` en el router.

---

## Estados

`pending` | `colindante` | `approved` | `rejected` | `cancelled` — mismo significado que en el dominio anterior de vacaciones.

## Permisos CRUD

| Permiso | Descripción |
|---------|-------------|
| `absences:create` | Crear solicitudes |
| `absences:read` | Ver propias + calendario acotado |
| `absences:read-all` | Ver solicitudes del alcance (rol) |
| `absences:approve` | Aprobar/rechazar (y cancelar ajenas en alcance) |
| `absences:cancel` | Llamar a `DELETE` (obligatorio en la ruta) |
| `absences:delete` | Borrado administrativo (si está expuesto) |

## Webhooks / Teams

Los eventos canónicos son `absence_requested`, `absence_approved`, `absence_rejected`, `absence_cancelled` (Teams / webhooks).

Para el detalle campo a campo del JSON, ver también `docs/openapi.json` generado desde `openapi.ts`.
