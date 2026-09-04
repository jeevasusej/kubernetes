# Running InventoryTracking

A beginner, start-to-finish procedure for standing up the InventoryTracking exercise on Rancher Desktop.

| | |
|---|---|
| **Namespace** | `inventory-ns` |
| **Hostname** | `inventorytracking.local` |
| **Ingress class** | `traefik` |
| **Folder** | `exam\02\InventoryTracking` |

---

## Before you start

- [ ] **Rancher Desktop is installed and running** — its whale icon should be visible and settled, not spinning, in the Windows system tray.
- [ ] **Kubernetes is turned on inside Rancher Desktop** — Preferences → Kubernetes → Enable Kubernetes.
- [ ] **You have a Command Prompt window open** — regular Command Prompt is enough; nothing here needs Administrator rights except the hosts-file step.
- [ ] **kubectl responds** — Rancher Desktop installs it for you, you don't need a separate download.

---

## The four files

Everything for this exercise lives in `exam\02\InventoryTracking`, already created for you:

| File | What it does |
|---|---|
| `01-namespace.yaml` | Creates the `inventory-ns` namespace — the isolated area the rest of the objects live in. |
| `02-deployment.yaml` | Runs 2 replicas of `hashicorp/http-echo`, each replying with the text `InventoryTracking`. |
| `03-service.yaml` | A stable internal address (`inventorytracking-svc`) that load-balances across the 2 pods. |
| `04-ingress.yaml` | Routes external requests for `inventorytracking.local/web` and `/status` to the Service. |

`http-echo` is a tiny test image — it doesn't do real inventory logic, it just answers every request with the `-text` value it was started with. That's exactly what today's exercise needs: something that exists, runs reliably, and is reachable.

---

## Steps, in order

### 1. Confirm the cluster is awake

```bat
:: which cluster kubectl is pointed at
kubectl config current-context

:: is the one node ready
kubectl get nodes

:: is the Traefik ingress controller running
kubectl get pods -n kube-system | findstr traefik

:: is an IngressClass named traefik registered
kubectl get ingressclass
```

**Expect:** context `rancher-desktop`, one node `Ready`, a `traefik-…` pod showing `1/1 Running`, and an ingressclass named `traefik`.

### 2. Move into the exercise folder

```bat
cd /d "D:\Projects\kubernetes\exam\02\InventoryTracking"
```

### 3. Apply the four files, in order

The namespace has to exist before anything can be placed inside it, so the numbered order matters.

```bat
kubectl apply -f 01-namespace.yaml -f 02-deployment.yaml -f 03-service.yaml -f 04-ingress.yaml
```

Or just run the included script, which does the same thing:

```bat
apply.bat
```

**Expect:** four lines, each ending in `created` — `namespace/inventory-ns created`, `deployment.apps/inventorytracking created`, and so on.

### 4. Check that everything actually came up

```bat
:: pods, deployment, service all in one view
kubectl get pods -n inventory-ns

:: does the Service have real pods behind it
kubectl get endpoints -n inventory-ns

:: does the Ingress have an address assigned
kubectl get ingress -n inventory-ns
```

**Expect:** `kubectl get pods -n inventory-ns` shows 2 pods, each `1/1 Running`; the endpoints list is **not empty** (two IPs, not blank); the Ingress `ADDRESS` column is **not blank**.

### 5. Point your computer at the hostname

Kubernetes now knows about `inventorytracking.local` — but Windows doesn't, yet. This step needs an **elevated (Administrator)** Command Prompt.

```bat
:: run from an Administrator Command Prompt
echo 127.0.0.1 inventorytracking.local >> C:\Windows\System32\drivers\etc\hosts
```

Prefer a text editor instead? Right-click Notepad → "Run as administrator", open `C:\Windows\System32\drivers\etc\hosts`, and add the line `127.0.0.1    inventorytracking.local` at the bottom.

### 6. Test it

```bat
curl http://inventorytracking.local/web
curl http://inventorytracking.local/status
```

**Expect:** both commands print `InventoryTracking`.

> **Getting a Windows / IIS 404 page instead?** Something else on your machine already owns port 80. Confirm with `Get-NetTCPConnection -LocalPort 80` in PowerShell, then stop IIS with `net stop W3SVC` from an Administrator prompt (restart later with `net start W3SVC` if needed).

---

## Acceptance criteria checklist

- [ ] `kubectl get pods -n inventory-ns` shows 2 Pods, each `1/1 Running`
- [ ] `curl http://inventorytracking.local/web` returns `InventoryTracking`
- [ ] `curl http://inventorytracking.local/status` returns `InventoryTracking`
- [ ] `kubectl get ingress -n inventory-ns` shows a non-blank `ADDRESS`

---

## Cleanup

Deleting the namespace removes everything inside it in one shot — the Deployment, Pods, Service, and Ingress.

```bat
kubectl delete namespace inventory-ns
```

Then remove the `inventorytracking.local` line from the hosts file the same way you added it (Administrator Notepad).
