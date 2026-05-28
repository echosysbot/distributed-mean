---
phase: "06"
phase_name: react-dashboard
depth: standard
files_reviewed: 47
files_reviewed_list:
  - ui/package.json
  - ui/tsconfig.json
  - ui/tsconfig.app.json
  - ui/tsconfig.node.json
  - ui/vite.config.ts
  - ui/vitest.config.ts
  - ui/tailwind.config.ts
  - ui/postcss.config.js
  - ui/eslint.config.js
  - ui/.eslintrc.cjs
  - ui/index.html
  - ui/src/App.tsx
  - ui/src/main.tsx
  - ui/src/index.css
  - ui/src/vite-env.d.ts
  - ui/src/types/api.ts
  - ui/src/types/sse.ts
  - ui/src/lib/api.ts
  - ui/src/store/useSystemStore.ts
  - ui/src/store/useJobsStore.ts
  - ui/src/store/useLogStore.ts
  - ui/src/hooks/useSSE.ts
  - ui/src/hooks/useInitialLoad.ts
  - ui/src/setupTests.ts
  - ui/src/lib/format.ts
  - ui/src/components/StatusPill.tsx
  - ui/src/components/Header.tsx
  - ui/src/components/StatsCards.tsx
  - ui/src/components/WorkerFleet.tsx
  - ui/src/components/SubmitJobForm.tsx
  - ui/src/components/LogFeed.tsx
  - ui/src/components/QueueDepthChart.tsx
  - ui/src/components/WorkerSpeedChart.tsx
  - ui/src/components/StatusBadge.tsx
  - ui/src/components/JobTaskRows.tsx
  - ui/src/components/JobsTable.tsx
  - ui/src/hooks/useJobTasks.ts
  - ui/src/__tests__/format.test.ts
  - ui/src/__tests__/api.test.ts
  - ui/src/__tests__/stores.test.ts
  - ui/src/__tests__/StatusBadge.test.tsx
  - ui/src/__tests__/StatsCards.test.tsx
  - ui/src/__tests__/LogFeed.test.tsx
  - ui/src/__tests__/SubmitJobForm.test.tsx
  - ui/src/__tests__/JobsTable.test.tsx
  - ui/src/__tests__/useSSE.test.tsx
  - ui/nginx.conf
  - ui/.dockerignore
  - ui/Dockerfile
  - docker-compose.yml
findings:
  critical: 1
  warning: 8
  info: 5
  total: 14
status: issues_found
reviewed_at: 2026-05-28
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

This is a React 18 + TypeScript + Vite dashboard for the Distributed Mean system. The overall structure is sound: Zustand stores are cleanly separated, SSE reconnection logic is well-structured, and TypeScript is configured with strict settings including `noUncheckedIndexedAccess`. However, multiple bugs were found across hooks, infrastructure config, and tests that need addressing before production deployment.

The single critical issue is that the nginx config exposes the `/internal` API path publicly without any access restriction. On the application side the main correctness defects are: a timer leak in `SubmitJobForm`, a state-clobbering bug in `useInitialLoad` that reverts the connection indicator after SSE is already live, an unmount-unsafe fetch in `useJobTasks`, and a scroll trigger mismatch in `LogFeed`. A significant test infrastructure defect means `vitest.config.ts` is missing `setupFiles`, causing all `toBeInTheDocument()` assertions to fail when tests are run directly through `vitest` rather than through `vite.config.ts`. Five additional info-level findings cover dead exports, an unused dependency, duplicate DOM chrome, misleading Fragment key, and a deprecated compose field.

---

## Critical Issues

### CR-01: nginx exposes `/internal` route without any access restriction

**File:** `ui/nginx.conf:26-33`

**Issue:** The `/internal` location block unconditionally proxies all requests to `http://api:3000` with no IP restriction, authentication requirement, or any other access guard. Any HTTP client that can reach port 80 of the nginx container — including browsers accessing the UI — can invoke `/internal/...` routes on the API directly. If these routes perform administrative operations (worker scaling, queue management, service-to-service calls), this is a direct external exposure of internal admin surface. The Vite dev proxy (`vite.config.ts:23-26`) also exposes this path, so the gap exists in both dev and production.

**Fix:** Remove the `/internal` location block from `nginx.conf` entirely (and the corresponding proxy entry from `vite.config.ts`) if no browser code calls it. Inter-service traffic to `/internal` should use the Docker network directly. If browser calls to `/internal` are genuinely required, restrict to internal network ranges:

```nginx
location /internal {
    allow 172.16.0.0/12;
    allow 10.0.0.0/8;
    allow 127.0.0.1;
    deny all;

    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Warnings

### WR-01: `useInitialLoad` resets `connectionStatus` to `'connecting'` after successful bootstrap — races with `useSSE` and reverts a live connection

**File:** `ui/src/hooks/useInitialLoad.ts:15-19`

**Issue:** Both `useSSE` and `useInitialLoad` mount concurrently in `App`. The race resolves predictably:

1. `useSSE` creates an `EventSource`; `onopen` fires quickly and sets `connectionStatus = 'connected'`.
2. `useInitialLoad` performs two HTTP round-trips (`Promise.all([listJobs(), getSystem()])`).
3. When those resolve, `useInitialLoad` calls `useSystemStore.setState({ ..., connectionStatus: 'connecting' })`, overwriting the `'connected'` status from step 1.

The `StatusPill` flickers from "Connected" back to "Connecting..." after initialization. In slow network environments it may never show "Connected" at all from the user's perspective. `connectionStatus` is owned by the SSE lifecycle and must not be written by `useInitialLoad`.

**Fix:** Remove `connectionStatus` from the `useInitialLoad` setState call:

```typescript
useSystemStore.setState({
  workers: sys.workers,
  queueDepth: sys.queueDepth,
  // connectionStatus is owned exclusively by useSSE — do not write here
});
```

---

### WR-02: `SubmitJobForm.showBanner` timer is never cancelled — fires on unmounted component and overlapping timers clear banners early

**File:** `ui/src/components/SubmitJobForm.tsx:21-25`

**Issue:** `showBanner` calls `setTimeout` and discards the handle. Two failure modes:

1. If the component unmounts before 6 seconds (e.g. in a conditional render), `setBanner(null)` fires on a stale state dispatcher. React 18 suppresses the dev warning but the closure still runs.

2. If the user submits twice within 6 seconds, two independent timers run concurrently. The first timer fires at t+6s and clears the success banner from the second submission, regardless of when the second click happened.

```typescript
// Current — no handle stored, no cleanup:
function showBanner(b: Banner, durationMs = 6000) {
  setBanner(b);
  setTimeout(() => { setBanner(null); }, durationMs);
}
```

**Fix:** Track the timer in a ref, cancel on each new call, and clean up on unmount:

```typescript
const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function showBanner(b: Banner, durationMs = 6000) {
  if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current);
  setBanner(b);
  bannerTimerRef.current = setTimeout(() => {
    setBanner(null);
    bannerTimerRef.current = null;
  }, durationMs);
}

