# TableGH

Restaurant discovery and reservations platform for Accra, Ghana. Think OpenTable, localized for the Ghanaian market.

**Stack:** Next.js 15 · TypeScript · PostgreSQL (Neon) · Prisma · Redis (Upstash) · Clerk Auth · Paystack · Arkesel SMS · WhatsApp Business API · Mapbox · Cloudflare R2

---

## Prerequisites

- Node.js 20 LTS
- pnpm or npm
- A Neon (or Supabase) PostgreSQL database
- Upstash Redis account
- Clerk account (phone OTP auth)
- Paystack account (Ghana)
- Arkesel account (SMS)
- Meta Business Manager (WhatsApp Cloud API)
- Mapbox account
- Cloudflare R2 bucket

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/yourorg/tablegh.git
cd tablegh
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and fill in every CHANGE_ME value
```

All required variables are documented inline in `.env.example`.

### 3. Database setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables + indexes)
npm run db:migrate

# Seed with 15 Accra restaurants
npm run db:seed
```

**Required PostgreSQL extensions** (auto-created by migration):
- `pg_trgm` — trigram similarity for fuzzy search
- `unaccent` — accent-insensitive search

If your Neon/Supabase instance doesn't have these, enable them via:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 4. Full-text search indexes

After running migrations, apply these manually (or add to a migration file):

```sql
-- Restaurant full-text search
CREATE INDEX idx_restaurants_fts ON restaurants
  USING gin(to_tsvector('english', name || ' ' || description));

-- Menu item full-text search
CREATE INDEX idx_menu_items_fts ON menu_items
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Trigram index for fuzzy name matching
CREATE INDEX idx_restaurants_name_trgm ON restaurants
  USING gin(name gin_trgm_ops);
```

### 5. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deployment: Vercel + Neon + Upstash

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod

# Set environment variables (or use Vercel dashboard)
vercel env add DATABASE_URL production
vercel env add CLERK_SECRET_KEY production
# ... (all variables from .env.example)
```

**Important Vercel settings:**
- Node.js runtime: 20.x
- Framework preset: Next.js
- Build command: `npm run db:generate && next build`
- Output directory: `.next`

### Neon (Database)

1. Create project at [neon.tech](https://neon.tech)
2. Copy connection strings (pooled + direct) to `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
3. Run `npm run db:migrate:prod` to apply migrations

### Upstash (Redis)

