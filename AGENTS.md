# Omni AI Agent Rules

Canonical rules for AI agents working in Omni codebases. See [STYLEGUIDE.md](./STYLEGUIDE.md) for code style conventions.

## Global Rules

- Never hallucinate paths, APIs, or environment variables
- Make minimal, focused changes
- Match existing patterns and style

## Tilt Integration

See [ARCHITECTURE.md#tilt-orchestration](./ARCHITECTURE.md#tilt-orchestration) for Tilt commands.

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

## Git

Follow [STYLEGUIDE.md#git](./STYLEGUIDE.md#git).

## Testing

Follow [STYLEGUIDE.md#testing](./STYLEGUIDE.md#testing).

## Dependencies

Follow [STYLEGUIDE.md#dependencies](./STYLEGUIDE.md#dependencies).
