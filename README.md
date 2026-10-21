# POS System (working name)

A multi-business point-of-sale system by **MiddleCode Technologies**: one app for
retail shops, restaurants/bars, pharmacies and salons. Each business switches on only
the modules it needs.

**Stack:** SvelteKit 3 · Svelte 5 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM

---

## 1. Run it on your computer (Windows)

You need **Node.js 22+** and **PostgreSQL 16+** (or a free [Neon](https://neon.tech) database).

```powershell
cd D:\Project\pos-system
npm install

# 1. Create the database (in psql or pgAdmin):
#    CREATE USER pos WITH PASSWORD 'pos' CREATEDB;
#    CREATE DATABASE pos_dev OWNER pos;

# 2. Copy the settings file and check DATABASE_URL
copy .env.example .env

# 3. Create the tables and the demo business
npm run db:setup

# 4. Start the app
npm run dev
```

Open http://localhost:5173.

| Demo login | |
|---|---|
| Email sign-in | `owner@demo.test` / `demo1234` |
| Till PINs | Demo Owner `9999` · Ama (Cashier) `1111` · Kofi (Manager) `2222` |

To try PIN login: sign in as the owner → **Settings → This device → Set up as till** →
**Lock till** in the sidebar.

## 2. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app with live reload |
| `npm run check` | Type-check everything |
| `npm run build` then `npm start` | Production build, served at http://localhost:3000 |
| `npm run db:generate` | Create a migration after you change the schema |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:seed` | Add the demo business |
| `npm run db:studio` | Browse the database in your browser |

## 3. How the code is organised

```
src/
├─ hooks.server.ts            Reads the session + till cookies on every request
├─ lib/
│  ├─ core/                   Shared by every business type
│  │  ├─ modules.ts           The PosModule contract every module follows
│  │  ├─ permissions.ts       Permission keys + default roles
│  │  └─ money.ts             Money helpers (amounts stored in pesewas)
│  ├─ modules/                One folder per business type
│  │  ├─ index.ts             The registry — add new modules here
│  │  ├─ retail/  restaurant/  pharmacy/  salon/
│  ├─ server/
│  │  ├─ db/schema/           Database tables (tenancy, people, catalog, sales, system)
│  │  ├─ auth/                Passwords/PINs (scrypt), sessions, permission guards
│  │  └─ services/            Business logic (sign-up, audit log)
│  └─ components/
└─ routes/
   ├─ (auth)/                 login, register, pin
   └─ (app)/                  dashboard, products, sell, settings, module pages
```

### Key design rules

- **Multi-tenant:** every table has `tenant_id`; every query filters by the signed-in user's business.
- **Offline-ready IDs:** all primary keys are UUIDs, so tills can create records offline without clashes.
- **Money in pesewas:** prices are integers (GHS 12.50 → `1250`), never decimals.
- **Stock as movements:** stock is the sum of `stock_movements` rows (+20 opening, −2 sale…), never one overwritten number.
- **Sales are append-only:** fixed by refunds/voids, never edited.
- **Audit log:** price changes, staff changes, module changes and device changes are recorded.

### Adding a new business module

1. Create `src/lib/modules/<name>/index.ts` exporting a `PosModule` (copy `salon/` as a template).
2. Add its key to `ModuleKey` in `src/lib/core/modules.ts`.
3. Add it to the `MODULES` list in `src/lib/modules/index.ts`.
4. Add its pages under `src/routes/(app)/<name>/` and guard them with `requireModule(locals, '<name>')`.

Its sidebar links, permissions and product fields appear automatically.

## 4. What's built (Phase 1 foundation)

- [x] Business sign-up (30-day trial) with chosen modules
- [x] Email/password login, till PIN login, lock till, sign out
- [x] Roles & permissions (Owner, Manager, Cashier, Accountant)
- [x] Module system with switchable modules and module product fields
- [x] Products with categories, VAT, SKU/barcode, opening stock, low-stock alerts
- [x] Staff management with PINs; till/device registration
- [x] Dashboard with setup checklist
- [x] Full database schema for sales, payments, shifts, expenses, batches, audit

## 5. Next steps

- [ ] Sales screen (cart, cash/MoMo/card payments, receipts)
- [ ] Shifts (open/close with cash count)
- [ ] Offline mode (service worker + local database + sync queue)
- [ ] Desktop app (Tauri) with receipt printer support
- [ ] Reports

> VAT is seeded at 15% as a placeholder — confirm current GRA rates and levies before launch.
