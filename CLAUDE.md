# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## About AGAPAY

AGAPAY is a citizen-centered digital healthcare journey platform for the Philippines (see README.md for the full product concept). This repository currently contains only the default Expo Router scaffold — no AGAPAY-specific screens or features have been built yet. The planned MVP modules are: Citizen Authentication, Digital Health Identity, Healthcare Navigation, Healthcare Discovery, Appointment, Digital Check-in & Queue, Notifications, and Healthcare Journey.

## Commands

- `npm run start` (or `expo start`) — start the Metro dev server
- `npm run ios` / `npm run android` / `npm run web` — start the dev server targeting a specific platform
- `npm run lint` — run `expo lint`
- `npm run reset-project` — moves the starter code in `src/app` to `src/app-example` and creates a blank `src/app`; only run this if explicitly asked to reset the template

There is no test suite configured in this repo yet.

## Architecture

- Expo SDK 57 / React Native 0.86 / React 19, using **Expo Router** for file-based routing with **typed routes** and the **React Compiler** enabled (`app.json` experiments).
- Routable screens live under `src/app/` (not the repo root `app/`) — e.g. `src/app/index.tsx` is the Home tab, `src/app/explore.tsx` is the Explore tab, `src/app/_layout.tsx` is the root layout.
- Navigation uses `expo-router/unstable-native-tabs` (`src/components/app-tabs.tsx`), not the classic `Tabs` component — tab items are declared with `NativeTabs.Trigger`.
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*` (see `tsconfig.json`).
- Theming is manual, not via a UI kit: `src/constants/theme.ts` exports `Colors` (light/dark), `Fonts`, and `Spacing` scale constants. `src/hooks/use-color-scheme.ts` (native) / `.web.ts` (web) resolve the active scheme, and `src/hooks/use-theme.ts` reads colors for it. `ThemedText` / `ThemedView` (`src/components/`) are the base styled primitives — prefer them over raw `Text`/`View` for anything that needs theme-aware colors.
- Platform-specific files use the standard Expo/RN convention: a `.web.tsx` suffix overrides the default (native) implementation for web builds (e.g. `animated-icon.tsx` vs `animated-icon.web.tsx`).
- Global CSS (`src/global.css`) is imported from `theme.ts` and only meaningfully applies on web (via `react-native-web`).
- `src/components/ui/collapsible.tsx` is currently the only component in `components/ui`.

## Working with Expo v57

Expo v57 is a recent major version with breaking API changes (e.g. `NativeTabs`, the new icon/splash config in `app.json`). **Always consult the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before relying on prior Expo knowledge**, since generic or older Expo patterns may not apply here.
