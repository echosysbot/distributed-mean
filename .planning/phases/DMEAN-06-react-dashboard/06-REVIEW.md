---
phase: DMEAN-06-react-dashboard
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - docker-compose.yml
  - ui/.dockerignore
  - ui/.eslintrc.cjs
  - ui/eslint.config.js
  - ui/nginx.conf
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
  - ui/src/lib/api.ts
  - ui/src/lib/format.ts
  - ui/src/main.tsx
  - ui/src/store/useJobsStore.ts
  - ui/src/store/useLogStore.ts
  - ui/src/store/useSystemStore.ts
  - ui/src/types/api.ts
  - ui/src/types/sse.ts
  - ui/tailwind.config.ts
  - ui/tsconfig.app.json
  - ui/tsconfig.json
  - ui/tsconfig.node.json
  - ui/vite.config.ts
  - ui/vitest.config.ts
  - ui/Dockerfile
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase DMEAN-06: Code Review Report

**Reviewed:** 2026-05-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

This phase delivers a React/TypeScript dashboard built with Vite, Zustand, Recharts, Tailwind, and a complete Vitest test suite. The code is generally well-structured and follows consistent patterns. Three blockers were found: a banner auto-dismiss timer that leaks across component unmounts (timer is never cancelled), `useInitialLoad` explicitly overwriting SSE connection status back to `'connecting'` after SSE has already signaled `'connected'`, and the `/internal` backend route being exposed publicly through the nginx proxy without any access restriction. Seven warnings cover stale task data in the drill-down view, duplicate card-in-card DOM nesting, a dead `jobId` prop, duplicate vitest configs with divergent settings, missing store reset in one test file, and missing `X-Forwarded-Proto` in the nginx proxy headers.

---

## Critical Issues

### CR-01: Banner auto-dismiss `setTimeout` has no cleanup — fires on unmounted component and overlapping timers corrupt banner state

**File:** `ui/src/components/SubmitJobForm.tsx:21-25`

**Issue:** `showBanner` creates a raw `setTimeout` with no stored ID and no cleanup. Three concrete failure modes:

1. If the component unmounts before 6 seconds (user navigates away, parent removes it conditionally), `setBanner(null)` fires on a stale closure. React 18 suppresses the "update on unmounted component" warning in production but the call still runs.

2. If the user submits twice within 6 seconds, two independent timers are running. The first timer fires and clears the banner from the second submission. The user sees the success banner disappear 6 seconds after their first click regardless of when the second click happened.

3. Under React StrictMode (which is active — `main.tsx:11`) effects are double-invoked in development. `showBanner` called from `handleSubmit` is not in an effect, so this is safe, but the pattern is fragile adjacent to effect code.

**Fix:** Store the timer ID in a ref, cancel on re-call, and clean up on unmount:

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

### CR-02: `useInitialLoad` resets `connectionStatus` to `'connecting'` — races with `useSSE` and reverts a live connection to a stale status

**File:** `ui/src/hooks/useInitialLoad.ts:15-19`

**Issue:** Both `useInitialLoad` and `useSSE` mount in `App` simultaneously. The race is deterministic in most environments:

1. `useSSE` creates an `EventSource`, which fires `onopen` quickly, setting `connectionStatus = 'connected'`.
2. `useInitialLoad` performs `Promise.all([listJobs(), getSystem()])` — two HTTP round-trips.
3. When those resolve, `useInitialLoad` calls `useSystemStore.setState({ ..., connectionStatus: 'connecting' })`, overwriting the `'connected'` status written by step 1.

The `StatusPill` will display "Connecting..." after the SSE connection is already live. In slower network environments the status may never reach "Connected" from the user's perspective.

`connectionStatus` is part of the SSE lifecycle and should not be written by anything other than `useSSE`.

**Fix:** Remove `connectionStatus` from the `useInitialLoad` setState:

```typescript
// useInitialLoad.ts
useSystemStore.setState({
  workers: sys.workers,
  queueDepth: sys.queueDepth,
  // connectionStatus is owned exclusively by useSSE — do not write here
});
```

---

### CR-03: `/internal` backend route is publicly proxied without access restriction

**File:** `ui/nginx.conf:27-32`

**Issue:**

