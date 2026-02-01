# Frontend Sincro

Aplicación SPA de Sincro construida con React, Vite y TypeScript.

## Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Zustand (estado cliente)
- TanStack Query (caché y fetching)
- Vitest + Testing Library

## Tema e identidad visual

- La identidad visual es fija de Sincro.
- No existe Theme Manager ni bootstrap de tema desde backend.
- La paleta y tokens visuales quedan fijos en variables CSS de `src/index.css`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Estructura base

```text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── store/
│   ├── config/
│   └── test/
├── public/
└── package.json
```

## Convenciones

- Rutas de administración bajo `/admin/*` con controles por rol.
- Mantener consistencia de marca: nombre visible `Sincro`, logo y favicon del proyecto.
