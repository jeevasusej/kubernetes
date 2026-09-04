@echo off
:: Applies the InventoryTracking-02 (Snipe-IT) manifests in order.
cd /d "%~dp0"

kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secret.yaml -f 02-configmap.yaml
kubectl apply -f 03-db-pvc.yaml -f 04-db-service.yaml -f 05-db-statefulset.yaml

echo.
echo Waiting for the database to be ready before starting the app...
kubectl wait --for=condition=ready pod -l app=inventorytracking-02-db -n inventory02-ns --timeout=180s

kubectl apply -f 06-app-deployment.yaml -f 07-app-service.yaml
kubectl apply -f 08-middleware.yaml -f 09-ingress.yaml

echo.
echo Done. Verify with:
echo   kubectl get all -n inventory02-ns
