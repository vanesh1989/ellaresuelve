# RevenueCat — integrated (2026-10-01)
This file is supposed to serve as a memory to you if you have to interact with user's RevenueCat account via integration proxy at any later point in time.

## Identifiers (from /setup response — copy verbatim)
- rc_project_id: proj761042b1
- apple_app_id: app871d04a663
- play_app_id: appc482fafcb1
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> proded81a0b7f3 ($3.000 CLP / P1M, trial: none)
  - $rc_annual -> ELIMINADO el 2026-10-01 (la usuaria solo quiere mensual)
- Dashboard: https://app.revenuecat.com/projects/proj761042b1
- SDK keys: en frontend/.env (EXPO_PUBLIC_REVENUECAT_*); nunca copiar valores aquí.
- Auth para llamadas proxy: la misma Emergent key de backend/.env (no copiar aquí).

## Check for project_state in revenuecat status api response. if the project_state is less than project_created, re-fetch RevenueCat playbook via the integration expert tool.
Status check:
`curl -sS -H "Authorization: Bearer <EMERGENT_KEY>" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/ba583a91-60f0-4079-90e1-552df27f3cee/status"`

## Later updates to user's products (integration proxy apis ONLY — NEVER call the RevenueCat REST API)
- Change price/duration/trial OR add a package (upsert):
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/ba583a91-60f0-4079-90e1-552df27f3cee/products
  body: {"products":[{"package":"$rc_monthly","price":3000,"currency":"CLP","period":"P1M","prices":[{"amount_micros":3000000000,"currency":"CLP"}]}]}
- Remove a package: DELETE .../products/%24rc_monthly ($ -> %24)
- Recover identifiers / repopulate .env: re-run the idempotent /setup call.

## App wiring
- src/revenuecat.tsx: SubscriptionProvider, useSubscription, initializeRevenueCat (module scope en app/_layout.tsx).
- Entitlement gate: isSubscribed (customerInfo.entitlements.active["pro"]) — client-side source of truth.
- Paywall: app/paywall.tsx (coded paywall, $rc_monthly, restore purchases, label "simulado" en preview/Test Store).
- Tras compra/entitlement activo: frontend llama POST /api/users/upgrade para sincronizar plan en backend (filtro de directorio free/premium vive en backend).
- Purchases.logIn(user.id) en cada login/sesión; logOut al cerrar sesión.

## Taking in-app purchases LIVE — store-side steps (USER does these — agent cannot verify or perform)
Real purchases need: App Store Connect API key (.p8) + Google Play service-account JSON en el dashboard de RevenueCat; productos IAP con los MISMOS product IDs en App Store Connect y Play Console; perfiles de pago configurados. Detalles en la sección FAQ del panel de payments de Emergent.
