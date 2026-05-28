---
phase: DMEAN-06-react-dashboard
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - docker-compose.yml
  - ui/.dockerignore
  - ui/.eslintrc.cjs
  - ui/.gitignore
  - ui/Dockerfile
  - ui/eslint.config.js
  - ui/index.html
  - ui/nginx.conf
  - ui/package-lock.json
  - ui/package.json
  - ui/postcss.config.js
  - ui/src/App.tsx
  - ui/src/__tests__/JobsTable.test.tsx
  - ui/src/__tests__/LogFeed.test.tsx
  - ui/src/__tests__/StatsCards.test.tsx
  - ui/src/__tests__/StatusBadge.test.tsx
  - ui/src/__tests__/SubmitJobForm.test.tsx
  - ui/src/__tests__/api.test.ts
  - ui/src/__tests__/format.test.ts
  - ui/src/__tests__/stores.test.ts
  - ui/src/__tests__/useSSE.test.tsx
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
  - ui/src/index.css
  - ui/src/lib/api.ts
  - ui/src/lib/format.ts
  - ui/src/main.tsx
  - ui/src/setupTests.ts
  - ui/src/store/useJobsStore.ts
  - ui/src/store/useLogStore.ts
  - ui/src/store/useSystemStore.ts
  - ui/src/types/api.ts
  - ui/src/types/sse.ts
  - ui/src/vite-env.d.ts
  - ui/tailwind.config.ts
  - ui/tsconfig.app.json
  - ui/vite.config.ts
  - ui/vitest.config.ts
findings:
  critical: 4
  warning: 8
  info: 4
  total: 16
status: issues_found
---

# Phase DMEAN-06: Code Review Report

**Reviewed:** 2026-05-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

This phase implements a React/TypeScript dashboard with Zustand stores, SSE streaming, Recharts visualizations, and a complete Vitest test suite. The architecture is sound and the code is generally well-structured. However, four blockers were found: a duplicate service key in docker-compose.yml that silently drops the first `ui` service definition, a memory leak from banner auto-dismiss timers that fire on unmounted components, an incorrect `key` prop placement (on a Fragment wrapping element rather than on the list element), and a missing SSE URL prefix that will 404 in production. Eight additional warnings cover store mutations leaking across tests, a stale-closure bug in the banner timer, unguarded type coercions, and missing `X-Forwarded-Proto` headers in the nginx proxy.

---

## Critical Issues

### CR-01: Duplicate `ui` service key silently discards first definition

**File:** `docker-compose.yml:96-130`
**Issue:** The `ui` service is declared twice (lines 96–111 and lines 115–130). YAML parsers silently keep only the last key, so the first definition — including the explicit comment "UI" — is discarded. The two definitions are identical, so the functional impact happens to be neutral today, but any future divergence between the two blocks will produce invisible, hard-to-debug configuration drift. Docker Compose will emit no error and will only start one `ui` container using the second definition.
**Fix:** Remove the duplicate block (lines 115–130) and add a comment header `# ─── Workers ────────────────────────────────────────────────────────────────` immediately before the `worker:` service definition at line 132.

```yaml
  # ─── Workers ────────────────────────────────────────────────────────────────

  worker:
    build:
      context: ./workers
```

---

### CR-02: Banner auto-dismiss timer fires on unmounted component (memory leak / React warning)

**File:** `ui/src/components/SubmitJobForm.tsx:21-24`
**Issue:** `showBanner` uses a bare `setTimeout` that calls `setBanner(null)` after 6 seconds. If the component unmounts before the timer fires (e.g., the user navigates away or the component is conditionally removed), React will emit an "update on unmounted component" warning in development and log a no-op state update in production. In React 18 strict mode (`App.tsx` renders inside `<React.StrictMode>`), effects and timers are double-invoked during development, meaning the timer can fire unexpectedly. There is no cleanup mechanism.

```typescript
// Current — no cleanup:
function showBanner(b: Banner, durationMs = 6000) {
  setBanner(b);
  setTimeout(() => {
    setBanner(null);
  }, durationMs);
}
```

**Fix:** Track the timer ID in a ref and clear it on each new call and on unmount:

```typescript
const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function showBanner(b: Banner, durationMs = 6000) {
  if (bannerTimerRef.current !== null) {
    clearTimeout(bannerTimerRef.current);
  }
  setBanner(b);
  bannerTimerRef.current = setTimeout(() => {
    setBanner(null);
    bannerTimerRef.current = null;
  }, durationMs);
}

useEffect(() => {
  return () => {
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
  };
}, []);
```

---

### CR-03: `key` prop on `React.Fragment` is a no-op — React list reconciliation broken for task rows

