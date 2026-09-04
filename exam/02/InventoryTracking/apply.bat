@echo off
:: Applies the InventoryTracking manifests in order (namespace first).
cd /d "%~dp0"

kubectl apply -f 01-namespace.yaml -f 02-deployment.yaml -f 03-service.yaml -f 04-ingress.yaml

echo.
echo Done. Verify with:
echo   kubectl get all -n inventory-ns
