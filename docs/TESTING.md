# Testing

Every number below came from running the command next to it on **Oct 25 2026**. Every fixture is a real record captured from data.texas.gov or a real API answer; nothing in the tests is invented.

## Suites

| Suite | Result | Command |
|---|---|---|
| Database (pgTAP): schema, row-level security allow and deny, every RPC, views, visits, geocode quality, photos rule, search, home privacy (no street, 5-digit ZIP) | **185 tests in 11 files, all pass** | `supabase test db` |
| Pipeline (pytest + hypothesis) | **283 tests, all pass (29 need the local database) · 93% line coverage** (classify 100%, load 98%, notify 93%, photos 98%) | `cd services/pipeline && DATABASE_URL=... uv run pytest --cov=pipeline` |
| Pipeline static checks | ruff clean · `mypy --strict` clean on 13 modules | `uv run ruff check . && uv run mypy --strict src` |
| Mobile unit (Jest) | **37 tests in 7 suites, all pass** | `cd apps/mobile && npx jest` |
| Mobile end-to-end (Maestro) | 11 flows, including the full find-to-alert journey and the largest accessibility text size | `maestro test apps/mobile/e2e/journey-find-watch.yaml` |
| Mobile static checks | `tsc --noEmit`, ESLint | `npm run typecheck --prefix apps/mobile` |

## What the tests guard

| Promise | Test |
|---|---|
| A broken or changed state file never loads a guess | Contract tests on real captured rows (`test_models.py`); a bad row fails the run and is logged (`test_runner.py`) |
| Findings join their visit, or the run fails | Join rate ≥ 95% (`test_load.py`); measured 100% |
| A quiet night sends no alerts | Re-running a sync creates 0 events (`test_load.py`; QA matrix B3) |
| The plain summary never adds facts | Hypothesis: no new numbers. Full state file (133,739 findings): no new words. Golden file of 50 real narratives (`test_classify.py`) |
| One alert per parent per event | Dedupe and dead-token pruning round trip (`test_notify.py`) |
| A replay is always labelled | "Replay of a real state record from <date>" (`test_notify.py`) |
| "In TX-04" means the map point is in the district | Real Frisco, Sherman, and Paris daycares come out inside, real Dallas ones outside (`test_district.py`); pgTAP 004 and 008 |
| Homes and approximate points never get photos | `test_photos.py` (query targets) and pgTAP 009 (`daycare_record` returns none) |
| Parents only see their own watches | pgTAP 002, allow and deny for each role |

## The QA matrix

Every user-facing case, run cold by someone who did not build the screen, with pass/fail and evidence: [`QA_MATRIX.md`](QA_MATRIX.md).

## Continuous integration

| Workflow | When | What |
|---|---|---|
| [`pipeline-ci.yml`](../.github/workflows/pipeline-ci.yml) | Every push | ruff, `mypy --strict`, pytest |
| [`daily-sync.yml`](../.github/workflows/daily-sync.yml) | 10:15 and 11:47 UTC daily, and on demand | The real sync against the cloud database, with a per-stage report in the run summary |