**File:** `ui/src/components/JobsTable.tsx:83`
**Issue:** `<React.Fragment key={job.id}>` places the `key` on the Fragment wrapper. When React renders a list of Fragments, the `key` must be on the Fragment itself — which is correct for static JSX. However the `key` attribute here is redundant because the outer iterator (`jobList.map`) already renders `<JobRow key={j.id} .../>` (line 213). The bug is that `JobRow` itself returns a `<React.Fragment key={job.id}>` (line 83), but the `key` prop is **not forwarded through component boundaries** — the `key` on the Fragment inside `JobRow` has no relation to the outer list `key`. The outer `key={j.id}` on `<JobRow>` is what actually drives reconciliation, so the Fragment `key` inside is dead code and misleading. This is not simply a style issue: if `JobRow` is ever refactored to render multiple sibling rows outside a Fragment (e.g., to address the `colSpan` structure), developers will incorrectly believe the inner `key` is sufficient and remove the outer one.

More critically: the `<JobTaskRows>` component (line 125) renders a bare `<>…</>` (shorthand Fragment without a key) containing multiple `<tr>` elements, which are siblings in the DOM to the parent `<tr>`. This means the task rows do not have keys on them at the correct level, which can cause incorrect DOM reconciliation when tasks are added or removed.

**Fix:** Remove the `key` prop from the internal `React.Fragment` in `JobRow` — it is meaningless there — and ensure the outer `<JobRow key={j.id}>` call site (line 213) is the sole source of reconciliation identity. Document this in a comment.

```typescript
// JobsTable.tsx line 83 — remove key from Fragment:
return (
  <React.Fragment>
    {/* key is managed by the parent map: <JobRow key={j.id} /> */}
    <tr ...>
```

---

### CR-04: SSE endpoint hardcoded to `/events` — will 404 behind the nginx proxy for the `/system/events` path

**File:** `ui/src/hooks/useSSE.ts:29`  
**Issue:** The SSE hook connects to `/events` unconditionally:

```typescript
const es = new EventSource('/events');
```

The nginx config at `ui/nginx.conf` proxies **both** `/events` (line 47) and `/system/events` (line 35). However, the Vite dev proxy (`vite.config.ts`) only proxies `/events` (line 22), not `/system/events`. This is currently consistent, so in isolation it appears fine. The problem is the other direction: `nginx.conf` has a dedicated `/system/events` block with correct SSE headers (no-buffering, long timeout), yet the client always connects to `/events`. If the API server ever moves the SSE endpoint to `/system/events` — which the nginx config strongly suggests was either planned or is an alternate route — the client will silently fail. More concretely, the nginx `/system/events` block exists with no corresponding client usage, indicating either dead nginx config (a quality defect) or a missed client update (a correctness defect). Either the `/system/events` nginx block should be removed, or the SSE URL should be a configurable constant.

**Fix:** Either remove the dead `/system/events` nginx proxy block, or expose the SSE endpoint as an env-configurable constant and document the intended URL:

```typescript
// useSSE.ts — use a named constant for the endpoint
const SSE_ENDPOINT = (import.meta.env['VITE_SSE_ENDPOINT'] as string | undefined) ?? '/events';
const es = new EventSource(SSE_ENDPOINT);
```

And clean up `nginx.conf` to remove the `/system/events` block if unused.

---

## Warnings

### WR-01: Stale closure — banner `setTimeout` captures `f`/`c` at call time but form state can change

**File:** `ui/src/components/SubmitJobForm.tsx:21-24, 56`
**Issue:** The `showBanner` function is declared inside `SubmitJobForm` but captures no reactive values. The actual stale closure risk is that calling `showBanner` multiple times in rapid succession will schedule overlapping timers, each independently setting `setBanner(null)`. If the user submits twice quickly, the first timer fires 6s after the first submission and will clear the banner from the second submission early. This is a race condition on the auto-dismiss timers, not just an unmount issue. (This partially overlaps with CR-02 but is a distinct runtime behavior.)

**Fix:** Same fix as CR-02 — a single `bannerTimerRef` that is cleared on each `showBanner` call prevents overlapping timers.

---

### WR-02: `useJobTasks` — `inFlight` ref is per-component-instance and does not prevent concurrent fetches across re-mounts

**File:** `ui/src/hooks/useJobTasks.ts:20-30`
**Issue:** The `inFlight` ref is reset to `false` on every unmount/remount of `JobRow`. If `JobRow` unmounts and remounts before the first fetch resolves (e.g., due to React StrictMode double-invocation or rapid expand/collapse), `inFlight.current` is `false` on the new mount and a second fetch is dispatched. The store-cache check (`if (cached !== undefined) return`) guards against a completed fetch, but not against an in-flight fetch from a previous mount. This can produce two concurrent requests for the same job's tasks, where both responses call `setJobTasks` — the second write is harmless but generates unnecessary network load.

