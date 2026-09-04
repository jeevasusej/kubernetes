# TimesheetTracking-02

A simple, beginner-friendly guide to this application and how it runs on Kubernetes.

## What this application does

TimesheetTracking is a small dashboard website. It shows sample timesheet
information for a company:

- Total hours worked
- Billable hours
- Pending approvals
- Active projects
- A table of employee timesheet entries (employee, project, date, hours, approval status)

All the numbers on the page are **fixed sample data** — the page does not
connect to a real database. It exists to show that a website can be packaged,
deployed, and reached through Kubernetes.

The website has two web addresses ("endpoints"):

| Endpoint | What it shows |
|---|---|
| `/web` | The full dashboard page (HTML, with CSS styling and a little JavaScript) |
| `/status` | A tiny health check that replies `{"status":"UP","service":"TimesheetTracking"}` |

`/status` exists so that things like Kubernetes, monitoring tools, or load
balancers can quickly check "is this app still alive?" without loading the
whole page.

## How a request reaches the browser

```
Browser → Ingress → Service → Pod → Nginx → Browser
```

In plain words:

1. **Browser** — you type `http://timesheettracking02.local/web` (or `/status`).
2. **Ingress** — Traefik reads the hostname and path, and works out which Service should handle it.
3. **Service** — `timesheettracking-02-svc` picks one of the 2 healthy Pods to send the request to.
4. **Pod** — the chosen Pod, running the `timesheettracking:v1` image, receives the request.
5. **Nginx** — inside that Pod, the nginx web server answers with the dashboard page or the status JSON.
6. **Browser** — the response travels all the way back and is shown on screen.

(Getting the image itself into that Pod in the first place is a separate,
earlier step: `Website files → Docker image → Kubernetes Pod`. That only
happens once, when you build the image and deploy it — not on every request.)

## What's in this folder, and why

| File | Type | What it's for |
|---|---|---|
| `01-namespace.yaml` | Namespace | Creates `timesheet02-ns`, a separate "room" in the cluster so this app's resources don't mix with anything else. |
| `02-deployment.yaml` | Deployment | Tells Kubernetes to run 2 copies (replicas) of the `timesheettracking:v1` image, and checks their health with probes. |
| `03-service.yaml` | Service | Gives the 2 Pods one stable internal name and address (`timesheettracking-02-svc`) on port 80. |
| `04-ingress.yaml` | Ingress | Exposes the Service to the outside world at `timesheettracking02.local`, routing both `/web` and `/status` to it. |

The actual website and Docker packaging live in a separate folder, because the
same Docker image can be reused by more than one Kubernetes deployment:

| File (in `docker/TimesheetTracking/`) | What it's for |
|---|---|
| `Dockerfile` | The recipe for building the image: start from `nginx:alpine`, copy in the web files and the nginx configuration. |
| `nginx.conf` | Tells the nginx web server how to answer `/web` (serve the dashboard page) and `/status` (reply with the health-check JSON). |
| `web/index.html` | The dashboard page itself. |
| `web/styles.css` | The page's styling (colors, layout, spacing). |
| `web/app.js` | Small bits of interactivity (table sorting, an hours total, a "last updated" time). |

## Building the image (Rancher Desktop)

The image must be built once, using Rancher Desktop's own Docker engine, before
it can be deployed. On this Windows setup, the Docker engine is reached through
Rancher Desktop's WSL distribution, so the build runs like this:

```powershell
wsl -d rancher-desktop -- sh -lc 'cd "/mnt/d/Projects/kubernetes/docker/TimesheetTracking" && docker build -t timesheettracking:v1 .'
```

This creates a local image named `timesheettracking:v1`. It is **not** uploaded
anywhere — it only exists on this machine, inside Rancher Desktop.

## Deploying to Kubernetes (recommended order)

The namespace must exist before anything else, since a Deployment can't be
created inside a namespace that doesn't exist yet. Applying Deployment →
Service → Ingress after that is a recommended, beginner-friendly order (not a
strict requirement — Kubernetes will happily accept a Service or Ingress that
points at a Deployment that hasn't shown up yet, and just wait for it):

```bash
cd exam/01/TimesheetTracking-02

kubectl apply -f 01-namespace.yaml
kubectl apply -f 02-deployment.yaml
kubectl apply -f 03-service.yaml
kubectl apply -f 04-ingress.yaml
```

## Verifying it worked

```bash
# Are both Pods running and ready?
kubectl get pods -n timesheet02-ns

# Is the Deployment showing 2/2 ready?
kubectl get deployment timesheettracking-02 -n timesheet02-ns

# Does the Service exist?
kubectl get svc timesheettracking-02-svc -n timesheet02-ns

# Does the Ingress have an ADDRESS (not blank)?
kubectl get ingress timesheettracking-02-ingress -n timesheet02-ns
```

**Expect:** 2 Pods `1/1 Running`, Deployment `2/2`, the Service listed with
port `80`, and the Ingress showing an address in the `ADDRESS` column.

## Reaching it from a browser

Traefik (the Ingress controller) already has a routing rule for the hostname
`timesheettracking02.local` — that's what `04-ingress.yaml` created. But
Windows itself has no idea what `timesheettracking02.local` means yet, until
you tell it. Add this line to the Windows hosts file so it maps that hostname
to `127.0.0.1`, where Traefik is listening:

**File:** `C:\Windows\System32\drivers\etc\hosts`

**Line to add:**
```
127.0.0.1 timesheettracking02.local
```

After that's saved, these URLs work in a browser:

- `http://timesheettracking02.local/web` — the dashboard
- `http://timesheettracking02.local/status` — the health check

## Why `imagePullPolicy: Never`

`02-deployment.yaml` sets:

```yaml
imagePullPolicy: Never
```

This tells Kubernetes: *don't try to download this image from Docker Hub or
anywhere else on the internet — only use the copy that's already sitting on
this machine.* Since `timesheettracking:v1` was built locally with
`docker build`, it already exists in Rancher Desktop, so this works.

**This also means:** if you copy this project to a different computer, that
computer's Rancher Desktop will **not** have the `timesheettracking:v1` image
yet, because it was never pushed to Docker Hub. On any new computer, you must
run the `docker build` command above first, on that same computer, before
`kubectl apply` will succeed. If you skip this step, the Pods will show a
`ErrImageNeverPull` status instead of `Running`.

## Cleaning up (safe — only removes this app)

Everything this app created lives inside the `timesheet02-ns` namespace, so
deleting that one namespace removes all of it — the Deployment, the Pods, the
Service, and the Ingress:

```bash
kubectl delete namespace timesheet02-ns
```

Then remove the `timesheettracking02.local` line from the hosts file if you
added it and no longer need it.

**This command only touches `timesheet02-ns`.** It does not delete or affect
anything in `timesheet-ns` — the original TimesheetTracking application in
`exam/01/TimesheetTracking` — because that app lives in a completely separate
namespace with its own Deployment, Service, and Ingress. The two applications
were built and tested side by side, and confirmed to keep running
independently of each other.
