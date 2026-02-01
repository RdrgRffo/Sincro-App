# Settings API

La API de configuración visual fue retirada.

## Estado actual

- Ya no existen endpoints en `/api/settings` para tema, presets ni título del sitio.
- Ya no existe el bootstrap público en `/api/public/theme/bootstrap`.
- La identidad visual de la aplicación queda fijada en frontend con la paleta roja de `Sincro`.
- El favicon y el título se gestionan como assets/configuración estática del cliente.

## Implicación para frontend

- No debe realizar llamadas a endpoints de tema o branding.
- Debe usar los tokens visuales fijos definidos en `frontend/src/index.css`.
- El título visible de la aplicación es `Sincro`.
