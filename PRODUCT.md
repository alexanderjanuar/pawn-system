# Product

## Register

product

## Users

**Petugas (staff / clerk)** — works the counter at Gulam Cell II. Enters new pawn transactions while a customer waits, prints the A4 receipt, processes extensions (perpanjang) and redemptions (tebus). Wants speed and zero arithmetic mistakes. Often mid-conversation with a customer; the screen has to be fast and unambiguous.

**Pemilik (owner)** — full access. Watches business health (running principal, fee income, items per status, upcoming due dates), sets fee rules, manages staff accounts. Checks in a few times a day, wants the state of the shop in one glance.

**Pelanggan (customer)** — never logs into the internal tool. Uses one public page to check the status of their own pawned item (device, principal, due date) by looking up a code, without visiting or phoning the counter.

## Product Purpose

Replaces Gulam Cell II's manual paper-note bookkeeping for phone pawning with a digital system: record incoming items, auto-calculate the holding fee (biaya titipan), track due dates with WhatsApp reminders, and report on the business. Success = fewer miscalculations, fewer lapsed/auctioned items from missed due dates, and the owner never having to reconstruct the day from a stack of notes.

## Brand Personality

Trustworthy, warm, unfussy. This is a neighborhood shop tool, not enterprise software: it should feel like a well-kept ledger, not a cold SaaS dashboard. Three words: **dependable, warm, quick**. The emotional goal for staff is calm confidence (the numbers are right, the status is obvious); for the owner, reassurance (the shop is under control).

## Anti-references

- Generic SaaS dashboards with gradient hero-metric cards.
- Loud, saturated, or gimmicky color. We use a single *restrained* emerald accent over clean cool-white neutrals, not a full-saturation costume.
- Identical icon-heading-text card grids repeated down the page.
- Over-animated, "delightful" consumer-app motion that gets in the way of fast data entry.

## Design Principles

1. **Honest, legible numbers.** Money is the point. Tabular figures, clear Rupiah formatting, the auto-calculated fee always shown before it is committed. Never make the user second-guess an amount.
2. **Status readable at a glance.** The five pawn statuses (AKTIF, DIAMBIL, PERPANJANG, TIDAK DIAMBIL, LELANG) have one consistent color vocabulary everywhere they appear. A clerk should read a row's state without reading words.
3. **Fast for the counter.** Smart forms, sensible defaults, auto-calculation, minimal clicks. The clerk is serving a person in real time; the tool disappears into the task.
4. **Warm, not loud.** Calm surfaces, warm neutrals, a single confident accent. Restraint over decoration. The interface earns trust by getting out of the way.

## Accessibility & Inclusion

- WCAG AA contrast minimum for text and interactive states, in both light and dark themes.
- Status is never conveyed by color alone: always a label (and often an icon) alongside the color.
- Full keyboard operability for the data-entry flows; visible focus rings (gold).
- Respect `prefers-reduced-motion`.
- Indonesian-language UI, Rupiah currency, Indonesian date formatting.