useEffect(() => {
  return () => {
    if (bannerTimerRef.current !== null) clearTimeout(bannerTimerRef.current);
  };
}, []);
```

---

### WR-03: `useJobTasks` performs no abort-on-unmount — fetch completes and mutates store after component is gone

**File:** `ui/src/hooks/useJobTasks.ts:36-51`

**Issue:** When `JobRow` collapses and unmounts while a task fetch is in flight, the `.then()` callback still runs:
- `setLoading(false)` is called on the unmounted instance's state dispatcher.
- `useJobsStore.getState().setJobTasks(jobId, tasks)` mutates global store with data from an abandoned request.

Additionally, the `inFlight` ref is per-component-instance and resets to `false` on unmount. In React 18 StrictMode (active via `main.tsx:11`), effects are double-invoked during development. A second mount after the first unmount gets `inFlight.current = false`, bypasses the guard, and dispatches a duplicate fetch while the first request is still outstanding.

**Fix:** Use `AbortController` and guard on abort in all callbacks:

```typescript
useEffect(() => {
  if (!enabled) return;
  const cached = useJobsStore.getState().jobTasks[jobId];
  if (cached !== undefined) return;
  if (inFlight.current) return;

  const controller = new AbortController();
  inFlight.current = true;
  setLoading(true);
  setError(null);

  getJobTasks(jobId, controller.signal)
    .then((tasks) => {
      if (!controller.signal.aborted) {
        useJobsStore.getState().setJobTasks(jobId, tasks);
        setLoading(false);
      }
    })
    .catch((err: unknown) => {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLoading(false);
      useLogStore.getState().addLine('warn', `Failed to load tasks for ${shortId(jobId)}: ${message}`);
    })
    .finally(() => { inFlight.current = false; });

  return () => { controller.abort(); };
}, [jobId, enabled]);
```

`api.ts` `getJobTasks` needs to accept and forward the signal to `fetch`.

---

### WR-04: `LogFeed` auto-scroll fires on every raw log line even when a level filter is active — scrolls a filtered view with no new visible content

**File:** `ui/src/components/LogFeed.tsx:23-29`

**Issue:** The scroll `useEffect` depends on `lines.length` — the raw, unfiltered count. When the user has an active filter (e.g. "error") and a burst of "info" lines arrives, `lines.length` increments and triggers scrolling of the filtered view even though no new visible content was added. For a system generating many non-error log lines, this repeatedly jerks the scroll position while the user is reading the error-only view.

```typescript
// Current — scrolls on any new line regardless of filter:
}, [lines.length]);
```

**Fix:** Depend on `filteredLines.length` instead:

```typescript
}, [filteredLines.length]);
```

This also makes the separate `lines` subscription at line 16 redundant — it can be removed once this fix is applied (see IN-03).

---

### WR-05: `vitest.config.ts` is missing `setupFiles` — `toBeInTheDocument()` throws when vitest runs through this config

**File:** `ui/vitest.config.ts:1-21`

**Issue:** Two files define vitest configuration: `vite.config.ts` (with `test` block) and `vitest.config.ts`. When `vitest` CLI runs directly (`npx vitest`, `npm test`), it resolves `vitest.config.ts` first per Vitest's documented resolution order. `vitest.config.ts` is missing `setupFiles: './src/setupTests.ts'`.

Without `setupFiles`, `@testing-library/jest-dom/vitest` is never imported. All `expect(...).toBeInTheDocument()` assertions in the component tests throw `TypeError: expect(...).toBeInTheDocument is not a function`. All five component test files fail under this config. `npm run test` runs `vitest run` which will pick up `vitest.config.ts`, so this failure reproduces on every `npm test` invocation in a clean environment.

`vitest.config.ts` is also missing `include`/`exclude` coverage patterns, meaning coverage is computed over a different (larger) file set than `vite.config.ts` intends.

**Fix:** Delete `vitest.config.ts` and keep the single authoritative test configuration in `vite.config.ts`. Alternatively, migrate fully to `vitest.config.ts` with the merged settings:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],    // required for jest-dom matchers
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/setupTests.ts', 'src/main.tsx', 'src/**/__tests__/**'],
      thresholds: { lines: 60, branches: 60, functions: 60, statements: 60 },
    },
  },
});
```

---

### WR-06: Task drill-down is permanently stale — `useJobTasks` never re-fetches; completed tasks remain showing `running` indefinitely

**File:** `ui/src/hooks/useJobTasks.ts:26-28`

**Issue:** The cache check unconditionally returns if tasks are present:

```typescript
const cached = useJobsStore.getState().jobTasks[jobId];
if (cached !== undefined) return;
```

Once fetched, tasks are never refreshed. A job that is `running` when the user first expands its row will show tasks as `pending`/`running` even after the job transitions to `done` or `failed` via SSE. The `task_completed` SSE event is received in `useSSE.ts:63` but explicitly dropped with a comment. There is no cache-invalidation path.

**Fix:** Invalidate the task cache when a `job_update` SSE event signals a terminal state:

```typescript
// useJobsStore.ts — add clearJobTasks action:
clearJobTasks: (jobId: string) => {
  set((state) => {
    const { [jobId]: _, ...rest } = state.jobTasks;
    return { jobTasks: rest };
  });
},

// useSSE.ts — invalidate on terminal transition:
case 'job_update':
  useJobsStore.getState().upsertJob(sseEvent.job);
  if (sseEvent.job.status === 'done' || sseEvent.job.status === 'failed') {
    useJobsStore.getState().clearJobTasks(sseEvent.job.id);
  }
  break;
```

---

### WR-07: `api.test.ts` error-path test calls `createJob` twice — second call masks first and inflates call count

**File:** `ui/src/__tests__/api.test.ts:62-79`

**Issue:** The test at line 62 uses `await expect(createJob(...)).rejects.toThrow(ApiError)` which consumes the first mock call. It then enters a `try { await createJob(...) }` block at line 73 that makes a second call against the same mock. This means `mockFetch` is called twice when the test name implies a single invocation. More critically: the outer `try/catch` silently ignores errors that are not `ApiError` — if `createJob` threw a `TypeError` instead, the `expect(err).toBeInstanceOf(ApiError)` at line 76 would fail, but the failure message would reference line 76 rather than exposing the root cause at line 63. The test structure obscures failures.

