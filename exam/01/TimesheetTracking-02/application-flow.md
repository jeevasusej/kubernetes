# TimesheetTracking Application Flow

This guide explains how the TimesheetTracking website becomes a Docker image, how Kubernetes runs it, and how a browser reaches it.

## Short flow

```text
Application files
    ↓
Dockerfile
    ↓
Docker build
    ↓
Local image: timesheettracking:v1
    ↓
Kubernetes Deployment
    ↓
Two Pods
    ↓
Service
    ↓
Ingress
    ↓
Browser
```

## Part 1: Creating the application

The application source is stored under:

```text
docker/TimesheetTracking/
├── Dockerfile
├── nginx.conf
└── web/
    ├── index.html
    ├── styles.css
    └── app.js
```

- `index.html` contains the TimesheetTracking dashboard.
- `styles.css` controls its design and layout.
- `app.js` provides small browser interactions.
- `nginx.conf` tells Nginx how to serve `/web` and `/status`.
- `Dockerfile` contains the instructions for packaging everything into an image.

At this stage, these are only files. The application is not running yet.

## Part 2: Building the Docker image

The following command reads the Dockerfile and creates the image:

```powershell
wsl -d rancher-desktop -- sh -lc 'cd "/mnt/d/Projects/kubernetes/docker/TimesheetTracking" && docker build -t timesheettracking:v1 .'
```

The result is a local Docker image named:

```text
timesheettracking:v1
```

The image contains:

- The Nginx web server
- The Nginx configuration
- The HTML, CSS and JavaScript files

The image is stored inside Rancher Desktop's container engine. It is not a normal file in the project folder, and it is not a running website by itself.

View the image with:

```powershell
wsl -d rancher-desktop -- sh -lc 'docker image ls timesheettracking'
```

## Part 3: Kubernetes uses the local image

The Kubernetes Deployment contains:

```yaml
image: timesheettracking:v1
imagePullPolicy: Never
replicas: 2
```

This tells Kubernetes:

1. Find the local image named `timesheettracking:v1`.
2. Do not download the image from Docker Hub.
3. Create and maintain two Pods using that image.

Because the image was built inside Rancher Desktop, the Rancher Desktop Kubernetes cluster can use it.

If the image does not exist locally, the Pods cannot start and normally show `ErrImageNeverPull`.

## Part 4: Image, container and Pod

These three items are related, but they are not the same:

| Item | Meaning |
|---|---|
| Docker image | The packaged application and its files |
| Container | One running copy of the image |
| Pod | The Kubernetes object containing the running container |

The same image is used to create both Pods:

```text
timesheettracking:v1
    ├── Pod 1 → Nginx container
    └── Pod 2 → Nginx container
```

The two containers run separately, but they contain the same application.

## Part 5: Deployment, Service and Ingress

### Deployment

The Deployment creates the two Pods and replaces a Pod if it stops or fails.

### Service

Pod names and IP addresses can change. The Service provides one stable internal name and distributes requests between the two Pods.

```text
timesheettracking-02-svc → Pod 1 or Pod 2
```

### Ingress

Traefik Ingress receives requests for:

```text
http://timesheettracking02.local/web
http://timesheettracking02.local/status
```

It forwards both paths to `timesheettracking-02-svc` on port 80.

## Part 6: Why the Windows hosts file is needed

`timesheettracking02.local` is a local hostname, not a public internet address. Windows must be told that this hostname belongs to the local computer.

The hosts file is:

```text
C:\Windows\System32\drivers\etc\hosts
```

It contains:

```text
127.0.0.1 timesheettracking02.local
```

Here, `127.0.0.1` means "this computer." Rancher Desktop forwards the request from Windows to Traefik.

## Part 7: Browser request flow

When the user opens `http://timesheettracking02.local/web`, the request travels like this:

```text
Browser
    ↓
Windows hosts file resolves the hostname to 127.0.0.1
    ↓
Rancher Desktop forwards the request to Traefik
    ↓
Ingress matches timesheettracking02.local and /web
    ↓
Service selects one of the two Pods
    ↓
Nginx inside the selected Pod returns the webpage
    ↓
Browser displays the TimesheetTracking dashboard
```

For `/status`, the route is the same, but Nginx returns this JSON response instead of the dashboard:

```json
{"status":"UP","service":"TimesheetTracking"}
```

## Final summary

```text
Files create the image.
The image creates containers.
Kubernetes runs the containers inside Pods.
The Service provides stable access to the Pods.
Ingress exposes the Service using a hostname and paths.
The hosts file lets Windows find that local hostname.
The browser displays the response returned by Nginx.
```

