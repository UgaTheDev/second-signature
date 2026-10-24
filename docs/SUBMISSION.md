# Submission checklist

Target: mostly done by **Saturday 11:59pm PDT**, submitted by **Sunday 9:00am PDT**.

## Code
- [ ] Fresh clone: `cd server && uv sync && uv run python gate.py && uv run python verify.py && uv run python intel.py && uv run python review.py && uv run python smoke.py`
- [ ] `uv run python arena.py --selftest`
- [ ] `cd dashboard && npm ci && npm run build`
- [ ] `git grep -nE "sk-ant|AC[0-9a-f]{32}|-----BEGIN"` finds nothing; `.env` is not tracked
- [ ] Convex functions deployed (`npx convex deploy` or `npx convex dev` running) and `CASE_WRITE_SECRET` set

## Live proof
- [ ] `uv run python preflight.py --crs`: ready for a live run
- [ ] One full live flow recorded: Shield whisper, hold, call, verification, family bridge, analyst decision
- [ ] Restart recovery shown live
- [ ] Arena published to the dashboard; numbers copied into docs/TRACKS.md [brackets]
- [ ] Droid review run once with FACTORY_API_KEY; screenshot of the diff and the DENIED steps

## Devpost
- [ ] Demo video opens with the moment (docs/DEMO.md), 2 minutes
- [ ] Track write-ups pasted from docs/TRACKS.md, one per track entered
- [ ] All three teammates added: Kush Zingade, Robert Guo, Brandon Yip
- [ ] Repo link is the submission repo, public or shared with judges
- [ ] "Built before and during CalHacks" in the README is accurate
- [ ] Each sponsor's extra asks: Cartesia README sections (setup, features used, known limitations), Factory "where and how
      Droid is used", CRS live sandbox in the demo, Apify actor published
