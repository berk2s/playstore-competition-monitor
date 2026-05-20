# playstore-competition-monitor

Tracks Play Store listings for apps you care about. You paste a Play Store URL, a worker grabs a full-page screenshot on a schedule, and the timeline shows how the listing changes over time (rating, install count, version, what's-new, etc).

It exists because the Play Store doesn't tell you when a competitor changes their listing. You either notice by accident, or you don't. This pulls the history into one place.

## Demo

Live: http://pcm-prod-alb-2088702885.eu-west-3.elb.amazonaws.com

Your browser will likely warn that the connection isn't secure - that's expected. The stack is deployed without HTTPS for now (no domain / ACM cert wired up), so traffic to the ALB is plain HTTP. Fine for a demo; obviously not for anything real.

![Demo](docs/demo.gif)

## How it fits together

Three Node services plus Mongo, Redis, and S3:

```
                       ┌──────────────────────────┐
                       │         Browser          │
                       └──────────────┬───────────┘
                                      │ HTTP
                                      ▼
                       ┌───────────────────────────────┐
                       │             ALB               │
                       │  /api/* → api    /* → web     │
                       └─────────┬───────────┬─────────┘
                                 │           │
                                 ▼           ▼
                          ┌──────────┐ ┌──────────┐
                          │   api    │ │   web    │
                          │ Fastify  │ │ Next.js  │
                          └─┬──────┬─┘ └──────────┘
                            │      │
                  app CRUD  │      │ enqueue capture job
                            │      │  (on add or "capture now")
                            ▼      ▼
                ┌──────────────┐ ┌───────────────────────────┐
                │   Mongo      │ │   Redis (BullMQ)          │
                │   Atlas      │ │  ┌─────────┐ ┌─────────┐  │
                └──────────────┘ │  │dispatch │ │capture  │  │
                       ▲         │  │ queue   │ │ queue   │  │
                       │         │  └────▲────┘ └────▲────┘  │
                       │         └───────┼───────────┼───────┘
                       │                 │           │
                       │  hourly tick    │           │ pull
                       │  0 * * * *      │           │ (concurrency 2,
                       │  (CAPTURE_CRON, │           │  CAPTURE_CONCURRENCY)
                       │   configurable) │           │
                       │                 │           │
                       │       ┌─────────┴───┐ ┌─────┴─────────┐
                       │       │  worker:    │ │  worker:      │
                       │       │ dispatcher  │ │ capture       │
                       │       │             │ │ Playwright    │
                       │       │ fans out →  │ │ → Play Store  │
                       │       │ N capture   │ │               │
                       │       │ jobs        │ │               │
                       │       └─────────────┘ └──┬────────┬───┘
                       │                          │        │
                       │  writes Screenshot doc   │        │ PutObject
                       └──────────────────────────┘        ▼
                                                     ┌──────────┐
                                                     │    S3    │
                                                     │ (private)│── CloudFront
                                                     └──────────┘
```

The cron pattern (`CAPTURE_CRON`, default `0 * * * *` — top of every hour) is set on the worker service as an env var; change it to `*/15 * * * *` or whatever cadence you actually want. Adjusting it is a task-definition update, not a code change.

The api is a thin Fastify service: CRUD on tracked apps + a `/health` probe. It writes a BullMQ job when an app is added or when you click "capture now". The worker pulls jobs, drives a headless Chromium against the Play Store listing, takes a full-page PNG, extracts visible metadata from the page (rating, installs, version, "what's new", ad/IAP flags), and writes both to Mongo + S3. A separate cron-style dispatcher in the worker also fires scheduled captures.

Web is a plain Next.js (standalone) app that uses TanStack Query to poll the api. There's no SSR data fetching here — all calls are client-side over relative `/api/*` URLs that the shared ALB routes to the right target.

## How the app works

### Adding an app

When you paste a Play Store URL into the form, the api parses the package name out of it (anything `play.google.com/store/apps/details?id=<pkg>`), checks Mongo for a duplicate, inserts a new `App` doc if it's new, and immediately enqueues a `capture` job on Redis. The api returns 201 in a few milliseconds — the actual capture happens out-of-band on the worker.

The reason this is a queue and not a direct call: capturing takes 5–30 seconds (Chromium startup, networkidle wait, scroll to the bottom of the page, screenshot). You don't want a request handler holding that long, and you definitely don't want the api running Playwright.

### Scheduled captures

The worker boots two independent BullMQ workers on the same Redis:

- A **dispatcher** on the `dispatch` queue, with a single recurring job set up via `repeat: { pattern: CAPTURE_CRON }` (default hourly). When it fires, it loads every active app from Mongo and enqueues one `capture` job per app on the `capture` queue, staggered by 2s to avoid hammering the Play Store.
- A **capture worker** on the `capture` queue that actually does the screenshotting. Concurrency is set by `CAPTURE_CONCURRENCY` (default 2).

Splitting them onto two queues isn't cosmetic — early on they shared a queue and the dispatcher's worker would occasionally pick up and "process" (no-op) capture jobs that the api had enqueued, silently dropping them. Two queues, two workers, no overlap.

### What the worker actually captures

For each job:

1. Open a fresh Playwright browser context, set viewport + locale + user agent so the page looks like a normal desktop visit.
2. Block requests to obvious ad/analytics domains to keep the page light and avoid noise.
3. Navigate to `play.google.com/store/apps/details?id=<pkg>&hl=<locale>&gl=<country>`, wait for the `<h1>`.
4. Click through any consent dialog ("Accept all" / "I agree" / similar).
5. Scroll to the bottom to lazy-load images, wait for networkidle, then scroll back to top.
6. Take a full-page PNG.
7. Run `extractListingMetadata` on the same page before closing the context.

The metadata extraction is deliberately defensive. The Play Store DOM uses obfuscated class names and changes frequently, so the extractor prefers the `<script type="application/ld+json">` block (which Google maintains as a `SoftwareApplication` schema) for title, developer, icon, rating, ratingCount, price, and the long description. For fields not in JSON-LD (installs, version, "updated on", size, min Android, "what's new", "contains ads", "in-app purchases"), it falls back to label-based DOM probes — find a node whose direct text matches a known English label, then read its sibling. If any single field can't be found, it's stored as `null`; the screenshot still saves. The metadata is embedded directly on the `Screenshot` doc so each capture is a self-contained snapshot of the listing at that moment.

The PNG goes to S3 (key shape: `apps/<appId>/<ISO timestamp>.png`); the Mongo `Screenshot` doc records the key, the public URL (CloudFront in prod, the api in local dev), capture duration, and the metadata blob. The app's `lastCapturedAt` is stamped on success.

Failures are retried with exponential backoff (default 3 attempts). Only the **final** failure persists a `Screenshot` doc with `status: 'failed'` and a truncated error message, so transient retries don't pollute the timeline.

### The timeline UI

The detail page polls `/api/apps/<id>/screenshots` every 5 seconds via TanStack Query. Newest capture is expanded by default, the rest are collapsed to just the timestamp + status badge — full-page Play Store screenshots are tall and you don't want to scroll past ten of them to see today's. The compact metadata grid (rating, installs, version, updated, size, etc.) sits under each capture even when the screenshot itself is collapsed, since that's the part most worth scanning.

"Capture now" on the detail page enqueues a fresh job through the same path the dispatcher uses. The polling picks it up as soon as the screenshot doc lands in Mongo.

## Repo layout

```
api/        Fastify REST API. Owns Mongo writes.
worker/     BullMQ worker + dispatcher. Owns Playwright + S3 writes.
web/        Next.js standalone app.
infra/      Terraform. Modules + a single prod environment.
.github/    GitHub Actions workflows.
docker-compose.yml   Local dev: Mongo, Redis, all three services.
```

Each of api/worker/web has its own `package.json`, its own `Dockerfile`, and its own tests under `*.test.ts`. They don't share a workspace — keeping them independent makes it cheaper to swap or split out later.

## Running locally

You need Docker, that's it. `docker compose up --build` brings up:

- `mongo` on `localhost:27017`
- `redis` on `localhost:6379`
- `api` on `localhost:4000`
- `web` on `localhost:3000`
- `worker` (no exposed port)

Screenshots land in a named volume (`screenshot-data`) so they survive `compose down`.

Open `http://localhost:3000`, paste a Play Store URL like `https://play.google.com/store/apps/details?id=com.activision.callofduty.shooter`, and within ~15s the first capture should appear.

The web service uses a Next.js rewrite (`API_PROXY_TARGET`) to forward `/api/*` to the api container — so the same relative URLs that work in prod also work in dev.

### Running pieces outside Docker

Each package works standalone if you'd rather use the host node:

```
cd api    && yarn install && yarn dev   # needs MONGO_URI and REDIS_URL in env
cd worker && yarn install && yarn dev
cd web    && yarn install && yarn dev
```

Tests live next to their code (vitest):

```
cd api    && yarn test
cd worker && yarn test
cd web    && yarn test
```

## Infrastructure (Terraform on AWS)

Region is `eu-west-3`. The stack is:

- VPC with two public and two private subnets across two AZs, one NAT
- ECR repos for `api`, `worker`, `web` (mutable tags, scan on push)
- ECS Fargate cluster with three services behind a public ALB (path-routed: `/api/*` → api, `/*` → web; worker has no ALB target)
- S3 bucket for screenshots (private, 90d → Glacier IR, 365d expire), fronted by CloudFront
- ElastiCache Redis (single `cache.t4g.micro`) in private subnets
- Secrets Manager: one secret you bring (Mongo Atlas URI) and one Terraform owns (Redis URL)
- IAM: per-service task roles. Worker is the only one with `s3:PutObject` on the screenshots bucket.
- A GitHub OIDC provider + a role the deploy workflow assumes (no AWS keys in GitHub)

The layout under `infra/` is a small `modules/` directory consumed by `environments/prod/`. There's only one environment for now; the structure leaves room for a `staging` later without re-shaping anything.

### What you need before `terraform apply`

1. **An S3 bucket and a DynamoDB table for remote state** (already exists in your account if you reused one). The bucket and table names are hardcoded in `infra/environments/prod/backend.tf` — Terraform backend blocks can't read variables, so edit the file if yours differ.

2. **Your MongoDB Atlas connection string in Secrets Manager.** Atlas isn't provisioned here — bring your own cluster. Create the secret once:

   ```
   aws secretsmanager create-secret \
     --region eu-west-3 \
     --name playstore-competition-monitor-prod/mongo-uri \
     --secret-string 'mongodb+srv://USER:PASS@cluster.xxxxx.mongodb.net/playstore_competition_monitor?retryWrites=true&w=majority'
   ```

   Copy the returned ARN into `infra/environments/prod/terraform.tfvars`:

   ```hcl
   mongo_uri_secret_arn = "arn:aws:secretsmanager:eu-west-3:<acct>:secret:playstore-competition-monitor-prod/mongo-uri-XXXXXX"
   ```

   This file is gitignored — it contains a secret ARN, which on its own isn't sensitive, but the discipline of keeping tfvars out of git is worth it.

3. **Apply, then allowlist the NAT EIP in Atlas.** Run:

   ```
   cd infra/environments/prod
   terraform init
   terraform apply
   ```

   After it finishes, `terraform output nat_public_ip` prints a single IP. Add it to Atlas → Network Access → IP Access List. Without this, ECS tasks will start, fail to connect to Mongo, and look "broken" for no obvious reason.

4. **GitHub variable.** Grab `terraform output github_actions_role_arn`, then in GitHub repo Settings → Secrets and variables → Actions → **Variables** tab, add `AWS_ACCOUNT_ID = <your 12-digit account id>`. That's the only thing CI needs from you.

The first `apply` leaves the three ECS services pointing at an empty `:latest` tag in ECR. Tasks will keep failing to pull until CI pushes images. That's expected; the next section closes the loop.

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main` (and on manual dispatch). It uses GitHub OIDC to assume the IAM role Terraform created, so there are no long-lived AWS credentials anywhere.

Three sequential jobs, each fanned out over `[api, worker, web]`:

1. **test** — `yarn install --frozen-lockfile && yarn test` per package, in parallel. Tests use vitest with `mongodb-memory-server` so nothing external is needed.
2. **build-and-push** — buildx + GHA cache, pushes both `:${git-sha}` (for rollback) and `:latest` (which the ECS task definitions pin to).
3. **deploy** — `aws ecs update-service --force-new-deployment` to trigger a rolling restart, then `aws ecs wait services-stable` so the workflow fails loudly if a rollout never goes healthy.

`concurrency: deploy-prod` is set without cancellation, so two pushes to main queue rather than race over ECS.

To roll back: bump the workflow to push only the SHA tag, or temporarily change `local.images` in `infra/environments/prod/main.tf` to pin a known-good `:${sha}`, then `terraform apply`.
