# Crowdsourced Safety Reports — Design & Build Spec

Standalone handoff for the crowd-input feature of the Latin America City Safety Map.
Self-contained: a Claude Code agent should be able to build the backend + wire the frontend from this
file alone. Read §0 first — the whole design exists to avoid one specific failure.

---

## 0. Why it's built this way (read this before changing anything)

Crowd "safety" votes are the part of this product most likely to cause harm. Two well-known apps shipped
almost exactly a "rate how safe this feels" feature and were correctly destroyed for it:
**SketchFactor** (2014) and **"Ghetto Tracker"** (2013) — both became racial-profiling tools, because a
one-tap "feels sketchy" vote tracks *unfamiliarity and who lives somewhere* far more than actual risk.
A visitor's "sketchy" is very often "poor," "non-white," or "foreign to me."

**Therefore the core principle: collect events, not feelings — and never the people.**
The design enforces this structurally so a raw vibe cannot become a data point on its own.

Three consequences that must not be undone:
1. **Asymmetric friction.** Positive ("Felt-safe") is one tap and frictionless — positive reports are
   bias-*protective*. Negative is never one tap; it must name a concrete event or an environmental fact.
2. **No demographic inputs, ever.** There is deliberately no "I judged it by the people / type of area"
   option or checkbox. That would legitimize and collect exactly the bias we filter out.
3. **Crowd input is a delta over a baseline, gated and audited** — never a raw score, never unfiltered.

This reduces and *surfaces* bias; it does not eliminate it. That's an honest, defensible posture — more
than the predecessors could say. Keep it that way.

---

## 1. Hard rules (non-negotiable)
- Negative reports require a **category** (event or environment). No free-floating "felt unsafe."
- **No category, label, free-text option, or tag may describe people** (race, ethnicity, nationality,
  housing status, "type of people/area," language, dress). Reject such free-text (see §4).
- Public UI shows **aggregates and categories**, never a user's raw free-text and never PII.
- A rating only moves after a **minimum number of distinct reporters** (see §5).
- Store the **LLM classification + category**, not the raw text, in anything publicly served.

---

## 2. UX flow (frontend)

Rename the popup buttons:
- **▲ Felt-safe** — one tap. Records a positive signal. Done.
- **⚑ Report an issue** — opens a small sheet (NOT a vote):

**"What happened here?"** (single select; pick one)

| key | label | type | base weight |
|---|---|---|---|
| `robbery` | Robbed / mugged | incident | 1.0 |
| `theft_grab` | Phone or bag snatched / pickpocketed | incident | 0.9 |
| `vehicle` | Car broken into / vehicle theft | incident | 0.8 |
| `threat` | Threatened, followed, or harassed | incident | 0.8 |
| `witnessed` | Witnessed a crime here | incident (2nd-hand) | 0.5 |
| `environment` | Poorly lit / deserted / no exit | environment | 0.3 |

Then:
- **When** (optional): today / this week / this month / older (drives recency weight).
- **First-hand?** (optional toggle): happened to me / heard about it (drives credibility weight).
- **Reason** (free text, optional but encouraged): "what happened, in your words." Goes through the §4 gate.

There is intentionally **no people-based option** in this list. If a user tries to put that in the free
text, the gate rejects it.

Frontend mechanics:
- Each area already has a stable `cluster_id` (see PROJECT.md Task C: detailed districts reuse their
  polygon; city-level cities subdivide via neighbourhood polygons or an H3 hex grid).
- Optimistic UI: show the report accepted immediately; reconcile with server tally on response.
- Show the **"why" breakdown** under the rating (see §6), not a bare red blob.

---

## 3. Data model

```sql
-- one row per report
report(
  id           uuid pk,
  city         text,            -- city key/slug
  cluster_id   text,            -- stable area id
  kind         text,            -- 'safe' | 'issue'
  category     text,            -- null for 'safe'; else one of the §2 keys
  first_hand   boolean,         -- null unknown
  when_bucket  text,            -- 'today'|'week'|'month'|'older'|null
  reason_class text,            -- LLM bucket: 'incident' | 'vibe' | 'rejected' | 'none'
  weight       real,            -- final computed weight (0 if vibe/rejected)
  token        text,            -- anonymous browser UUID (see §7)
  ip_hash      text,            -- salted hash, NEVER raw IP
  created_at   timestamptz,
  unique (city, cluster_id, token)   -- one active report per area per browser (upsert to change)
)
-- store raw reason ONLY transiently for classification, then drop or encrypt-at-rest, never serve it.
```

