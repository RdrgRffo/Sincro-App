# Backend Constants Guide

Objetivo: mapa rapido de donde estan las constantes, reglas, tipos y validaciones del backend actual.

Alcance:
- Incluye constantes globales, catalogos por modulo, tipos de dominio y validaciones.
- No lista variables locales temporales dentro de funciones.

## 1) Configuracion Global

- src/config/env.ts
  - Variables de entorno validadas con zod: DATABASE_URL, JWT_*, PORT, CORS_ORIGIN, IMPORT_DEFAULT_PASSWORD, SEED_*.
  - Fuente de verdad para runtime env.
- src/config/constants.ts
  - ROLES
  - USER_STATUS
  - DEPARTMENT_CATALOG
  - NOTIFICATION_TYPES
  - NOTIFICATION_STATUS
  - MAX_FAILED_ATTEMPTS
  - LOCKOUT_MINUTES
- src/config/database.ts
  - Instancia Prisma singleton y politica de logging por NODE_ENV.

## 2) Catalogos por Modulo

- src/modules/branches/branches.constants.ts
  - HOLIDAY_TYPES
  - HOLIDAY_SCOPES
  - BRANCH_CODES
- src/modules/departments/departments.constants.ts
  - Constantes de etiqueta y catalogo propio del modulo de departamentos.
- src/modules/roles/roles.constants.ts
  - ROLE_NAMES
  - ROLE_LABELS
  - PERMISSIONS (44 permisos canónicos)
- src/modules/schedule-types/schedule-types.constants.ts
  - Catalogo de tipos de schedule y colores asociados.
- src/modules/shift-presets/shift-presets.constants.ts
  - Presets de turnos y defaults de plantilla.
- src/modules/skills/skills.constants.ts
  - Catalogo base de skills, categorias y defaults del modulo.
- src/modules/schedules/schedules.constants.ts
  - Etiquetas y defaults del modulo de schedules.
- src/modules/users/users.constants.ts
  - Valores canonicos para usuarios, importacion CSV y estados auxiliares.
- src/modules/absences/absences.constants.ts
  - ABSENCE_PERMISSIONS (mapeo de permisos de ausencias)
  - ABSENCE_STATUS (pending, colindante, approved, rejected, cancelled)
- src/modules/absences/absences.types.ts
  - AbsenceType (si existe como tipo local)
- backend/prisma/schema.prisma
  - enum AbsenceType (vacaciones, asuntos_propios, formacion, permiso_retribuido, cumpleanos, baja_medica, maternidad, paternidad, compensatorio, festivo)
  - enum AbsenceStatus (pending, colindante, approved, rejected, cancelled)
  - enum HolidayType (nacional, autonomica, local, mejora, regional, company)


## 3) Contratos de Dominio

Estos archivos no son constantes puras, pero fijan contratos estables de datos y reglas.

- src/modules/branches/domain/branches.types.ts
  - BranchHolidayType
  - BranchHolidayScope
  - Tipos de entrada y listados del modulo de branches.
- src/modules/branches/domain/branches.rules.ts
  - Normalizacion de codigos de sucursal y fechas de feriados.
- src/modules/departments/domain/departments.types.ts
  - Tipos de entrada y filtros del modulo de departments.
- src/modules/departments/domain/departments.rules.ts
  - Normalizacion de codigos y nombres de departamento.
- src/modules/users/domain/user.factory.ts
  - Normalizacion de email y telefono para crear usuarios.
- src/modules/schedules/domain/schedule.rules.ts
  - Reglas de rango, duracion, horas semanales y calculo de semana ISO.
- src/modules/schedules/weekly-summary.service.ts
  - Recalculo y lectura de resúmenes semanales.
- src/modules/planning/planning.types.ts
  - Tipos de filtros, riesgo, cobertura, disponibilidad y comentarios.
- src/modules/skills/skills.types.ts
  - Tipos auxiliares del modulo de skills.
