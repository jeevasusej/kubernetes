@echo off
:: Applies the TimesheetTracking manifests in order (namespace first).
cd /d "%~dp0"

kubectl apply -f 01-namespace.yaml -f 02-configmap.yaml -f 03-deployment.yaml -f 04-service.yaml -f 05-ingress.yaml

echo.
echo Done. Verify with:
echo   kubectl get all -n timesheet-ns