Aggregates can be a materialized view refreshed on write or on a schedule.

---

## 4. The LLM gate (the bias filter)

Every negative report's free text (when present) is classified **server-side** into one of three buckets.
This is where coded language a keyword filter would miss gets caught, across languages (ES/PT/EN).

Buckets and effect:
- **`incident`** — names a concrete event/time/place ("robbed at this corner last month", "guy followed
  me from the ATM"). → counts at full category weight.
- **`vibe`** — vague feeling, no event ("felt off", "looked rough", "wouldn't go back"). → accepted but
  **weight 0** (logged as low-info; does not move the score).
- **`rejected`** — describes or codes **people/demographics** ("too many homeless", "you know what kind
  of people live there", "looked like a bad neighborhood", "sketchy types"). → **not stored as a signal**;
  return a calm message: *"This map rates incidents and conditions, not who lives somewhere. Tell us what
  happened — e.g. a theft, a threat, bad lighting."*

Classifier prompt (sketch — make it strict, return JSON only):
```
You classify a single short safety report about a place. Output JSON:
{ "bucket": "incident" | "vibe" | "rejected", "reason": "<≤8 words>" }
Rules:
- "rejected" if the text characterizes PEOPLE or a group: race, ethnicity, nationality, immigration
  status, homelessness/poverty, language, dress, or coded equivalents ("those people", "bad element",
  "rough crowd", "ghetto", "shady characters"). This overrides everything else.
- "incident" if it states a concrete event/threat/loss (robbery, theft, assault, harassment, break-in,
  being followed) — optionally with time/place.
- "vibe" if it's only a feeling/impression with no concrete event and no people-characterization.
Languages: English, Spanish, Portuguese. Judge meaning, not keywords.
```
- Run with low temperature. Log `bucket` + short `reason`; **discard the raw text from anything public**.
- Treat the gate as fail-closed for `rejected`. If the LLM is unavailable, hold the report as `vibe`
  (weight 0) rather than letting unfiltered text count.

---

## 5. Aggregation & scoring

Crowd input is a **delta over the baseline** (editorial tier, or real crime-feed value where available
— see PROJECT.md Task D), never the score itself.

Per cluster:
```
issue_score   = Σ over issue reports of: base_weight(category)
                                       × first_hand_factor   (1.0 first-hand, 0.5 second-hand/unknown)
                                       × recency_factor      (today 1.0 → week .8 → month .6 → older .3)
                                       × reason_factor       (incident 1.0, vibe 0.0)
safe_score    = count(safe reports) × 0.5
net           = issue_score − safe_score
```
Guardrails:
- **Min reporters**: `delta = 0` until **≥ 5 distinct tokens** have reported on the cluster. Below that,
  show "not enough reports yet," not a colour change.
- **Cap the delta** so the crowd can nudge but not fully repaint: `delta = clamp(k · tanh(net / s), −2.0, +2.0)`
  on the 1–10 scale (tune `k`, `s`). Final shown score = `clamp(baseline + delta, 1, 10)`.
- **Decay**: recompute with recency factors so stale reports fade; reports older than ~12 months drop out.
- **De-dupe**: one active report per `(city, cluster_id, token)`; newest replaces older from same token.

---

## 6. Display ("why", not a red blob)
Under each cluster's rating, show the basis so it's contestable and actually useful:
> **"9 reports — mostly phone snatching, evenings."**
- List top 1–2 categories + the dominant time bucket. Never show raw text or counts of "safe" vs people.
- If `delta` is suppressed (under min reporters), say "few reports — based on editorial rating."
- Make "knowing it's pickpocketing vs armed robbery" explicit — that changes traveller behaviour and is
  the honest value of the feature.

---

## 7. Identity & anti-abuse (anonymous, low-friction)
No phone/email. Layered:
1. **Browser token**: random UUID in `localStorage` on first visit → one active report per area.
2. **IP rate-limit**: store a **salted hash** of IP (+ cluster + day); cap reports/IP/window. Never raw IP.
3. **Bot check**: Cloudflare Turnstile / hCaptcha, challenge only suspicious traffic.
4. Optional later: Google/Apple sign-in as a *trust weight booster*, never a gate.
Zero-backend shortcut: **Supabase** (Postgres + REST + **anonymous auth** = durable anon id, no friction).

---

## 8. Bias audit (run this, don't skip it)
The whole design is falsifiable — verify it:
- Periodically compare each cluster's **crowd delta** against (a) official incident data where it exists
  and (b) census/demographic composition.
- **Divergence that correlates with demographics rather than recorded incidents is the bias signal.**
  Auto-flag those clusters; discount or hold them for review.
- Track gate stats: share of reports going `rejected` / `vibe` / `incident` over time and by city.
- Keep a public, plain-language note on method + limits ("reports are incidents/conditions, gated for
  bias; not a guarantee; not about who lives somewhere").

---

## 9. Backend API (contract)
On the Hetzner box (FastAPI/Express + SQLite/Postgres) or Supabase. CORS → the GitHub Pages origin.
```
POST /report
  body: { city, cluster_id, kind:'safe'|'issue', category?, first_hand?, when_bucket?, reason?, token, turnstile_token }
  server: validate → (if reason) LLM gate → compute weight → upsert (city,cluster_id,token) → recompute aggregate
  resp: { ok, cluster: { reports, top_categories:[…], top_when, delta, shown_score, suppressed:bool },
          message? }   // message set when reason rejected
GET /reports?city=…            -> { [cluster_id]: { reports, top_categories, top_when, delta, shown_score, suppressed } }
GET /reports/:city/:cluster_id -> single cluster aggregate
```
- Frontend loads `GET /reports?city=` on city build; merges deltas into colours; popups call `POST /report`.
- Return the recomputed aggregate so the UI can reconcile its optimistic update.

---

## 10. Privacy & legal
- **PII**: never store raw IP; salt+hash. Token is a first-party functional id (no cookie banner needed).
- **Defamation/PII**: don't publish raw free text (it can name people/businesses). Serve categories only.
- **GDPR/LGPD**: minimal data, hashed identifiers, a short privacy note, deletion on request by token.
- The LLM-`rejected` path is also a legal safeguard — it keeps discriminatory text out of the dataset.

---

## 11. Frontend changes (from the current stub)
The map already has: per-area `cluster_id` plan, popup buttons, an in-memory `castVote` stub.
Replace with:
- Buttons → **▲ Felt-safe** (one tap → `POST /report kind:safe`) and **⚑ Report an issue** (opens the §2 sheet).
- Remove the in-memory `VOTES` stub; use server aggregates.
- Render the §6 "why" line in the popup and shift the cluster's fill by `delta`.
- Keep optimistic update; reconcile on response; show the reject `message` inline if returned.

---

## 12. Build order
1. Schema + `POST /report` (no LLM yet) + Turnstile + token/IP-hash rate-limit.
2. LLM gate on `reason`; store bucket; weight=0 for vibe/rejected.
3. Aggregation view + `GET /reports`; min-reporters + cap + recency.
4. Frontend: incident sheet, "why" line, delta colouring, reject message.
5. Bias-audit job + method note.

## 13. Acceptance criteria
- One-tap **Felt-safe** records without friction; positive reports never trigger the sheet.
- A negative report **cannot** be submitted without a category.
- Free text "you know what kind of people live here" → **rejected**, not stored as signal, calm message shown.
- "felt off, looked rough" → accepted as **vibe**, weight 0, score unchanged.
- "my friend was robbed at this corner last month" → **incident**, counts, but only moves the rating once
  ≥5 distinct tokens have reported.
- No endpoint or table ever stores raw IP or serves raw free text.
- Bias-audit job outputs a list of clusters whose crowd delta diverges from incident data and tracks
  demographic correlation.
