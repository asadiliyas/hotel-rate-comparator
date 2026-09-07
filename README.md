# Hotel Rate Comparator

A hotel search app that uses a [Temporal](https://temporal.io) workflow to call two
mock supplier APIs in parallel, handle their delays/timeouts/errors/empty
responses, and return the cheapest available rate to a React frontend.

```
┌──────────┐   POST /api/search-hotels    ┌──────────────┐   starts    ┌────────────────────────┐
│ frontend │ ────────────────────────────▶│  backend API │────────────▶│   searchHotelsWorkflow  │
│ (Vite +  │   GET  /api/search-hotels/:id │  (Express)   │◀────────────│                         │
│  React)  │◀───────────────────────────── └──────────────┘   result   │  fetchSupplierARates  ┐│
└──────────┘   POST .../cancel                     │                   │  fetchSupplierBRates  ┤├─▶ mock suppliers
                                                     │ Temporal client   └────────────────────────┘   (Express, :4000)
                                                     ▼
                                            Temporal Server (:7233 / UI :8233)
                                                     ▲
                                                     │ polls task queue "hotel-search"
                                            ┌──────────────────┐
                                            │  Temporal Worker  │
                                            └──────────────────┘
```

## Packages

This is an npm-workspaces monorepo:

| Package | Purpose |
|---|---|
| [`packages/shared`](packages/shared) | Types shared by every other package (`HotelRate`, `SearchHotelsInput`, `SearchHotelsResult`). Pure, no Node APIs, no build step - it's imported straight from source, including into the Temporal workflow sandbox. |
| [`packages/suppliers`](packages/suppliers) | Mock Supplier A / Supplier B APIs (Express). |
| [`packages/backend`](packages/backend) | The Temporal workflow, activities, worker, and the Express API the frontend talks to. |
| [`packages/frontend`](packages/frontend) | The React (Vite + TypeScript) search UI. |

## Prerequisites

- **Node.js >= 20.3** (developed and tested on Node 24; see `.nvmrc`)
- **A local Temporal server.** Pick one - both listen on `localhost:7233` (gRPC) and serve a Web UI on `localhost:8233`, so **only run one at a time**:
  - **Option A - Docker** (`docker-compose.yml` is included, single container, no Postgres/Elasticsearch needed):
    ```bash
    docker compose up -d
    ```
  - **Option B - Temporal CLI** (no Docker required):
    ```bash
    temporal server start-dev
    ```
    Install it from https://docs.temporal.io/cli or via a package manager (e.g. `winget install Temporal.TemporalCLI`, `brew install temporal`).

Both options need one-time internet access on first run (to pull the image or download the binary); nothing after that.

## Setup

```bash
npm install
```

This installs every workspace package's dependencies in one pass. No separate build step is needed anywhere - the backend and suppliers run their TypeScript directly via `tsx`, and the frontend runs it via Vite.

## Running the app

With a Temporal server already running (see Prerequisites), from the repo root:

```bash
npm run dev
```

This starts the mock suppliers, the Temporal worker, the backend API, and the frontend together (via `concurrently`), then open **http://localhost:5173**.

Or run each piece individually, in separate terminals:

```bash
npm run dev:suppliers   # mock Supplier A / B APIs      -> http://localhost:4000
npm run dev:worker      # Temporal worker (polls "hotel-search")
npm run dev:api         # backend Express API           -> http://localhost:4100
npm run dev:frontend    # React frontend                -> http://localhost:5173
```

The Temporal Web UI (http://localhost:8233) is useful for watching workflow executions, retries, and cancellations while you use the app.

### Configuration

Every setting has a working default, so none of this is required. Override via environment variables if needed:

| Variable | Default | Used by |
|---|---|---|
| `TEMPORAL_ADDRESS` | `localhost:7233` | worker, backend API |
| `BACKEND_PORT` | `4100` | backend API |
| `SUPPLIERS_PORT` | `4000` | mock suppliers |
| `SUPPLIERS_BASE_URL` | `http://localhost:4000` | backend API (where activities call the suppliers) |
| `VITE_API_BASE_URL` | `http://localhost:4100` | frontend (see `packages/frontend/.env.example`) |

## Running tests

```bash
npm test
```

Runs the backend's full unit + workflow suite (`packages/backend`, Jest + `@temporalio/testing`). No running Temporal server, worker, or suppliers process is needed - the workflow tests spin up an ephemeral, time-skipping Temporal test environment and use mocked activity implementations, so the suite is fast and deterministic.

```bash
npm run typecheck   # tsc --noEmit across every package
```

## API

| Endpoint | Description |
|---|---|
| `POST /api/search-hotels` | Body `{ city, checkInDate, checkOutDate }`. Validates input, starts the workflow, returns `202 { workflowId }`. |
| `GET /api/search-hotels/:workflowId` | Awaits the workflow's result. `200` with `{status:'OK', hotel}` or `{status:'NO_HOTELS_FOUND'}`; `502` if both suppliers failed; `409` if the search was cancelled; `404` for an unknown id. |
| `POST /api/search-hotels/:workflowId/cancel` | Requests cancellation of an in-progress search. `202` once the request is sent. |

`GET /supplierA/hotels` and `GET /supplierB/hotels` (mock suppliers, `:4000`) accept `city` (required) plus optional simulation knobs: `delayMs` (default ~250ms - a value larger than the workflow's timeout is indistinguishable from a real timeout), `empty=true`, and `error=<http status>`.

## Scenario coverage

All scenarios are covered at both the unit level (`packages/backend/tests/unit/compare.test.ts` - pure comparator logic, no Temporal involved) and, except where noted, the workflow level (`packages/backend/tests/workflow/searchHotelsWorkflow.test.ts` - the real workflow running against Temporal's test environment with mocked activities).

**Basic scenarios**

| Scenario | Expected outcome | Covered by |
|---|---|---|
| Supplier A cheaper | Return A's result | `compare.test.ts`, workflow test |
| Supplier B cheaper | Return B's result | `compare.test.ts`, workflow test |
| Both return same rate | Deterministically pick Supplier A | `compare.test.ts`, workflow test |
| Supplier A fails, B succeeds | Return B's result | `compare.test.ts`, workflow test |
| Both fail | Return error | `compare.test.ts`, workflow test (asserts a non-retryable `ApplicationFailure`) |
| One returns empty | Use the available result | `compare.test.ts`, workflow test |
| Both return empty | "No hotels found" | `compare.test.ts`, workflow test |

**Advanced scenarios**

| Scenario | Expected behavior | Covered by |
|---|---|---|
| One supplier takes >5s | Cancel the slow activity, proceed with the other result | `activities.test.ts` (via `MockActivityEnvironment`, asserts the activity's in-flight request actually aborts) + workflow test (asserts the workflow proceeds with the fast supplier's result within a short, test-overridden timeout) |
| Supplier A fails 2x before success | Still succeeds within the retry policy | workflow test only (a closure call-counter mock, run under the real retry policy - not something a plain unit test can exercise) |
| User cancels mid-way | Workflow stops gracefully | workflow test (starts the workflow, calls `handle.cancel()`, asserts a clean `CancelledFailure`) - and it's wired all the way up to the UI too: a "Cancel search" link appears while a search is in flight |

`compare.test.ts` also covers one edge case beyond the required table: a supplier returning an empty list alongside a *failed* sibling still resolves to "No hotels found" rather than an error, since an empty response is a valid answer, not a failure.

## Design notes

- **Why an async start/result API instead of one blocking request:** a worst-case run (retries × two suppliers) can approach ~20-30s. Splitting `POST` (start) from `GET` (await result) is the idiomatic Temporal pattern and is what makes the Cancel button possible - the frontend just calls both in sequence, so the user experience is still a single search-and-wait.
- **Why cancelling the slow supplier needs more than a timeout:** a Temporal activity's `startToCloseTimeout` stops the *workflow* from waiting, but doesn't by itself stop the *activity's* in-flight work - that requires the activity to heartbeat and react to a cancellation signal, which is what `fetchSupplierARates`/`fetchSupplierBRates` do (wiring `Context.current().cancellationSignal` into `fetch`).
- **Why a real workflow cancellation is detected the way it is:** `Promise.allSettled` never rejects, so if both suppliers' activity calls happen to reject as cancellations at the same moment, that can only mean the *workflow itself* was cancelled from outside (the app's own logic never cancels both suppliers at once) - see the comment in `searchHotelsWorkflow` for the full reasoning.

## Known limitations & assumptions

- No auth or rate-limiting anywhere - fine for mock suppliers and a take-home backend, not production-hardened.
- No persistence layer beyond Temporal's own workflow history; there's no search history feature, by design.
- Mock supplier data is generated deterministically from a hash of `(city, supplier)` rather than drawn from a fixed city list, so any city name works, but the data is obviously synthetic.
- The frontend awaits one blocking `GET` for the final result rather than polling or streaming progress - a deliberate simplification given realistic run times, not a missing feature.
- Playwright/end-to-end browser tests are intentionally out of scope. The assignment's testing ask is scenario coverage via unit and workflow tests (both backend concerns), which is what's implemented; the frontend was verified manually against the running backend instead.
- Temporal's default workflow history retention applies - a `GET` against a very old, expired `workflowId` will come back as `404`.
