# FoodSave — Food Waste Tracker + Surplus Pickup

Track and reduce personal food waste, and let donors post surplus food for verified collectors to pick up — confirmed with a one-time code at handoff. Backend runs on Lovable Cloud (database, accounts, roles).

## Screens

- **Home (/)** — hero intro, this-week impact summary (waste logged, CO2e/water saved), quick actions: "Log waste" and "Donate surplus", rotating tip card.
- **Log (/log)** — form: item, category, quantity + unit, reason, date, note; recent entries below with edit/delete.
- **Tips (/tips)** — curated tips by category (storage, planning, leftovers, shopping), searchable, markable as tried.
- **Reports (/reports)** — waste over time, by category, by reason; impact cards (CO2e, water, money). Week / month / all-time switcher.
- **Donate (/donate)** — post a surplus food listing: description, quantity, food type, best-before, pickup window, and pickup address with a map pin (drag to adjust or use current location). Donor sees their listings and each one's status.
- **Pickups (/pickups)** — collector-only board: map + list of open donations nearby, with distance and pickup window. Claiming a donation reveals the full address and contact note.
- **Auth (/auth)** — email + password and Google sign-in. Collector accounts request verification; an admin approves them.

## Pickup + OTP flow

```text
Donor posts listing        -> status: open   (address hidden, approx area only)
Verified collector claims  -> status: claimed (full address revealed to that collector)
Donor's screen shows a 6-digit code
Collector arrives, enters the code -> status: collected, timestamped
Codes expire after the pickup window; donor can regenerate; wrong attempts are rate-limited
```

The code is generated server-side, stored hashed, and never exposed to the collector — only the donor can read it. Verification happens in a server function that checks the collector owns the claim and the code matches before marking the pickup collected.

## Roles and access

- Roles live in a dedicated `user_roles` table (`donor`, `collector`, `admin`) — never on the profile row.
- Collector verification: a user applies with organization name and contact; an admin approves, which grants the `collector` role.
- Only verified collectors can view claimable listings or claim them. Exact addresses are never readable by unverified users — open listings expose only a coarse area/approximate point.
- Row-level security on every table, scoped by owner or role.

## Data (Lovable Cloud)

- `profiles` — display name, phone, avatar, created on signup via trigger.
- `user_roles` — user_id + role enum, with a `has_role()` security-definer function used by all policies.
- `collector_applications` — org name, contact, status, reviewed_by.
- `waste_entries` — user's own logged waste (owner-scoped).
- `donations` — donor_id, description, food type, quantity, best-before, pickup window, address lines, lat/lng, approximate lat/lng, status, claimed_by, collected_at.
- `pickup_codes` — donation_id, hashed code, expires_at, attempt count.
- `tips` and `tip_completions` — public tips, per-user "tried" state.

## Design

Warm, produce-inspired palette — deep leaf green, sprout accent, cream paper background — clean card layouts, rounded corners, gentle motion. Fully responsive: stacked single column on mobile, dashboard grid on desktop.

## Technical notes

- Maps and geocoding use the Google Maps connector: browser key for the map and address autocomplete, gateway calls server-side for geocoding a typed address into lat/lng.
- Log, reports, donate, and pickups sit under the authenticated layout; home and tips stay public.
- All donation reads/writes and code generation/verification go through server functions with the authenticated Supabase client; Recharts powers the reports.
- Per-route SEO metadata (title, description, OG/Twitter tags).
