# Running Ex8 — RBAC for a Deployed Microservice

This guide explains how to deploy Ex8 on the Kubernetes cluster supplied by Rancher Desktop. It uses Windows PowerShell commands.

This exercise is for learning `ServiceAccount`, `Role`, and `RoleBinding` in a more realistic setting: an `ex8-hello-microservice` Deployment and Service are running in namespace `ex8`, and two ServiceAccounts are granted different levels of access to it — `ex8-dev-viewer` can only `get`/`list`/`watch` Pods, Pod logs, and Services, while `ex8-dev-writer` has those same read verbs plus `delete`.

Every resource name is prefixed `ex8-` so it's unambiguous in `kubectl get` output across namespaces. Everything lives in one file, `ex8.yaml`, as a series of `---`-separated documents applied together in dependency order:

| Order | Kubernetes resource | Purpose |
| --- | --- | --- |
| 1 | Namespace `ex8` | Creates an isolated area for the exercise. |
| 2–3 | ServiceAccount `ex8-dev-viewer`, `ex8-dev-writer` | The two identities. |
| 4–5 | Role `ex8-pod-reader`, `ex8-pod-writer` | `ex8-pod-reader` grants `get`/`list`/`watch` on `pods`, `pods/log`, `services`; `ex8-pod-writer` grants the same plus `delete`. |
| 6–7 | RoleBinding `ex8-dev-viewer-binding`, `ex8-dev-writer-binding` | Bind each ServiceAccount to its Role. |
| 8 | Deployment `ex8-hello-microservice` | Runs 2 replicas on container port 3000. |
| 9 | Service `ex8-hello-microservice` | Exposes the Deployment on NodePort `30081`. |

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
Set-Location "D:\Projects\kubernetes\Ex8"
Get-ChildItem *.yaml
```

You should see `ex8.yaml`.

---

## 3. Apply the file

```powershell
kubectl apply -f ex8.yaml
```

`kubectl apply` processes the documents in the file top to bottom, so the Namespace, ServiceAccounts, and Roles are created before the RoleBindings and Deployment that depend on them.

---

## 4. Verify the rollout

```powershell
kubectl rollout status deployment/ex8-hello-microservice -n ex8
kubectl get pods -n ex8
kubectl get service ex8-hello-microservice -n ex8
```

Expected: 2 pods `1/1 Running` under `ex8-hello-microservice`, and the Service listed with `NodePort` `30081`.

> The image is pulled from a private ECR registry (`092304627145.dkr.ecr.eu-north-1.amazonaws.com/sample-node-api:latest`). If Rancher Desktop cannot pull it, the pods will show `ErrImagePull`/`ImagePullBackOff` — this is expected unless the image has been pushed to a registry your cluster can reach, or already cached locally (`imagePullPolicy: IfNotPresent`).

---

## 5. Verify the RBAC objects exist

```powershell
kubectl get serviceaccount -n ex8
kubectl get role -n ex8
kubectl get rolebinding -n ex8
```

Expected: `ex8-dev-viewer` and `ex8-dev-writer` ServiceAccounts, `ex8-pod-reader` and `ex8-pod-writer` Roles, and `ex8-dev-viewer-binding`/`ex8-dev-writer-binding` RoleBindings.

---

## 6. Compare what each Role grants

```powershell
kubectl describe role ex8-pod-reader -n ex8
kubectl describe role ex8-pod-writer -n ex8
```

Expected: both list `pods`, `pods/log`, and `services` under Resources; `ex8-pod-reader`'s Verbs column shows `get list watch`, while `ex8-pod-writer`'s also includes `delete`.

---

## 7. Troubleshooting

### A RoleBinding doesn't seem to grant the expected access

```powershell
kubectl describe rolebinding ex8-dev-viewer-binding -n ex8
kubectl describe rolebinding ex8-dev-writer-binding -n ex8
```

Confirm each `Subjects` section lists the right ServiceAccount in namespace `ex8`, and `Role` under `RoleRef` matches `ex8-pod-reader`/`ex8-pod-writer` exactly.

### Pods stuck in `ErrImagePull` / `ImagePullBackOff`

```powershell
kubectl describe pod -n ex8 -l app=ex8-hello-microservice
```

Check the **Events** section — this means the cluster cannot reach the private ECR image referenced in `ex8.yaml`. Point it at an image your cluster can pull if you want the pods to actually run.

---

## 8. Cleanup

```powershell
kubectl delete namespace ex8
```

This deletes both ServiceAccounts, both Roles, both RoleBindings, the Deployment, and the Service together.

---

## Command summary

```powershell
# Apply
kubectl apply -f ex8.yaml

# Verify
kubectl rollout status deployment/ex8-hello-microservice -n ex8
kubectl describe role ex8-pod-reader -n ex8
kubectl describe role ex8-pod-writer -n ex8

# Cleanup
kubectl delete namespace ex8
```
