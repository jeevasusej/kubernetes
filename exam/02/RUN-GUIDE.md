# TimesheetTracking — Day 2

This exercise uses:

- Service: `timesheettracking`
- Namespace: `timesheet-ns`
- Hostname: `timesheettracking.local`
- Homepage: `Timesheet Tracking Service - Now Configurable!`

Run every command from the `exam/02` folder.

## 1. Create the Namespace

```powershell
kubectl apply -f namespace.yaml
```

## 2. Create the ConfigMap

```powershell
kubectl apply -f configmap.yaml
```

## 3. Create the Secret

The exercise requires the Secret to be created using a command, not a YAML file.

```powershell
kubectl create secret generic timesheettracking-secret --from-literal=api-token=demo-token-12345 -n timesheet-ns
```

## 4. Create the Deployment, Service, Middleware and Ingress

```powershell
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f middleware.yaml
kubectl apply -f ingress.yaml
```

The Middleware removes `/web` before the request reaches nginx. Therefore nginx receives `/` and serves `index.html`.

## 5. Check the Resources

```powershell
kubectl get all -n timesheet-ns
kubectl get ingress -n timesheet-ns
kubectl get pods -n timesheet-ns
```

Both Pods should show `1/1` under `READY`.

## 6. Test the URLs

Make sure the Windows hosts file contains:

```text
127.0.0.1 timesheettracking.local
```

Test the homepage:

```powershell
curl.exe http://timesheettracking.local/web
```

Expected text:

```text
Timesheet Tracking Service - Now Configurable!
```

The old `/status` URL is also retained:

```powershell
curl.exe http://timesheettracking.local/status
```

Expected text:

```text
Healthy
```

## 7. Check the Secret Without Displaying Its Value

```powershell
kubectl exec -n timesheet-ns deploy/timesheettracking -- sh -c 'if [ -n "$API_TOKEN" ]; then echo "API_TOKEN is set"; else echo "API_TOKEN is missing"; fi'
```

Expected result:

```text
API_TOKEN is set
```

## 8. Check Resources and Health Probes

First get a Pod name:

```powershell
kubectl get pods -n timesheet-ns
```

Then describe one Pod:

```powershell
kubectl describe pod <POD-NAME> -n timesheet-ns
```

In the output, check for:

- Requests: CPU `100m`, memory `64Mi`
- Limits: CPU `250m`, memory `128Mi`
- Readiness probe on `/`
- Liveness probe on `/`

## 9. Demo A — Live ConfigMap Update

Check the current message:

```powershell
curl.exe http://timesheettracking.local/web
kubectl get pods -n timesheet-ns
```

Edit the ConfigMap:

```powershell
kubectl edit configmap timesheettracking-web-content -n timesheet-ns
```

Inside `index.html`, change the heading text, save the file and close the editor.

Wait about 60 seconds, then run:

```powershell
curl.exe http://timesheettracking.local/web
kubectl get pods -n timesheet-ns
```

The page text changes, but the Pod names, ages and restart counts remain unchanged.

## 10. Demo B — Rolling Update

In PowerShell terminal 1, continuously call the homepage:

```powershell
while ($true) {
  curl.exe -s -o NUL -w "%{http_code}`n" http://timesheettracking.local/web
  Start-Sleep -Milliseconds 500
}
```

It should continuously display `200`.

In PowerShell terminal 2, change nginx from `1.25` to `1.26`:

```powershell
kubectl annotate deployment/timesheettracking kubernetes.io/change-cause="Updated to nginx:1.26" -n timesheet-ns --overwrite
kubectl set image deployment/timesheettracking web=nginx:1.26 -n timesheet-ns
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```

Watch the Pods being replaced:

```powershell
kubectl get pods -n timesheet-ns -w
```

Press `Ctrl+C` to stop watching. Terminal 1 should continue showing `200` while the Pods are replaced.

## 11. Check Rollout History

```powershell
kubectl rollout history deployment/timesheettracking -n timesheet-ns
```

The history should show `Updated to nginx:1.26` instead of `<none>`.

Optional rollback:

```powershell
kubectl rollout undo deployment/timesheettracking -n timesheet-ns
kubectl rollout status deployment/timesheettracking -n timesheet-ns
```
