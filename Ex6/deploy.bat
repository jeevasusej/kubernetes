@echo off
setlocal

set EX6_DIR=D:\Projects\kubernates\Ex6

echo == 1. Create namespace ==
kubectl apply -f "%EX6_DIR%\namespace.yaml"
if errorlevel 1 goto :error

echo.
echo == 2. Apply deployments and services ==
kubectl apply -f "%EX6_DIR%\shop-deployment.yaml"
if errorlevel 1 goto :error
kubectl apply -f "%EX6_DIR%\shop-service.yaml"
if errorlevel 1 goto :error
kubectl apply -f "%EX6_DIR%\admin-deployment.yaml"
if errorlevel 1 goto :error
kubectl apply -f "%EX6_DIR%\admin-service.yaml"
if errorlevel 1 goto :error

echo.
echo == 3. Apply middleware and ingress ==
kubectl apply -f "%EX6_DIR%\middleware.yaml"
if errorlevel 1 goto :error
kubectl apply -f "%EX6_DIR%\ingress.yaml"
if errorlevel 1 goto :error

echo.
echo == 4. Wait for rollouts to finish ==
kubectl rollout status deployment/shop-deployment -n ex6 --timeout=120s
if errorlevel 1 goto :error
kubectl rollout status deployment/admin-deployment -n ex6 --timeout=120s
if errorlevel 1 goto :error

echo.
echo == 5. Current state of ex6 ==
kubectl get all -n ex6
kubectl get ingress -n ex6
kubectl get middleware -n ex6

echo.
echo Deployment complete. Watching pods in ex6 - press Ctrl+C to stop and exit.
echo.
kubectl get pods -n ex6 -w

goto :eof

:error
echo.
echo Command failed - stopping script.
exit /b 1
