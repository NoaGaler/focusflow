# Assignment 4 – Cloud deployment (Google Cloud)

## Architecture

```
Browser → https://focusflow.ddns.net
              │
        Load Balancer (HTTPS 443, Google-managed certificate)
              ├── /api/* and /health → Cloud Run "focusflow-server" (port 8000)
              └── everything else    → Cloud Run "focusflow-client" (port 3000)
                                          │
                     focusflow-server → MongoDB Atlas (M0, Google Cloud, europe-west1)
```

## Decisions (and why)

| Decision | Why |
|---|---|
| **Cloud Run**, not a VM | Google manages the machines, scales instances up with load and down to zero; no OS updates, no health-check firewall rules, almost no cost when idle. |
| **One service for client, one for server** | Each scales on its own; a failure in one does not take down the other. |
| **Max 4 instances, min 0** | Cloud Run adds instances automatically under load (the "2+ instances behind the LB" recommendation); the cap protects the credit. |
| **The server is stateless** | Users, revoked tokens and login-failure counters are all in MongoDB, and JWT_SECRET is shared from Secret Manager, so any instance can serve any request. |
| **MongoDB Atlas M0** | Same database as assignment 3, free tier, managed backups. Cloud SQL costs per hour; a DB on a VM means our own backups and updates. Never run the DB inside Cloud Run (its filesystem is in memory). |
| **Atlas network access 0.0.0.0/0** | Cloud Run has no fixed outgoing IP. Access is protected by a strong password (kept in Secret Manager) and TLS. A stricter option would be a VPC connector + Cloud NAT with a static IP. |
| **Atlas DB user with `readWrite` on `focusflow` only** | Least privilege: the app cannot touch anything else. |
| **Secrets in Secret Manager** | `MONGODB_URI` and `JWT_SECRET` are never in code, images, GitHub or plain Console variables. They are referenced as environment variables in Cloud Run. |
| **Dedicated service account `focusflow-server`** | Its only role is *Secret Manager Secret Accessor*. |
| **Artifact Registry remote repository `dockerhub`** | Cloud Run could not pull our new Docker Hub images through Google's mirror (`mirror.gcr.io ... not found`). A remote repository proxies Docker Hub and caches the images. Images are referenced by their git commit tag so a new deploy always gets the new image. |
| **JWT_SECRET generated randomly, never shown** | 48 random bytes from the OS crypto generator, copied straight to the clipboard and into Secret Manager. |

## Done

- [x] Google Cloud project `focusflow-514113`, budget alert, no upgrade
- [x] No-IP hostname `focusflow.ddns.net` (A record; Dynamic DNS off)
- [x] MongoDB Atlas cluster `focusflow-db` (M0, GCP europe-west1), user `noagaler_db_user`
- [x] Secret Manager: `MONGODB_URI`, `JWT_SECRET`
- [x] Artifact Registry remote repo `dockerhub` (Docker Hub, unauthenticated, europe-west1)
- [x] Cloud Run `focusflow-server` (europe-west1, port 8000, `DB_NAME=focusflow`, both secrets, service account `focusflow-server`, public access, max 4) – log shows `Connected to MongoDB, indexes are ready`

## Still to do

1. **Cloud Run `focusflow-client`**
   - image `europe-west1-docker.pkg.dev/focusflow-514113/dockerhub/noagal/focusflow-client:<commit>`
   - port **3000**, public access, max 4 instances, no variables or secrets
   - its own service account `focusflow-client` with **no roles**
2. **Load Balancer** (Network services → Load balancing → Create → Application Load Balancer, global, external):
   - Frontend: HTTPS, new static IP `focusflow-ip`, Google-managed certificate for `focusflow.ddns.net`;
     optional HTTP→HTTPS redirect
   - Backends: serverless NEG → `focusflow-client` (default) and serverless NEG → `focusflow-server`
   - Routing rules: `/api/*` and `/health` → server backend; everything else → client backend
3. **No-IP**: change the A record of `focusflow.ddns.net` to the Load Balancer's static IP (only that IP).
4. Wait for the certificate (`PROVISIONING` → `ACTIVE`, up to ~60 min + DNS time).
5. Optional hardening: set both Cloud Run services' ingress to *Internal + Cloud Load Balancing*
   so they are reachable only through the Load Balancer.
6. Test from a browser without NetFree: `https://focusflow.ddns.net`, `/health`, register, session with camera.
7. Submit `<project>.json` with the domain.

## Things to remember

- **No-IP free hostnames must be confirmed every 30 days** (email from No-IP) or the domain stops working.
- **Never click "Upgrade"** in Google Cloud (Free Trial: no real charges).
- After the grading window you may delete the Load Balancer to save credit, but it is needed again for the final project.
- The computer used for setup has NetFree, which blocks Cloud Shell, `*.run.app` and probably the final domain;
  test the live site from another device.
