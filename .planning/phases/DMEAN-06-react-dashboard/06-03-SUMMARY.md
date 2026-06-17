---
phase: 06-react-dashboard
plan: "03"
subsystem: ui
tags: [react, typescript, tailwind, zustand, jobs-table, sort, expand, lazy-load]
dependency_graph:
  requires:
    - ui/src/types/api.ts
    - ui/src/store/useJobsStore.ts
    - ui/src/store/useLogStore.ts
    - ui/src/lib/api.ts
  provides:
    - ui/src/components/StatusBadge.tsx
    - ui/src/components/JobTaskRows.tsx
    - ui/src/components/JobsTable.tsx
    - ui/src/hooks/useJobTasks.ts
    - ui/src/lib/format.ts
  affects:
    - ui/ (adds jobs table components and format utilities)
tech_stack:
  added: []
  patterns:
    - Zustand selector subscription (useJobsStore with selector lambdas)
    - Lazy-fetch with in-flight ref dedup (T-06-08 mitigation)
    - Record<Status, string> color maps for zero-any typed badge
    - React.Fragment key wrapping for two-row-per-job pattern
    - stopPropagation on download anchor to prevent row toggle
key_files:
  created:
    - ui/src/components/StatusBadge.tsx
    - ui/src/components/JobTaskRows.tsx
    - ui/src/components/JobsTable.tsx
    - ui/src/hooks/useJobTasks.ts
    - ui/src/lib/format.ts
  modified: []
decisions:
  - Created format.ts in this plan (owned by Plan 02) because Plan 02 runs in parallel wave 2 and format.ts is required to compile; both plans create the same file — Plan 02 commit will overwrite with identical content or merges cleanly since no conflicts
  - Extracted JobRow as inner component to cleanly call useJobTasks per-job (hooks must be called at top of component, not inside a map callback)
  - SortDir defaults to 'desc' when switching sort key to match common UX pattern (show largest/newest first on new column)
metrics:
  duration_minutes: 12
  completed_date: "2026-05-28T00:00:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 0
---

# Phase 6 Plan 03: Jobs Table — Sort + Expand + Task Rows Summary

**One-liner:** Sortable expandable jobs table with lazy task loading, per-status colored badges, and progress bars — zero `any` types, build and lint both pass.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | StatusBadge + useJobTasks hook | e7db7cb | ui/src/components/StatusBadge.tsx, ui/src/hooks/useJobTasks.ts, ui/src/lib/format.ts |
| 2 | JobTaskRows component | d65da9e | ui/src/components/JobTaskRows.tsx |
| 3 | JobsTable with sort + expand | 700c5ff | ui/src/components/JobsTable.tsx |

## Verification Results

- `npm run build` exits 0 — zero TypeScript errors
- `npm run lint` exits 0 — zero ESLint warnings
- `grep -n ": any\|<any>\| as any" ui/src/components/StatusBadge.tsx ui/src/hooks/useJobTasks.ts ui/src/components/JobTaskRows.tsx ui/src/components/JobsTable.tsx` returns 0 matches
- All must_haves truths satisfied:
  - Jobs table renders all jobs sorted newest first (sortKey='createdAt', sortDir='desc' default)
  - Expandable rows fetch /jobs/:id/tasks lazily via useJobTasks, cached into store
  - Sortable columns: createdAt, status, f, c, progress; click toggles direction
  - Done jobs show download link `⬇ CSV`; non-done show `—`
  - Status badges color-coded per legacy palette for both jobs and tasks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] format.ts missing at build time**
- **Found during:** Task 1
- **Issue:** ui/src/lib/format.ts is listed in Plan 02's files_modified, which runs in parallel wave 2. At time of Task 1 execution, format.ts did not exist, causing import failures for shortId and formatElapsed.
- **Fix:** Created format.ts with formatElapsed, shortId, and formatBytes matching the legacy.index.html implementations (lines 468-475, 548-552). Content is identical to what Plan 02 was going to produce, so no merge conflict is expected.
- **Files created:** ui/src/lib/format.ts
- **Commit:** e7db7cb

**2. [Rule 2 - Design] JobRow extracted as inner component**
- **Found during:** Task 3
- **Issue:** useJobTasks must be called at component top level (React rules of hooks), not inside a .map() callback in the render. The plan description implied calling it within the map loop.
- **Fix:** Extracted a JobRow component that takes `job` and `expanded` as props and calls useJobTasks at its own top level. Plan 04 composes JobsTable as-is with no API change.
- **Files modified:** ui/src/components/JobsTable.tsx
- **Commit:** 700c5ff

## Known Stubs

None — all components are fully wired. JobsTable reads from useJobsStore (hydrated by useSSE/useInitialLoad from Plan 01). Plan 04 will import and render JobsTable in the App shell.

## Threat Surface Scan

- T-06-08 (DoS: rapid expand/collapse triggering repeated fetches): Mitigated — useJobTasks uses `inFlight` ref and store-cache check to deduplicate. Only fetches when `enabled && !cached && !inFlight`.
- T-06-09 (Info disclosure via result URLs): Accepted — UUIDs in result URLs are consistent with existing API behavior; not a secret in this dev system.

No new trust boundaries introduced beyond the plan's documented `/jobs/:id/tasks` fetch.

## Self-Check

- [x] ui/src/components/StatusBadge.tsx exists — FOUND
- [x] ui/src/components/JobTaskRows.tsx exists — FOUND
- [x] ui/src/components/JobsTable.tsx exists — FOUND
- [x] ui/src/hooks/useJobTasks.ts exists — FOUND
- [x] ui/src/lib/format.ts exists — FOUND
- [x] Commit e7db7cb — FOUND
- [x] Commit d65da9e — FOUND
- [x] Commit 700c5ff — FOUND

## Self-Check: PASSED
