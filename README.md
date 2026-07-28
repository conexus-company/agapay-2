# AGAPAY

## About the Project

AGAPAY is a citizen-centered digital healthcare journey platform that connects government digital identity, AI-assisted navigation, and messaging services to help Filipinos find the right care, book appointments, and manage their healthcare journey through a single verified identity — without repeatedly providing the same information.

## Problem

Healthcare access in the Philippines is fragmented. Citizens repeatedly re-enter their information and navigate disconnected systems just to find, book, and access appropriate care.

## Solution

AGAPAY connects the citizen journey end-to-end:

1. **Verify once** — via eGov SSO, eVerify, and Face Liveness
2. **Get a trusted digital identity** — a Digital Health ID (QR-based, does not expose medical history)
3. **Find the right care** — via eGov AI-assisted healthcare navigation and GIS facility search
4. **Book an appointment** — select facility, provider, date, and time
5. **Check in** — QR-based check-in with automatic queue assignment
6. **Stay updated** — real-time notifications via eMessage
7. **Track the journey** — a unified timeline of the citizen's healthcare experience

## What AGAPAY Is Not

AGAPAY is not a replacement for PhilHealth or existing hospital ID systems:

- **PhilHealth** answers: _"How is healthcare financially covered?"_
- **A hospital ID** answers: _"How does this facility identify you?"_
- **AGAPAY** answers: _"How does the citizen navigate their entire digital healthcare journey?"_

It is the digital layer connecting citizens to the healthcare system — not a competing record or coverage system.

## Core Concept

```
Verify Once → Trusted Identity → Find the Right Care →
Book Appointment → Check In → Receive Updates → Track Journey
```

## MVP Modules

| Module                   | Handles                                                   |
| ------------------------ | --------------------------------------------------------- |
| Citizen Authentication   | eGov SSO, eVerify, Face Liveness                          |
| Digital Health Identity  | Digital Health ID, consent, QR code, once-only data reuse |
| Healthcare Navigation    | eGov AI, service recommendations                          |
| Healthcare Discovery     | Provider directory, GIS facility map, facility details    |
| Appointment              | Schedule selection, booking, confirmation                 |
| Digital Check-in & Queue | QR verification, check-in, queue assignment               |
| Notifications            | eMessage for appointment/queue/health updates             |
| Healthcare Journey       | Journey timeline and status tracking                      |

---

## Running & Testing This Build

This section is for reviewers and testers who want to get the app running locally.

### Tech Stack

- Expo SDK 57 / React Native 0.86 / React 19, with **Expo Router** (file-based routing, typed routes) and the React Compiler enabled.
- **Supabase** (Postgres + Edge Functions) for the Digital Health Profile / Health ID.
- Expo API routes (`+api.ts` files) act as a thin backend for eGov SSO, health navigation triage, and SMS notifications — this is why `app.json` sets `web.output` to `"server"`.

### Prerequisites

