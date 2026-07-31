# FoodSave — Food Waste Tracker

A web app to log daily food waste, learn reduction tips, and see progress and environmental impact over time. Backend runs on Lovable Cloud (database + accounts).

## Screens

- **Home (/)** — hero intro, this-week summary (waste logged, CO2e and water saved, money value), quick "Log waste" action, and a rotating tip card.
- **Log (/log)** — form: food item, category (produce, dairy, bakery, meat, leftovers, other), quantity + unit (g/kg/items), reason (spoiled, expired, over-cooked, plate scraps), date, optional note. Below the form: recent entries list with edit/delete.
- **Tips (/tips)** — curated tips grouped by category (storage, planning, leftovers, shopping), searchable and filterable; tips can be marked as tried.
- **Reports (/reports)** — charts: waste over time (line), by category (donut), by reason (bar), plus impact cards translating waste into CO2e, water, and money. Range switcher: week / month / all time.
- **Auth (/auth)** — email + password and Google sign-in. Logging and reports require an account; tips are public.

## Data (Lovable Cloud)

- `waste_entries` — user_id, item name, category, quantity, unit, reason, wasted_on date, note, timestamp.
- `tips` — title, body, category; public read, seeded with a solid starter set.
- `tip_completions` — user_id + tip_id, so "tried" state is per user.
- Row-level security on all user data: each person can only read and write their own entries.
- Impact math (CO2e / water / money per kg by category) is a shared constant table used by the reports page.

## Design

Warm, produce-inspired palette — deep leaf green, sprout accent, cream paper background — with a clean card-based layout, rounded corners, and gentle motion. Fully responsive: single-column stacked on mobile, multi-column dashboard on desktop.

## Technical notes

- TanStack Start routes; reports and log pages sit under the authenticated layout, home and tips stay public.
- Data reads/writes go through server functions with the authenticated Supabase client; charts use Recharts.
- Aggregation for reports is computed in a server function so the client only receives summarized series.
- Per-route SEO metadata (title, description, OG/Twitter tags).