- src/modules/skills/skills.manager.ts
  - Logica de acceso y manipulacion para skills y asignaciones.

## 4) Validacion y Esquemas

- src/modules/planning/planning.validation.ts
  - Esquemas zod para filtros, comentarios, soporte y preferencias de notificaciones.
- src/modules/skills/skills.validation.ts
  - Esquemas zod para alta, edicion, listado y asignacion de skills.
- src/modules/users/users.http.schemas.ts
  - Validacion de entradas y respuestas del modulo de usuarios.
- src/modules/branches/branches.http.schemas.ts
  - Validacion de entradas y respuestas del modulo de sucursales.
- src/modules/departments/departments.http.schemas.ts
  - Validacion de entradas y respuestas del modulo de departamentos.
- src/modules/schedules/schedules.http.schemas.ts
  - Validacion de schedules, filtros y payloads relacionados.
- backend/prisma/schema.prisma
  - Entidades y enums de persistencia, incluido ScheduleType.
- backend/prisma/seed.ts
  - Punto de entrada del seed Prisma.
- backend/src/scripts/seeds/*
  - Seeds modulares por dominio.
- frontend/src/index.css
  - Tokens visuales fijos de Sincro consumidos por el cliente. No existe configuracion visual editable en backend.

## 5) Sincronizacion Backend <-> Frontend

Mantener estos pares alineados:
- Roles y estados:
  - backend/src/config/constants.ts
  - backend/src/modules/roles/roles.constants.ts
  - frontend/src/types/index.ts
- Tipos de schedule:
  - backend/prisma/schema.prisma
  - backend/src/modules/schedule-types/schedule-types.constants.ts
  - frontend/src/types/index.ts
  - frontend/src/pages/SchedulePage.tsx
- Departamentos y sucursales:
  - backend/src/config/constants.ts
  - backend/src/modules/branches/branches.constants.ts
  - backend/src/modules/branches/domain/*
  - backend/src/modules/departments/domain/*
  - frontend/src/pages/admin/UsersPage.tsx
  - frontend/src/pages/admin/UserFormModal.tsx
- Skills:
  - backend/src/modules/skills/*
  - frontend/src/pages/admin/SkillsPage.tsx
  - frontend/src/hooks/useScheduleTypes.ts
- Planning y resumen semanal:
  - backend/src/modules/planning/*
  - backend/src/modules/schedules/domain/schedule.rules.ts
  - backend/src/modules/schedules/weekly-summary.service.ts
  - frontend/src/pages/admin/PlanningPage.tsx
  - frontend/src/pages/SchedulePage.tsx
- Notificaciones y webhooks:
  - backend/src/config/constants.ts
  - backend/src/modules/notifications/*
  - backend/src/modules/in-app-notifications/*
  - backend/src/modules/webhooks/*
  - frontend/src/pages/admin/NotificationsPage.tsx
  - frontend/src/pages/admin/WebhooksPage.tsx

## 6) Regla de Oro para CSV de Usuarios

- Backend valida departamentos con codigos canonicos.
- Frontend puede mostrar etiquetas mas amigables para UX.
- Siempre normalizar antes de validar o exportar para evitar falsos errores.

## 7) Checklist Rapido al Agregar una Constante

1. Ubicarla en el modulo correcto (config global, catalogo o dominio).
2. Exportarla desde el archivo de constantes o tipos del modulo.
3. Si impacta API o UI, actualizar el archivo espejo del frontend.
4. Si impacta seed o importacion, revisar prisma/seed.ts y los seeds modulares.
5. Actualizar tests del modulo afectado en backend/test y frontend/test si aplica.

## 8) Busqueda Rapida

- Buscar constantes exportadas en backend:
  - rg "export const|as const" backend/src
- Buscar uso de una constante concreta:
  - rg "NOMBRE_CONSTANTE" backend/src backend/test
