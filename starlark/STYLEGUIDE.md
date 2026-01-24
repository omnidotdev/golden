# [Tilt](https://tilt.dev) & [Starlark](https://github.com/bazelbuild/starlark) Style Guide

If this conflicts with root `STYLEGUIDE.md`, **this file takes precedence**.

## Structure

```
Tiltfile                # Main entry point (keep short)
tilt/
  services.tilt         # Service declarations
  k8s.tilt              # K8s wiring
starlark/
  env.tilt              # Reusable env helpers
  utils.tilt            # Generic functions
```

Single responsibility per file.

## Naming

- **snake_case**: functions, variables
- **SCREAMING_SNAKE**: constants (rare)
- Files: `*.tilt`, named by purpose

## Imports

- Prefer local `load()` from `starlark/` or `tilt/`
- Centralize `ext://` extensions
- Avoid scattering `ext://` loads

## Environment

- Use dedicated env helpers
- Support `.env`, `.env.local`
- Never hardcode secrets

## Services

Declarative, no magic globals:

```python
register_service(
    name='api',
    path='services/api',
    dockerfile='services/api/Dockerfile',
)
```

## Metarepo Pattern

See [ARCHITECTURE.weaver.md#service-discovery](../ARCHITECTURE.weaver.md#service-discovery) for the service discovery pattern.

## Discouraged

- Hardcoded secrets
- Complex business logic (Tilt is orchestration only)
- Hidden side effects
- Files growing unwieldy (split them)
