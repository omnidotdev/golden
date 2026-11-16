# Omni Architecture

Project structure and orchestration patterns for Omni services.

## Directory Structure

```
project/
  services/
    project-api/
      Tiltfile
      src/
    project-app/
      Tiltfile
      src/
  Tiltfile           # Root orchestrator
```

Services live in `services/` with individual Tiltfiles.

## Tilt Orchestration

[Tilt](https://tilt.dev) is the recommended local dev entry point:

```bash
tilt up              # Start all services
tilt down            # Stop all services
tilt trigger <svc>   # Restart a specific service
```

Direct commands (`bun test`, `cargo check`) are also supported.

## Service Discovery

Auto-discover services in `services/*/Tiltfile`:

```python
services_dir = "%s/services" % base_path
# Discover and include sub-Tiltfiles
```

## Port Convention

`*-app` services default to **port 3000** in local dev, with `PORT` env override and `strictPort: true` so collisions fail loudly instead of silently shifting.

### Standard vite config

```ts
server: {
  port: Number(process.env.PORT) || 3000,
  strictPort: true,
  host: "0.0.0.0",
},
```

### Why 3000

- **Dev/prod parity.** Production containers `EXPOSE 3000` and the nitro server defaults to `PORT=3000`. Aligning the dev port keeps URLs identical across environments.
- **One canonical port.** Predictable for new contributors; no per-app lookup.
- **`strictPort: true`** prevents Vite from silently picking a different port when 3000 is taken. Failure is the signal to set `PORT`.

### Running multiple apps locally

```bash
PORT=3001 bun dev   # second app
PORT=3002 bun dev   # third app
```

Prefer `PORT=X bun dev` over `vite dev --port X` in `package.json` scripts so the env-driven convention is honored everywhere.

### Tauri apps

Tauri apps follow the same convention. The Tauri scaffolder defaults to `1420`, but the actual contract is that `tauri.conf.json`'s `devUrl` matches the vite port. Set both to `3000`:

```jsonc
// src-tauri/tauri.conf.json
{
  "build": {
    "devUrl": "http://localhost:3000",
  }
}
```

For mobile dev (`TAURI_DEV_HOST` set), the paired HMR WebSocket uses port `3001`.

### Exceptions

| App | Port | Reason |
|---|---|---|
| `gatekeeper-app` | 8000 | Auth service depended on by sibling apps at fixed URL |
| `warden-app` | 8001 | Auth service, paired with gatekeeper |

Add new exceptions only when an app must be reachable at a fixed local URL by sibling services. Otherwise default to 3000.

## Product Resources Live in the Workspace

Products are editors on top of the platform. Anything a product creates for a user (a hosted site, a deployed service, a repository, a bucket) is a resource of the user's **workspace** on the platform product that owns that kind of resource, never of the product itself. Keystone is the reference: a published site is a static site in the workspace's own Fractal project, built from a repository the workspace owns in Arbor.

### Rules

1. **The workspace owns the resource.** Create it in the workspace's own space on the platform (its Fractal project, its Arbor organization), so every member sees and manages it there with the platform's normal roles, and it outlives the product. Never park user resources in a product-owned project, repository, or account.
2. **The product acts for a member, with least privilege.** A product reaches the platform through delegated access: its own service key plus the signed-in member's own token (minted for the product's API) and the workspace it acts in. The platform authorizes the member as usual, then confines the product to its registered policy (fractal-api `src/lib/auth/delegation.ts`: whitelisted operations, permitted service types, only the projects it created). A product never holds standing, workspace-wide credentials; where it must write later without the member (git pushes), it gets a narrow, visible, revocable grant on one resource (an Arbor write collaborator on the one repository, created for the member via `createWorkspaceRepository`).
3. **Billing goes through the platform's own plans.** The workspace pays the platform product for the resource under that product's normal plan (Fractal bills hosting), and only when it uses it. The product's plan sells only what the product itself does (Keystone: AI credits, sites, seats, badge removal). The platform's own limits decide what is allowed; when they refuse, the product says so and links to the hub's upgrade for that platform product (`hubPlanUrl` with the platform product id). Cross-product bundles (`bundleConfigs`) remain a pricing option, not a substitute for this.
4. **Platform credentials stay platform-side.** Build and runtime credentials come from the platform (for example the Arbor build reader the operator provides to every Fractal project), declared in IaC, never from the product and never hand-made per workspace.

### Onboarding a product

- Register its delegation policy in fractal-api and its key in infra (`FRACTAL_SERVICE_KEYS`, `<product>=<key>`); the product presents `X-Fractal-Service-Key`, the member's token, and `X-Fractal-Workspace`
- For repositories, give its Arbor service user `actsForMembers` and create workspace repositories with the member's token in `X-Arbor-Member-Token`
- Record where each resource lives (project, service, repository) on the product's own row, and link members to it in the platform's dashboard
