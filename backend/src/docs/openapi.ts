export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Sincro API',
    version: '1.0.0',
    description: 'API REST para gestión de turnos, ausencias, usuarios, skills, planning y notificaciones.',
  },
  servers: [
    { url: '/api', description: 'API base path' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Schedules' },
    { name: 'Users' },
    { name: 'Absences' },
    { name: 'Skills' },
    { name: 'Planning' },
    { name: 'Webhooks' },
    { name: 'Notifications' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', const: true },
          data: {},
          message: { type: 'string' },
        },
        required: ['success'],
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', const: false },
          error: { type: 'string' },
          code: { type: 'string' },
          details: {},
        },
        required: ['success', 'error'],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Comprueba que la API responde',
        security: [],
        responses: {
          '200': { description: 'Servicio operativo' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicia sesión y devuelve tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  identifier: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
                required: ['password'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login correcto' },
          '400': { description: 'Credenciales inválidas' },
          '429': { description: 'Demasiados intentos de login' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Lista usuarios con filtros y paginación',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de usuarios' } },
      },
      post: {
        tags: ['Users'],
        summary: 'Crea un usuario',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Usuario creado' } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Obtiene un usuario por id',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Usuario encontrado' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Actualiza un usuario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Usuario actualizado' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Elimina un usuario (soft delete)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Usuario eliminado' } },
      },
    },
    '/schedules': {
      get: {
        tags: ['Schedules'],
        summary: 'Lista turnos visibles para el usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de turnos' } },
      },
      post: {
        tags: ['Schedules'],
        summary: 'Crea un turno',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Turno creado' },
          '400': { description: 'Datos inválidos' },
        },
      },
    },
    '/absences': {
      get: {
        tags: ['Absences'],
        summary: 'Lista solicitudes de ausencia según el scope del usuario',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de ausencias' } },
      },
      post: {
        tags: ['Absences'],
        summary: 'Crea una solicitud de ausencia',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Solicitud creada' },
          '400': { description: 'Datos inválidos' },
        },
      },
    },
    '/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'Lista webhooks configurados',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de webhooks' } },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Crea un webhook',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Webhook creado' },
          '400': { description: 'Datos inválidos' },
        },
      },
    },
    '/notifications/friday-summary': {
      post: {
        tags: ['Notifications'],
        summary: 'Envía manualmente el resumen semanal',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Resumen enviado' } },
      },
    },
    '/notifications/absence-summary': {
      post: {
        tags: ['Notifications'],
        summary: 'Envía manualmente el resumen de ausencias (lunes)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Resumen enviado' } },
      },
    },
    '/skills': {
      get: {
        tags: ['Skills'],
        summary: 'Lista skills',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de skills' } },
      },
      post: {
        tags: ['Skills'],
        summary: 'Crea una skill',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Skill creada' } },
      },
    },
    '/planning/coverage-risks': {
      get: {
        tags: ['Planning'],
        summary: 'Obtiene riesgos de cobertura',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Riesgos calculados' } },
      },
    },
    '/planning/absence-impact': {
      get: {
        tags: ['Planning'],
        summary: 'Obtiene impacto de ausencias sobre cobertura',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Impacto calculado' } },
      },
    },
    '/planning/comments': {
      get: {
        tags: ['Planning'],
        summary: 'Lista comentarios de entidad en planning',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Comentarios listados' } },
      },
      post: {
        tags: ['Planning'],
        summary: 'Crea comentario en planning',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Comentario creado' } },
      },
    },
  },
} as const;
