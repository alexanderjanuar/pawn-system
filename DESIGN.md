# Design

Visual system for the Gulam Cell II pawn-management tool. Product register. Clean cool-white neutrals + a single restrained emerald accent. Light default with a dark toggle. All values OKLCH; no pure `#000`/`#fff`; neutrals carry a faint cool tint (hue ~240–250).

## Theme

- **Default:** light, bright and clean. Scene: a clerk at the Gulam Cell II counter in daytime shop light, entering a transaction while a customer waits.
- **Dark:** available via the existing appearance toggle. Cool charcoal, not neutral black.
- Surfaces stay crisp: a soft cool-gray page backdrop, the inset content and cards sit near-white and lift via borders + subtle shadow, the sidebar reads as a light panel.

## Color Palette

Color strategy: **Restrained** — clean neutrals carry the surface, emerald is the single accent (primary actions, current selection, focus, key figures). Status colors are a separate, fixed semantic vocabulary.

### Core (light)
- Background (content): `oklch(0.988 0.004 240)`
- Card / popover: `oklch(0.998 0.0015 240)`
- Foreground (slate ink): `oklch(0.25 0.02 255)`
- Muted foreground: `oklch(0.53 0.02 250)`
- Border / input: `oklch(0.922 0.006 245)`
- Primary (emerald): `oklch(0.56 0.135 160)` with near-white text `oklch(0.99 0.02 160)`
- Accent surface (neutral, hover/selected): `oklch(0.95 0.006 240)` — kept neutral so green appears only as the primary accent, never as a soft-green wash
- Sidebar (soft gray backdrop): `oklch(0.966 0.006 240)`, active item neutral `oklch(0.93 0.007 240)` + emerald ring/icon
- Ring (focus, emerald): `oklch(0.56 0.135 160)`

### Core (dark)
- Background: `oklch(0.2 0.008 250)`
- Card / popover: `oklch(0.235 0.010 250)`
- Foreground: `oklch(0.96 0.005 245)`
- Muted foreground: `oklch(0.72 0.014 250)`
- Border / input: `oklch(0.33 0.010 250)`
- Primary (emerald): `oklch(0.68 0.15 162)` with dark text `oklch(0.18 0.03 160)`
- Sidebar: `oklch(0.18 0.008 250)`

### Status vocabulary (the five pawn states)
Each status renders as a soft tinted badge (tinted bg + strong same-hue text), consistent everywhere, and kept distinct from the emerald brand accent. Never color-only — always paired with its label.

| Status | Meaning | Hue family | Light text / bg |
|---|---|---|---|
| `AKTIF` | in pawn | blue | `oklch(0.50 0.14 250)` on `oklch(0.945 0.03 250)` |
| `PERPANJANG` | extended | violet | `oklch(0.50 0.16 300)` on `oklch(0.95 0.03 302)` |
| `DIAMBIL` | redeemed, closed OK | green | `oklch(0.50 0.13 162)` on `oklch(0.94 0.05 165)` |
| `TIDAK DIAMBIL` | overdue, no contact | amber | `oklch(0.55 0.14 62)` on `oklch(0.95 0.06 68)` |
| `LELANG` | auctioned (terminal) | red | `oklch(0.53 0.18 25)` on `oklch(0.94 0.05 25)` |

Charts reuse: emerald, blue, violet, amber, red (defined as `--chart-1..5`).

## Typography

- One family: **Instrument Sans** (already loaded, weights 400/500/600). No display/body pairing.
- Fixed rem scale, ratio ~1.2. Page title `text-xl`/`text-2xl` semibold; section headings `text-sm`/`text-base` semibold; body `text-sm`; labels/meta `text-xs` muted uppercase-tracking where useful.
- **Money and IDs use tabular figures** (`font-variant-numeric: tabular-nums`, utility `.tabular`). Currency shown as `Rp 1.500.000` (Indonesian grouping). Serial numbers / codes in the same tabular treatment.
- Prose capped ~65–75ch; tables may run denser.

## Components

shadcn/ui (new-york), Lucide icons. Every interactive element ships default/hover/focus/active/disabled; tables get skeleton loading, lists get teaching empty states.

- **StatusBadge** — the single source of truth for the five statuses (color + label + dot).
- **Stat / summary blocks** — restrained: label, tabular value, small delta or context line. No gradient hero-metric cards, no identical icon-card grids.
- **Data table** — dense rows, tabular money columns right-aligned, sticky header, row hover, status badge column.
- **Money input & auto-calc** — the holding-fee (biaya titipan) preview updates live as principal/tenor change; the computed number is always visible before submit.
- **Timeline** — vertical riwayat for a transaction (created → extended → redeemed / auctioned).
- Radius: `--radius: 0.625rem` (cards/inputs `rounded-lg`/`rounded-md`). Elevation via warm borders + subtle `shadow-sm`, not heavy shadows.

## Layout

- App shell: inset **sidebar** (Dashboard, Transaksi, Gadai Baru, Jatuh Tempo, Laporan; owner section: Pengaturan Biaya, Kelola Petugas) + top breadcrumb header. Familiar, predictable.
- Content max-width for reading views; tables and the dashboard span full width. Spacing varied for rhythm, not uniform padding everywhere. Avoid wrapping everything in a card.
- Public **Cek Status** page: no sidebar, centered warm lookup card. **Nota A4**: print-optimized, ink-on-paper, no chrome.
- Responsive: sidebar collapses to icons / sheet on small screens; tables scroll or reflow to stacked rows.

## Motion

- 150–250ms, ease-out. Motion conveys state (hover, selection, fee recalculation, row/toast feedback) — never decorative choreography, no page-load sequences. Respect `prefers-reduced-motion`.