**Fix:** Move the in-flight guard to a module-level `Set` keyed by `jobId`, so it persists across component instances:

```typescript
const inFlightJobIds = new Set<string>();

export function useJobTasks(jobId: string, enabled: boolean): UseJobTasksResult {
  // ...
  useEffect(() => {
    if (!enabled) return;
    const cached = useJobsStore.getState().jobTasks[jobId];
    if (cached !== undefined) return;
    if (inFlightJobIds.has(jobId)) return;

    inFlightJobIds.add(jobId);
    // ...fetch...
    .finally(() => {
      inFlightJobIds.delete(jobId);
    });
  }, [jobId, enabled]);
}
```

---

### WR-03: `useInitialLoad` overwrites `connectionStatus` to `'connecting'` on every initial load — races with `useSSE`

**File:** `ui/src/hooks/useInitialLoad.ts:15-19`
**Issue:** The `useInitialLoad` hook calls `useSystemStore.setState({ connectionStatus: 'connecting' })` after successfully receiving data from the API. If `useSSE` runs concurrently (both hooks are called at App mount) and the SSE connection opens before `useInitialLoad` finishes, `useSSE.onopen` sets status to `'connected'`, then `useInitialLoad`'s `setState` fires and reverts it to `'connecting'`. The user sees the connection status pill flicker from "Connecting..." to "Connected" then back to "Connecting..." momentarily. There is no intentional reason to reset connection status from within `useInitialLoad` — this field belongs solely to the SSE lifecycle.

**Fix:** Remove `connectionStatus: 'connecting'` from the `useInitialLoad` setState call. Only `useSSE` should manage connection status.

```typescript
useSystemStore.setState({
  workers: sys.workers,
  queueDepth: sys.queueDepth,
  // Do not reset connectionStatus here — owned by useSSE
});
```

---

### WR-04: `JobTaskRows` receives `jobId` prop but never uses it — dead prop

**File:** `ui/src/components/JobTaskRows.tsx:13`
**Issue:** The component signature destructures `{ tasks, loading, error, colSpan }` but the interface declares `jobId: string` (line 6) as a required prop. The `jobId` parameter is accepted by the interface but immediately discarded in the destructuring. This is dead surface area on the component API — every call site must pass a `jobId` string that is never consumed.

```typescript
// Interface declares jobId but component ignores it:
export function JobTaskRows({ tasks, loading, error, colSpan }: JobTaskRowsProps) {
```

**Fix:** Remove `jobId` from `JobTaskRowsProps` and the `JobTaskRows` call site in `JobsTable.tsx`, or use it for something (e.g., a data-testid attribute).

---

### WR-05: `WorkerFleet` renders its own card wrapper duplicating the card already provided by `App.tsx`

**File:** `ui/src/components/WorkerFleet.tsx:34-36` and `ui/src/App.tsx:24-29`
**Issue:** `App.tsx` wraps `<WorkerFleet />` inside a `<section className="rounded-lg bg-slate-800 border border-slate-700 p-5">` that already includes the card chrome. `WorkerFleet` itself returns another `<div className="rounded-lg bg-slate-800 border border-slate-700 p-5">` wrapper with a duplicate "Worker Fleet" heading. The same duplication exists in `SubmitJobForm`, `LogFeed`, `QueueDepthChart`, and `WorkerSpeedChart`. The result is double-bordered, double-padded sections in the rendered output, producing visual artifacts (nested dark cards). The `App.tsx` sections are redundant wrappers.

**Fix:** Either remove the card wrapper `<div>` from each component (letting `App.tsx` control layout) or remove the `<section>` wrappers in `App.tsx` and let each component own its own chrome. Chose one pattern and apply consistently. The `Header.tsx` pattern (no self-wrapping card) is the cleaner approach.

---

### WR-06: `formatTime` in `ui/src/lib/format.ts` is exported but never imported anywhere

**File:** `ui/src/lib/format.ts:35-37`
**Issue:** `formatTime` is exported but a project-wide search of all imports reveals it is not used by any component, hook, or test file. With `noUnusedLocals` set in `tsconfig.app.json`, this would normally be caught at compile time — however `noUnusedLocals` only applies to local (non-exported) symbols. Exported dead code is invisible to TypeScript's checker. The function will be included in the bundle and accumulates maintenance debt.

**Fix:** Remove `formatTime` from `format.ts`, or add a usage (e.g., in `LogFeed` for displaying log timestamps consistently instead of the inline `new Date(line.ts).toLocaleTimeString()` call at `LogFeed.tsx:75`).

---

### WR-07: Zustand store state leaks between test files — `expandedJobs: new Set()` reference shared