**Fix:** Remove the double-call and assert error properties directly:

```typescript
it('throws ApiError with status 400 on bad request', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({ error: 'bad' }),
  });
  vi.stubGlobal('fetch', mockFetch);

  const err = await createJob({ F: 5, C: 2 }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(400);
});
```

---

### WR-08: nginx proxy blocks missing `X-Forwarded-Proto` header — API cannot determine TLS termination

**File:** `ui/nginx.conf:12-44`

**Issue:** All five proxy location blocks set `X-Forwarded-For` but none set `X-Forwarded-Proto`. When this nginx container is placed behind a TLS-terminating load balancer (the standard production topology), the API receives all requests as plain HTTP with no indication that the original connection was HTTPS. Any API logic that checks the protocol for HTTPS enforcement, secure cookie flags, or redirect generation will behave incorrectly.

**Fix:** Add `proxy_set_header X-Forwarded-Proto $scheme;` to every proxy location block:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## Info

### IN-01: `JobTaskRows` declares `jobId` prop in its interface but the component never uses it

**File:** `ui/src/components/JobTaskRows.tsx:8, 13`

**Issue:** `JobTaskRowsProps` declares `jobId: string` as a required field (line 8), but the destructuring at line 13 is `{ tasks, loading, error, colSpan }` — `jobId` is silently dropped. Every call site in `JobsTable.tsx:125` must pass a `jobId` value that is discarded. TypeScript's `noUnusedParameters` does not catch this because the prop is omitted from destructuring rather than declared and unused.

**Fix:** Remove `jobId` from `JobTaskRowsProps` and from the `<JobTaskRows>` call site in `JobsTable.tsx:125`.

---

### IN-02: `formatTime` is exported but never imported by any source file — dead export duplicated inline

**File:** `ui/src/lib/format.ts:35-37`

**Issue:** `export function formatTime` has no importers. `LogFeed.tsx:75` duplicates its logic inline with `new Date(line.ts).toLocaleTimeString()`. The function is dead bundle weight and creates a maintenance divergence point.

**Fix:** Either delete `formatTime`, or import and use it in `LogFeed.tsx:75` to remove the inline duplication:

```typescript
import { formatTime } from '../lib/format';
// ...
<span className="text-slate-600 select-none">{formatTime(line.ts)}</span>
```

---

### IN-03: `LogFeed` maintains a redundant `lines` subscription used only for scroll — can be removed after WR-04 fix

**File:** `ui/src/components/LogFeed.tsx:16`

**Issue:** `lines` is subscribed at line 16 solely to feed the `useEffect` dependency at line 29. `filteredLines` from `selectFilteredLines` is already subscribed at line 18 and derived from the same store state. Once WR-04 is applied (`filteredLines.length` as the scroll dependency), the `lines` subscription at line 16 becomes entirely redundant and causes an extra re-render on every log line addition that would not have affected the filtered view.

**Fix (apply after WR-04):** Remove line 16 and update the scroll effect dependency:

```typescript
// Remove: const lines = useLogStore((s) => s.lines);
// Change effect: }, [filteredLines.length]);
```

---

### IN-04: `React.Fragment` with `key` prop inside `JobRow` is misleading — key has no effect there

**File:** `ui/src/components/JobsTable.tsx:83`

**Issue:**

```tsx
return (
  <React.Fragment key={job.id}>
```

The `key` here has no effect on reconciliation. React reconciliation keys must be placed at the list-rendering call site. The effective key is `key={j.id}` on the `<JobRow>` element at line 214. The Fragment `key` inside the component function body is invisible to the outer reconciler. This misleads a reader into believing the inner `key` is load-bearing, which may cause a developer to remove the correct outer key thinking it is redundant.

**Fix:** Remove `key` from the inner Fragment:

```tsx
return (
  <>
    {/* reconciliation key is on the <JobRow key={j.id}> call site in JobsTable */}
    <tr ...>
```

---

### IN-05: `docker-compose.yml` uses the deprecated `version:` top-level key

**File:** `docker-compose.yml:1`

**Issue:** `version: "3.9"` is ignored by Docker Compose v2 (shipped with Docker Desktop 4.x and all modern CI runners) and emits a deprecation warning on every `docker compose up` invocation. It has no functional effect.

**Fix:** Remove the `version: "3.9"` line.

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
