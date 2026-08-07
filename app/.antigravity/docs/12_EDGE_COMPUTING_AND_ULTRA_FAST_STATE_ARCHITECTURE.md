# 12 · Edge Computing & Ultra-Fast State Architecture — Wealth AI

## Goal

Keep large-ledger filtering and dashboard updates responsive without weakening
authentication, cache isolation, or data consistency. The main thread should
not be blocked longer than 50 ms by client-side computation.

## Deliverables

- Add a typed ledger worker under `src/lib/workers/` only after profiling shows
  the client filter/sort is a bottleneck. Define serializable transaction input
  and output types; normalize optional merchant/category values; terminate the
  worker on unmount; and prevent stale responses from replacing newer queries.
- Build a `useWorkerLedger` hook with a synchronous fallback for environments
  without `Worker`. Send sort/filter criteria and a request ID; transfer only
  the fields needed for search where possible.
- Use React `useDeferredValue` for ledger search so input state updates
  immediately. Pair it with a clearly presented pending state; deferred search
  is not a debounce substitute for server requests.
- Use SWR for appropriate client dashboard widgets. The fetcher must reject
  non-OK responses, use authenticated same-origin requests, validate response
  shape, and never expose one user’s cached data to another.
- Use optimistic state only for operations with a reconciled server result and
  visible failure recovery.

## Acceptance gates

- Test 10,000 realistic rows: typing remains responsive and results cannot be
  reordered by late worker messages.
- A revisited dashboard paints cached data without a layout flash, then safely
  revalidates. Error and logged-out states remain explicit.
- Worker initialization, fallback, cleanup, typecheck, and production build
  succeed without a hydration regression.