```nginx
location /internal {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Any HTTP client that can reach the UI container's port 80 can send requests to `/internal/...` on the API. If the API exposes administrative or worker-management routes under `/internal` (which is a common convention for internal service-to-service endpoints), those routes are now reachable from the public internet with no authentication at the nginx layer.

The Vite dev proxy (`vite.config.ts:26-29`) also proxies `/internal`, so this exposure is consistent across dev and production — which means there is no safety net in either environment.

**Fix:** Either remove the `/internal` nginx proxy block entirely (inter-service calls from workers to API should use the Docker network directly, not go through the UI nginx), or restrict access to the Docker internal network:

```nginx
location /internal {
    allow 172.16.0.0/12;   # Docker bridge network range
    allow 127.0.0.1;
    deny all;
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Also remove the `/internal` entry from `vite.config.ts` proxy config for the dev server.

---

## Warnings

### WR-01: Task drill-down view is permanently stale — `useJobTasks` never re-fetches after initial cache population

**File:** `ui/src/hooks/useJobTasks.ts:26-28`

**Issue:** The cache check is:

```typescript
const cached = useJobsStore.getState().jobTasks[jobId];
if (cached !== undefined) return;
```

Once tasks are fetched, `cached` is always defined (even as `[]`), and the hook never fetches again for that job ID. A job that is still `running` when the row is first expanded will show tasks as `pending`/`running` permanently, even after the job transitions to `done` via SSE. The `task_completed` SSE event is received in `useSSE.ts` but explicitly ignored with `// Reserved for future counter tracking`. There is no cache invalidation path.

**Fix:** Invalidate the task cache when a `job_update` SSE event signals a terminal status (`done` or `failed`), or handle `task_completed` events with a jobId payload:

```typescript
// In useJobsStore.ts — add a clearJobTasks action:
clearJobTasks: (jobId: string) => {
  set((state) => {
    const next = { ...state.jobTasks };
    delete next[jobId];
    return { jobTasks: next };
  });
},
```

```typescript
// In useSSE.ts — clear cache when job completes:
case 'job_update':
  useJobsStore.getState().upsertJob(sseEvent.job);
  if (sseEvent.job.status === 'done' || sseEvent.job.status === 'failed') {
    useJobsStore.getState().clearJobTasks(sseEvent.job.id);
  }
  break;
```

---

### WR-02: `JobTaskRows` `jobId` prop is declared in the interface but never used inside the component

**File:** `ui/src/components/JobTaskRows.tsx:6, 13`

**Issue:** `JobTaskRowsProps` declares `jobId: string` as a required field, but the function destructures only `{ tasks, loading, error, colSpan }`. Every call site in `JobsTable.tsx` must pass a `jobId` prop that is silently discarded. TypeScript does not flag this because the prop is consumed at the boundary — it is simply never destructured.

**Fix:** Remove `jobId` from `JobTaskRowsProps` and remove the prop from the call site in `JobsTable.tsx:125`:

```typescript
interface JobTaskRowsProps {
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  colSpan: number;
}
```

---

### WR-03: Double card nesting — components own their card wrapper AND `App.tsx` wraps them in an identical card section

**File:** `ui/src/App.tsx:24-29, 31-36, 60-67` and `ui/src/components/WorkerFleet.tsx:34-36`, `ui/src/components/SubmitJobForm.tsx:77`, `ui/src/components/LogFeed.tsx:38`

**Issue:** `App.tsx` wraps `<WorkerFleet>`, `<SubmitJobForm>`, and `<LogFeed>` in `<section className="rounded-lg bg-slate-800 border border-slate-700 p-5">` with a section `<h2>`. Each of those components then renders its own identical outer `<div className="rounded-lg bg-slate-800 border border-slate-700 p-5">` with its own `<h2>` heading. The DOM result is a dark card nested inside an identical dark card, producing visible double-border and double-padding artifacts. The `LogFeed` component is the worst case: `App.tsx:62` renders a "Live Log" `h2`, and `LogFeed.tsx:41` renders another "Live Log" `h2` directly below it.

**Fix:** Decide on one owner for the card chrome. Recommended: remove the outer card `<div>` and duplicate `<h2>` from each leaf component so that `App.tsx` is the single source of card layout. `QueueDepthChart` and `WorkerSpeedChart` follow this same anti-pattern.

---

### WR-04: `useInitialLoad` fetch errors are swallowed as `warn` log lines with no user-visible signal

**File:** `ui/src/hooks/useInitialLoad.ts:20-23`

**Issue:**

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  useLogStore.getState().addLine('warn', `Initial load failed: ${message}`);
}
```

If the API is unreachable when the page first loads, all jobs and system state silently remain empty. The only feedback is a `warn` log line in the `LogFeed` component, which the user may not notice. The `StatsCards` will show all zeros with no indication that data failed to load. The `StatusPill` still shows "Connecting…" from the SSE connection (which may also fail), but there is no dedicated "data load failed" state.

**Fix:** At minimum, also set a visible error state. A simple approach is to add an `error` field to `useSystemStore` and display a banner in `App.tsx`:

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  useLogStore.getState().addLine('warn', `Initial load failed: ${message}`);
  useSystemStore.getState().setInitialLoadError(message);
}
```

---

### WR-05: `vitest.config.ts` and the `test` block in `vite.config.ts` are divergent — `setupFiles` missing from `vitest.config.ts`

**File:** `ui/vitest.config.ts:1-21` and `ui/vite.config.ts:30-47`

