---
phase: DMEAN-06-react-dashboard
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - ui/src/App.tsx
  - ui/src/main.tsx
  - ui/src/components/Header.tsx
  - ui/src/components/JobTaskRows.tsx
  - ui/src/components/JobsTable.tsx
  - ui/src/components/LogFeed.tsx
  - ui/src/components/QueueDepthChart.tsx
  - ui/src/components/StatsCards.tsx
  - ui/src/components/StatusBadge.tsx
  - ui/src/components/StatusPill.tsx
  - ui/src/components/SubmitJobForm.tsx
  - ui/src/components/WorkerFleet.tsx
  - ui/src/components/WorkerSpeedChart.tsx
  - ui/src/hooks/useInitialLoad.ts
  - ui/src/hooks/useJobTasks.ts
  - ui/src/hooks/useSSE.ts
  - ui/src/lib/api.ts
  - ui/src/lib/format.ts
  - ui/src/store/useJobsStore.ts
  - ui/src/store/useLogStore.ts
  - ui/src/store/useSystemStore.ts
  - ui/src/types/api.ts
  - ui/src/types/sse.ts
  - ui/src/__tests__/JobsTable.test.tsx
  - ui/src/__tests__/LogFeed.test.tsx
  - ui/src/__tests__/StatsCards.test.tsx
  - ui/src/__tests__/StatusBadge.test.tsx
  - ui/src/__tests__/SubmitJobForm.test.tsx
  - ui/src/__tests__/api.test.ts
  - ui/src/__tests__/format.test.ts
  - ui/src/__tests__/stores.test.ts
  - ui/src/__tests__/useSSE.test.tsx
  - ui/vite.config.ts
  - ui/nginx.conf
  - ui/tailwind.config.ts
  - ui/tsconfig.app.json
  - ui/tsconfig.json
  - ui/tsconfig.node.json
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase DMEAN-06: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

This is a fresh review of the React dashboard (`ui/`) reflecting the current state of the
code after the prior review-fix iteration recorded in `06-REVIEW-FIX.md`. The earlier
findings (CR-01 nginx `/internal`, WR-01..WR-08) all appear correctly resolved in the
current tree — `/internal` is gone, `X-Forwarded-Proto` is present, the banner timer is
cleaned up, `useJobTasks` aborts on unmount, `LogFeed` scrolls on `filteredLines.length`,
the duplicate `vitest.config.ts` is gone, and the SSE handler invalidates task cache on
terminal job state.

However, this adversarial pass surfaces a new structural defect that the previous review
missed: **every "card" component that is also wrapped by `App.tsx` renders its own
duplicate card + `<h2>` heading.** Five panels render their title and outer chrome twice,
producing duplicated headings and nested cards in the live UI. This is the lead BLOCKER.
Several correctness and robustness warnings follow, plus quality/info items.

The test suite is reasonable for store/hook/format/api logic, but no test renders `App.tsx`
or asserts on heading uniqueness, which is exactly why the duplicate-card defect slipped
through.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Five panel components render a duplicate card wrapper and heading

**File:** `ui/src/App.tsx:24-67` together with `ui/src/components/WorkerFleet.tsx:33-46`, `ui/src/components/SubmitJobForm.tsx:86-90`, `ui/src/components/QueueDepthChart.tsx:43-46`, `ui/src/components/WorkerSpeedChart.tsx:50-54` and `:84-87`, `ui/src/components/LogFeed.tsx:37-41`

**Issue:** `App.tsx` already wraps each panel in a styled `<section class="rounded-lg bg-slate-800 border border-slate-700 p-5">` containing an `<h2>` title — e.g. `<h2>Worker Fleet</h2><WorkerFleet />` (lines 24-28), `<h2>Submit Job</h2><SubmitJobForm />` (31-35), `<h2>Queue Depth</h2><QueueDepthChart />` (39-43), `<h2>Worker Activity</h2><WorkerSpeedChart />` (45-49), `<h2>Live Log</h2><LogFeed />` (60-66).

But each of those five components *also* renders its own outer `<div class="rounded-lg bg-slate-800 border border-slate-700 p-5">` plus its own `<h2>` ("Worker Fleet", "Submit Job", "Queue Depth (last 2 min)", "Worker Activity (last 2 min)", "Live Log"). The result is a card nested inside a card, and the title appears twice in the DOM for each of these panels.

This is provably inconsistent: `StatsCards.tsx` and `JobsTable.tsx` correctly render *no* wrapper/heading and rely on `App.tsx` for chrome, while the five components above duplicate it. The two conventions cannot both be intended.

User-visible impact: doubled headings, doubled borders/padding, and broken accessibility (duplicate headings, redundant box nesting).

