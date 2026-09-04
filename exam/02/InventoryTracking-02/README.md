# InventoryTracking-02 — Snipe-IT on Kubernetes

A second, independent inventory application running side-by-side with the original
`InventoryTracking` (http-echo) exercise. This one runs a real app — [Snipe-IT](https://snipeit.readme.io/),
an open-source asset/license tracker — backed by MariaDB, entirely inside its own
namespace so it cannot interfere with the original.

| | Original (`../InventoryTracking`) | This app |
|---|---|---|
| Namespace | `inventory-ns` | `inventory02-ns` |
| App Deployment | `inventorytracking` | `inventorytracking-02` |
| App Service | `inventorytracking-svc` | `inventorytracking-02-svc` |
| Ingress | `inventorytracking-ingress` | `inventorytracking-02-ingress` |
| Hostname | `inventorytracking.local` | `inventorytracking02.local` |
| Database | none | `inventorytracking-02-db` (MariaDB StatefulSet) |

No object, label, selector, Secret, ConfigMap, Service, PVC, or hostname here reuses a
name from the original — the two stacks can be applied, run, and deleted independently.

---

## What's in this folder

| File | Kind | Purpose |
|---|---|---|
| `00-namespace.yaml` | Namespace | `inventory02-ns` — everything below lives in it. |
| `01-secret.yaml` | Secret | `inventorytracking-02-secret` — `APP_KEY`, DB passwords. |
| `02-configmap.yaml` | ConfigMap | `inventorytracking-02-config` — non-secret app/DB settings. |
| `03-db-pvc.yaml` | PersistentVolumeClaim | `inventorytracking-02-db-pvc` — MariaDB's data directory. |
| `04-db-service.yaml` | Service (headless) | `inventorytracking-02-db-svc` — stable DNS name for the DB. |
| `05-db-statefulset.yaml` | StatefulSet | `inventorytracking-02-db` — MariaDB `10.11`. |
| `06-app-deployment.yaml` | Deployment | `inventorytracking-02` — 2 replicas of `snipe/snipe-it:v6.0.14`, plus a tiny `http-echo` sidecar for `/status`. |
| `07-app-service.yaml` | Service | `inventorytracking-02-svc` — exposes both the app (port 80) and the status sidecar (port 8080). |
| `08-middleware.yaml` | Traefik `Middleware` | Strips the `/web` prefix before it reaches Snipe-IT (see note below). |
| `09-ingress.yaml` | Ingress | `inventorytracking-02-ingress` — routes `/web` and `/status`. |

**Why a sidecar for `/status`?** Snipe-IT's own pages redirect (HTTP 302) to
`/setup` or `/login` — useful, but not the plain "200 OK" the acceptance
criteria ask for, and it would depend on the database being reachable. The
second container in `06-app-deployment.yaml` is the same `hashicorp/http-echo`
image used by the original exercise, always answers `200 OK` on port 8080, and
is wired into `inventorytracking-02-svc` as the `status` port — so `/status`
still goes through the app's own Service, independent of Snipe-IT/DB health.

**Why a Middleware for `/web`?** Snipe-IT is a normal Laravel app — it doesn't
know it's being served under a subpath. `APP_URL` (in the ConfigMap) is set to
`http://inventorytracking02.local/web`, so Snipe-IT *generates* every link,
redirect, and asset URL with the `/web` prefix. The Traefik `Middleware`
strips that same prefix back off before the request reaches the container, so
Snipe-IT sees ordinary paths like `/login` or `/css/app.css`. Browser → `/web/css/app.css` → Traefik strips `/web` → container serves `/css/app.css`.

---

## Deployment order

Order matters: the namespace must exist first, the Secret/ConfigMap must exist
before anything reads them, and the database should be up (or at least
scheduled) before the app tries to migrate into it.

```
00-namespace.yaml
01-secret.yaml
02-configmap.yaml
03-db-pvc.yaml
04-db-service.yaml
05-db-statefulset.yaml
06-app-deployment.yaml
07-app-service.yaml
08-middleware.yaml
09-ingress.yaml
```

## Setup commands

### 1. Confirm the cluster is up

```bat
kubectl config current-context
kubectl get nodes
kubectl get pods -n kube-system | findstr traefik
kubectl get ingressclass
```

### 2. Apply everything, in order

Either run the included script:

```bat
cd /d "D:\Projects\kubernetes\exam\02\InventoryTracking-02"
apply.bat
```

...or apply file-by-file (also demonstrates why the order matters):

```bat
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secret.yaml -f 02-configmap.yaml
kubectl apply -f 03-db-pvc.yaml -f 04-db-service.yaml -f 05-db-statefulset.yaml

:: wait for MariaDB to actually be ready before starting Snipe-IT
kubectl wait --for=condition=ready pod -l app=inventorytracking-02-db -n inventory02-ns --timeout=180s

kubectl apply -f 06-app-deployment.yaml -f 07-app-service.yaml
kubectl apply -f 08-middleware.yaml -f 09-ingress.yaml
```

**First boot is slow.** Snipe-IT runs its database migrations the first time
each Pod starts, which can take 1-3 minutes. The readiness probe has a 60s
initial delay and 10 retries for exactly this reason — don't panic if pods sit
in `0/1 Running` (not yet `Ready`) for a minute or two.

### 3. Add the hostname to your hosts file (Administrator Command Prompt)

```bat
echo 127.0.0.1 inventorytracking02.local >> C:\Windows\System32\drivers\etc\hosts
```

(This is in addition to, not instead of, the `inventorytracking.local` line
from the original exercise — both can be in the hosts file at once.)

---

## Verification commands & expected results

| # | Command | Expected result |
|---|---|---|
| 1 | `kubectl get pods -n inventory02-ns -l app=inventorytracking-02` | 2 pods, each `2/2 Running` (app container + status sidecar) |
| 2 | `kubectl get pods -n inventory02-ns -l app=inventorytracking-02-db` | 1 pod, `1/1 Running` |
| 3 | `curl -I http://inventorytracking02.local/web` | `HTTP/1.1 200` (or a `302` to `/web/setup` or `/web/login` — both are healthy) |
| 4 | Open `http://inventorytracking02.local/web` in a browser | Full Snipe-IT setup or login page, with CSS/JS/images loading and any redirects landing on a working page |
| 5 | `curl -i http://inventorytracking02.local/status` | `HTTP/1.1 200 OK` with body `OK` |
| 6 | `kubectl get ingress -n inventory02-ns` | `ADDRESS` column is **not blank** |
| 7 | `kubectl logs -n inventory02-ns -l app=inventorytracking-02 -c snipe-it --tail=100` | No `SQLSTATE`, `Connection refused`, or `could not find driver` errors |
| 8 | `kubectl logs -n inventory02-ns -l app=inventorytracking-02-db --tail=100` | No `[ERROR]` lines after startup; ends with `ready for connections` |

Full one-shot check:

```bat
kubectl get pods -n inventory02-ns
kubectl get svc -n inventory02-ns
kubectl get ingress -n inventory02-ns
curl -I http://inventorytracking02.local/web
curl -i http://inventorytracking02.local/status
```

### Confirming the original app is untouched

Run these before *and* after applying this folder — the output should be
identical both times:

```bat
kubectl get all -n inventory-ns
kubectl get ingress -n inventory-ns
curl http://inventorytracking.local/web
curl http://inventorytracking.local/status
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `no matches for kind "Middleware"` on `kubectl apply -f 08-middleware.yaml` | Your cluster's Traefik CRDs use the older `traefik.containo.us/v1alpha1` group instead of `traefik.io/v1alpha1`. | `kubectl get crd \| findstr traefik` to see which group is installed, then edit `apiVersion` in `08-middleware.yaml` to match, and re-apply. |
| `/web` loads the login page but CSS/JS are missing or links 404 | The Middleware isn't attached, or `APP_URL` doesn't match the hostname. | Check the Ingress annotation matches the Middleware's `<namespace>-<name>@kubernetescrd` name exactly; check `kubectl get configmap inventorytracking-02-config -n inventory02-ns -o yaml` for `APP_URL`. |
| App pods stuck `0/2 Running`, never `Ready` | Still running first-boot migrations, or can't reach the database. | `kubectl logs -n inventory02-ns <pod> -c snipe-it` — give it a few minutes; if it shows connection errors, check the DB pod is `Ready` first. |
| DB pod `CrashLoopBackOff` | PVC didn't bind, or root password mismatch after a previous run with different data. | `kubectl get pvc -n inventory02-ns` (should be `Bound`); if you changed passwords in `01-secret.yaml` after the volume already had data, delete the PVC to reset (see Cleanup) and re-apply. |
| `curl` to either hostname fails/times out | hosts file entry missing, or something else already owns port 80 (commonly IIS on Windows). | Confirm the hosts file line; `Get-NetTCPConnection -LocalPort 80` in PowerShell, `net stop W3SVC` if IIS is squatting on the port. |
| Ingress `ADDRESS` column stays blank | Traefik hasn't reconciled the rule yet, or `ingressClassName: traefik` doesn't match an installed IngressClass. | `kubectl get ingressclass`; wait ~30s and re-check. |

---

## Cleanup

Everything created by this folder lives inside `inventory02-ns`, so deleting
the namespace removes it all in one shot — the Secret, ConfigMap, PVC,
StatefulSet, Deployment, both Services, the Middleware, and the Ingress. **It
does not touch `inventory-ns` or anything from the original exercise.**

```bat
kubectl delete namespace inventory02-ns
```

Then remove the `inventorytracking02.local` line from the hosts file
(Administrator Notepad) if you no longer need it.

To tear down *only* the app (keep the database and its data):

```bat
kubectl delete -f 09-ingress.yaml -f 08-middleware.yaml -f 07-app-service.yaml -f 06-app-deployment.yaml -n inventory02-ns
```
