# Business App Validator Tool — Frontend

The **React + Vite** portal for the Business App Validator Tool. Business users
onboard applications, record test cases by pointing and clicking, run them, and read
reports — all in the browser. It talks to the backend (a separate repo) over `/api`;
in production **nginx** serves this SPA and reverse-proxies to the backend, so the
frontend is the only exposed component.

## What's here

- **Portal** (`src/App.tsx`): the applications home (per-app run history + actions),
  the record-first case editor, live execution status, the report viewer, and PDF
  download.
- **API client** (`src/api.ts`) + shared types (`src/types.ts`) that mirror the
  backend contracts.
- **`nginx.conf`**: serves `dist/` and proxies `/api` + `/runs` to
  `http://backend:8000` (the backend Service, in-cluster).

## Run it

Full instructions in **[HOW_TO_RUN.md](HOW_TO_RUN.md)**. In short:

```bash
make setup      # npm install
make dev        # UI on http://localhost:5173 (proxies to the backend at :8000)
make build      # typecheck + production build → dist/
```

Point the dev proxy at a backend on another port with `L3_BACKEND=http://127.0.0.1:8010 make dev`.

## Deploy

`k8s/` — a **LoadBalancer** service on `:80` (the only externally exposed entry
point); see [k8s/README.md](k8s/README.md).