**Fix:** Pick one convention. The cleanest is to make components render only their inner content (matching `StatsCards`/`JobsTable`) and let `App.tsx` own the card + heading. For each of the five components, remove the outer wrapper `<div className="rounded-lg bg-slate-800 ... p-5">` and the self-rendered `<h2>`. Example for `WorkerFleet.tsx`:

```tsx
export function WorkerFleet() {
  const workers = useSystemStore((s) => s.workers);
  return (
    <div className="flex flex-wrap gap-2 min-h-[60px]">
      {workers.length === 0 ? (
        <span className="text-slate-500 text-sm">No workers connected yet</span>
      ) : (
        workers.map((w) => <WorkerChip key={w.id} worker={w} />)
      )}
    </div>
  );
}
```

Apply the equivalent removal to `SubmitJobForm`, `QueueDepthChart`, `WorkerSpeedChart` (both the data branch and the empty-state branch), and `LogFeed` (note `LogFeed` additionally renders its own filter `<h2>Live Log</h2>` while `App.tsx` also renders one at line 62 — remove the component's). Then add a test that renders `<App />` and asserts each heading text appears exactly once.

## Warnings

### WR-01: `useInitialLoad` overwrites `jobs` map, dropping any jobs delivered by SSE during bootstrap

**File:** `ui/src/hooks/useInitialLoad.ts:12-14`

**Issue:** `useInitialLoad` and `useSSE` both run on mount (`App.tsx:13-14`). `useInitialLoad` does `useJobsStore.setState({ jobs: Object.fromEntries(...) })`, a wholesale replacement. If the SSE connection opens and a `job_update` arrives (via `upsertJob`) before the `listJobs()` promise resolves, that job is silently discarded by the replacement. This is a real race: the SSE handshake (`/events`) and `listJobs()`/`getSystem()` fire concurrently.

**Fix:** Merge instead of replace. Minimal fix — merge over current state:

```ts
useJobsStore.setState((state) => ({
  jobs: { ...Object.fromEntries(jobs.map((j) => [j.id, j])), ...state.jobs },
}));
```

(Spreading `state.jobs` last lets any newer SSE-delivered job win; choose the precedence intentionally.)

### WR-02: SSE reconnect on error never clears the previous pending timer, leaking timers under flapping connections

**File:** `ui/src/hooks/useSSE.ts:74-81`

**Issue:** In `onerror`, a reconnect timer is stored in `timerRef.current` but a previous pending timer is never cleared before assigning a new one. `EventSource` can fire `onerror` repeatedly (e.g. flapping network) before the 3s timer elapses; each call to `connect()` → new `EventSource` → another `onerror` can schedule an additional `setTimeout` while the prior `timerRef.current` reference is overwritten, leaking the earlier timer (the effect-cleanup only clears the *latest* `timerRef.current`). This can produce multiple concurrent reconnect attempts / orphaned timers.

**Fix:** Clear any pending timer before scheduling a new one:

```ts
es.onerror = () => {
  useSystemStore.getState().setConnectionStatus('reconnecting');
  es.close();
  esRef.current = null;
  if (timerRef.current !== null) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => { connect(); }, RECONNECT_DELAY_MS);
};
```

### WR-03: `request()` assumes every successful response body is JSON

**File:** `ui/src/lib/api.ts:52`

**Issue:** On the success path, `request()` unconditionally returns `res.json()`. If an endpoint returns 204 No Content, an empty body, or a non-JSON success (e.g. a misconfigured proxy returning HTML), `res.json()` throws a raw `SyntaxError` that is *not* wrapped in `ApiError`, so callers' `instanceof ApiError` branches (e.g. `SubmitJobForm.tsx:69`) won't recognize it and the user sees a generic/confusing message. The error path (lines 33-50) carefully inspects `content-type`, but the success path does not.

**Fix:** Guard the success parse:

```ts
try {
  return (await res.json()) as T;
} catch {
  throw new ApiError(res.status, null, `Invalid JSON response: ${path}`);
}
```

(For endpoints that may legitimately return 204, handle that explicitly.)

### WR-04: `SubmitJobForm` accepts `NaN` and non-integer F/C, bypassing the client-side guard

**File:** `ui/src/components/SubmitJobForm.tsx:101,113,42`

**Issue:** `onChange` does `setF(Number(e.target.value))`. Clearing the number input yields `''` → `Number('') === 0`, and partial/invalid entries can yield `NaN`. The guard at line 42 checks `f < 2 || f > 100_000 ...`, but `NaN < 2` is `false` and `NaN > 100_000` is `false`, so `NaN` passes the guard and is sent to the API as `{ F: NaN }`, which `JSON.stringify` serializes to `null`. The guard also never enforces integers (e.g. `F=2.5` passes). The comment claims it matches "API Zod bounds (T-06-05)" but it does not match an integer/`NaN` constraint.

**Fix:** Validate with `Number.isInteger` and explicit `NaN` rejection:

```ts
if (!Number.isInteger(f) || !Number.isInteger(c) ||
    f < 2 || f > 100_000 || c < 1 || c > 10_000) {
  showBanner({ type: 'error', message: 'F must be an integer 2..100000, C an integer 1..10000' });
  return;
}
```

### WR-05: Dev proxy (vite) and prod proxy (nginx) cover different SSE route sets

**File:** `ui/vite.config.ts:11-24`, `ui/nginx.conf:11-54`

**Issue:** The client connects to `/events` (`useSSE.ts:29`) and downloads results via `/jobs/:id/result` (`api.ts:101-103`, covered by `/jobs`). The dev proxy lists only `/jobs`, `/system`, `/events`, whereas `nginx.conf` additionally proxies `/system/events`. Nothing in the reviewed client calls `/system/events`, so that nginx block is dead config relative to this client, and the dev/prod asymmetry is a latent footgun: a future call to `/system/events` would work in prod but 404 in dev (or vice-versa).

**Fix:** Standardize on one SSE route. If the client uses `/events`, remove the `/system/events` block from `nginx.conf` (or vice versa) so dev and prod proxy exactly the same set of routes the client calls.

### WR-06: Unused `formatTime` export (no NaN guard) and loosely-typed `StatusPill` maps defeat exhaustiveness

**File:** `ui/src/lib/format.ts:34-37`, `ui/src/components/StatusPill.tsx:3-13`

**Issue (two related robustness gaps):**
1. `formatTime(iso)` is exported but never called anywhere (components inline `new Date(...).toLocaleTimeString()` in `LogFeed.tsx:74` and the charts). Dead public surface; it also does no `isNaN` guard, unlike `formatElapsed`, so it can render `"Invalid Date"`.
2. `StatusPill`'s `dotColors`/`labelText` are typed `Record<string, string>` rather than keyed by the `connectionStatus` union. This defeats exhaustiveness checking: if a new `connectionStatus` value is added to the store union, TypeScript will not flag the missing entry and the pill silently falls back.

**Fix:** Remove `formatTime` (or route `LogFeed`/charts through it after adding an `isNaN` guard). Type the maps as `Record<SystemState['connectionStatus'], string>` so missing cases fail compilation.

## Info

### IN-01: `useJobsStore` exports `selectJobList`/`selectJobStats`/`setJobs` that no reviewed component consumes

**File:** `ui/src/store/useJobsStore.ts:31-52,68-72`

**Issue:** `JobsTable` sorts inline via its own `sortJobs` (`JobsTable.tsx:18-44`) and `StatsCards` computes counts inline (`StatsCards.tsx:24-29`), so `selectJobList` and `selectJobStats` are dead exports. `setJobs` is also unused (bootstrap uses `setState` directly in `useInitialLoad.ts:12`). Dead exports drift out of sync with the inline logic they duplicate.

**Fix:** Either consume the selectors from the components (removing duplicated inline logic) or delete the unused exports.

### IN-02: Magic constant `9` in size estimate is undocumented

**File:** `ui/src/components/SubmitJobForm.tsx:20`

**Issue:** `const sizeBytes = f * c * 9;` — the `9` (presumably average bytes per value incl. delimiter) is a magic number with no explanation.

**Fix:** Extract to a named constant with a comment, e.g. `const AVG_BYTES_PER_VALUE = 9;`.

### IN-03: `clearJobTasks` relies on an eslint-disable to drop a destructured key

**File:** `ui/src/store/useJobsStore.ts:82-84`

**Issue:** The `const { [jobId]: _removed, ...rest } = state.jobTasks;` pattern requires a lint suppression. It works but the suppression is a smell.

**Fix:** Prefer an explicit copy-and-delete:

```ts
clearJobTasks: (jobId) => set((state) => {
  const rest = { ...state.jobTasks };
  delete rest[jobId];
  return { jobTasks: rest };
}),
```

### IN-04: `WorkerSpeedChart.workerColor` masks hash to 16 bits unnecessarily

**File:** `ui/src/components/WorkerSpeedChart.tsx:21-27`

**Issue:** `hash = (hash * 31 + charCode) & 0xffff` masks to 16 bits before `% PALETTE.length` (6). With only 6 colors this is cosmetic, but the early mask is unnecessary and slightly biases distribution. Not a correctness bug. (Performance is out of scope.)

**Fix:** Drop the `& 0xffff` mask, or document that color collisions are acceptable.

### IN-05: No render test on `<App />` to catch duplicate/orphaned headings

**File:** `ui/src/App.tsx:24-67` (test gap)

**Issue:** Closely tied to CR-01: the absence of any `<App />`-level render test is precisely why the duplicate-card/heading defect went unnoticed. After fixing CR-01, verify no orphaned/duplicate headings remain.

**Fix:** Add a render test on `<App />` asserting `screen.getAllByRole('heading', { name: 'Live Log' })` (and the other panel titles) returns exactly one element each.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
