# Omni Organization-Wide AI Agent Rules

## Global Rules

- Never hallucinate paths, APIs, or env vars.
- Make minimal, focused changes.
- Match existing patterns and style.
- Use Tilt (`tilt.dev`) as the single entrypoint; never suggest `npm run`, `cargo`, or direct commands.
- Reference Tilt targets: `tilt up`, `tilt down`, `tilt trigger <service>`.
- Do not modify `Tiltfile` unless explicitly requested.

## Tilt Integration

- All local dev runs through `tilt up`.
- Agents suggesting commands must use Tilt targets.
- Example: “Run `tilt trigger api` to restart the API.”

## TypeScript/JavaScript

- Prefer `interface` over `type` for object shapes.
- No `any`; use `unknown` or generics.
- Enforce Biome via editor.
- Use `bun` (never `npm`, `yarn`, or `pnpm`).

## Rust

- Follow `clippy::all` and `clippy::pedantic`.
- Always `#[derive(Debug, Clone)]` on structs/enums.
- Return `Result<T, E>`; avoid panics.
- Use `cargo watch` via Tilt only.
