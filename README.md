# AI Access Equity

Prototype for the platform described in the PRD (see the linked Claude Doc). Working adults report being certified in AI tools but denied real access to use them at work — this site collects that data, shows it back as shareable statistics, hosts an ideas board for solutions, and generates personalized guidance and idea synthesis with the Claude API.

## Stack

- **Frontend:** plain HTML/CSS/JS, no build step (`index.html`, `styles.css`, `script.js`, `dashboard.html` / `dashboard.js`)
- **Data:** Supabase (Postgres + auto-generated REST API, public anon key + Row Level Security)
- **LLM:** Claude API (`claude-haiku-4-5`), called only from the server (`/api`) — never from the browser
- **Backend:** two small Node.js serverless functions (`api/guidance.js`, `api/synthesize-ideas.js`), written for Vercel's convention so they deploy with zero config; `server.js` runs the same functions locally

## One-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is enough for this).
2. In the Supabase dashboard, open **SQL Editor > New query**, paste in `supabase/schema.sql`, and run it. This creates the `responses`, `ideas`, and `synthesized_ideas` tables, RLS policies, the vote-increment function, and the public `response_stats` view.
3. In **Project Settings > API**, copy:
   - **Project URL** and the **anon public** key → paste into `config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Safe to expose in the browser — RLS controls what it can actually do.
   - **service_role** key → paste into `.env` as `SUPABASE_SERVICE_ROLE_KEY` (see below). **Never** put this one in `config.js` or any client-side file — it bypasses RLS entirely.
4. **Get an Anthropic API key** at [console.anthropic.com](https://console.anthropic.com) (API Keys section).
5. Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and pick any random string for `ADMIN_SECRET` (protects the dashboard's synthesis trigger until real auth exists).

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 (survey + stats + ideas board) and http://localhost:5173/dashboard.html (HR/company view + idea synthesis).

`npm run dev` runs `server.js`, which serves the static files **and** the `/api` routes together — the old PowerShell-only static server (`serve.ps1`) still works for a quick visual check of the frontend, but the survey, guidance, and idea synthesis won't function through it since it can't run the API routes.

## Deploy

Push this repo to GitHub and import it on [vercel.com](https://vercel.com) — it detects the `/api` folder automatically and deploys each file there as a serverless function, no config needed. Add the same `.env` variables (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`) in the Vercel project's Environment Variables settings, and fill in `config.js` with your real Supabase URL/anon key before deploying (or template it at build time later — a plain edit is fine for now).

## Known gaps (before a real public launch)

- **Dashboard has no authentication.** `dashboard.html` is reachable by anyone with the URL; the synthesis trigger is only gated by the `ADMIN_SECRET` header (entered client-side, not stored). Add real auth before sharing this link.
- **No rate limiting** on `/api/guidance` — a survey submission triggers one LLM call; fine at prototype volume, worth adding before a public LinkedIn launch to bound cost.
- **No PII is collected** today (survey is anonymous) — keep it that way unless a real privacy policy and consent flow are added first.

Full product context, research citations, personas, and roadmap: see the PRD doc.
