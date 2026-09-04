# Running TimesheetTracking

This guide explains how to deploy and test the TimesheetTracking application on the Kubernetes cluster supplied by Rancher Desktop. It uses Windows PowerShell commands.

The completed application has these two endpoints:

| URL | Expected response |
| --- | --- |
| `http://timesheettracking.local/web` | `TimesheetTracking web service is running` |
| `http://timesheettracking.local/status` | `TimesheetTracking service is healthy` |

The application uses five Kubernetes files:

| File | Kubernetes resource | Purpose |
| --- | --- | --- |
| `01-namespace.yaml` | Namespace | Creates an isolated area named `timesheet-ns`. |
| `02-configmap.yaml` | ConfigMap | Stores the two responses and the Nginx configuration. |
| `03-deployment.yaml` | Deployment | Runs two Nginx pods and mounts the ConfigMap data. |
| `04-service.yaml` | Service | Provides one stable internal address for the pods. |
| `05-ingress.yaml` | Ingress | Routes the hostname and URL paths to the Service. |

---

## 1. Prerequisites

Before creating the files, confirm the following:

1. Rancher Desktop is installed and running.
2. Kubernetes is enabled in Rancher Desktop.
3. The Rancher Desktop Kubernetes context is active.
4. `kubectl` is available from PowerShell.
5. Traefik is running. Rancher Desktop normally installs it as the Ingress controller.

Run:

```powershell
kubectl config current-context
kubectl get nodes
kubectl get pods -n kube-system
kubectl get ingressclass
```

Expected results:

- The current context is `rancher-desktop`.
- The node status is `Ready`.
- A Traefik pod is `Running`.
- An IngressClass named `traefik` exists.

If the node is not ready, wait for Rancher Desktop to finish starting and run the commands again.

---

## 2. Create and open the project folder

Run:

```powershell
New-Item -ItemType Directory -Force -Path "D:\Projects\kubernetes\exam\01\TimesheetTracking"
Set-Location "D:\Projects\kubernetes\exam\01\TimesheetTracking"
```

Save all five YAML files below in this folder. Use spaces for YAML indentation. Do not use tabs.

---

## 3. Create the Kubernetes files

### File 1: `01-namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: timesheet-ns
```

This creates the namespace used by every other resource.

### File 2: `02-configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: timesheettracking-content
  namespace: timesheet-ns
data:
  web: |
    TimesheetTracking web service is running
  status: |
    TimesheetTracking service is healthy
  default.conf: |
    server {
        listen 80;
        server_name _;
        default_type text/plain;

        location / {
            root /usr/share/nginx/html;
        }
    }
```

This ConfigMap contains three keys:

- `web` becomes a file named `web`.
- `status` becomes a file named `status`.
- `default.conf` becomes the Nginx server configuration.

The two response files do not have file extensions. The `default_type text/plain;` setting is therefore important. It tells Nginx to return them as plain text. Without this setting, Nginx can return `application/octet-stream`, which causes Chrome to download the files instead of displaying them.

### File 3: `03-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: timesheettracking
  namespace: timesheet-ns
spec:
  replicas: 2
  selector:
    matchLabels:
      app: timesheettracking
  template:
    metadata:
      labels:
        app: timesheettracking
    spec:
      containers:
        - name: nginx
          image: nginx:alpine
          ports:
            - containerPort: 80
          volumeMounts:
            - name: content
              mountPath: /usr/share/nginx/html
            - name: nginx-config
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: default.conf
      volumes:
        - name: content
          configMap:
            name: timesheettracking-content
            items:
              - key: web
                path: web
              - key: status
                path: status
        - name: nginx-config
          configMap:
            name: timesheettracking-content
            items:
              - key: default.conf
                path: default.conf
```

Important: the name `default.conf` must be identical in all three places:

```yaml
# 02-configmap.yaml
default.conf: |

# 03-deployment.yaml, volume item
key: default.conf
path: default.conf

# 03-deployment.yaml, container mount
subPath: default.conf
```

If the Deployment requests `default_type.conf` while the ConfigMap contains `default.conf`, the pods cannot start because the requested ConfigMap key does not exist.

### File 4: `04-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: timesheettracking-svc
  namespace: timesheet-ns
spec:
  type: ClusterIP
  selector:
    app: timesheettracking
  ports:
    - port: 80
      targetPort: 80
```

This Service selects pods that contain the label `app: timesheettracking`. It accepts traffic on Service port 80 and forwards that traffic to container port 80.

### File 5: `05-ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: timesheettracking-ingress
  namespace: timesheet-ns
spec:
  ingressClassName: traefik
  rules:
    - host: timesheettracking.local
      http:
        paths:
          - path: /web
            pathType: Prefix
            backend:
              service:
                name: timesheettracking-svc
                port:
                  number: 80
          - path: /status
            pathType: Prefix
            backend:
              service:
                name: timesheettracking-svc
                port:
                  number: 80
