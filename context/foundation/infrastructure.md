---
project: HabitLoop
researched_at: 2026-05-28
recommended_platform: Netlify
runner_up: Cloudflare Workers
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro v6 SSR
  runtime: Node.js serverless (Netlify Functions via @astrojs/netlify)
  database: Supabase (external — Postgres + Auth)
---

## Recommendation

**Deploy on Netlify.**

Cloudflare Workers is the stack's native runtime and scored 5/5 on agent-friendly criteria, but the anti-bias cross-check revealed two meaningful risks: a tight 10ms CPU-time limit on the free tier (relevant for the adaptive recommendation algorithm iterating over multi-week history) and a hard vendor lock-in via `cloudflare:workers` imports that makes future platform changes expensive. Netlify also scores 5/5, costs $0 on the free tier (300 credits/month ≈ 1.5M requests), has an official Supabase integration (auto-injects env vars including to `netlify dev`), a GA MCP server, no active adapter bugs, and a function timeout model (26s wall-clock) that is more predictable than Cloudflare's CPU-time accounting. The user chose Netlify after reviewing the Cloudflare cross-check.

**Required adapter migration:** The bootstrapped project uses `@astrojs/cloudflare`. Switching to Netlify requires installing `@astrojs/netlify` and removing all `cloudflare:workers` imports — see Getting Started.

---

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP integration | **Score** |
|---|---|---|---|---|---|---|
| **Netlify** | PASS | PASS | PASS | PASS | PASS | **5/5** |
| **Cloudflare Workers** | PASS | PASS | PASS | PASS | PASS | **5/5** |
| **Vercel** | PASS | PASS | PASS | PASS ⚠️ | PASS | **5/5** ⚠️ |
| **Render** | PASS | PARTIAL | PASS | PASS | PASS | **4.5/5** |
| **Railway** | PARTIAL | PARTIAL | PARTIAL | PASS | PARTIAL | **2.5/5** |
| **Fly.io** | PARTIAL | PARTIAL | PARTIAL | PASS | PARTIAL | **2.5/5** |

