# Running the frontend

React + Vite single-page app. In production it's served by **nginx**, which also
reverse-proxies `/api` and `/runs` to the backend — so the frontend is the only
exposed component. Run every command from this repo's root.

## Prerequisites

- Node 20+ and npm

## Local development

```bash
npm install
npm run dev            # Vite dev server → http://localhost:5173
```

Open <http://localhost:5173>. The dev server proxies `/api` and `/runs` to the
backend at `http://127.0.0.1:8000` by default, so you only ever hit `:5173`.

Start the backend separately (see the backend repo). If it runs on a different port:

```bash
L3_BACKEND=http://127.0.0.1:8010 npm run dev
```

## Build

```bash
npm run build          # tsc --noEmit && vite build → dist/
npm run preview        # serve the built dist/ locally to sanity-check
```

## Build & run the container image

The image is nginx serving `dist/` plus the reverse proxy in `nginx.conf`. It
expects the backend reachable in-cluster as `http://backend:8000`.

```bash
docker build -t business-app-validator-frontend:latest .
```

To run it alongside the backend locally, put both on one Docker network and name the
backend container **`backend`** (so nginx can resolve it):

```bash
docker network create bav 2>/dev/null || true
docker run -d --name backend  --network bav business-app-validator-backend:latest
docker run -d --name frontend --network bav -p 8080:80 business-app-validator-frontend:latest
# open http://localhost:8080
```

## Deploy (Kubernetes)

See [`k8s/README.md`](k8s/README.md) — a **LoadBalancer** Service on `:80` (the only
externally exposed entry point). It depends only on a Service named `backend`
existing in the same namespace (deployed from the backend repo).
