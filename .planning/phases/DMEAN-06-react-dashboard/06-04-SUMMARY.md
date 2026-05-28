---
phase: 06-react-dashboard
plan: "04"
subsystem: ui
tags:
  - react
  - testing
  - docker
  - nginx
  - vitest
dependency_graph:
  requires:
    - 06-02
    - 06-03
  provides:
    - composed-react-dashboard
    - test-coverage-60pct
    - nginx-docker-service
  affects:
    - docker-compose.yml
    - ui/src/App.tsx
tech_stack:
  added:
    - nginx:1.27-alpine (production static + proxy server)
    - Vitest + @testing-library/react + @testing-library/user-event (test suite)
  patterns:
    - Multi-stage Docker build (node:20-alpine → nginx:1.27-alpine)
    - Fake EventSource for SSE hook testing
    - Zustand store reset in beforeEach for test isolation
key_files:
  created:
    - ui/src/App.tsx (composed dashboard root — replaces placeholder)
    - ui/src/__tests__/format.test.ts
    - ui/src/__tests__/api.test.ts
    - ui/src/__tests__/stores.test.ts
    - ui/src/__tests__/StatusBadge.test.tsx
    - ui/src/__tests__/StatsCards.test.tsx
    - ui/src/__tests__/LogFeed.test.tsx
    - ui/src/__tests__/SubmitJobForm.test.tsx
    - ui/src/__tests__/JobsTable.test.tsx
    - ui/src/__tests__/useSSE.test.tsx
    - ui/Dockerfile
    - ui/nginx.conf
    - ui/.dockerignore
  modified:
    - ui/src/lib/format.ts (shortId optional length param; formatElapsed end type fix)
    - ui/vite.config.ts (vitest coverage config + /// reference types)
    - docker-compose.yml (added ui service on port 5173)
  deleted:
    - ui/App.placeholder.tsx
    - ui/legacy.index.html
decisions:
  - "Added optional length parameter to shortId() to fix pre-existing TS2554 errors in WorkerFleet and WorkerSpeedChart callers — Rule 1 bug fix"
  - "Used /// <reference types='vitest' /> in vite.config.ts instead of separate vitest.config.ts so tsc build in Dockerfile does not fail with unknown 'test' property"
  - "Ran smoke test by attaching ui container to existing distributed-mean_default docker network rather than starting full compose stack, avoiding port conflicts with already-running CI containers"
  - "Used Promise.resolve() instead of async arrow for fetch mock json() methods to satisfy @typescript-eslint/require-await"
metrics:
  duration: "~18 minutes"
  completed_date: "2026-05-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 14
  files_modified: 3
  files_deleted: 2
  test_count: 60
  test_coverage_statements: "60.96%"
  test_coverage_branches: "80.19%"
  test_coverage_functions: "72.85%"
  test_coverage_lines: "60.96%"
---

# Phase 6 Plan 04: App Composition, Test Suite, and Docker Service Summary

## One-liner

Full React dashboard composed from Phase 6 components with Vitest+RTL test suite at 60%+ coverage, nginx multi-stage Dockerfile, and docker-compose ui service on port 5173.

## What Was Built

### Task 1: Compose App.tsx, retire placeholder and legacy dashboard

Replaced the re-export stub `ui/src/App.tsx` with the full composed dashboard. The component calls `useInitialLoad()` then `useSSE()` on mount, then renders `<Header>`, `<StatsCards>` (full width), `<WorkerFleet>`, `<SubmitJobForm>`, `<QueueDepthChart>`, `<WorkerSpeedChart>`, `<JobsTable>`, and `<LogFeed>` in a responsive `lg:grid-cols-2` layout.

Both legacy files — `ui/App.placeholder.tsx` and `ui/legacy.index.html` — were deleted from the repository.

### Task 2: Vitest + RTL test suite ≥60% coverage

Created 9 test files under `ui/src/__tests__/` covering all major units:
- `format.test.ts` — 17 tests: formatBytes, formatElapsed, shortId edge cases
- `api.test.ts` — 4 tests: listJobs, createJob, ApiError, getResultUrl
- `stores.test.ts` — 12 tests: LogStore (cap 200, setFilter, clear), JobsStore (upsert, toggleExpanded), SystemStore (setWorkers → speed history)
- `StatusBadge.test.tsx` — 6 tests: status text, class names
- `StatsCards.test.tsx` — 2 tests: seeded store values render correctly
- `LogFeed.test.tsx` — 5 tests: messages, filter, clear
- `SubmitJobForm.test.tsx` — 2 tests: success path + error banner
- `JobsTable.test.tsx` — 5 tests: rows, progress, deduplicated fetch, sort
- `useSSE.test.tsx` — 7 tests: all event types, reconnect, close on unmount

Final coverage: statements 60.96%, branches 80.19%, functions 72.85%, lines 60.96% — all above 60%.

### Task 3: nginx Dockerfile, compose ui service, smoke test

Created a multi-stage `ui/Dockerfile` (node:20-alpine builds, nginx:1.27-alpine serves dist). Created `ui/nginx.conf` with location blocks proxying `/jobs`, `/system`, `/internal` to `http://api:3000`, and `/events` + `/system/events` with `proxy_buffering off` for SSE. Added SPA fallback `try_files`. Created `ui/.dockerignore` to exclude build artifacts. Added `ui` service to `docker-compose.yml` on port `5173:80` depending on `api: service_healthy`.

Smoke test confirmed: `docker compose build ui` exits 0, `http://localhost:5173/` returns 200 with `id="root"`, `/system` proxy returns JSON from the running API.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shortId() to accept optional length parameter**
- **Found during:** Task 1 build (npm run build)
- **Issue:** `WorkerFleet.tsx` called `shortId(worker.currentTaskId, 6)` and `WorkerSpeedChart.tsx` called `shortId(value, 8)`, but `shortId` only accepted one argument (TS2554)
- **Fix:** Added optional `length = 8` parameter to `shortId()` in `format.ts`
- **Files modified:** `ui/src/lib/format.ts`
- **Commit:** 57340b1

**2. [Rule 1 - Bug] Fixed formatElapsed end param type redundancy**
- **Found during:** Task 1 lint (npm run lint)
- **Issue:** `end?: string | null | undefined` — the `undefined` is redundant with `?` optional marker, causing `@typescript-eslint/no-duplicate-type-constituents` error
- **Fix:** Changed to `end?: string | null`
- **Files modified:** `ui/src/lib/format.ts`
- **Commit:** 57340b1

**3. [Rule 1 - Bug] Fixed vite.config.ts tsc build failure in Dockerfile**
- **Found during:** Task 3 docker build
- **Issue:** `tsc -b` (called by `npm run build`) rejected the `test` property in vite config without the vitest type reference
- **Fix:** Added `/// <reference types="vitest" />` at top of `vite.config.ts`
- **Files modified:** `ui/vite.config.ts`
- **Commit:** 444c8ab

**4. [Rule 1 - Bug] Fixed async lint errors in test mocks and act() callbacks**
- **Found during:** Task 2 lint pass
- **Issue:** `json: async () => ...` in fetch mocks triggered `@typescript-eslint/require-await`; `async () =>` inside `act()` with no `await` similarly
- **Fix:** Changed `json: async () => x` to `json: () => Promise.resolve(x)`; removed `async` from non-awaiting `act()` callbacks
- **Files modified:** `ui/src/__tests__/api.test.ts`, `ui/src/__tests__/SubmitJobForm.test.tsx`, `ui/src/__tests__/JobsTable.test.tsx`, `ui/src/__tests__/useSSE.test.tsx`
- **Commit:** c8731c8

## Known Stubs

None — all components render from live Zustand store state with real data flow.

## Threat Flags

None — no new network endpoints or auth paths introduced. nginx proxy configuration stays within the mitigations described in the plan's threat model (T-06-10, T-06-12, T-06-SC).

## Self-Check: PASSED

Files verified:
- ui/src/App.tsx — EXISTS
- ui/Dockerfile — EXISTS
- ui/nginx.conf — EXISTS
- ui/.dockerignore — EXISTS
- ui/src/__tests__/ (9 files) — EXISTS
- ui/App.placeholder.tsx — CORRECTLY DELETED
- ui/legacy.index.html — CORRECTLY DELETED

Commits verified:
- 57340b1 — feat(06-04): Task 1
- c8731c8 — feat(06-04): Task 2
- 444c8ab — feat(06-04): Task 3
