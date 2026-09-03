# Running TimesheetTracking

*Field Guide · Part 1 of 2*

A start-to-finish runbook for standing up the TimesheetTracking exercise on Rancher Desktop, with every command, every expected result, and every real problem hit along the way.

| | |
|---|---|
| **Namespace** | `timesheet-ns` |
| **Hostname** | `timesheettracking.local` |
| **Ingress class** | `traefik` |
| **Folder** | `exam\01\TimesheetTracking` |

---

## Before you start

- [ ] **Rancher Desktop is installed and running** — its whale icon should be visible and settled, not spinning, in the Windows system tray.
- [ ] **Kubernetes is turned on inside Rancher Desktop** — Preferences → Kubernetes → Enable Kubernetes.
- [ ] **You have a Command Prompt window open** — regular Command Prompt is enough; nothing here needs Administrator rights except the two steps marked below.
- [ ] **kubectl responds** — Rancher Desktop installs it for you, you don't need a separate download.

---

## Seven steps, in order

Each step depends on the one before it — the namespace has to exist before anything can live inside it, and the cluster has to be awake before it will accept any of this.

### 1. Create your workspace folder

Every file for this exercise — the five YAML files, nothing else — lives in one folder. Creating it first keeps the whole exercise self-contained and easy to find again later.

```bat
:: creates the folder, then moves into it
mkdir "D:\Projects\kubernates\exam\01\TimesheetTracking"
cd /d "D:\Projects\kubernates\exam\01\TimesheetTracking"
```

The `/d` switch just makes sure Command Prompt also switches drive letter, in case you started on `C:`.

### 2. Confirm the cluster is actually awake

Rancher Desktop's Kubernetes takes a little while to boot after a fresh start — running your files against a cluster that isn't ready yet is the single most common source of confusing errors, so we check first.

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

> **If the node isn't ready yet** — Rancher Desktop can take several minutes to finish starting Kubernetes, especially the first time after a reboot. Wait and re-run `kubectl get nodes` every 30 seconds or so rather than assuming something is broken.

### 3. Write the five YAML files

Namespace, ConfigMap, Deployment, Service, then Ingress — save each one in the folder from Step 1. What each field means is covered file-by-file in **Part 2: Understanding TimesheetTracking**; this guide only concerns itself with running them.

Filenames used throughout this guide: `01-namespace.yaml`, `02-configmap.yaml`, `03-deployment.yaml`, `04-service.yaml`, `05-ingress.yaml`.

### 4. Apply the files, in order

"Applying" a file tells Kubernetes: *make the real cluster match this description.* The namespace has to be created before anything can be placed inside it, so the numbered order matters — one command with several `-f` flags works as long as the namespace file comes first in the list.

```bat
kubectl apply -f 01-namespace.yaml -f 02-configmap.yaml -f 03-deployment.yaml -f 04-service.yaml -f 05-ingress.yaml
```

**Expect:** five lines, each ending in `created` — `namespace/timesheet-ns created`, `configmap/…created`, and so on.

### 5. Check that everything actually came up

Applying a file only submits a request — it doesn't guarantee the result worked. These checks confirm the whole chain is connected end to end.

```bat
:: pod, deployment, service all in one view
kubectl get all -n timesheet-ns

:: does the Service have a real pod behind it
kubectl get endpoints -n timesheet-ns

:: does the Ingress have an address assigned
kubectl get ingress -n timesheet-ns
```

**Expect:** the pod shows `1/1 Running`, the endpoints list is **not empty** (an IP address, not blank), and the Ingress `ADDRESS` column is **not blank** — a blank address means Traefik hasn't picked up the rule yet.

### 6. Point your computer at the hostname

Kubernetes now knows about `timesheettracking.local` — but Windows doesn't, yet. The hosts file is the short list Windows checks before asking the internet how to find a name, and this step adds one line to it. It's the one step here that needs an **elevated (Administrator)** Command Prompt.

```bat
:: run from an Administrator Command Prompt
echo 127.0.0.1 timesheettracking.local >> C:\Windows\System32\drivers\etc\hosts
```

Prefer a text editor instead? Right-click Notepad → "Run as administrator", open `C:\Windows\System32\drivers\etc\hosts`, and add the line `127.0.0.1    timesheettracking.local` at the bottom.

### 7. Test it

```bat
curl http://timesheettracking.local/web
curl http://timesheettracking.local/status
```

**Expect:** `TimesheetTracking web service is running` and `TimesheetTracking service is healthy`.

> **Getting a Windows / IIS 404 page instead?** See Incident 01 below — something else on your machine already owns port 80.

---

## Incident log

Three problems worth knowing about — real issues encountered while building this exact exercise on Windows with Rancher Desktop, not hypothetical edge cases.

| Symptom | Cause | Fix |
|---|---|---|
| **01 —** curl returns an IIS "HTTP Error 404" page, not your text, even though the Ingress ADDRESS looked fine. | Windows' built-in web server (IIS, service name `W3SVC`) was already listening on port 80, so Rancher Desktop's own port-forwarding couldn't bind to it — every request to port 80 was quietly being answered by IIS instead of Traefik. | Confirm with `Get-NetTCPConnection -LocalPort 80` in PowerShell, then stop IIS with `net stop W3SVC` from an Administrator prompt. Restart it later with `net start W3SVC` if you need it for something else. |
| **02 —** kubectl says "actively refused" right after starting Rancher Desktop. | The Kubernetes control plane genuinely hadn't finished starting yet — this is normal, especially on the first start after a reboot, and can take several minutes. | Wait, then re-run `kubectl get nodes`. No fix needed beyond patience. |
| **03 —** hosts file "Access is denied" when adding the line. | The system hosts file is protected; a normal Command Prompt or PowerShell window doesn't have permission to write to it. | Reopen Command Prompt (or Notepad) with "Run as administrator", then retry the same command. |

---

## Cleanup

Deleting the namespace removes everything inside it in one shot — the ConfigMap, Deployment, Pod, and Service. The Ingress is also namespaced, so it goes with it; only the hosts-file line is outside the cluster and needs removing separately.

```bat
kubectl delete namespace timesheet-ns
```

Then remove the `timesheettracking.local` line from the hosts file the same way you added it (Administrator Notepad), and run `net start W3SVC` if you stopped IIS in Incident 01 and want it back.

---

## Copy-paste reference

```bat
:: 1 — folder
mkdir "D:\Projects\kubernates\exam\01\TimesheetTracking"
cd /d "D:\Projects\kubernates\exam\01\TimesheetTracking"

:: 2 — cluster check
kubectl config current-context
kubectl get nodes
kubectl get pods -n kube-system | findstr traefik
kubectl get ingressclass

:: 4 — apply
kubectl apply -f 01-namespace.yaml -f 02-configmap.yaml -f 03-deployment.yaml -f 04-service.yaml -f 05-ingress.yaml

:: 5 — verify
kubectl get all -n timesheet-ns
kubectl get endpoints -n timesheet-ns
kubectl get ingress -n timesheet-ns

:: 6 — hosts file (Administrator prompt)
echo 127.0.0.1 timesheettracking.local >> C:\Windows\System32\drivers\etc\hosts

:: 7 — test
curl http://timesheettracking.local/web
curl http://timesheettracking.local/status

:: cleanup
kubectl delete namespace timesheet-ns
```

---

*Part 1 of 2 — TimesheetTracking Field Guide. See **Part 2: Understanding TimesheetTracking** (`CONCEPTS-GUIDE.md`) for what each file and each Kubernetes idea actually means.*

**Live version:** https://claude.ai/code/artifact/28da4d10-1fc3-46ac-9617-b765ba86c6fd
