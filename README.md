# Hopper

Hopper is a purchase-tracking app: log what you buy (item, price, currency, condition,
size, location), see it converted to your home currency with historical FX rates, and
browse your purchases as a catalogue, a map (by purchase location), and a spend
dashboard.

Built with Next.js (App Router), Supabase (Postgres + Auth + RLS), Leaflet for the map,
and Tailwind for styling.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/public API key. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key (server-only; never expose to the client). |
| `TAVILY_API_KEY` | no (Plan 2) | Web search for auto-populating item details. Not used yet. |
| `AIAND_BASE_URL` | no (Plan 2) | Base URL for the ai&-compatible LLM endpoint used for item lookup. Not used yet. |
| `AIAND_MODEL` | no (Plan 2) | Model id for item-lookup extraction. Not used yet. |
| `AIAND_API_KEY` | no (Plan 2) | API key for the above. Not used yet. |
| `OXYLABS_USERNAME` | no (Plan 2) | Oxylabs proxy username, used as a scraping fallback for item lookup. Not used yet. |
| `OXYLABS_PASSWORD` | no (Plan 2) | Oxylabs proxy password. Not used yet. |
| `OXYLABS_PROXY` | no (Plan 2) | Oxylabs proxy host:port. Not used yet. |

The "Plan 2" vars back the "Look up" auto-populate button on the add-purchase form,
which is currently disabled in the UI. They can be left blank for now.

## Supabase setup

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. In the Supabase SQL editor, run the migration in `supabase/migrations/0001_init.sql`.
   This creates the `purchases` table with row-level security enabled so each user
   only sees their own rows.
3. From Project Settings → API, copy the Project URL, `anon` public key, and
   `service_role` key into `.env.local` (see table above).
4. Auth: email/password sign-up is enabled by default in Supabase Auth. No extra
   config is required for the happy path used here.

## Local development

```bash
npm install
npm run dev       # start the dev server at http://localhost:3000
npm run lint       # eslint
npm run test       # vitest unit tests
npm run e2e        # playwright e2e (see note below)
npm run build      # production build
```

### Running the e2e test

`tests/e2e/add-purchase.spec.ts` signs in as a seeded user, adds a purchase, and
asserts it shows up in the catalogue. It needs:

- The app running (via `playwright.config.ts`'s `webServer`, this happens
  automatically — it runs `npm run dev` and waits for `http://localhost:3000`).
- A live Supabase backend reachable from your `.env.local`.
- A seeded test user, with credentials passed as env vars:

```bash
E2E_EMAIL=test@example.com E2E_PASSWORD=your-test-password npm run e2e
```

**This spec has not been executed in this session** — there is no Supabase project
wired up yet, so there's no backend to sign in against and no seeded user. It has only
been checked with `npx playwright test --list` to confirm it parses and is discovered
correctly. Whoever wires up Supabase should seed a test user (via the Supabase Auth
dashboard or `supabase.auth.admin.createUser`) and run it for real before relying on it
as a regression gate.

## Deploy (not yet done this session — steps for whoever wires up Vercel)

1. **Supabase**: create the project and apply the migration as described above, if not
   already done.
2. **Vercel**: import this GitHub repo (`github.com/C-lb/hopper`) at
   [vercel.com/new](https://vercel.com/new).
3. In the Vercel project's Environment Variables settings, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (optionally, once implemented) the Plan 2 vars listed above
4. Deploy.
5. Verify the deployed app: sign up a new account, log a purchase, and confirm it
   appears on the catalogue, the map, and the dashboard.
