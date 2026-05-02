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
