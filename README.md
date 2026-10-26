# POS System (working name)

A multi-business point-of-sale system by **RiG_Designs**: one app for
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

### Making a sale

1. Go to **Sell**. The first time, you'll be asked to **open a shift** — enter the cash in the drawer.
2. Scan a barcode (or type and press Enter), or tap a product. Use + / − or type a quantity
   (decimals like 1.5 work for kg and litre items).
3. Optional: **%** gives a discount (an amount like `5`, or `10%`) — managers and owners only.
   **⏸** puts the sale on hold so you can serve the next customer; resume it from **Held**.
4. **Pay** → choose Cash, Mobile money, Card or Bank. You can split one sale across several methods.
   For cash, tap a note button (GH₵50, GH₵100…) and the change is worked out for you.
5. **Complete sale** → print the receipt or start a new sale.
6. At the end of the day, open **Shift → Close shift**, count the drawer, and see if it's over or short.

Keyboard: **F2** jumps to the search box, **F9** opens payment, **Esc** closes the payment window.

Managers can **void** a sale from **Sales → open the receipt → Void**. Stock goes back automatically.

### Refunds and returns

Open the sale (**Sales → the receipt**) and tap **Refund** (managers and owners).

- Enter how many of each item is coming back. Weighed items can be part-refunded (0.5 kg). **Refund everything left** fills it in for you.
- Untick **Back in stock?** for damaged items so they don't go back on the shelf.
- Choose how the money goes back: cash (comes off the shift drawer, so a shift must be open), MoMo, card, bank,
  or **Take off what they owe** for customers with a balance.
- You can never pay out more than the sale actually took in. For a "pay later" sale, the unpaid part can only be taken off the customer's balance.
- A sale can be refunded in several goes. Each refund prints a slip, and sales, shift and dashboard totals take refunds off.
- Use **Void** to cancel a whole sale by mistake. Once a sale has a refund, refund the rest instead of voiding it.

### Customers and "pay later"

- On the till, tap **Add customer** above the cart to search by name or phone, or add a new customer on the spot.
- If the customer has a **credit limit**, the payment window shows **Pay later**. The amount can't take them over their limit,
  and it can be combined with cash or MoMo (e.g. pay half now, half later).
- **Customers** in the sidebar lists everyone and what they owe. Open a customer to see their statement and
  **Record payment** when they pay you back (with a printable receipt). Cash payments need an open shift and count towards the drawer.
- Only managers and owners can set credit limits. A manager can cancel a payment entered by mistake.
- Voiding a "pay later" sale removes it from what the customer owes.

### Reports

Open **Reports** in the sidebar (owners, managers and accountants).

- Pick a period (today, this week, last month…) or your own dates, and a branch if you have more than one.
- The top shows net sales, gross profit, VAT collected and refunds, with a chart of net sales per day.
- **Summary** walks from gross sales to gross profit: discounts, refunds, VAT and cost of goods.
- Breakdowns by **product**, **category**, **staff**, **payment method** and **day**. Each one downloads as a CSV for Excel.
- How the numbers work: a sale counts on the day it was made, and a refund on the day the money went back.
  Voided sales are left out. Cost uses the cost price at the time of each sale; a returned item that went back on
  the shelf gives its cost back, a damaged one doesn't.

### Managing stock

Open **Stock** in the sidebar (managers and owners).

- **Overview** shows stock value at cost and selling price, plus what is running low or out. Click a product to see its history.
- **Receive stock** records a delivery from a supplier: scan or search products, enter quantity and cost.
  You can tick a box to update cost prices too. You can add a new supplier while you're there.
- **Adjust stock** is for damaged, expired, lost or stolen items, or for correcting a wrong count (a note is required).
- **Stock takes**: start a count (everything, or one category), type what is on the shelf, then **Complete**.
  Stock is corrected to your count and the difference is shown in cedis. Products you don't count are left alone.
  System numbers stay live during the count, so sales while you count are still taken into account.