- Node.js 20+ and npm
- An Expo account is **not** required for local dev
- To run on a device/simulator: [Expo Go](https://expo.dev/go) on a physical phone (easiest), or an iOS Simulator / Android Emulator set up per the [Expo docs](https://docs.expo.dev/versions/v57.0.0/)
- A [Supabase](https://supabase.com) project (free tier is fine) — required to get past sign-in, see below

### Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with the values described below, then:

```bash
npm run start
```

This opens the Expo Dev Tools. From there, press `i` (iOS simulator), `a` (Android emulator), `w` (web), or scan the QR code with Expo Go. You can also run a platform directly:

```bash
npm run ios
npm run android
npm run web
```

### Environment Variables

`.env.example` lists every variable the app reads. What's actually required to run and test the app:

| Variable                                                                | Required? | Purpose                                                                                                                                          |
| ------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`                    | **Yes**   | Digital Health Profile. `health-profile-setup.tsx` calls `createOrGetHealthProfile()`, which imports `src/lib/supabase.ts` — the app throws on sign-in if these are unset. See [Supabase Setup](#supabase-setup) below. |
| `GROQ_API_KEY`, `GROQ_MODEL`                                              | Optional  | Powers Stage 1 AI triage in Healthcare Navigation. Facility lookup itself uses the Overpass API and needs no key.                                 |
| `EMESSAGE_BASE_URL`, `EMESSAGE_ACCESS_TOKEN`                              | Optional  | Sends the appointment-confirmed SMS (`src/app/appointments/confirm+api.ts`). Booking still works without it; the notification just won't send.   |
| `EGOV_SSO_BASE_URL`, `EGOV_SSO_PARTNER_CODE`, `EGOV_SSO_PARTNER_SECRET`   | Optional* | Real eGov SSO token exchange. See [Signing In / Test Accounts](#signing-in--test-accounts) — most reviewers won't have these.                     |
| `EGOV_LIVENESS_CALLBACK_URL`, `EGOV_VERIFY_*`                             | Not used  | Face Liveness / eVerify are wired into the login screens but currently disconnected from the flow (see caveat below) — the sandbox SDK hangs after capture, so these aren't exercised yet. |
| `FLOW_TOKEN_SECRET`                                                       | Optional  | Signs short-lived flow tokens used internally between auth steps.                                                                                  |

### Supabase Setup

The app needs one table and one Edge Function:

1. Create a Supabase project and grab its URL + anon key for `.env.local`.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then link and push the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This applies `supabase/migrations/20260727190524_health_profiles.sql`, which creates the `health_profiles` table (RLS enabled, no client-facing policies — it's only ever touched by the Edge Function via the service role key).
3. Deploy the Edge Function that generates the Digital Health ID and QR payload:
   ```bash
   supabase functions deploy generate-health-id
   ```

### Signing In / Test Accounts

The production sign-in flow (`src/app/auth/index.tsx`) goes through **eGov SSO**, a government sandbox that requires partner credentials (`EGOV_SSO_PARTNER_CODE`/`SECRET`) and a manually-obtained `exchange_code` from the eGov test portal. **Most reviewers will not have access to this sandbox**, and the authorize URL in `src/constants/egov-sso.ts` is currently a placeholder pending the eGov team publishing the real one — so the "Continue with eGov SSO" button will not complete a full round-trip out of the box.

For local testing, two dev-only screens (stripped from production builds via `__DEV__`) are linked at the bottom of the login screen:

- **"Developer: test with sandbox exchange code"** (`/auth/dev-login`) — runs the full identity-verification chain.
- **"Developer: quick login (skip liveness/eVerify)"** (`/auth/quick-login`) — jumps straight to the citizen dashboard.

Both still require pasting a valid eGov sandbox `exchange_code` — **if you don't have eGov sandbox access, ask the project team for a working `exchange_code` or a set of `EGOV_SSO_*` credentials to test the sign-in flow end-to-end.** Everything past sign-in (facility discovery/map, appointment booking, journey timeline, health ID/QR) can be explored freely once you're in.

### Linting

```bash
npm run lint
```

There is no automated test suite configured in this repo yet — manual testing through the app is the primary verification method.

---

## Project Structure

```
src/
  app/                # Expo Router screens (file-based routing)
    auth/              # Sign-in, dev-login, quick-login, callbacks
    (app)/             # Authenticated area (tabs, facilities, appointments, journey, health-id)
    appointments/       # Server route: confirm+api.ts (eMessage notification)
    health-navigation/  # Server route: triage+api.ts (Groq)
  components/          # Shared UI, including components/ui primitives
  contexts/            # Auth + health profile setup React contexts
  lib/                 # API clients and helpers (Supabase, eGov, Groq, facilities, etc.)
  constants/           # Theme, spacing, eGov SSO config
supabase/
  migrations/          # SQL schema (health_profiles)
  functions/            # Edge Functions (generate-health-id)
```

## Future Roadmap

- **Phase 2** — Healthcare provider integration (nurse/doctor/lab portals, digital records)
- **Phase 3** — Smart referral system with facility-to-facility coordination
- **Phase 4** — Payments via eGovPay
- **Phase 5** — Tamper-evident records via eGovChain
- **Phase 6** — Citizen reporting via eReport

## Tagline

> **AGAPAY** — Your Digital Healthcare Journey, Connected Once.
