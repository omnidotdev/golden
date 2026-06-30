# Omni Code Style Guide

Canonical baseline for all Omni code. Language-specific guides:

- [`typescript/STYLEGUIDE.md`](./typescript/STYLEGUIDE.md)
- [`rust/STYLEGUIDE.md`](./rust/STYLEGUIDE.md)
- [`starlark/STYLEGUIDE.md`](./starlark/STYLEGUIDE.md)

Language-specific guides take precedence when they conflict with this file.

## Hierarchy

1. This file (global rules)
2. Language guides (per folder)
3. Tool configs ([Biome](https://biomejs.dev), [rustfmt](https://rust-lang.github.io/rustfmt), [Tilt](https://tilt.dev))
4. Project overrides (only when justified)

## Principles

- **Consistency over preference**: match existing patterns
- **Small, composable units**: small files, small functions
- **Explicit over implicit**: no magic behavior
- **Predictable by default**: standard patterns first

## Structure

Group by feature/domain, not type:

```
src/
  billing/
  auth/
tests/
scripts/
```

Prefer small files. If a file is getting unwieldy, split it.

## Comments

- Sentence case, no trailing punctuation: `// Ensure database exists`
- Keep inline comments on a single line, do not wrap
- Wrap code in backticks: `// Parse \`userId\` param`
- TODO format: `// TODO: description` or `// TODO(assignee): description` or `// TODO(assignee1,assignee2): description`
- Explain **why**, not what
  - Avoid "Function that...", "Hook that...", "Component that..."
  - Use singular imperative: `// Parse a timestamp` not `// Parses a timestamp`

## Testing

- Fast, deterministic tests
- Integration tests at boundaries, unit tests for tricky logic
- Single command per repo: `bun test`, `cargo test`
- Arrange-Act-Assert structure
- Test naming: `describe` the unit, `it` the behavior
- Mock at boundaries (external APIs, databases), not internal modules

## API Design

- GraphQL-first: schema as the contract, leverage introspection
- Server is database-first via Postgraphile v5 (never code-first/Pothos); clients use graphql-request + graphql-codegen + TanStack Query (never urql/Apollo). See [AGENTS.md#graphql](./AGENTS.md)
- Client realtime uses GraphQL subscriptions (Postgraphile LISTEN/NOTIFY via the native v5 PgSubscriber, served over SSE by graphql-yoga and consumed with graphql-sse); reserve raw WebSockets/LiveKit for media transport and CloudEvents for server-to-server events
- Consistent error handling with proper error codes and extensions
- Document schemas with descriptions; keep them self-documenting
- REST only when GraphQL doesn't fit (webhooks, file uploads, health checks)

## URLs

- **Always lowercase**: paths, slugs, query-parameter keys, query-parameter values, and anchors. Never let camelCase or human display strings leak into a URL.
- **Path segments and slugs**: kebab-case (`/feedback-board`, `/in-progress`).
- **Query-parameter keys**: snake_case (`?excluded_statuses=…&sort_by=created_at&page_size=20`), not camelCase (`excludedStatuses`). camelCase introduces uppercase characters, which breaks the lowercase rule and reads as code leaking into the URL.
- **Query-parameter values**: stable lowercase identifiers, not display strings. Use a status `name` like `completed` / `in_progress`, never `Completed` or `In Progress`. For multiple values, repeat the key or comma-separate lowercase identifiers (`?excluded_statuses=completed,archived`).
- **Anchors/fragments**: kebab-case lowercase (`#getting-started`).
- **Scope**: this governs URLs and params your app owns (its own routes, search state, and calls to Omni-internal APIs, which should also use snake_case keys). **External/standard params keep their upstream name**: OAuth/OIDC (`client_id`, `redirect_uri`, `post_logout_redirect_uri`, `id_token_hint`), provider callbacks (`setup_action`, `installation_id`), and third-party API query params follow the external spec, not this convention. When a value also feeds a server-side filter (e.g. a GraphQL `displayName` vs `name`), change both together so the URL identifier and the query stay in sync.

## Accessibility

- Semantic HTML first; ARIA only when needed
- Keyboard navigable; visible focus states
- Sufficient color contrast; don't rely on color alone

## Tooling

Formatting and linting are required. Use configs from [templates](https://github.com/omnidotdev/templates).

## Git

Omni uses Extended Conventional Commits (ECC), an Omni-coined term for standard [Conventional Commits](https://www.conventionalcommits.org/) with full-word aliases for readability.

- **Default branch**: `master`
- **Format**: `type(scope): description`
- **Types**: `feature` (or `feat`), `fix`, `documentation` (or `docs`), `style`, `refactor`, `test`, `chore`, `build`, `ci`, `performance` (or `perf`), `revert`
- **Branch naming**: `feature/`, `fix/`, `chore/` prefixes
- **Atomic commits**: one focused, logical change per commit
- **No `!` suffix**: do not use `feat!:` or similar for breaking changes. Document breaking changes in PR descriptions and changesets instead

Optionally enforce with [commitlint](https://commitlint.js.org) + [husky](https://typicode.github.io/husky).

## Dependencies

- Prefer standard library when sufficient
- **[Renovate](https://docs.renovatebot.com)** for automated dependency updates
- Pin versions in lockfiles
- Audit regularly (`bun audit`, `cargo deny`)
- Justify new dependencies; prefer well-maintained packages

## Workflow

See [`CONTRIBUTING.md`](https://github.com/omnidotdev/.github/blob/master/CONTRIBUTING.md) for PR etiquette and contribution rules.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for project structure and orchestration patterns.