⚠️ Vercel: active open bug Astro 6.1.3+ SSR esbuild parse error (#16258, unresolved as of 2026-05-28) — deploy API stable but adapter broken.

**Score notes per platform:**

- **Netlify**: CLI covers deploy/rollback/logs (logs GA May 2026). Fully managed serverless (Functions + Edge Functions). `docs.netlify.com/llms.txt` published, pages available as `.md`. `netlify deploy --prod` is deterministic with stable exit codes. Official MCP server `@netlify/mcp` GA June 2025 (20+ tools).
- **Cloudflare Workers**: Wrangler deploy/rollback/tail all GA. Best-in-class agent docs (llms.txt + per-page markdown + MCP servers across docs/Workers/observability). Workers is fully serverless + managed. Free tier 100k req/day. Dropped from top spot due to 10ms CPU limit risk and adapter lock-in — not a defect, a trade-off.
- **Vercel**: GA MCP, llms-full.txt, strong CLI. Dropped to #3 due to active Astro 6.1.3+ SSR build bug. Fluid Compute (warm instances) is Pro-only — free Hobby hits cold starts.
- **Render**: GA MCP (mcp.render.com, August 2025, best-in-class PaaS MCP with 20+ tools), llms.txt. Dropped due to PARTIAL on managed/serverless (Node.js Web Service is container-based PaaS, not fully abstracted). Free tier has 30–60s cold starts — requires $7/month Starter for production.
- **Railway**: $5/month, no free tier, no outbound IPv6 (requires Supabase Session Pooler URL, not direct connection string). No llms.txt, MCP server is beta/WIP. Single region, no CDN.
- **Fly.io**: No free tier (eliminated 2024), $2–5/month. VM-based (persistent processes, no serverless cold starts if `min_machines_running = 1`). No llms.txt, experimental MCP. Rollback requires manual `fly deploy --image <prior-tag>`. Good platform for always-on Node.js; overbuilt for this stateless MVP.

---

### Shortlisted Platforms

#### 1. Netlify (Recommended)

5/5 criteria, $0 free tier covering ~1.5M requests/month, official Supabase integration that auto-injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into all environments including `netlify dev`, GA MCP server with full deploy/logs/env-var management, and no active adapter bugs. The 26s function timeout is a known hard ceiling but well above the 200ms NFR target. Chosen over Cloudflare Workers after cross-check revealed 10ms CPU limit risk and adapter lock-in.

#### 2. Cloudflare Workers

The stack's native runtime — `@astrojs/cloudflare` v13.5.5 targets Workers exclusively (Pages support dropped). $0 free tier (100k req/day), best-in-class agent docs and MCP. The 10ms CPU-time limit on the free tier is a specific risk for the adaptive recommendation computation; Workers Standard ($5/month) lifts it. Strongest choice if cold starts matter (edge network, global distribution) or if the project stays Cloudflare-native long-term.

#### 3. Vercel

Strong CLI, GA MCP, llms-full.txt. Blocked from top-3 shortlist consideration by the active Astro 6.1.3+ SSR esbuild build error (GitHub issue #16258, unresolved). Check whether the pinned Astro version in `package.json` is affected before using Vercel — if it's ≤6.1.2 or the bug is patched, Vercel becomes a viable alternative to Netlify.

---

## Anti-Bias Cross-Check: Netlify

### Devil's Advocate — Weaknesses

1. **Hard site pause at 300 credits/month**: Credit cap causes entire site blackout (no error page — "site not found") until monthly reset. A compute runaway (background cleanup on every request, etc.) can hit the cap mid-month with no warning. Mitigation: upgrade to Pro ($20/month) before acquiring regular users.
2. **Function timeout 10s default, 26s max**: Tighter than it sounds for SSR + external Supabase fetch + adaptive computation under slow network. Exceeding the limit returns 502 with no user-visible fallback. Mitigation: measure function duration in `netlify dev`, add request timing to logs.
3. **Adapter migration required**: Project uses `@astrojs/cloudflare`. Switching to Netlify requires installing `@astrojs/netlify`, removing `cloudflare:workers` imports, and migrating secrets from `.dev.vars` to Netlify env vars / `netlify.toml`. Real migration — not a 5-minute swap.
4. **`--prod` must be explicit**: `netlify deploy` defaults to preview URL. Missing `--prod` in CI = production silently not updated. Mitigation: assert `--prod` in GitHub Actions workflow, verify after deploy.
5. **Serverless cold starts**: Functions scale to zero. First request after inactivity incurs 200–500ms cold start for Node.js. For a habit tracker with infrequent daily logins, this is the common case — not a blocker, but visible.

### Pre-Mortem — How This Could Fail

HabitLoop deployed on Netlify and ran cleanly for three months. In month four, a refactor added a small session-cleanup operation on every authenticated request. Individually lightweight — collectively, it pushed compute GB-hours above the 300-credit cap on the 25th of the month. The site went dark at 23:00; users saw "site not found" for 9 hours before the developer noticed the next morning. After upgrading to Pro, a separate investigation revealed the CI pipeline had lost the `--prod` flag two weeks earlier — production had been running stale code while every commit "deployed" to preview URLs. The adaptive recommendation bug fix reported as shipped had not reached users. Combined: 3 days of debugging, 9-hour outage, and a 2-week window of incorrect behaviour in production that damaged early-adopter trust.

### Unknown Unknowns

1. **Preview deploys share production Supabase credentials**: Supabase extension injects credentials into all environments, including PR previews. Any publicly accessible preview URL connects to the production database. Without a dedicated Supabase test project, PR previews can write real data.
2. **300-credit consumption is opaque in real time**: Dashboard shows aggregate usage but no per-function or per-deploy breakdown. You discover you're near the cap when you're near it — there's no proactive alert on the free tier.
3. **Edge Functions (middleware) run in Deno, not Node.js**: If `middlewareMode: 'edge'` is set, any Node.js API used in middleware (Buffer, crypto built-ins) will fail at runtime, not build time. The error only surfaces in production.
4. **`netlify dev` doesn't simulate CDN routing**: Local dev runs through a local server. CDN-proximity behaviour and Edge Function latency relative to Supabase servers won't appear until production.
5. **`@astrojs/netlify` v7 is pinned to Astro v6**: A future Astro v7 upgrade will require a matching adapter update, which may introduce breaking changes in the rendering pipeline.

---

## Operational Story

- **Preview deploys**: Every git push to a non-production branch creates an automatically deployed preview URL (`<hash>--<site-name>.netlify.app`). Preview URLs are public by default — protect with Netlify's password protection or Netlify Identity if the app handles real user data during testing. Fork PRs from external contributors also get preview deploys.
- **Secrets**: Environment variables live in Netlify dashboard → Site configuration → Environment variables. The Supabase extension auto-populates `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` including in `netlify dev` local context. Rotate secrets in Netlify dashboard; they take effect on the next deploy. Do not commit secrets to `netlify.toml` — use Netlify dashboard or CLI: `netlify env:set KEY value`.
- **Rollback**: `netlify deploy --restore <deploy-id>` or select any prior atomic deploy in dashboard → Deploys → "Publish deploy". Rollback is instantaneous (Netlify repoints CDN, no rebuild). Does not roll back database schema — Supabase migrations are separate.
- **Approval**: Netlify CLI operations (deploy, env var set, DNS changes) require a personal access token — scope it to the minimum needed. Destructive actions (delete site, rotate primary Supabase key, drop database tables) are human-only panel operations. Agent may deploy, tail logs, and manage non-destructive env vars unattended.
- **Logs**: `netlify logs --source functions --follow` — streaming live logs. `netlify logs --source functions --since 1h` — last hour. `--json` for structured output. MCP: `list_log_events` tool via `@netlify/mcp` for structured log queries without CLI parsing.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Site blackout from credit cap hit mid-month | Pre-mortem | M | H | Upgrade to Pro ($20/mo) before launch; set Netlify credit alert at 70% |
| `--prod` dropped from CI pipeline → stale production | Pre-mortem | M | M | Assert `--prod` in GitHub Actions; add post-deploy smoke test against production URL |
| PR previews connected to production Supabase | Unknown unknowns | H | M | Create a Supabase test project; configure Netlify branch env vars to point preview/dev branches at test project |
| Function timeout 502 on complex recommendation computation | Devil's advocate | L | M | Benchmark adaptive algorithm in `netlify dev` with realistic data; split computation off SSR if needed |
| Edge Functions (Deno) API mismatch if middleware uses Node.js APIs | Unknown unknowns | L | H | Avoid `middlewareMode: 'edge'` unless needed; test middleware changes locally before deploy |
| Adapter migration breaks existing cloudflare:workers imports | Devil's advocate | H | M | Audit all `cloudflare:workers` imports before switching; treat as a discrete migration task |
| `@astrojs/netlify` breaking change on Astro v7 upgrade | Unknown unknowns | M | M | Pin adapter version; read adapter changelog before any Astro major version bump |
| Opaque credit burn from unexpected function behaviour | Unknown unknowns | M | H | Add function duration logging from day one; check Netlify dashboard weekly during early launch |

---

## Getting Started

These steps assume the project currently uses `@astrojs/cloudflare`. Run these after verifying no `cloudflare:workers` imports remain in the codebase.

1. **Install the Netlify adapter** (replace cloudflare adapter):
   ```bash
   npx astro remove cloudflare
   npx astro add netlify
   ```
   This uninstalls `@astrojs/cloudflare` and installs `@astrojs/netlify` v7.x, updating `astro.config.mjs` automatically.

2. **Audit and remove cloudflare-specific imports**:
   Search for `cloudflare:workers` and `Astro.locals.runtime` in `src/`. Replace env access with Astro's `astro:env` schema (already configured in `astro.config.mjs` — no change needed if env vars are defined there).

3. **Install Netlify CLI and authenticate**:
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify init
   ```
   `netlify init` links the local project to a Netlify site and creates `netlify.toml` if absent.

4. **Configure the Supabase Netlify extension**:
   In Netlify dashboard → Extensions → Supabase, connect your Supabase project. This auto-populates `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for all environments and local `netlify dev`.

5. **Test locally and deploy**:
   ```bash
   netlify dev           # local dev with Netlify Functions runtime
   netlify deploy --prod # first production deploy
   ```
   Verify the deploy URL and confirm Supabase auth flow works end-to-end before committing the CI pipeline.

6. **GitHub Actions** — add to your workflow:
   ```yaml
   - run: netlify deploy --prod --dir=dist --auth=$NETLIFY_AUTH_TOKEN --site=$NETLIFY_SITE_ID
   ```
   Store `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as GitHub repository secrets.

---

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline full setup beyond deploy command
- Production-scale architecture (multi-region, HA, DR)
