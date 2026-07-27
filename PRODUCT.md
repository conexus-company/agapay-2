# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Filipino citizens navigating the public/private healthcare system — the primary audience is the **broad general public**, not a tech-savvy early-adopter segment. Design defaults should assume varying digital literacy, including older or less tech-comfortable citizens, and favor familiar, low-friction patterns over novel interaction models. (This is why the SSO login flow was moved from an initial dark theme to light mode — confirmed directly by the user: "normal users don't like dark mode.")

## Product Purpose

AGAPAY is a citizen-centered digital healthcare journey platform for the Philippines. It connects government digital identity, AI-assisted navigation, and messaging services so citizens can find the right care, book appointments, and manage their healthcare journey through a single verified identity — without repeatedly re-entering the same information.

Problem it solves: healthcare access in the Philippines is fragmented — citizens re-enter their information and navigate disconnected systems just to find, book, and access appropriate care.

Success means a citizen can move through verify → discover → book → check in → track without duplicate data entry or disconnected systems.

## Positioning

AGAPAY is the digital layer connecting citizens to the healthcare system — not a competing record or coverage system:

- **PhilHealth** answers "How is healthcare financially covered?"
- **A hospital ID** answers "How does this facility identify you?"
- **AGAPAY** answers "How does the citizen navigate their entire digital healthcare journey?"

The mechanism a neighboring product couldn't truthfully copy: one verified digital identity (via eGov SSO, eVerify, Face Liveness) that carries across every step of the journey — navigation, booking, check-in, notifications — so the citizen verifies once instead of per-facility or per-service.

## Operating Context

Core journey (from README): **Verify Once → Trusted Identity → Find the Right Care → Book Appointment → Check In → Receive Updates → Track Journey**.

MVP modules:

| Module | Handles |
|---|---|
| Citizen Authentication | eGov SSO, eVerify, Face Liveness |
| Digital Health Identity | Digital Health ID, consent, QR code, once-only data reuse |
| Healthcare Navigation | eGov AI, service recommendations |
| Healthcare Discovery | Provider directory, GIS facility map, facility details |
| Appointment | Schedule selection, booking, confirmation |
| Digital Check-in & Queue | QR verification, check-in, queue assignment |
| Notifications | eMessage for appointment/queue/health updates |
| Healthcare Journey | Journey timeline and status tracking |

Future roadmap (not current scope): provider portals (Phase 2), smart referrals (Phase 3), eGovPay payments (Phase 4), eGovChain tamper-evident records (Phase 5), eReport citizen reporting (Phase 6).

This is being built as a hackathon project against a per-feature spec (feature IDs like A-001, A-002... each with its own acceptance criteria and due date), integrating against real hackathon sandbox APIs (eGov SSO, Face Liveness) rather than mocks.

## Capabilities and Constraints

- Built on Expo SDK 57 / React Native 0.86 / React 19 with Expo Router (file-based routing, typed routes), targeting iOS, Android, and web from one codebase.
- Citizen Authentication (eGov SSO) is implemented: token exchange + profile fetch via Expo Router API routes, `partner_code`/`partner_secret` kept server-side only, session token stored via `expo-secure-store` (web falls back to `localStorage`, since SecureStore has no web implementation).
- Face Liveness API integration exists (session creation + result polling).
- Env vars present but not yet built into features: `EVERIFY_*` (eVerify), `EGOV_AI_ACCESS_CODE` (AI-assisted navigation), `EGOVPAY_*` (payments, Phase 4 — earlier than roadmap suggests), `EMESSAGE_ACCESS_TOKEN`, `EREPORT_ACCESS_TOKEN`, plus a Supabase project (likely backend/data layer, not yet integrated into app code).
- The eGov SSO citizen-facing login/authorize page URL is not yet provided by eGov — it's isolated as a single placeholder constant (`EGOV_SSO_AUTHORIZE_URL`) for a one-line swap later.
- Terminology: "citizen" (not "user"), "Digital Health ID" (QR-based identity credential that does not expose medical history), "exchange_code" (single-use eGov SSO code).
- Undecided: how/whether eGovPay, eGovChain, and eReport integrate into the citizen-facing journey vs. remaining backend-only or later-phase.

## Brand Commitments

- Name: **AGAPAY**. Tagline: "Your Digital Healthcare Journey, Connected Once."
- Logo: `assets/images/logo.png` — wordmark in blue, with the "A" accented in Philippine-flag yellow/red.
- Primary accent blue (`#2563EB`–`#2563EB` range) is the established CTA color, carried from the eGov SSO login screen.
- No confirmed official eGovPH design system or accessibility standard exists yet (confirmed directly with the user) — current visual decisions (e.g. light mode over the initially-spec'd dark placeholder theme) are working defaults, not final government branding, and should be revisited if an official system is later provided.

## Evidence on Hand

- eGov SSO sandbox integration has been verified end-to-end against the real hackathon sandbox base URL (`https://hackathon-sso.e.gov.ph`), including a live `422` (expired/already-used exchange code) propagating correctly through the backend and UI.
- No real citizen testimonials, case studies, usage data, or press exist — do not fabricate any.
- This is a hackathon submission; screenshots/demos should reflect sandbox/dev-mode testing, not production usage claims.

## Product Principles

1. **Verify once, reuse everywhere** — a citizen should never have to re-enter identity or personal data they've already verified through AGAPAY, across any module.
2. **Familiar over novel** — the audience is the broad general public, including citizens with lower digital comfort; default to conventional, low-friction UI patterns over novel ones unless there's a specific reason to diverge.
3. **Platform-native feel** — lean into native per-OS conventions (native tab bars, native splash, platform-appropriate components) rather than forcing one custom visual skin across iOS/Android/web.
4. **Government-adjacent trust, not government identity** — the product mediates a citizen's national digital identity and health journey and must read as credible and secure, while being explicit that it is not itself PhilHealth, a hospital ID system, or a system of record.
5. **Be honest about placeholders** — where upstream eGov endpoints or design systems aren't final, isolate them as clearly-marked, swappable constants and build dev-only test paths, rather than blocking or faking completeness.

## Accessibility & Inclusion

No official accessibility standard or eGovPH design system has been confirmed yet. Until one is provided, follow general best practice already established in the Citizen Authentication flow: sufficient text contrast, minimum 44×44 touch targets, and screen-reader labels on interactive elements and error/success states.
