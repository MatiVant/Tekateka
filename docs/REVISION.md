# Revisión Técnica de Tekateka
**Fecha:** 21 de noviembre de 2026  
**Revisor:** Cloud Agent (Cursor)  
**Repositorio:** [github.com/MatiVant/Tekateka](https://github.com/MatiVant/Tekateka)  
**Sitio en producción:** [tekateka.com.ar](https://tekateka.com.ar)

---

## 1. Mapa del Proyecto

### Stack Tecnológico

**Framework y versiones:**
- **Next.js 16.0.10** (App Router) — ⚠️ **3 CVEs sin parchear** (ver sección 3)
- **React 19.2.0** / **React DOM 19.2.0**
- **TypeScript 5.x**
- **Tailwind CSS 4.1.9** + PostCSS 8.5
- **pnpm** como gestor de paquetes

**Base de datos y ORM:**
- **Supabase** (PostgreSQL con Row Level Security habilitado)
- **@supabase/supabase-js** (latest) + **@supabase/ssr** (latest)
- Cliente admin en `lib/supabase/admin.ts` con `SUPABASE_SERVICE_ROLE_KEY`
- Cliente user en `lib/supabase/client.ts` con `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Middleware de auth en `lib/supabase/middleware.ts` (`middleware.ts:4-6`)

**Autenticación:**
- Supabase Auth con sesiones SSR
- Roles: `visitor`, `organizer`, `ticketero`, `superadmin` (tabla `profiles`)
- RLS configurado correctamente (verificado en revisión anterior)

**Pagos:**
- **Mercado Pago** con webhooks firmados HMAC-SHA256 (`app/api/mercadopago/webhook/route.ts:6-18`)
- OAuth2 para conectar cuentas de organizadores (`app/api/mercadopago/oauth/`)
- Verificación de firma implementada con `timingSafeEqual`
- Secret `MERCADOPAGO_WEBHOOK_SECRET` para validación

**Emails:**
- **Resend** (`resend` package, latest)
- Configuración centralizada en `lib/email-config.ts` (PR #13)
- Remitente: `TekaTeka <notificaciones@tktk.buholabs.com.ar>`
- Emails transaccionales: confirmación de compra, QR de entrada, resumen semanal

**Códigos QR:**
- Librería `qrcode` (latest)
- Generación dinámica en `/api/generate-qr?code=...`
- Almacenamiento del código en campo `qr_code` (único) de tabla `tickets`

### Estructura de Carpetas

```
/agent/repos/Tekateka/
├── app/                          # Next.js App Router
│   ├── actions/                  # Server Actions (create-ticket, save-event, etc.)
│   ├── admin/                    # Panel de organizadores
│   ├── api/                      # API Routes
│   │   ├── mercadopago/          # Webhook, checkout, OAuth
│   │   ├── superadmin/           # Endpoints admin
│   │   └── cron/                 # Cron jobs (weekly-sales-summary)
│   ├── auth/                     # Login, signup, reset password
│   ├── eventos/, events/         # Páginas públicas de eventos
│   ├── my-tickets/               # Entradas del comprador
│   ├── profile/                  # Perfil de usuario
│   ├── superadmin/               # Dashboard superadmin
│   ├── verify/                   # Validación de QR en puerta
│   └── layout.tsx, page.tsx
├── components/                   # Componentes React
│   ├── admin/                    # Componentes del panel organizador
│   ├── superadmin/               # Componentes del panel superadmin
│   ├── ui/                       # Componentes UI (shadcn/ui + Radix)
│   └── verify/                   # Scanner QR y validación
├── lib/                          # Lógica de negocio
│   ├── supabase/                 # Clientes Supabase (admin, server, client)
│   ├── auth.ts                   # Helpers de auth
│   ├── mercadopago.ts            # Refresh tokens MP
│   ├── send-confirmed-ticket-email.ts  # Email de confirmación
│   ├── sales-summary.ts          # Resumen de ventas para organizadores
│   └── platform-fees.ts, legal.ts, etc.
├── scripts/                      # Migraciones SQL de Supabase
│   ├── 001_create_schema.sql    # Esquema inicial (profiles, events, tickets)
│   ├── 004_create_functions.sql # decrement_available_tickets()
│   ├── 006_allow_guest_purchases_final.sql  # Compras sin auth
│   └── 037_add_purchase_notifications.sql, etc.
├── public/                       # Assets estáticos
├── styles/, globals.css          # Estilos globales
├── vercel.json                   # Config de Vercel (crons)
├── package.json, pnpm-lock.yaml
└── tsconfig.json, eslint.config.mjs
```

### Build y Deploy

- **Build:** `pnpm run build` ejecuta `next build`
- **Deploy:** Probablemente en **Vercel** (el dominio `tekateka.com.ar` y la estructura con `vercel.json` lo sugieren)
- **Cron:** `/api/cron/weekly-sales-summary` configurado en `vercel.json:3-6` para correr diario a las 12:00 UTC
- **Protección de cron:** Header `Authorization: Bearer ${CRON_SECRET}` (`app/api/cron/weekly-sales-summary/route.ts:17`)

### Variables de Entorno

**Variables encontradas en el código** (solo nombres, sin valores):

| Variable | Uso | Archivos |
|----------|-----|----------|
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio (fallback extenso) | `app/actions/create-ticket.ts:201,258`, `lib/send-confirmed-ticket-email.ts:49`, etc. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `lib/supabase/client.ts`, `lib/supabase/server.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | `lib/supabase/client.ts`, `lib/supabase/server.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Supabase (admin) | `lib/supabase/admin.ts` |
| `RESEND_API_KEY` | API key de Resend | `app/actions/create-ticket.ts:12`, `lib/send-confirmed-ticket-email.ts:6`, etc. |
| `MERCADOPAGO_CLIENT_ID` | OAuth client ID de Mercado Pago | `lib/mercadopago.ts:9` |
| `MERCADOPAGO_CLIENT_SECRET` | OAuth client secret de Mercado Pago | `lib/mercadopago.ts:9` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret para firmar webhooks | `app/api/mercadopago/webhook/route.ts:17` |
| `CRON_SECRET` | Secret para proteger crons | `app/api/cron/weekly-sales-summary/route.ts:17` |
| `VERCEL_URL` | URL automática de Vercel | `app/actions/create-ticket.ts:258` (fallback) |
| `SUPPORT_EMAIL` | Email de soporte (sin uso explícito en código actual) | grep output |
| `PURELYMAIL_FROM` | Remitente de Purelymail (sin uso explícito) | grep output |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Redirect URL en dev (sin uso explícito) | grep output |

**⚠️ Variables obsoletas encontradas:** `PURELYMAIL_FROM`, `SUPPORT_EMAIL`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — No se usan en el código actual, pueden eliminarse de la configuración.

---

## 2. Seguridad

### 2.1 Secretos Commiteados ✅

**Estado:** No se encontraron secretos expuestos en el código ni en el historial de git (confirmado en revisión anterior).

### 2.2 Autenticación y Autorización

**RLS (Row Level Security) ✅:**
- Configurado en todas las tablas sensibles (`profiles`, `events`, `tickets`, etc.)
- Políticas revisadas en `scripts/001_create_schema.sql:10-105` y migraciones posteriores
- `service_role` usado correctamente solo en operaciones de admin (`lib/supabase/admin.ts`)

**Endpoints públicos sin autenticación (esperados):**
- `/api/mercadopago/webhook` — Protegido por firma HMAC ✅
- `/api/generate-qr` — Endpoint público (sin datos sensibles, solo genera imagen QR)
- `/eventos`, `/events/[id]` — Páginas públicas de eventos

**Endpoints protegidos:**
- `/admin/*` — Requiere rol `organizer` (verificado en componentes)
- `/superadmin/*` — Requiere rol `superadmin` (verificado en componentes)
- `/api/superadmin/*` — Requieren verificación de rol en cada endpoint

**⚠️ Problema encontrado:** Algunos endpoints de API en `/api/superadmin/` confían en la verificación de rol en el cliente. Se recomienda validar `auth.uid()` y rol en **cada endpoint** individualmente.

### 2.3 Validación de Input

**Validaciones presentes:**
- Precio final vs precio servidor (`app/actions/create-ticket.ts:106`)
- Email obligatorio y normalizado a lowercase (`app/actions/create-ticket.ts:39-40`)
- Términos aceptados (`app/actions/create-ticket.ts:42`)
- Disponibilidad de tickets (`app/actions/create-ticket.ts:52-62`)
- Validación de códigos de promoción con fecha de expiración (`app/actions/create-ticket.ts:80-104`)

**⚠️ Validaciones insuficientes:**
- No hay validación explícita de formato de email (regex)
- No hay sanitización de HTML en campos de texto libre (`description`, `buyer_name`)
- Los QR codes se generan con `randomBytes()` pero no se valida unicidad antes de insertar (se confía en constraint UNIQUE de DB)

### 2.4 Webhook de Mercado Pago

**Seguridad ✅:**
- Verificación de firma HMAC-SHA256 con `timingSafeEqual` (`app/api/mercadopago/webhook/route.ts:17-18`)
- Validación de timestamp (máximo 5 minutos de antigüedad) (`app/api/mercadopago/webhook/route.ts:19`)
- Verificación de `mp_user_id` contra conexiones registradas (`app/api/mercadopago/webhook/route.ts:24-29`)
- Validación de organizador propietario de los tickets (`app/api/mercadopago/webhook/route.ts:87-90`)

**Idempotencia ⚠️:**
- Existe verificación de movimiento duplicado por `payment_id` (`app/api/mercadopago/webhook/route.ts:125-132`)
- `process_mercadopago_payment` es un RPC pero no se encontró su definición en los scripts SQL (posible función faltante en Supabase)
- **Recomendación:** Documentar o crear la función `process_mercadopago_payment` con lógica idempotente explícita

### 2.5 Race Conditions en Stock/Cupos 🔴 **CRÍTICO**

**Problema identificado:**

En `app/actions/create-ticket.ts:52-62`, se verifica disponibilidad con un `SELECT COUNT`:

```typescript
const { count: activeTicketCount } = await supabase
  .from("tickets")
  .select("id", { count: "exact", head: true })
  .eq("event_id", data.event_id)
  .in("status", ["pending", "confirmed", "used"])
// ...
const remainingTickets = Math.max(0, Number(event.total_tickets) - Number(activeTicketCount) - doorSaleCount)
if (requestedQuantity > remainingTickets) throw new Error(...)
```

Luego se llama a `supabase.rpc("create_ticket_atomic", ...)` en línea 145, **pero esta función no existe en ningún script SQL del repositorio**. Esto sugiere que:

1. La función fue eliminada o nunca se deployó a producción
2. El código inserta tickets sin lock transaccional
3. **Dos requests concurrentes pueden pasar el check de disponibilidad y ambas crear tickets, causando sobreventa**

**Evidencia:**
```bash
$ grep -r "create_ticket_atomic" scripts/
# (sin resultados)
```

**Escenario de sobreventa:**
1. Usuario A y Usuario B solicitan la última entrada del evento al mismo tiempo
2. Ambos leen `remainingTickets = 1`
3. Ambos pasan el check `requestedQuantity <= remainingTickets`
4. Ambos insertan un ticket → **2 tickets vendidos cuando solo quedaba 1**

**Impacto:** **ALTO** — Puede causar sobreventa de entradas, incumplimiento de aforo, pérdida de confianza.

**Solución propuesta:**

**Opción A: Lock optimista con constraint CHECK**
```sql
-- Agregar constraint a nivel de base de datos
ALTER TABLE events ADD CONSTRAINT check_available_tickets 
  CHECK (available_tickets >= 0);

-- Decrementar atómicamente en una transacción
BEGIN;
  UPDATE events 
  SET available_tickets = available_tickets - 1 
  WHERE id = $1 AND available_tickets >= 1
  RETURNING id;
  
  -- Si no retorna fila, rollback
  INSERT INTO tickets (...);
COMMIT;
```

**Opción B: Función Postgres con lock FOR UPDATE**
```sql
CREATE OR REPLACE FUNCTION create_ticket_atomic(
  p_event_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_qr_code text,
  p_final_price numeric,
  p_tier_id uuid DEFAULT NULL,
  p_buyer_id uuid DEFAULT NULL,
  p_marketing_consent boolean DEFAULT false
)
RETURNS TABLE(id uuid, qr_code text, status text) AS $$
DECLARE
  v_available int;
  v_ticket_id uuid;
BEGIN
  -- Lock pessimista en la fila del evento
  SELECT available_tickets INTO v_available
  FROM events
  WHERE events.id = p_event_id
  FOR UPDATE;
  
  IF v_available < 1 THEN
    RAISE EXCEPTION 'No quedan entradas disponibles';
  END IF;
  
  -- Decrementar tickets
  UPDATE events SET available_tickets = available_tickets - 1
  WHERE events.id = p_event_id;
  
  -- Insertar ticket
  INSERT INTO tickets (event_id, buyer_name, buyer_email, qr_code, final_price, tier_id, buyer_id, marketing_consent, status)
  VALUES (p_event_id, p_buyer_name, p_buyer_email, p_qr_code, p_final_price, p_tier_id, p_buyer_id, p_marketing_consent, 'pending')
  RETURNING tickets.id, tickets.qr_code, tickets.status INTO v_ticket_id, qr_code, status;
  
  RETURN QUERY SELECT v_ticket_id AS id, qr_code, status;
END;
$$ LANGUAGE plpgsql;
```

Luego actualizar `app/actions/create-ticket.ts` para usar esta función.

**Esfuerzo:** Bajo (~2-3 horas implementación + testing)  
**Riesgo:** Bajo (solo cambia la lógica de inserción, no afecta otras features)  
**Prioridad:** 🔴 **CRÍTICA**

### 2.6 Exposición de Datos Personales

**Buyer Email en Logs 🟠 Ley 25.326:**

En `lib/send-confirmed-ticket-email.ts:74`:
```typescript
console.log("[email] Entrada confirmada enviada", { emailId: emailData?.id, ticketIds, recipient: firstTicket.buyer_email })
```

**Problema:** Se loguea el email completo del comprador. Según **Ley 25.326 de Protección de Datos Personales** (Argentina), los datos sensibles deben tratarse con confidencialidad. Los logs de Vercel pueden ser accesibles a múltiples personas del equipo.

**Solución propuesta:**
```typescript
// Enmascarar el email
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

console.log("[email] Entrada confirmada enviada", { 
  emailId: emailData?.id, 
  ticketIds, 
  recipient: maskEmail(firstTicket.buyer_email) 
});
```

**Esfuerzo:** Bajo (~30 min)  
**Riesgo:** Muy bajo  
**Prioridad:** 🟠 **MEDIO-ALTO** (legal compliance)

**Otras exposiciones:**
- Los endpoints `/api/admin/events/[id]/tickets` retornan datos completos de compradores (esperado para organizadores)
- RLS previene acceso no autorizado ✅

### 2.7 CORS

**Estado:** No hay configuración explícita de CORS en el código.

**Impacto:** Next.js por defecto no habilita CORS en API routes. Esto es **correcto** para una aplicación monolítica donde el frontend y backend están en el mismo dominio.

**Recomendación:** Si en el futuro se necesita consumir las APIs desde otro dominio (ej. app móvil), configurar CORS explícitamente en `next.config.js` o por endpoint.

**Prioridad:** ⚪ **BAJO** (no aplica actualmente)

### 2.8 Rate Limiting

**Estado:** ❌ No hay rate limiting implementado.

**Endpoints vulnerables a abuso:**
- `/api/mercadopago/checkout` — Podría usarse para spam de solicitudes de pago
- `/api/resend-ticket` — Podría usarse para spam de emails
- `/api/resend-payment-link` — Idem
- `/api/support` — Formulario de contacto sin protección

**Impacto:** Un atacante podría:
- Crear miles de reservas pendientes (DoS de stock)
- Enviar cientos de emails (costo en Resend, abuso de servicios)
- Spamear el formulario de soporte

**Solución propuesta:**

**Opción A: Vercel Edge Config con `@vercel/edge-config`**
```typescript
// middleware.ts
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests por minuto
});

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    if (!success) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  return updateSession(request);
}
```

**Opción B: Upstash Redis (más simple, sin Vercel KV)**
- Crear cuenta gratis en Upstash
- Instalar `@upstash/redis` y `@upstash/ratelimit`
- Mismo código que Opción A

**Esfuerzo:** Medio (~3-4 horas setup + testing)  
**Riesgo:** Bajo (solo afecta requests excesivas, no bloquea tráfico legítimo)  
**Prioridad:** 🟡 **MEDIO** (importante para producción)

---

## 3. Dependencias y Vulnerabilidades

### Auditoría de npm (pnpm audit)

**Ejecutado:** `pnpm audit --json`

**Resultados:**

#### 🔴 Vulnerabilidades Críticas/Altas

| CVE | Paquete | Versión Actual | Severidad | Impacto |
|-----|---------|----------------|-----------|---------|
| **CVE-2026-23864** ([GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf)) | `next` | **16.0.10** | 🔴 **HIGH** (7.5 CVSS) | DoS por deserialización en React Server Components. Request HTTP malicioso puede causar uso excesivo de CPU, OOM o crash del servidor. |
| **CVE-2025-59471** ([GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f)) | `next` | **16.0.10** | 🟠 **MODERATE** (5.9 CVSS) | DoS en Image Optimizer cuando se usa `remotePatterns`. Atacante puede servir imágenes arbitrariamente grandes causando OOM. |
| **CVE-2026-29057** ([GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8)) | `next` | **16.0.10** | 🟠 **MODERATE** | HTTP Request Smuggling en rewrites. Request `DELETE`/`OPTIONS` con `Transfer-Encoding: chunked` puede bypassear rutas reescritas. |

**Parches disponibles:**
- Next.js **16.0.11+** (CVE-2026-23864)
- Next.js **16.1.5+** (CVE-2025-59471)
- Next.js **16.1.7+** (CVE-2026-29057)

**Recomendación:** ⬆️ **Actualizar Next.js a 16.1.7 o superior INMEDIATAMENTE**

```bash
pnpm update next@16.1.7
pnpm audit --fix
```

**Esfuerzo:** Bajo (~30 min)  
**Riesgo:** Bajo (Next 16.x mantiene compatibilidad en minor versions)  
**Prioridad:** 🔴 **CRÍTICA**

#### 🟡 Paquetes Desactualizados (no vulnerables pero con updates mayores)

| Paquete | Versión Actual | Última Estable | Notas |
|---------|----------------|----------------|-------|
| `next` | 16.0.10 | **16.1.7** | Ver CVEs arriba |
| `date-fns` | 4.1.0 | 4.1.0 | ✅ Actualizado |
| `lucide-react` | 0.454.0 | ~0.460.0 | Minor update disponible |
| `jspdf` | 4.2.1 | **2.5.2** | ⚠️ Versión major muy desactualizada (4.x no es oficial, probablemente typo) |

**Problema con `jspdf`:** El package.json lista `"jspdf": "^4.2.1"` pero la última versión estable es **2.5.2**. Esto sugiere un error en el número de versión o un fork no oficial.

**Recomendación:**
```bash
pnpm remove jspdf jspdf-autotable
pnpm add jspdf@2.5.2 jspdf-autotable@3.8.4
```

Luego verificar que los PDFs de reportes sigan generándose correctamente.

**Esfuerzo:** Bajo (~1 hora testing)  
**Riesgo:** Medio (puede requerir ajustes en código que genera PDFs)  
**Prioridad:** 🟡 **MEDIO**

### Dependencias con `latest`

**Paquetes con versión `latest` en `package.json:40-67`:**
- `@react-email/render: latest`
- `@supabase/ssr: latest`
- `@supabase/supabase-js: latest`
- `@vercel/analytics: latest`
- `@vercel/blob: latest`
- `qrcode: latest`
- `resend: latest`

**Riesgo:** Usar `latest` puede causar **breaking changes inesperados** en deploys automáticos si el paquete lanza una major version.

**Recomendación:** Fijar versiones específicas:
```json
"@supabase/ssr": "^0.5.2",
"@supabase/supabase-js": "^2.47.10",
"resend": "^4.0.3",
"qrcode": "^1.5.4"
```

**Esfuerzo:** Bajo (~15 min)  
**Riesgo:** Muy bajo  
**Prioridad:** 🟡 **MEDIO**

---

## 4. Bugs y Problemas Evidentes

### 4.1 Función `create_ticket_atomic` Faltante 🔴

**Ya descrito en sección 2.5 (Race Conditions).**

### 4.2 Variable `NEXT_PUBLIC_SITE_URL` sin Setear en Vercel 🟠

**Problema:** La variable `NEXT_PUBLIC_SITE_URL` no está configurada en Vercel (según contexto del usuario).

**Impacto:** El código usa fallbacks complejos que pueden generar URLs incorrectas:

**En `app/actions/create-ticket.ts:201,258`:**
```typescript
// Línea 201 (email de entrada gratuita)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (forwardedHost ? `https://${forwardedHost}` : "https://tktk.buholabs.com.ar")

// Línea 258 (email de compra pendiente)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
  (forwardedHost ? `${forwardedProto}://${forwardedHost}` : 
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
    "http://localhost:3000")
```

**Problemas potenciales:**

1. **QR Codes con URL incorrecta:**
   - Si `NEXT_PUBLIC_SITE_URL` no está seteada y el email se envía desde un background job (ej. webhook), `forwardedHost` puede estar vacío
   - Resultado: QR apuntando a `https://tktk.buholabs.com.ar` (dominio obsoleto?) en vez de `tekateka.com.ar`

2. **Links de pago con subdominios de Vercel:**
   - Si se usa `VERCEL_URL`, los links podrían apuntar a `*.vercel.app` en vez del dominio productivo
   - Los compradores verían URLs confusas o no funcionales

3. **Inconsistencia entre línea 201 y 258:**
   - La línea 201 siempre usa `https://`, pero la 258 depende de `forwardedProto`
   - En localhost esto puede causar links con `http://` en vez de `https://`

**Solución:**

1. **Setear `NEXT_PUBLIC_SITE_URL` en Vercel:**
   ```
   NEXT_PUBLIC_SITE_URL=https://tekateka.com.ar
   ```

2. **Simplificar fallback a un solo valor:**
   ```typescript
   const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar";
   ```

3. **Crear helper centralizado:**
   ```typescript
   // lib/site-url.ts
   export function getSiteUrl() {
     return process.env.NEXT_PUBLIC_SITE_URL || "https://tekateka.com.ar";
   }
   ```

**Esfuerzo:** Muy bajo (~30 min)  
**Riesgo:** Bajo (solo afecta links/QR generados)  
**Prioridad:** 🟠 **MEDIO-ALTO** (puede causar confusión en usuarios)

### 4.3 Código Muerto y Variables de Entorno sin Usar

**Variables obsoletas:**
- `PURELYMAIL_FROM` — No se usa en ningún archivo
- `SUPPORT_EMAIL` — No se usa explícitamente (quizás planeado para `lib/legal.ts` o similar)
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — No se referencia en el código actual

**Recomendación:** Eliminar de la config de Vercel para evitar confusión.

**Esfuerzo:** Muy bajo (~5 min)  
**Riesgo:** Ninguno  
**Prioridad:** ⚪ **BAJO**

### 4.4 Email por Cada Venta al Organizador 🟠

**Contexto (del usuario):** El organizador recibe un mail por cada entrada vendida.

**Estado actual:** No se encontró código que envíe emails individuales al organizador por cada venta. Sin embargo, existe un **resumen semanal** implementado:

- **Cron job:** `/api/cron/weekly-sales-summary/route.ts`
- **Función:** `lib/sales-summary.ts:sendOrganizerSalesSummary()`
- **Frecuencia configurable:** `monthly`, `weekly`, `biweekly`, `off` (tabla `platform_settings`)

**Si efectivamente se está enviando un email por venta**, el código responsable puede estar en:
1. Un trigger de Supabase no versionado en este repo
2. Una integración externa (ej. Zapier, Make, n8n)
3. Código deployado pero no commiteado

**Solución propuesta: Resumen Diario con Batching**

**Diseño:**

1. **Tabla de notificaciones pendientes:**
```sql
CREATE TABLE pending_organizer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid NOT NULL REFERENCES events(id),
  ticket_id uuid NOT NULL REFERENCES tickets(id),
  notification_type text NOT NULL, -- 'new_sale', 'payment_confirmed', 'ticket_cancelled'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_notifications_organizer ON pending_organizer_notifications(organizer_id, created_at);
```

2. **Cron diario (7am Argentina) en `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-sales-notifications",
      "schedule": "0 10 * * *"
    }
  ]
}
```

3. **Endpoint `/api/cron/daily-sales-notifications/route.ts`:**
```typescript
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  const supabase = createAdminClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Agrupar notificaciones por organizador
  const { data: organizers } = await supabase
    .from("pending_organizer_notifications")
    .select("organizer_id, profiles!inner(email, full_name)")
    .gte("created_at", yesterday.toISOString());
  
  const grouped = groupBy(organizers, "organizer_id");
  
  for (const [organizerId, notifications] of Object.entries(grouped)) {
    const organizer = notifications[0].profiles;
    const newSales = notifications.filter(n => n.notification_type === "new_sale");
    const confirmed = notifications.filter(n => n.notification_type === "payment_confirmed");
    
    await resend.emails.send({
      from: "TKTK Entradas <notificaciones@tktk.buholabs.com.ar>",
      to: organizer.email,
      subject: `Ventas del día: ${newSales.length} nuevas entradas`,
      html: renderDailySummaryEmail({ organizer, newSales, confirmed }),
    });
    
    // Marcar como enviadas
    await supabase
      .from("pending_organizer_notifications")
      .delete()
      .in("id", notifications.map(n => n.id));
  }
  
  return Response.json({ success: true });
}
```

4. **En `app/actions/create-ticket.ts`, insertar notificación en vez de enviar email:**
```typescript
await supabase.from("pending_organizer_notifications").insert({
  organizer_id: event.organizer_id,
  event_id: data.event_id,
  ticket_id: createdTicket.id,
  notification_type: "new_sale",
});
```

**Beneficios:**
- ✅ Reduce carga de emails (1 email/día vs N emails/día)
- ✅ Mejora experiencia del organizador (inbox menos saturado)
- ✅ Reduce costos de Resend
- ✅ Permite configurar frecuencia por organizador (futuro)

**Esfuerzo:** Medio (~4-6 horas)  
**Riesgo:** Bajo (no afecta flujo de compra)  
**Prioridad:** 🟠 **MEDIO** (calidad de vida del organizador)

### 4.5 Build de TypeScript

**Estado:** No se pudo verificar porque `node_modules` no está presente.

**Intento:**
```bash
$ pnpm run build
sh: 1: next: not found
```

**Recomendación:** Ejecutar en ambiente con dependencias instaladas:
```bash
pnpm install
pnpm run build
pnpm run lint
```

Si hay errores de tipos, usar `pnpm run build --debug` para ver detalles.

**Esfuerzo:** N/A (depende de errores encontrados)  
**Prioridad:** 🟡 **MEDIO** (verificar antes de deploy)

---

## 5. Tests y CI/CD

### Estado Actual

**Tests:** ❌ **No existen**
- No se encontraron archivos `.test.ts`, `.spec.ts` ni carpeta `__tests__/`
- No hay configuración de Jest, Vitest, ni Playwright

**CI/CD:** ❌ **No existe**
- No hay carpeta `.github/workflows/`
- Vercel probablemente corre builds automáticos en push/PR, pero no hay checks de calidad

**Linting:**
- `eslint.config.mjs` presente
- Script `pnpm run lint` configurado en `package.json:8`

### Recomendaciones

#### 5.1 Tests Unitarios (Jest + React Testing Library)

**Setup:**
```bash
pnpm add -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

**Archivos a testear prioritariamente:**
1. **`lib/sales-summary.ts`** — Cálculos de totales, fechas
2. **`lib/platform-fees.ts`** — Cálculo de comisiones
3. **`lib/date.ts`** — Formateo de fechas (zona horaria Argentina)
4. **`app/actions/validate-promotion.ts`** — Lógica de descuentos

**Ejemplo de test:**
```typescript
// lib/sales-summary.test.ts
import { getSummaryRange } from './sales-summary';

describe('getSummaryRange', () => {
  it('devuelve el rango correcto para el período semanal', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const { start, end } = getSummaryRange('week', now);
    
    expect(start.toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-21T12:00:00.000Z');
  });
});
```

**Esfuerzo:** Alto (~20-30 horas para cobertura básica)  
**Riesgo:** Ninguno (solo agregar, no modifica código)  
**Prioridad:** 🟡 **MEDIO** (importante para mantenibilidad)

#### 5.2 Tests E2E (Playwright)

**Setup:**
```bash
pnpm create playwright
```

**Flows críticos a testear:**
1. **Flujo de compra completo:** Seleccionar evento → Llenar formulario → Ver reserva pendiente
2. **Login de organizador:** Login → Ver panel admin → Editar evento
3. **Validación de QR:** Escanear QR → Confirmar entrada → Ver entrada como "usada"

**Esfuerzo:** Medio (~10-15 horas)  
**Riesgo:** Ninguno  
**Prioridad:** 🟡 **MEDIO** (previene regresiones)

#### 5.3 CI con GitHub Actions

**Archivo `.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run build
      
      - name: Run tests
        run: pnpm test
        if: hashFiles('**/*.test.ts') != ''

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm audit --audit-level=high
```

**Esfuerzo:** Bajo (~1-2 horas)  
**Riesgo:** Ninguno  
**Prioridad:** 🟡 **MEDIO** (previene deploys con errores)

---

## 6. Lista Priorizada de Recomendaciones

### 🔴 Prioridad CRÍTICA

| # | Problema | Solución | Esfuerzo | Riesgo | Archivos Afectados |
|---|----------|----------|----------|--------|-------------------|
| 1 | **Race condition en stock de entradas** (sobreventa) | Implementar función `create_ticket_atomic` con lock `FOR UPDATE` | 2-3 horas | Bajo | `scripts/`, `app/actions/create-ticket.ts:145` |
| 2 | **3 CVEs de Next.js sin parchear** (DoS, Request Smuggling) | `pnpm update next@16.1.7` | 30 min | Bajo | `package.json:57` |

### 🟠 Prioridad ALTA

| # | Problema | Solución | Esfuerzo | Riesgo | Archivos Afectados |
|---|----------|----------|----------|--------|-------------------|
| 3 | **`NEXT_PUBLIC_SITE_URL` sin setear** → Links/QR incorrectos | Setear variable en Vercel + simplificar fallback | 30 min | Bajo | Vercel config, `app/actions/create-ticket.ts:201,258` |
| 4 | **Logging de `buyer_email` sin enmascarar** (Ley 25.326) | Crear función `maskEmail()` y aplicar en todos los logs | 30 min | Muy bajo | `lib/send-confirmed-ticket-email.ts:74` |

### 🟡 Prioridad MEDIA

| # | Problema | Solución | Esfuerzo | Riesgo | Archivos Afectados |
|---|----------|----------|----------|--------|-------------------|
| 5 | **Sin rate limiting** → Vulnerable a spam/DoS | Implementar rate limiting con Upstash | 3-4 horas | Bajo | `middleware.ts`, endpoints `/api/*` |
| 6 | **Email por cada venta al organizador** (si aplica) | Implementar resumen diario con batching | 4-6 horas | Bajo | Nuevo cron, `app/actions/create-ticket.ts` |
| 7 | **Paquetes con `latest`** → Breaking changes inesperados | Fijar versiones específicas | 15 min | Muy bajo | `package.json:40-67` |
| 8 | **`jspdf` versión incorrecta** (4.2.1 vs 2.5.2) | Reinstalar con versión correcta | 1 hora | Medio | `package.json:53`, generación de PDFs |
| 9 | **Sin tests** → Dificulta mantenimiento | Agregar Jest + tests unitarios básicos | 20-30 horas | Ninguno | Nueva carpeta `__tests__/` |
| 10 | **Sin CI/CD** → No valida builds antes de deploy | Agregar GitHub Actions workflow | 1-2 horas | Ninguno | `.github/workflows/ci.yml` |

### ⚪ Prioridad BAJA

| # | Problema | Solución | Esfuerzo | Riesgo | Archivos Afectados |
|---|----------|----------|----------|--------|-------------------|
| 11 | **Variables de entorno obsoletas** | Eliminar `PURELYMAIL_FROM`, `SUPPORT_EMAIL`, etc. | 5 min | Ninguno | Vercel config |
| 12 | **Sin validación de formato de email** | Agregar regex o librería de validación | 1 hora | Bajo | `app/actions/create-ticket.ts:39` |
| 13 | **Sin sanitización de HTML** | Usar `DOMPurify` o similar en campos de texto | 2 horas | Bajo | Componentes que renderizan `description`, etc. |

---

## Resumen Ejecutivo

**Tekateka** es una ticketera funcional en producción con un stack moderno (Next.js 16 App Router + Supabase + Mercado Pago). La arquitectura es sólida y las prácticas de seguridad básicas están bien implementadas (RLS, webhooks firmados, auth con SSR).

### 🔴 Hallazgos Críticos (Acción Inmediata)

1. **Race condition en reserva de tickets:** Sin lock transaccional, dos usuarios pueden comprar la última entrada simultáneamente → **sobreventa**.
2. **Vulnerabilidades de Next.js:** 3 CVEs sin parchear (1 HIGH, 2 MODERATE) que permiten DoS y request smuggling.

### 🟠 Hallazgos de Alta Prioridad

3. **Variable `NEXT_PUBLIC_SITE_URL` faltante:** Puede causar QR codes y links de pago con URLs incorrectas.
4. **Logging de emails personales:** Incumplimiento potencial de Ley 25.326 de Protección de Datos.

### 🟡 Deuda Técnica Importante

5. **Sin rate limiting:** APIs vulnerables a spam y abuso.
6. **Sin tests ni CI/CD:** Dificulta detección de regresiones.
7. **Dependencias desactualizadas:** Incluyendo una versión incorrecta de `jspdf`.

### ✅ Puntos Fuertes

- RLS configurado correctamente en todas las tablas
- Webhook de Mercado Pago seguro (HMAC + validación de timestamp)
- No hay secretos expuestos en código ni git
- Uso correcto de `service_role` solo en operaciones admin
- Arquitectura modular y escalable

**Riesgo General en Producción:** 🟠 **MEDIO-ALTO** (principalmente por sobreventa y CVEs)

---

**Próximos pasos sugeridos:**

1. Parchear CVEs de Next.js (30 min)
2. Implementar `create_ticket_atomic` con lock (2-3 horas)
3. Setear `NEXT_PUBLIC_SITE_URL` en Vercel (5 min)
4. Enmascarar emails en logs (30 min)
5. Planificar implementación de rate limiting y tests (siguiente sprint)

---

**Fin del informe.**