```

Both paths go to the same Service. The original request path is retained, so Nginx receives `/web` or `/status` and reads the file with the same name from `/usr/share/nginx/html`.

---

## 4. Apply the files

Confirm that PowerShell is in the folder containing the five files:

```powershell
Get-Location
Get-ChildItem *.yaml
```

Apply the files in order:

```powershell
kubectl apply -f 01-namespace.yaml
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-deployment.yaml
kubectl apply -f 04-service.yaml
kubectl apply -f 05-ingress.yaml
```

The first application normally reports `created`. Running the same commands again after a change normally reports `configured` or `unchanged`.

`kubectl apply` submits the required state to Kubernetes. It does not prove that the containers started successfully. Complete the verification steps below.

---

## 5. Wait for the Deployment

Run:

```powershell
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

Expected result:

```text
deployment "timesheettracking" successfully rolled out
```

This means the new Deployment revision has two available pods.

If the command remains waiting or reports that it exceeded its progress deadline, inspect the pods as described in the troubleshooting section.

---

## 6. Verify every Kubernetes resource

### Check the Deployment and pods

```powershell
kubectl get deployment -n timesheet-ns
kubectl get pods -n timesheet-ns
```

Expected Deployment values:

```text
READY   UP-TO-DATE   AVAILABLE
2/2     2            2
```

Expected pod values:

```text
READY   STATUS    RESTARTS
1/1     Running   0
1/1     Running   0
```

The generated pod names will be different on every Deployment revision.

### Check the Service

```powershell
kubectl get service timesheettracking-svc -n timesheet-ns
```

Expected values include:

```text
TYPE        PORT(S)
ClusterIP   80/TCP
```

### Check the Service endpoints

```powershell
kubectl get endpointslice -n timesheet-ns -l kubernetes.io/service-name=timesheettracking-svc
```

The EndpointSlice should contain pod IP addresses on port 80. These are the pods selected by the Service.

The older command below can also show the endpoint, but recent Kubernetes versions display a deprecation warning for it:

```powershell
kubectl get endpoints timesheettracking-svc -n timesheet-ns
```

### Check the Ingress

```powershell
kubectl get ingress timesheettracking-ingress -n timesheet-ns
```

Expected values include:

```text
CLASS     HOSTS
traefik   timesheettracking.local
```

The `ADDRESS` value depends on the local Rancher Desktop network configuration.

---

## 7. Add the local hostname to Windows

`timesheettracking.local` is a local training hostname. Public DNS does not know this name. Windows must map it to the local Ingress entry point.

Open Notepad as Administrator:

1. Open the Start menu.
2. Search for Notepad.
3. Right-click Notepad and select **Run as administrator**.
4. Open `C:\Windows\System32\drivers\etc\hosts`.
5. Add this line:

```text
127.0.0.1 timesheettracking.local
```

6. Save the file.

Check the entry from PowerShell:

```powershell
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String timesheettracking.local
```

If Windows has cached an earlier lookup, clear the DNS cache:

```powershell
ipconfig /flushdns
```

Do not add the same hostname more than once with different IP addresses.

---

## 8. Test both endpoints

### Test from PowerShell

Use `curl.exe`, not `curl`:

```powershell
curl.exe -i http://timesheettracking.local/web
curl.exe -i http://timesheettracking.local/status
```

In Windows PowerShell 5.1, `curl` is normally an alias for `Invoke-WebRequest`. That command may display a script-execution warning. `curl.exe` runs the actual curl program and avoids that warning.

Expected `/web` response:

```text
HTTP/1.1 200 OK
Content-Type: text/plain

TimesheetTracking web service is running
```

Expected `/status` response:

```text
HTTP/1.1 200 OK
Content-Type: text/plain

TimesheetTracking service is healthy
```

The exact header order can differ. The important values are HTTP status `200`, content type `text/plain`, and the expected response body.

### Test from Chrome

Open:

```text
http://timesheettracking.local/web
http://timesheettracking.local/status
```

The browser displays one line of plain text for each URL. This exercise does not contain a designed HTML user interface.

If Chrome previously downloaded `/web`, test with a cache-busting query string:

```text
http://timesheettracking.local/web?v=2
```

You can also use an Incognito window or clear the cached data for the hostname.

---

## 9. Apply later changes correctly

When a YAML file changes, apply that file again. For example:

```powershell
kubectl apply -f 03-deployment.yaml
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

The Nginx configuration is mounted with `subPath`. A ConfigMap change to `default.conf` is not automatically copied into an already-running subPath mount. After changing `02-configmap.yaml`, apply it and restart the Deployment:

```powershell
kubectl apply -f 02-configmap.yaml
kubectl rollout restart deployment/timesheettracking -n timesheet-ns
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

Then test both URLs again.

---

## 10. Troubleshooting

Use the checks in this order. Each check identifies a different part of the request path.

### Problem: Deployment shows `1/2` and new pods show `Error`

Run:

```powershell
kubectl get pods -n timesheet-ns
kubectl get replicasets -n timesheet-ns
kubectl describe deployment timesheettracking -n timesheet-ns
kubectl describe pod <failing-pod-name> -n timesheet-ns
```

Replace `<failing-pod-name>` with the actual pod name.

If the pod cannot start, the useful information is usually under **Events** at the bottom of `kubectl describe pod`. Container logs may be unavailable because Nginx never started.