- **Movements** lists every stock change (sales, deliveries, adjustments, counts) with who did it.

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
│  │  ├─ money.ts             Money helpers (amounts stored in pesewas)
│  │  └─ pricing.ts           Sale totals, VAT, discounts, payment checks (till + server)
│  ├─ modules/                One folder per business type
│  │  ├─ index.ts             The registry — add new modules here
│  │  ├─ retail/  restaurant/  pharmacy/  salon/
│  ├─ server/
│  │  ├─ db/schema/           Database tables (tenancy, people, catalog, sales, system)
│  │  ├─ auth/                Passwords/PINs (scrypt), sessions, permission guards
│  │  └─ services/            Business logic (sign-up, sales, shifts, audit log)
│  └─ components/
└─ routes/
   ├─ (auth)/                 login, register, pin
   ├─ (app)/                  dashboard, sell, sales, shift, products, settings, module pages
   ├─ (print)/receipt/[id]    Printable receipt (no sidebar)
   └─ api/sales               The till posts finished sales here
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

## 4. What's built

### Foundation

- [x] Business sign-up (30-day trial) with chosen modules
- [x] Email/password login, till PIN login, lock till, sign out
- [x] Roles & permissions (Owner, Manager, Cashier, Accountant)
- [x] Module system with switchable modules and module product fields
- [x] Products with categories, VAT, SKU/barcode, opening stock, low-stock alerts
- [x] Staff management with PINs; till/device registration
- [x] Dashboard with setup checklist
- [x] Full database schema for sales, payments, shifts, expenses, batches, audit

### Sales (Phase 1 continued)

- [x] Sales screen: barcode scanning, search, categories, cart, quantities, weighed items
- [x] Discounts (amount or %), hold and resume sales
- [x] Cash, mobile money, card and bank payments, split payments, change calculation
- [x] Prices and totals recalculated on the server, never trusted from the till
- [x] Each sale has its own ID, so a double click or retry never saves it twice
- [x] Receipt numbers per till (T1-000001) or per business (W-000001)
- [x] Stock deducted on sale and returned on void
- [x] Printable 80mm receipts
- [x] Shifts: open with a float, close with a cash count, over/short report
- [x] Sales history by day (cashiers see only their own sales); voids with a reason

### Reports

- [x] Any period (presets or custom dates), per branch or all branches
- [x] Net sales, gross profit and margin, VAT collected, refunds, discounts, average sale
- [x] Daily net sales chart with hover details
- [x] By product, category, staff, payment method and day, each downloadable as CSV
- [x] Credit given, customer payments received, voided sales and stock losses
- [x] Printable

### Refunds

- [x] Partial and full refunds, in several goes, per item and quantity (including weighed items)
- [x] Choose per item whether it goes back into stock
- [x] Refund by cash, MoMo, card, bank, or off the customer's balance; never more than the sale took in
- [x] Refund amounts follow the sale's discount and add up to the sale total exactly
- [x] Printable refund slips; refunds come off sales, shift drawer and dashboard totals

### Customers & credit

- [x] Customers with phone, email, notes and a credit limit
- [x] Attach a customer to a sale from the till; quick-add new customers
- [x] "Pay later" sales, alone or split with other payments, checked against the credit limit
- [x] What each customer owes, worked out from their sales and repayments (never a stored total)
- [x] Repayments by cash, MoMo, card or bank, with printed receipts; cash counts in the shift drawer
- [x] Customer statement with a running balance; managers can cancel a wrong payment

### Stock

- [x] Stock overview: value at cost and retail, low and out-of-stock filters
- [x] Receiving deliveries from suppliers, with optional cost price updates
- [x] Suppliers list with delivery totals
- [x] Stock adjustments (damage, expiry, loss, corrections) with reasons and notes
- [x] Stock takes: count, save progress, complete to correct stock, or cancel
- [x] Full movement history per product, linked to the sale, delivery or count that caused it

## 5. Next steps

- [ ] Stock transfers between branches; batch and expiry tracking (pharmacy)
- [ ] Offline mode (service worker + local database + sync queue)
- [ ] Desktop app (Tauri) with receipt printer support

> VAT is seeded at 15% as a placeholder — confirm current GRA rates and levies before launch.