1. Create database at [upstash.com](https://upstash.com)
2. Copy REST URL + token to env vars

---

## Migration commands

```bash
# Create a new migration
npm run db:migrate -- --name your_migration_name

# Deploy migrations to production
npm run db:migrate:prod

# Reset DB (dev only — destroys data)
npx prisma migrate reset

# Open Prisma Studio
npm run db:studio
```

---

## Testing

```bash
# Unit tests (Vitest)
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests (Playwright) — requires dev server running
npm run dev &
npm run test:e2e

# E2E in headed mode (debugging)
npx playwright test --headed
```

### Test structure

```
tests/
├── unit/
│   ├── phone.test.ts    # Phone normalization + MoMo network detection
│   └── slots.test.ts    # Slot availability algorithm + booking ref generation
└── e2e/
    └── booking.spec.ts  # Full booking happy path + cancellation flow
```

---

## API Reference

All routes versioned under `/api/v1/`. Auth via Clerk JWT (Bearer token).

### Restaurants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/restaurants` | No | Search + filter restaurants |
| GET | `/api/v1/restaurants/:slug` | No | Restaurant detail + menu |
| GET | `/api/v1/restaurants/:slug/availability` | No | Available time slots |

### Reservations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/reservations` | Yes | Create reservation |
| GET | `/api/v1/reservations` | Yes | List user's reservations |
| GET | `/api/v1/reservations/:ref` | Yes | Reservation detail |
| PATCH | `/api/v1/reservations/:ref` | Yes | Modify (up to 2h before) |
| DELETE | `/api/v1/reservations/:ref` | Yes | Cancel |

### Waitlist

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/waitlist` | Yes | Join waitlist |
| GET | `/api/v1/waitlist` | Yes | List user's waitlist entries |

### Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/payments/deposit` | Yes | Initiate deposit (card/MoMo) |
| POST | `/api/v1/webhooks/paystack` | — | Paystack webhook handler |

### Reviews

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/reviews` | Yes | Submit review (requires completed booking) |
| GET | `/api/v1/reviews?restaurantId=` | No | List restaurant reviews |

### Admin

| Method | Path | Auth (Owner) | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/restaurants/:id/reservations` | Yes | Reservation calendar |
| GET | `/api/v1/admin/analytics/:id` | Yes | Analytics dashboard data |
| PATCH | `/api/v1/admin/restaurants/:id/settings` | Yes | Update restaurant settings |
| POST | `/api/v1/menu/items` | Yes | Create menu item |
| PATCH | `/api/v1/menu/items/:id` | Yes | Update menu item |
| DELETE | `/api/v1/menu/items/:id` | Yes | Delete menu item |

---

## Key Design Decisions

### Currency
All monetary values stored as integers in **pesewas** (1 GHS = 100 pesewas). Never use floating point for money. Use `formatGHS(pesewas)` for display.

### Timezone
Africa/Accra is **GMT+0 with no DST** — but we still use `date-fns-tz` with explicit `ACCRA_TZ` constant everywhere to prevent bugs if Ghana ever adopts DST, and to be explicit about intent.

### Slot availability
Time slots stored as **minutes since midnight** (integer). This avoids timezone ambiguity in the database and makes interval arithmetic straightforward. See `src/lib/utils/slots.ts` for the full algorithm.

### Double-booking prevention
Uses `SELECT ... FOR UPDATE` via raw Prisma SQL in a transaction. Prisma ORM doesn't support `FOR UPDATE` natively as of v6, hence the `$executeRaw` approach.

### Phone normalization
All phones stored in E.164 (`+233XXXXXXXXX`). Normalization happens at the Zod schema layer — by the time any phone reaches the database, it's been validated and normalized. See `src/lib/validations/index.ts`.

### WhatsApp as primary notification channel
~90% of Ghanaian smartphone users use WhatsApp. All booking confirmations and reminders go WhatsApp-first, SMS as fallback for users who don't have WhatsApp registered.

---

## What I'd Build Next (v2)

1. **Mapbox map view** — clustered pins on `/search`, with hover card. The Mapbox token is already wired up; need to build the `<RestaurantMap>` component using `react-map-gl`.

2. **Admin reservation calendar** — drag-and-drop table assignment using a Gantt-style view. The DB schema supports it; need the frontend.

3. **Loyalty points redemption** — points are earned and stored (`PointsTransaction`); need the redemption flow where users can apply points at checkout.

4. **Walk-in QR code flow** — QR generation per restaurant (`/walkin/:restaurantId`), live queue with WebSockets or Server-Sent Events for real-time position updates.

5. **Meilisearch** — replace PostgreSQL full-text with Meilisearch for sub-50ms fuzzy search at scale. Schema supports it; just a search client swap.

6. **Push notifications** — PWA already has the manifest; add `next-pwa` Web Push for booking reminders as an alternative to WhatsApp (users who haven't connected WA).

7. **Analytics dashboard** — covers-per-day heatmap, no-show rate trends, peak times chart. PostHog + custom SQL aggregations on `reservations`.

8. **Social login** — add Google OAuth via Clerk for faster sign-up, supplementing phone OTP.

9. **Restaurant onboarding flow** — self-serve restaurant registration with admin approval queue. Currently restaurants are seeded manually.

10. **Hubtel MoMo collections via their API** — the Paystack MoMo flow covers most cases, but Hubtel has better rates for some Ghanaian MoMo providers and is worth offering as a parallel payment path.

---

## Ghana Data Protection Act 2012 Compliance

- Explicit consent checkbox on sign-up (`User.consentGiven + consentAt`)
- Data export: `GET /api/v1/account/export` — returns all user data as JSON
- Right to erasure: `DELETE /api/v1/account` — soft-deletes user, anonymizes reservations
- No data transferred outside Ghana without consent (R2 bucket in EU — move to AWS af-south-1 or GH-local S3-compatible for full compliance)

---

## Architecture Notes

```
src/
├── app/                    Next.js App Router
│   ├── (marketing)/        Public-facing pages (SSR/ISR)
│   ├── (auth)/             Sign in / sign up (Clerk hosted)
│   ├── (diner)/            Authenticated diner pages
│   ├── admin/              Restaurant admin dashboard
│   └── api/v1/             API routes
├── components/
│   ├── booking/            BookingWidget, BookingForm
│   ├── restaurant/         HeroSection, RestaurantGrid, RestaurantCard
│   ├── admin/              ReservationCalendar, MenuEditor
│   ├── map/                RestaurantMap (Mapbox)
│   ├── layout/             Navbar, Footer, Providers
│   └── ui/                 shadcn/ui primitive components
├── lib/
│   ├── db/                 Prisma client singleton
│   ├── auth/               Clerk helpers
│   ├── payments/           Paystack, Hubtel
│   ├── notifications/      WhatsApp, SMS
│   ├── storage/            Cloudflare R2 upload
│   ├── search/             Restaurant search service
│   ├── utils/              phone.ts, slots.ts, currency.ts, api.ts
│   └── validations/        Zod schemas (shared client + server)
├── hooks/                  React hooks (useGeolocation, useBooking, etc.)
├── store/                  Zustand stores (search filters, booking draft)
└── types/                  Shared TypeScript types
```
