.PHONY: setup dev build preview

setup:                 ## install dependencies
	npm install

dev:                   ## Vite dev server on :5173 (proxies /api,/runs to the backend)
	npm run dev

build:                 ## typecheck + production build → dist/
	npm run build

preview:               ## serve the built dist/ locally
	npm run preview
