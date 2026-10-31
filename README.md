# BeautyConnect Combined Website + Backend

This package combines the BeautyConnect website (`public/index.html`) and the Express/PostgreSQL API in one Node.js project. Express serves the website and API from the same host.

## Features in this starter
- Customer and professional registration/login; passwords are hashed with bcrypt.
- JWT authentication and role-protected admin route.
- Professional profiles and services.
- Booking creation, listing and status updates.
- Reviews for completed bookings.
- Community text posts.
- Basic one-to-one message endpoints.
- Payment ledger that calculates 10% platform commission and 90% professional share.
- Basic security headers, CORS, JSON size limit and rate limiting.

Professional registration is free for now. Customer registration is free.

## Important
This is a development starter, not a production-ready marketplace. Payment initialization only creates a **pending database record**. It does not collect money, call M-Pesa, verify provider callbacks, or pay professionals. Never trigger payouts from a browser redirect, screenshot, or customer claim. Add an approved provider integration and verify authenticated server-to-server callbacks, idempotency, KYC, settlement, refunds and payout support before live use. Payment processing fees are separate from the agreed 10% commission.

Photo uploads, live messaging, email/SMS verification, password reset, availability conflict prevention, moderation, reporting, disputes, audit logs, backups and a security/legal review still need to be added before public launch. Consider Kenya's Data Protection Act and ODPC requirements.

## Setup on Windows / VS Code
1. Install PostgreSQL 14 or later and start it.
2. Open this extracted `BeautyConnect_Backend` folder in VS Code.
3. In VS Code choose Terminal > New Terminal.
4. Run `npm.cmd install`.
5. Create a PostgreSQL database named `beautyconnect` (using pgAdmin or psql).
6. Copy `.env.example` to `.env`.
7. Edit `DATABASE_URL` with your PostgreSQL password and set `JWT_SECRET` to a private random value at least 32 characters long. Never share `.env`.
8. Run `npm.cmd run db:init`.
9. Run `npm.cmd start`.
10. Open http://localhost:3000 in Chrome to view the BeautyConnect website. Open http://localhost:3000/api/health to test the API. Expected: `{"success":true,"message":"BeautyConnect API is running."}`

## API
- GET `/api/health`
- POST `/api/auth/register` body: `{ "name":"Example", "email":"a@example.com", "password":"at-least-10-chars", "role":"customer" }` (role can be `customer` or `professional`)
- POST `/api/auth/login` body: `{ "email":"a@example.com", "password":"..." }`
- GET `/api/auth/me` with `Authorization: Bearer TOKEN`
- GET `/api/providers?location=Embu`
- POST `/api/providers/profile` (professional token)
- GET `/api/services?category=Hair`
- POST `/api/services` (professional token)
- POST `/api/bookings` (signed-in user; service_id and future scheduled_at)
- GET `/api/bookings/mine`
- PATCH `/api/bookings/:id/status`
- POST `/api/reviews` (completed booking only)
- GET `/api/community/posts`; POST `/api/community/posts`
- POST `/api/messages`; GET `/api/messages/:userId`
- POST `/api/payments/initialize` (creates pending ledger record only)
- GET `/api/admin/overview` (admin)
- PATCH `/api/admin/providers/:id/verification` (admin)

Admin accounts cannot be created through public registration. Register a trusted account, then promote it manually in PostgreSQL:
`UPDATE users SET role='admin' WHERE email='your-admin-email@example.com';`

For KSh 1,000: platform commission is KSh 100 (10%); professional share is KSh 900 (90%). This is calculated before processing fees.


## Website and API are packaged together
The frontend file is `public/index.html`; Express serves it at `/`. API routes are available under `/api`.

**Frontend integration status:** The current website is still the original prototype. Its demo registration, booking requests and community posts use browser localStorage and are not yet wired to the new API. The API is included and can be tested separately. A follow-up integration is needed to connect the website forms to real backend endpoints and replace the sample professionals.

## Deploying to the public internet
This ZIP is not itself a public website URL. To publish it, create a PostgreSQL database and deploy this Node.js project to a host such as Render:
1. Put the extracted project in a GitHub repository (do not upload `.env` or secrets).
2. Create a managed PostgreSQL database with your hosting provider.
3. Create a Node web service from the repository; build command: `npm install`; start command: `npm start`.
4. Add environment variables `DATABASE_URL`, `JWT_SECRET` (long random secret), `NODE_ENV=production`, and `FRONTEND_ORIGIN` set to your deployed site origin.
5. Run the database schema in `database/schema.sql` against the hosted database, or run `npm run db:init` from the service's shell once.
6. Deploy and open the URL supplied by the host.

A hosting account and its deployment permissions are required to create the actual public URL. Do not publish real customer data or enable real payments until payment callbacks, payouts, privacy and security have been reviewed.