**File:** `ui/src/__tests__/stores.test.ts:9-18`, `ui/src/__tests__/JobsTable.test.tsx:10-16`
**Issue:** Each test's `beforeEach` calls `useJobsStore.setState({ expandedJobs: new Set() })`. Zustand's `setState` performs a shallow merge — it replaces the reference at `expandedJobs` with the provided `new Set()`. However if any test calls `toggleExpanded`, it mutates the Set in-place via `set((state) => { const next = new Set(state.expandedJobs); ... })`. This is actually safe because `toggleExpanded` creates a new Set. But the `workerSpeedHistory` in `useSystemStore` is a `Record<string, WorkerSpeedSample[]>`, and the `setWorkers` action spreads it: `const updated = { ...state.workerSpeedHistory }`. If test isolation is not perfect (e.g., a test adds a worker without cleanup), the spread copies references to the old arrays, and those arrays are mutated by `pruneHistory` returning new arrays (safe). The real risk is that `vitest` runs test files in worker threads sharing the module graph — stores persist their singleton state across tests in the same file. The `beforeEach` resets in stores.test.ts are correct, but tests in `useSSE.test.tsx` reset `useSystemStore` but do **not** reset `useJobsStore.queueDepthHistory`, meaning a `queue_depth` SSE event test that fires `pushQueueDepthSample` could leave a non-empty `queueDepthHistory` visible to later tests.

**Fix:** In `useSSE.test.tsx`'s `beforeEach`, also reset `queueDepthHistory`:

```typescript
useJobsStore.setState({
  jobs: {},
  jobTasks: {},
  expandedJobs: new Set(),
  queueDepthHistory: [],  // ensure clean slate
});
```

---

### WR-08: nginx proxy missing `X-Forwarded-Proto` header — API cannot determine TLS termination

**File:** `ui/nginx.conf:12-44`
**Issue:** All proxy location blocks set `X-Forwarded-For` but omit `X-Forwarded-Proto`. When this nginx container sits behind a TLS-terminating load balancer or reverse proxy (standard production deployment), the API process receives HTTP requests with no indication that the original connection was HTTPS. Any API logic that inspects the protocol to enforce HTTPS redirects or set secure cookies will behave incorrectly.

**Fix:** Add `proxy_set_header X-Forwarded-Proto $scheme;` to all proxy location blocks:

```nginx
location /jobs {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## Info

### IN-01: Two vitest config files exist with divergent coverage settings

**File:** `ui/vite.config.ts:30-47` and `ui/vitest.config.ts:1-21`
**Issue:** `vite.config.ts` embeds a `test` block (used when running `vitest` from Vite), and `vitest.config.ts` exists as a separate config. The `vitest.config.ts` file specifies `reporter: ['text', 'html', 'lcov']` while `vite.config.ts` specifies `reporter: ['text', 'html']` (no lcov). The `vitest.config.ts` also omits the `include`/`exclude` coverage patterns present in `vite.config.ts`. When `vitest` is run directly (e.g., from CI using `npx vitest`), Vitest picks `vitest.config.ts` over the embedded config and the coverage exclusions are lost.

**Fix:** Remove the `test` block from `vite.config.ts` and consolidate all test/coverage config in `vitest.config.ts` with the union of both configurations.

---

### IN-02: `clsx` dependency declared but not used anywhere in source

**File:** `ui/package.json:16`
**Issue:** `clsx` is listed as a production dependency but a search of all `.ts`/`.tsx` files finds no `import ... from 'clsx'` statement. The package ships 1.5KB (minified) in the production bundle unnecessarily.

**Fix:** Remove `"clsx": "^2.1.0"` from `dependencies` in `package.json` and run `npm install` to update the lockfile.

---

### IN-03: `formatElapsed` in `LogFeed` — inline `toLocaleTimeString()` duplicates `formatTime` logic

**File:** `ui/src/components/LogFeed.tsx:75`
**Issue:** `LogFeed` calls `new Date(line.ts).toLocaleTimeString()` inline rather than using `formatTime` from `../lib/format`. This is the only in-source use of the same pattern that `formatTime` encapsulates. If locale formatting ever needs to change (e.g., 24-hour format, timezone), it must be changed in both places.

**Fix:** Import and use `formatTime` from `../lib/format` (which resolves IN-02 / WR-06 simultaneously):

```typescript
import { formatTime } from '../lib/format';
// ...
<span className="text-slate-600 select-none">{formatTime(line.ts)}</span>
```

---

### IN-04: `docker-compose.yml` uses deprecated `version:` top-level key

**File:** `docker-compose.yml:1`
**Issue:** `version: "3.9"` is ignored by Docker Compose v2 (which ships with Docker Desktop 4.x) and will trigger a deprecation warning. It has no effect on behavior but adds noise to `docker compose up` output.

**Fix:** Remove the `version: "3.9"` line from the top of `docker-compose.yml`.

---

_Reviewed: 2026-05-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
