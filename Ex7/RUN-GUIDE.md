# Running Ex7 — ConfigMap + Secret with Nginx

This guide explains how to deploy Ex7 on the Kubernetes cluster supplied by Rancher Desktop and verify that a Pod correctly picks up values from a ConfigMap and a Secret. It uses Windows PowerShell commands.

This exercise is for learning `ConfigMap` and `Secret`, not for building a real application. An nginx Pod is deployed with environment variables sourced from a ConfigMap via `configMapKeyRef` and from a Secret via `secretKeyRef`, so the two can be compared side by side.

The exercise uses five Kubernetes files, applied in this order:

| File | Kubernetes resource | Purpose |
| --- | --- | --- |
| `01-namespace.yaml` | Namespace | Creates an isolated area named `ex7`. |
| `02-configmap.yaml` | ConfigMap | Stores `APP_COLOR`, `APP_USERNAME`, `APP_PASSWORD`. |
| `03-secret.yaml` | Secret | Stores `APP_USERNAME`/`APP_PASSWORD` (via `data`) and `APP_USERNAME1`/`APP_PASSWORD1` (via `stringData`). |
| `04-deployment.yaml` | Deployment | Runs one nginx pod and injects the ConfigMap and Secret values as env vars. |
| `05-service.yaml` | Service | Exposes the pod on NodePort `30070`. |

---

## 1. Prerequisites

```powershell
kubectl config current-context
kubectl get nodes
```

Expected: current context is `rancher-desktop` and the node status is `Ready`.

---

## 2. Open the project folder

```powershell
Set-Location "D:\Projects\kubernetes\Ex7"
Get-ChildItem *.yaml
```

You should see the five files listed in the table above.

---

## 3. Apply the files in order

```powershell
kubectl apply -f 01-namespace.yaml
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-secret.yaml
kubectl apply -f 04-deployment.yaml
kubectl apply -f 05-service.yaml
```

The numeric prefixes exist so the files sort into the correct dependency order in the folder listing — the namespace must exist before the ConfigMap/Secret, and the ConfigMap/Secret must exist before the Deployment references them. `kubectl apply` does not require this order (Kubernetes will accept a Deployment before its ConfigMap/Secret exists and simply fail the pod until they appear), but applying in order avoids confusing intermediate errors.

---

## 4. Verify the rollout

```powershell
kubectl rollout status deployment/nginx-deployment -n ex7
kubectl get pods -n ex7
kubectl get configmap app-config -n ex7 -o yaml
kubectl get secret app-secret -n ex7 -o yaml
```

Expected pod status: `1/1 Running`. `kubectl get secret ... -o yaml` shows every value — including the `stringData` ones — already base64-encoded under `data`; Kubernetes merges `stringData` into `data` on write.

---

## 5. Confirm the ConfigMap and Secret values reached the container

```powershell
kubectl exec -n ex7 deploy/nginx-deployment -- env | Select-String "APP_"
```

Expected output:

```text
APP_COLOR_ENV=Green
APP_USERNAME_ENV=YWRtaW4=
APP_PASSWORD_ENV=cGFzc3dvcmQ=
APP_USERNAME_SECRET_ENV=admin
APP_PASSWORD_SECRET_ENV=password
```

`APP_USERNAME_ENV` and `APP_PASSWORD_ENV` (sourced from the ConfigMap) print the raw base64-looking text, not the decoded `admin` / `password`. This is expected — a ConfigMap's `data` values are always stored and delivered as plain strings; Kubernetes never base64-decodes them.

`APP_USERNAME_SECRET_ENV` and `APP_PASSWORD_SECRET_ENV` (sourced from the Secret via `secretKeyRef`), by contrast, print the decoded `admin` / `password` — a Secret's `data` field is base64-decoded automatically when consumed by a Pod.

---

## 6. Test the Service (optional)

```powershell
kubectl get service nginx-service -n ex7
curl.exe -i http://localhost:30070
```

Expected: `HTTP/1.1 200 OK` and the default nginx welcome page (the container serves nginx's default page; this exercise does not customize the served content).

---

## 7. Try the other consumption styles

`04-deployment.yaml` contains commented-out alternatives worth uncommenting one at a time to see the difference:

- **`envFrom` + `configMapRef`/`secretRef`** — imports every key in the ConfigMap/Secret as an env var in one line, instead of listing each key with `configMapKeyRef`/`secretKeyRef`.
- **Volume mount** — mounts the ConfigMap as files under `/etc/config` and the Secret as files under `/etc/secret`, one file per key, file content = the (decoded, for the Secret) value. After enabling it and re-applying:

  ```powershell
  kubectl apply -f 04-deployment.yaml
  kubectl rollout status deployment/nginx-deployment -n ex7
  kubectl exec -n ex7 deploy/nginx-deployment -- ls /etc/config
  kubectl exec -n ex7 deploy/nginx-deployment -- cat /etc/config/APP_COLOR
  kubectl exec -n ex7 deploy/nginx-deployment -- ls /etc/secret
  kubectl exec -n ex7 deploy/nginx-deployment -- cat /etc/secret/APP_PASSWORD
  ```

---

## 8. Apply a ConfigMap or Secret change

Env-var values from a ConfigMap or Secret are only read when the container starts — editing either does not update a running container's environment. After changing `02-configmap.yaml` or `03-secret.yaml`:

```powershell
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-secret.yaml
kubectl rollout restart deployment/nginx-deployment -n ex7
kubectl rollout status deployment/nginx-deployment -n ex7
```

(A ConfigMap or Secret mounted as a *volume*, by contrast, does eventually sync into the running container without a restart — the env-var path is the one that needs the restart.)

---

## 9. Troubleshooting

### Pod stuck in `CreateContainerConfigError` / `ContainerCreating`

```powershell
kubectl describe pod -n ex7 -l app=nginx
```

Check the **Events** section for `couldn't find key ... in ConfigMap` (or `in Secret`) — this means a `key:` in `04-deployment.yaml` does not match a key actually present in `02-configmap.yaml` or `03-secret.yaml`. The key names are case-sensitive and must match exactly.

### `curl.exe` to `localhost:30070` fails

Confirm the Service and pod are up:

```powershell
kubectl get pods -n ex7 -o wide
kubectl get service nginx-service -n ex7
kubectl get endpointslice -n ex7 -l kubernetes.io/service-name=nginx-service
```

If the EndpointSlice has no addresses, the Service selector (`app: nginx`) does not match the pod's labels.

---

## 10. Cleanup

```powershell
kubectl delete namespace ex7
```

This deletes the ConfigMap, Secret, Deployment, pod, and Service together.

---

## Command summary

```powershell
# Apply
kubectl apply -f 01-namespace.yaml
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-secret.yaml
kubectl apply -f 04-deployment.yaml
kubectl apply -f 05-service.yaml

# Verify
kubectl rollout status deployment/nginx-deployment -n ex7
kubectl get pods -n ex7
kubectl exec -n ex7 deploy/nginx-deployment -- env | Select-String "APP_"

# Test
curl.exe -i http://localhost:30070

# Cleanup
kubectl delete namespace ex7
```
