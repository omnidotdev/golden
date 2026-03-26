# Omni AI Agent Rules

Canonical rules for AI agents working in Omni codebases. See [STYLEGUIDE.md](./STYLEGUIDE.md) for code style conventions. See [ARCHITECTURE.md](./ARCHITECTURE.md) for project structure patterns.

## General

- Never hallucinate paths, APIs, or environment variables
- Make minimal, focused changes
- Match existing patterns and style

## Git

- Follow Extended Conventional Commits (ECC) per [STYLEGUIDE.md#git](./STYLEGUIDE.md#git)
- Never add `Co-Authored-By` lines to commits
- Default branch: `master`

## TypeScript

Follow [typescript/STYLEGUIDE.md](./typescript/STYLEGUIDE.md). Key points:

- Use `bun` (not npm, yarn, or pnpm)
- Enforce [Biome](https://biomejs.dev) for formatting and linting
- Enforce [Knip](https://knip.dev) for dead code and unused dependency detection

## Rust

Follow [rust/STYLEGUIDE.md](./rust/STYLEGUIDE.md). Key points:

- Use [thiserror](https://docs.rs/thiserror) for library errors, [anyhow](https://docs.rs/anyhow) for application errors
- Return `Result<T, E>`; avoid panics

## Error Handling

- Validate at system boundaries (user input, external APIs)
- Use typed errors; avoid stringly-typed error messages
- Never log secrets, tokens, PII, or full request bodies

## Drizzle

- Never manually edit migration files, snapshots, or journal
- No custom SQL migrations, all migrations must go through `bun db:generate`
- If a CHECK constraint, index, or other DDL is needed, define it in the Drizzle schema and let `db:generate` produce the migration
- Avoid `pgEnum` for business logic (use `text()` with app-level validation)

## Infrastructure

- All infrastructure operations must be reproducible and GitOps-friendly
- Never use one-off imperative commands for cluster state, use declarative manifests
- Secrets: use checked-in scripts that derive values from existing auth (e.g. `gh auth token`) rather than hardcoded tokens

## Startup Warnings

Products must boot successfully with only required env vars set. Optional integrations degrade gracefully:

- Log a warning to stdout on boot: `console.warn("<VAR_NAME> not set, <feature> disabled")`
- Never crash for missing optional config
- Use sensible defaults (free tier, noop providers, stdout fallback)
- Document which env vars are required vs optional in `.env.local.template`

## CloudEvents

All inter-service events follow the [CloudEvents](https://cloudevents.io) spec, routed through Vortex via `@omnidotdev/providers`.

- Source format: `omni.<product>` (e.g. `omni.vortex`, `omni.beacon`)
- Event type format: `<product>.<entity>.<action>` (e.g. `aether.subscription.changed`)
- Always use `createEventsProvider` from `@omnidotdev/providers`, never publish to Iggy directly

## Testing

Follow [STYLEGUIDE.md#testing](./STYLEGUIDE.md#testing).

## Dependencies

Follow [STYLEGUIDE.md#dependencies](./STYLEGUIDE.md#dependencies).
