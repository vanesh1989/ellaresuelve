# PRD — MaestrasRed

## Problema original
App móvil (Expo) donde usuarias buscan por ubicación a las mejores profesionales mujeres (niñeras, gasfiteras, jardineras, profesoras), las evalúan con reseñas, y las contactan por WhatsApp con 1 clic. Versión gratuita limitada a las mejor evaluadas. Login con correo + Google (Google pendiente). Idioma: español.

## Personas
- **Clienta**: busca y contacta profesionales cerca de su comuna; evalúa el servicio.
- **Profesional**: publica su perfil con descripción, tarifa y WhatsApp.

## Arquitectura
- Frontend: Expo SDK 57 (expo-router, tabs: Inicio/Buscar/Chats/Publicar), `src/theme.ts` (MaestrasRed iOS-Native Clean), `@react-native-vector-icons/ionicons`, `react-native-keyboard-controller`, `expo-location`.
- Backend: FastAPI + MongoDB (`/app/backend/server.py`), JWT auth, plan free/premium (free = solo rating >= 4.5).
- Integraciones: WhatsApp deep link (wa.me). Google Auth pendiente (Emergent-managed, sin keys necesarias).

## Implementado
- 2026-10-01: Auth correo (registro/login JWT), home con ubicación (GPS + comuna manual), 4 categorías con seed data, búsqueda con filtros (texto/categoría/rating), perfil con reseñas y promedio real, chat interno, registro de profesional, WhatsApp 1-clic, plan gratuito + upgrade mock a Premium.
- 2026-10-01: Bug Expo Go "accounts need to match" → no era bug de app; solución: cerrar sesión en Expo Go y re-escanear QR.

## Backlog
- **P0**: Google Auth (Emergent-managed) — el usuario irá por la API.
- **P1**: Upgrade Premium con pago real (RevenueCat/Stripe), profesionales como cuentas que responden chats, dedupe de reseñas por usuario.
- **P2**: Reseñas seed coherentes con contadores, subida de foto de perfil (Object Storage), notificaciones push.

## Testing
- iteration_1: 24/24 backend, todos los flujos frontend PASS. iteration_2: sanity post-restart PASS.
