# Business App Validator Tool — frontend image (static SPA + reverse proxy).
#
# Lives in the FRONTEND repo and builds from that repo's root — no dependency on
# the backend. nginx serves the built app and forwards /api and /runs to the
# backend Service in-cluster, so the frontend is the only exposed pod.
#
#   docker build -t <registry>/business-app-validator-frontend:<tag> .

# --- build the SPA ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- serve + proxy ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