For this exercise, check for an error indicating that a ConfigMap key does not exist. The ConfigMap defines `default.conf`; therefore, the Deployment must also use `default.conf`. A reference to `default_type.conf` is incorrect.

During a failed rolling update, Kubernetes can keep a pod from the previous ReplicaSet running. That is why the output can contain one running old pod and two failing new pods. Correct the Deployment and apply it again.

### Problem: Chrome downloads `web` instead of displaying it

Inspect the response header:

```powershell
curl.exe -I http://timesheettracking.local/web
```

Correct result:

```text
Content-Type: text/plain
```

Incorrect result:

```text
Content-Type: application/octet-stream
```

`application/octet-stream` tells a browser that the response is general binary data, so Chrome downloads it. The custom Nginx configuration fixes this by setting `default_type text/plain;`.

Check the configuration loaded inside a running pod:

```powershell
kubectl exec deployment/timesheettracking -n timesheet-ns -- cat /etc/nginx/conf.d/default.conf
```

It must contain:

```nginx
default_type text/plain;
```

If it does not, apply the ConfigMap and Deployment, then restart:

```powershell
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-deployment.yaml
kubectl rollout restart deployment/timesheettracking -n timesheet-ns
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

After the server is correct, use `/web?v=2` once to avoid an old Chrome cache entry.

### Problem: PowerShell shows a script-execution warning

PowerShell is running the `Invoke-WebRequest` alias instead of the curl executable. Use:

```powershell
curl.exe http://timesheettracking.local/web
```

Alternatively, use:

```powershell
Invoke-WebRequest http://timesheettracking.local/web -UseBasicParsing
```

### Problem: `The underlying connection was closed`

First check whether the pods are restarting or a rollout is incomplete:

```powershell
kubectl get pods -n timesheet-ns
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

Then inspect current and previous container logs:

```powershell
kubectl logs <pod-name> -n timesheet-ns
kubectl logs <pod-name> -n timesheet-ns --previous
```

`--previous` displays logs from the container instance that ran before the latest restart.

### Problem: Service has no endpoints

Run:

```powershell
kubectl get pods -n timesheet-ns --show-labels
kubectl describe service timesheettracking-svc -n timesheet-ns
```

Confirm all of these values match exactly:

```text
Pod label:        app=timesheettracking
Service selector: app=timesheettracking
Container port:   80
Service target:   80
```

The Service cannot send traffic to a pod that does not match its selector or is not ready.

### Problem: The Service works but the hostname does not

Test the Service without the Ingress:

```powershell
kubectl port-forward service/timesheettracking-svc 8080:80 -n timesheet-ns
```

Keep that PowerShell window open. In another PowerShell window, run:

```powershell
curl.exe -i http://127.0.0.1:8080/web
curl.exe -i http://127.0.0.1:8080/status
```

If these commands work, the pods and Service are working. Check the Ingress and Windows hosts-file entry next:

```powershell
kubectl describe ingress timesheettracking-ingress -n timesheet-ns
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String timesheettracking.local
```

Press `Ctrl+C` in the port-forward window when the test is complete.

### Problem: An IIS page appears instead of TimesheetTracking

Another Windows process may own port 80. Check it:

```powershell
Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

If IIS is using the port, open PowerShell as Administrator and stop it temporarily:

```powershell
Stop-Service W3SVC
```

Restart IIS later if it is needed by another local project:

```powershell
Start-Service W3SVC
```

Do not stop IIS when another required application is using it.

### Problem: An update is broken and must be reverted

View the Deployment revisions:

```powershell
kubectl rollout history deployment/timesheettracking -n timesheet-ns
```

Undo the latest Deployment change:

```powershell
kubectl rollout undo deployment/timesheettracking -n timesheet-ns
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

This restores the previous Deployment pod template. It does not restore an earlier ConfigMap value.

---

## 11. Cleanup

Delete the namespace only when the whole exercise is no longer required:

```powershell
kubectl delete namespace timesheet-ns
```

This also deletes the ConfigMap, Deployment, ReplicaSets, pods, Service, EndpointSlices, and Ingress inside the namespace.

The Windows hosts-file entry is outside Kubernetes, so remove this line separately:

```text
127.0.0.1 timesheettracking.local
```

---

## Command summary

```powershell
# Confirm the cluster
kubectl config current-context
kubectl get nodes
kubectl get ingressclass

# Apply the resources
kubectl apply -f 01-namespace.yaml
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-deployment.yaml
kubectl apply -f 04-service.yaml
kubectl apply -f 05-ingress.yaml

# Verify the resources
kubectl rollout status deployment/timesheettracking -n timesheet-ns
kubectl get deployment -n timesheet-ns
kubectl get pods -n timesheet-ns
kubectl get service -n timesheet-ns
kubectl get endpointslice -n timesheet-ns
kubectl get ingress -n timesheet-ns

# Test the application
curl.exe -i http://timesheettracking.local/web
curl.exe -i http://timesheettracking.local/status
```

For explanations of the Kubernetes resources, names, connections, and request flow, see `CONCEPTS-GUIDE.md`.
