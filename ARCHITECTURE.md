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
