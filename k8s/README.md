# Frontend deployment (frontend repo)

The frontend serves the SPA and reverse-proxies `/api` and `/runs` to the backend
Service. It is the **only exposed** component.

```bash
REG=your-registry.example.com

# from the frontend repo root
docker build -t $REG/business-app-validator-frontend:latest .
docker push  $REG/business-app-validator-frontend:latest

cd k8s
kustomize edit set image business-app-validator-frontend=$REG/business-app-validator-frontend:latest
kubectl apply -k .
kubectl -n bav rollout status deploy/frontend

kubectl -n bav get svc frontend        # EXTERNAL-IP → open http://<ip>/
# or, without a cloud LoadBalancer:
kubectl -n bav port-forward svc/frontend 8080:80    # http://localhost:8080
```

- Deploys a Deployment + a **LoadBalancer** Service on `:80` in namespace `bav`.
- The nginx config proxies to `http://backend:8000` — it depends only on a Service
  named **`backend`** existing in the same namespace (deployed from the backend repo).
- Deployable independently of the backend; if the backend isn't up yet, requests to
  `/api` fail until it is, but the SPA still serves.
