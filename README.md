# Multi-Vendor Marketplace (FS-01)
React + TypeScript + Tailwind frontend, Node/Express/Prisma/PostgreSQL backend, Redis cart, Docker for services.

## Install first
Node.js 20+, Git, Docker Desktop, VS Code.

## Run (VS Code terminal)
```bash
cd FS-01 && docker compose up -d
cd backend && npm install && npx prisma migrate dev --name init && npm run seed && npm run dev
# second terminal
cd FS-01/frontend && npm install && npm run dev     # http://localhost:5173
# tests (API must be running)
cd FS-01/backend && npm test
```
Demo logins (password `password123`): admin@demo.com, vendor1@demo.com, customer@demo.com. Coupon: SAVE10.

## Milestone status
| # | Milestone | Status |
|---|-----------|--------|
| 1 | Roles, schema, API list | Done (`FS-01/docs/ARCHITECTURE.md`) |
| 2 | JWT + role access | Done |
| 3 | Vendor product CRUD | Done; image is a URL, S3 upload |
| 4 | Search/filter/sort | Done with PostgreSQL; Elasticsearch |
| 5 | Cart, checkout, lifecycle | Done; Redis cart (memory fallback) |
| 6 | Split payments | Commission split stored per item; Stripe/Razorpay not yet |
| 7 | Reviews, coupons, PDF invoice, analytics | Done |

Add screenshots to `FS-01/screenshots/`, your test output and your reflection before submitting.
