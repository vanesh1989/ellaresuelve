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
- 2026-10-01: **Google Auth** (Emergent-managed): botón "Continuar con Google", POST /api/auth/session con session_id → session_token 7 días; user_sessions en Mongo con TTL; current_user acepta JWT y session tokens; usuarios Google sin password_hash con foto de Google.
- 2026-10-01: **Fotos de perfil** (clientas y profesionales) con Emergent Object Storage: POST /api/upload, GET /api/files/{path} (Bearer o ?token=), PUT /api/users/me/photo; PhotoPicker con flujo de permisos completo; avatares con foto en home, tarjetas, perfil y chat.
- 2026-10-01: **Chat bidireccional**: la cuenta que publica un servicio recibe y responde chats (badge "CLIENTA", role=professional); conversations guardan user_name/owner_id/provider_photo.
- 2026-10-01: Banner Premium muestra $3.000/mes (upgrade sigue mock por decisión de la usuaria).

## Backlog
- **P1**: Premium con pago real (RevenueCat gestionado por Emergent, ~$3.000/mes) — usuaria prefirió mock por ahora.
- **P1**: Dedupe de reseñas por usuario; reseñas seed coherentes con contadores.
- **P2**: Galería de trabajos en perfil profesional, notificaciones push de mensajes, verificación de identidad real.
- **P2**: 201 vs 200 en POST /providers; JWT_SECRET fallback hardcodeado.

## Testing
- iteration_1: 24/24 backend, todos los flujos frontend PASS. iteration_2: sanity post-restart PASS.
- iteration_3: 36/36 backend, Google Auth (redirect + endpoint), fotos (upload/display/ownership), chat bidireccional E2E, banner $3.000, regresión completa — PASS. Login Google real requiere cuenta Google (no automatizable).
