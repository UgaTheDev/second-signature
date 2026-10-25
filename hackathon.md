# Hackathon log

- **Project:** Second Signature
- **Event:** Cal Hacks 13.0
- **What it does:** A fraud desk for small credit unions that warns members during scam calls, settles Treasury's reclamation of a late member's Social Security, and never moves a dollar without a person signing off.
- **Live app:** https://second-signature-ai.vercel.app
- **Repo:** https://github.com/UgaTheDev/second-signature
- **Frontend:** Vercel
- **Convex deployment:** https://elated-cow-517.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, realtime useQuery
- **Auth:** none (no user auth; every mutation requires a shared server write secret)
- **AI models:** claude-opus-5-5, claude-haiku-5-5
- **Started:** 2026-10-24T17:51:20Z
- **Last updated:** 2026-10-25T10:46:55Z

## How we use Convex

- **Live call transcript and case record.** The Python server appends every spoken line and every agent or human action to the `transcript` and `actions` tables (indexed `by_case_t`); the case view re-renders line by line during the call via `useQuery(api.cases.get)`. `dashboard/convex/cases.ts`, `server/store.py`, `dashboard/app/lib/data.ts`
- **Holds that survive a restart.** Each case stores its permission-gate state (`saveState`); on startup the server reloads open cases with the `cases:active` query. `dashboard/convex/cases.ts`, `server/store.py`
- **Estate desk with an append-only journal.** Computed estates are upserted into `estates` (`by_key`); the controller's `sign` mutation appends the posted journal lines to `journal` (`by_estate_t`) once. `dashboard/convex/estates.ts`, `dashboard/convex/schema.ts`
- **Published proof.** The red-team arena posts its scoreboard with `arenaRecord`; policy reviews move through `reviewOpen`, `reviewStep` and `reviewSet`. Both are read with live queries. `dashboard/convex/cases.ts`, `server/arena.py`
- **Server-only writes.** All 12 mutations call `auth()` against a shared secret; the dashboard only reads. `dashboard/convex/cases.ts`

Screens that update live without a refresh: Active issues, the case view (transcript and record), Scam Shield, the Estate desk and its journal, Policy review, the Proof scoreboard, and the sidebar counts.

## Log

- 2026-10-24 `179fbc6` First version: server, Convex case file and dashboard. `dashboard/convex/`, `server/`
- 2026-10-24 `24190b4` Dashboard redesign with a sample-data mode. `dashboard/app/`
- 2026-10-24 `5cee892` Scam Shield mutes the caller during the whisper and survives restarts. `server/shield.py`
- 2026-10-25 `6f96483` First live call fixes. `server/agent.py`, `server/verify.py`
- 2026-10-25 `0b7d8a4` Dashboard split into Cases, Scam Shield, Policy review and Safety views. `dashboard/app/`
- 2026-10-25 `1f8d75d` Verification decoys a guesser can't eliminate. `server/verify.py`, `server/arena.py`
- 2026-10-25 `b12b2f4` Commit Convex generated types. `dashboard/convex/_generated/`
- 2026-10-25 `84ce737` Customer view and per-customer policy approvals. `dashboard/convex/cases.ts`
- 2026-10-25 `4fc00b2` Estate desk, `estates` and `journal` tables. `dashboard/convex/estates.ts`, `server/estate.py`
- 2026-10-25 `a82e095` No false comfort to the widow; Why? citations checked in code. `server/calltools.py`, `server/server.py`
- 2026-10-25 `e19b971` Verification needs all three answers; 25-scenario arena. `server/verify.py`, `server/arena.py`
- 2026-10-25 `8167064` Scam Shield checks mid-sentence; phone scripts. `server/shield.py`, `docs/SCRIPTS.md`
- 2026-10-25 `c432d92` Live verification requires every answer. `server/crs.py`, `server/verify.py`
- 2026-10-25 `486214f` Whisper waits for her to join the call. `server/shield.py`
- 2026-10-25 `6bf539d` Shorter estate call; live calls ask one credit-file question. `server/calltools.py`, `server/verify.py`
- 2026-10-25 `0e5b34e` Pitch docs lead with fraud protection for any member. `docs/`
- 2026-10-25 `33b1593` Judges' walkthrough script. `docs/JUDGES.md`