**Issue:** Two sources of vitest configuration exist with different settings:

- `vite.config.ts` test block: includes `setupFiles: ['./src/setupTests.ts']`, coverage `include`/`exclude` patterns, and `globals: true`.
- `vitest.config.ts`: omits `setupFiles`, omits coverage `include`/`exclude`, adds `lcov` reporter.

When `vitest` is invoked directly (e.g., `npx vitest` or CI runner without `--config`), Vitest prefers `vitest.config.ts` over the embedded `test` block in `vite.config.ts`. Under `vitest.config.ts`, `setupFiles` is absent, so `@testing-library/jest-dom/vitest` is never imported and all `toBeInTheDocument()` assertions throw `TypeError: expect(...).toBeInTheDocument is not a function`. All component tests currently fail under this config.

**Fix:** Delete `vitest.config.ts` and keep the single authoritative test configuration in `vite.config.ts`, or migrate entirely to `vitest.config.ts` with the complete merged settings from both files.

---

### WR-06: `useSSE.test.tsx` does not reset `queueDepthHistory` in `beforeEach` — samples from one test pollute later tests

**File:** `ui/src/__tests__/useSSE.test.tsx:44-60`

**Issue:** The `beforeEach` block resets `useSystemStore` and `useJobsStore.jobs/jobTasks/expandedJobs`, but does not reset `queueDepthHistory`. The `queue_depth` event test at line 68-79 calls `pushQueueDepthSample` via the `queue_depth` SSE event handler. That sample persists in `queueDepthHistory` for subsequent tests in the file. While no current test asserts on `queueDepthHistory`, any future test that checks chart data will see phantom samples from prior tests.

**Fix:** Reset `queueDepthHistory` in `beforeEach`:

```typescript
useJobsStore.setState({
  jobs: {},
  jobTasks: {},
  expandedJobs: new Set(),
  queueDepthHistory: [],
});
```

---

### WR-07: nginx proxy is missing `X-Forwarded-Proto` header — API cannot determine TLS termination status

**File:** `ui/nginx.conf:12-15, 20-23, 28-31, 36-41, 49-54`

**Issue:** All five proxy location blocks set `X-Forwarded-For` but none set `X-Forwarded-Proto`. When this nginx container is placed behind a TLS-terminating load balancer (the standard production topology), the API receives all requests as plain HTTP with no indication that the original connection was HTTPS. Any API logic that checks the protocol for HTTPS enforcement, secure cookie flags, or CSP policy generation will behave incorrectly.

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

### IN-01: `formatTime` is exported from `lib/format.ts` but never imported anywhere — dead export

**File:** `ui/src/lib/format.ts:35-37`

**Issue:** `formatTime` is an exported utility function but no source file imports it. `LogFeed.tsx:75` duplicates its logic inline with `new Date(line.ts).toLocaleTimeString()`. The function is dead code that ships in the bundle and must be maintained alongside the inline duplicate.

**Fix:** Either delete `formatTime`, or use it in `LogFeed.tsx` to eliminate the duplication:

```typescript
// LogFeed.tsx
import { formatTime } from '../lib/format';
// ...
<span className="text-slate-600 select-none">{formatTime(line.ts)}</span>
```

---

### IN-02: `clsx` is listed as a production dependency but is not imported anywhere in the source

**File:** `ui/package.json:16`

**Issue:** `"clsx": "^2.1.0"` is in `dependencies` (not `devDependencies`), so it ships in the production bundle. No `.ts` or `.tsx` file imports from `clsx`. The library adds ~1.5KB (minified) to the bundle unnecessarily.

**Fix:** Remove `"clsx": "^2.1.0"` from `dependencies` in `package.json`.

---

### IN-03: `React.Fragment` with `key` prop inside `JobRow` is misleading dead code

**File:** `ui/src/components/JobsTable.tsx:83`

**Issue:**

```tsx
return (
  <React.Fragment key={job.id}>
```

The `key` prop here has no effect. Keys must be placed on elements at the point where they appear in a list — the effective key is the `key={j.id}` on the `<JobRow>` element at line 214. The `key` on the Fragment inside `JobRow` is not visible to React's reconciliation for the outer list. This misleads a reader into thinking the inner `key` is doing work, and may cause a developer to remove the outer `key` thinking it is redundant.

**Fix:** Remove `key` from the inner Fragment:

```tsx
return (
  <React.Fragment>
    {/* reconciliation key is on the <JobRow key={j.id}> call site */}
```

---

### IN-04: `docker-compose.yml` uses the deprecated `version:` top-level key

**File:** `docker-compose.yml:1`

**Issue:** `version: "3.9"` is ignored by Docker Compose v2 (which ships with Docker Desktop 4.x and later) and produces a deprecation warning on every `docker compose up` invocation. It has no effect on behavior.

**Fix:** Remove the `version: "3.9"` line.

---

_Reviewed: 2026-05-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
