# Paper Boy Race — Competitive Teardown

> Source teardown for Paper Empire prototype design. Generated 2026-05-14 via gs-prototype-analyst.

## Identity

**Game:** *Paper Boy Race: Running game* (iOS title: *Paper Boy Race: Run & Rush 3D*)
**Developer:** Freeplay Inc / "Phantom" — package `com.phantom.paperboy` (source: Google Play, 2026-05-14)
**Scale (corroborated, conflicting):**
- Google Play badge: **50,000,000+ downloads** (source: Play store listing, 2026-05-14)
- AppBrain estimate: **~81M cumulative, ~49k/day** (`reported by AppBrain, not independently confirmed`)
- Rating: 4.5 / ~42k reviews

Alternative candidates rejected: *Paper Boy 3D* (different app), *Paper Boy: Deliver Race* (minor clone), Atari/NES *Paperboy* (1984, wrong era).

## 1. CORE LOOP

- Player launches a **"day" / level run** — ~25 sec stages per user feedback (source: paperboyrace.com blog, 2026-05-14).
- End-of-day: **score with up to 3 stars + coin payout** (source: CrazyGames, 2026-05-14).
- Spend coins on **vehicle upgrades / outfits / fortune wheel** between runs (source: CrazyGames + App Store description, 2026-05-14).
- **Daily missions / challenges** loop player back the next day (source: paperboyrace.com blog).
- **Heavy interstitial ads** between runs — dominates qualitative feedback (source: CrazyGames review aggregate).

Session length: very short. 1–3 min coffee-break, ad-supported.

## 2. MOMENT-TO-MOMENT GAMEPLAY

- **3-lane runner**: mailboxes (reward), coins (reward), obstacles (fail).
- **Inputs**: swipe / arrow keys / mouse drag for lane change; jump action over cars/ramps (source: CrazyGames, 2026-05-14).
- **Newspaper throw**: timing-based side-throw; sources describe "perfect timing / anticipate trajectory" — consistent with **auto-aim that fires on tap near mailbox**, not manual reticle. `[unverified: exact aim model not confirmed by primary dev source]`
- **Fail conditions**: crash into cars / trains / road signs.
- **Success**: survive, hit mailboxes, collect coins, reach finish.

## 3. MICRO-EVENTS / QUICK-DECISIONS

Public information is THIN here. Verified beats only — refused to invent:

- **Jump-ramps over cars** as scripted hazard events.
- **Train sequences** — railway crossings as obstacle set-pieces.
- **Mailbox throw windows** — short reaction window + correct lane + throw timing.
- **Fortune Wheel** between runs as post-run "press your luck" mini-event.
- **Daily Missions** as quick-decision meta-layer outside the run.

What I could NOT verify and refuse to invent: dedicated intersection mini-games, scripted boss runs, NPC chases, score-multiplier zones, Subway-Surfers-style use-item events. None of the public sources describe these. **This is the gap our prototype fills.**

## 4. PROGRESSION

- **Vehicle ladder**: skateboard → bicycle → motorbike (source: App Store description, 2026-05-14).
- **Currency**: soft-currency coins from runs + star rewards.
- **Spend sinks**: vehicle upgrades, outfits (paperboy/papergirl), fortune wheel spins.
- **Stats per vehicle**: `[unverified]` — not surfaced publicly. Assume speed / acceleration / coin-magnet as genre-standard.

## 5. DIFFICULTY CURVE & PACING

- Endless-runner with discrete "days" — finite ~25 sec stages rated 1–3 stars.
- Speed + density ramp with stage number.
- Biome variety: `[unverified]` — only "city streets" confirmed.

## 6. SECRET SAUCE (borrow)

1. **Stage-bounded "day" structure with 3-star rating** layered over endless feel — clear win-states + replay incentive.
2. **Two skill axes** — lane-dodge + paper-throw. Adds a second axis most Minion-Rush-likes lack.
3. **Fortune wheel as ad-gate** — converts forced ad-watch into a reward moment.

## 7. PITFALLS

1. **Ad-load complaints dominate** — "very short gameplay followed by lengthy ad watches" (CrazyGames). Build prototype runs at 25–45 sec assuming heavy ad pressure.
2. **Tiny runs feel thin without strong end-of-run dopamine** — 25 sec needs satisfying reward screen.
3. **Vehicle ladder reads as cosmetic without distinct handling** — `[inferred]` based on lack of stat documentation. Build distinct *feel* per vehicle.

## Actionable takeaways for HTML prototype

- **Run length:** 30–45 sec stages, not endless.
- **Two skill axes:** lane-dodge (swipe) + paper-throw (tap with auto-aim) — visible from second 1.
- **End-of-run screen:** 3-star rating + coin payout + 1 fortune-spin button.
- **Vehicle ladder:** 3–5 tiers, each with handling feel (not just +speed).
- **Differentiation gap:** add the missing scripted micro-events (intersections with traffic rules, dog-chase, doorstep tip combos).

## Verification notes

- Identity gate: **PASSED** — single canonical app, dev confirmed.
- Primary-source gate: store listings primary; CrazyGames/paperboyrace.com secondary portal pages. No dev-blog post-mortem exists for this title.
- Freshness: all citations 2026-05-14.
- Corroboration: download conflict (Play badge 50M+ vs AppBrain ~81M) — flagged.
- Where evidence was thin: `[unverified]`, not invented.

## Sources

- Google Play — `com.phantom.paperboy`
- App Store — *Paper Boy Race: Run & Rush 3D*
- CrazyGames — Paper Boy Race
- paperboy-race.com
- paperboyrace.com blog
- AppBrain
