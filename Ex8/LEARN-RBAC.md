# Ex8 — Learn RBAC by Doing

This is a hands-on companion to `RUN-GUIDE.md`. That file tells you *what* to run; this one is structured so you predict the outcome before running each command, then check yourself against what actually happens. Use Rancher Desktop's dashboard for the "look" steps and PowerShell for the "act" and "prove" steps.

Concepts recap (skip if you already have this solid):

- **ServiceAccount** — an identity a Pod/automation authenticates as. Not a human user.
- **Role** — a permission template: verbs × resources, scoped to one namespace. Grants nothing by itself.
- **RoleBinding** — attaches a Role to a subject (here, a ServiceAccount). This is what actually grants access.
- Role/RoleBinding are **namespace-scoped** — they say nothing about any other namespace.

---

## Stage 1 — Read before you run

Open `ex8.yaml` and, without running anything yet, answer these:

1. Which ServiceAccount can delete a pod in `ex8`, and which can't?
2. If you created a *third* ServiceAccount in `ex8` with no RoleBinding at all, what could it do?
3. `ex8-pod-reader` lists `services` as a resource. Does that mean `ex8-dev-viewer` can read Services in the `default` namespace too?

<details><summary>Answers</summary>

1. `ex8-dev-writer` (bound to `ex8-pod-writer`, which includes `delete`) can. `ex8-dev-viewer` (bound to `ex8-pod-reader`) cannot.
2. Nothing beyond what any authenticated identity gets by default (effectively nothing, under a default-deny RBAC setup) — a ServiceAccount with no RoleBinding has no granted permissions.
3. No. The Role only applies within the namespace named in its own `metadata.namespace` (`ex8`). A different namespace would need its own Role + RoleBinding, or a ClusterRole/ClusterRoleBinding.

</details>

---

## Stage 2 — Apply and look at raw state (prompt)

```powershell
Set-Location "D:\Projects\kubernetes\Ex8"
kubectl apply -f ex8.yaml
kubectl get all,sa,role,rolebinding -n ex8
```

You've already done this — pods are `ImagePullBackOff`, which is expected (private ECR image). That's a *scheduling/image* problem, unrelated to RBAC — keep it in mind so you don't confuse "pod won't start" with "RBAC is broken." RBAC governs API calls, not container health.

---

## Stage 3 — Look at it in the Rancher Desktop dashboard (GUI)

Open Rancher Desktop → click the Kubernetes cluster (the dashboard opens in-app or in your browser).

1. Switch the namespace selector (top bar) to `ex8`.
2. **Workloads → Deployments**: find `ex8-hello-microservice`, note the `0/2` ready count matching what you saw in the terminal.
3. Left nav → search for "Role" and "RoleBinding" (usually under **More Resources → RBAC**, or via the search box): open `ex8-pod-reader` and `ex8-pod-writer` side by side and compare their rules — you should visually see the `delete` verb is the only difference.
4. Open **ServiceAccounts**, click `ex8-dev-viewer`: nothing interesting lives on the ServiceAccount object itself — the permission lives on the Role, connected via the RoleBinding. This is worth confirming visually once: the ServiceAccount alone tells you nothing about what it can do.

---

## Stage 4 — Prove enforcement, not just configuration (prompt)

Everything so far has been "the YAML says X." This stage checks whether the API server actually enforces it, using `kubectl auth can-i --as=` to impersonate each ServiceAccount from your own kubectl (no extra pods needed):

```powershell
# dev-viewer: expect yes/yes/no/no
kubectl auth can-i get pods -n ex8 --as=system:serviceaccount:ex8:ex8-dev-viewer
kubectl auth can-i list services -n ex8 --as=system:serviceaccount:ex8:ex8-dev-viewer
kubectl auth can-i delete pods -n ex8 --as=system:serviceaccount:ex8:ex8-dev-viewer
kubectl auth can-i get secrets -n ex8 --as=system:serviceaccount:ex8:ex8-dev-viewer

# dev-writer: expect yes/yes/yes/no
kubectl auth can-i get pods -n ex8 --as=system:serviceaccount:ex8:ex8-dev-writer
kubectl auth can-i list services -n ex8 --as=system:serviceaccount:ex8:ex8-dev-writer
kubectl auth can-i delete pods -n ex8 --as=system:serviceaccount:ex8:ex8-dev-writer
kubectl auth can-i get secrets -n ex8 --as=system:serviceaccount:ex8:ex8-dev-writer

# namespace scoping: dev-writer can delete pods in ex8 — can it delete pods anywhere else?
kubectl auth can-i delete pods -n default --as=system:serviceaccount:ex8:ex8-dev-writer
```

Before running each block, write down (even just mentally) what you expect `yes`/`no` to be, then run it and check. The `get secrets` and cross-namespace checks are there specifically to fail — that's the point: Roles grant *only* what's listed, *only* in their own namespace.

---

## Stage 5 — Break something on purpose, then fix it

This is the fastest way to actually learn RBAC rather than just observe it.

1. Edit `ex8.yaml`: in `ex8-pod-reader`, remove `"services"` from the `resources` list. Re-apply:
   ```powershell
   kubectl apply -f ex8.yaml
   ```
2. Re-run: `kubectl auth can-i list services -n ex8 --as=system:serviceaccount:ex8:ex8-dev-viewer` — predict the answer before running it (it should flip to `no`).
3. Put `"services"` back, re-apply, and confirm it flips back to `yes`.

This proves the Role's `rules` block is the single source of truth being read live by the API server — nothing is cached against the old permission set.

---

## Stage 6 — Cleanup

```powershell
kubectl delete namespace ex8
```

---

## Self-check before moving on

- Can you explain, without looking, the difference between what a Role does and what a RoleBinding does?
- Could you now write a Role that lets a ServiceAccount only read ConfigMaps (nothing else) in a namespace of your choosing, from scratch?
- What would you add if you needed the *same* ServiceAccount to also read Secrets in a *different* namespace? (Hint: it's not a change to the existing Role.)
