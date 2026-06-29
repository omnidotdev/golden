# Omni AI Agent Rules

Canonical rules for AI agents working in Omni codebases. See [STYLEGUIDE.md](./STYLEGUIDE.md) for code style conventions. See [ARCHITECTURE.md](./ARCHITECTURE.md) for project structure patterns.

## General

- Never hallucinate paths, APIs, or environment variables
- Make minimal, focused changes
- Match existing patterns and style
- Code comments must never end with trailing punctuation (does not apply to doc comments like `///`, JSDoc, TSDoc, etc.)
- No em dashes in any output (use "to", commas, or parentheses instead)
- Never mention competitors by name

## Git

- Follow Extended Conventional Commits (ECC) per [STYLEGUIDE.md#git](./STYLEGUIDE.md#git)
- Never add `Co-Authored-By` lines to commits
- Default branch: `master`
- Breaking changes do not require a major semver bump in changesets

## Pull Requests

- Use the org PR template when creating PRs
- Do not invent custom PR body formats

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

- Table names must be **singular** (e.g. `product`, `order`, `store_setting`), not plural
- Never manually edit migration files, snapshots, or journal
- No custom SQL migrations, all migrations must go through `bun db:generate`
- If a CHECK constraint, index, or other DDL is needed, define it in the Drizzle schema and let `db:generate` produce the migration
- Avoid `pgEnum` for business logic (use `text()` with app-level validation)

## GraphQL

The canonical GraphQL stack for every project on this machine, not only repos under `~/projects/omni`. See [STYLEGUIDE.md#api-design](./STYLEGUIDE.md#api-design).

**Server (API): database-first via [Postgraphile v5](https://postgraphile.org).** Never hand-write the schema (no Pothos, Nexus, or other code-first builders).

- Mount with Elysia + `@elysiajs/graphql-yoga`; the schema comes from a Postgraphile preset in `src/lib/config/graphile.config.ts` (`PostGraphileAmberPreset` + `PgSimplifyInflectionPreset` + `PostGraphileConnectionFilterPreset`)
- Generate the schema from the Drizzle/Postgres tables via `bun graphql:generate` (`src/scripts/generateGraphqlSchema.ts`); always commit `schema.graphql` (it feeds client codegen). Run after `db:generate`/migrate; never edit the output. Pre-compiling an executable schema (`schema.executable.ts` via `exportSchema`) is recommended for pure-CRUD APIs (faster boot), but APIs with custom Grafast plans that close over runtime singletons should call `makeSchema(preset)` at boot instead, rather than wrapping every plan in `EXPORTABLE`
- Custom fields, mutations, and side effects go through Postgraphile/Grafast, not standalone resolvers: `makeExtendSchemaPlugin` for custom fields and mutations, Envelop `onExecute`/`onExecuteDone` hooks for post-mutation side effects (e.g. CloudEvents), `wrapPlans` for query filtering, smart tags (`jsonPgSmartTags`) to hide mutations. Plugins live in `src/lib/graphql/plugins/`
- Inject auth into the GraphQL context (e.g. `@envelop/generic-auth`); never resolve auth per-field by hand

**Client (App): [TanStack Query](https://tanstack.com/query) + [graphql-request](https://github.com/jasonkuhrt/graphql-request) + [graphql-codegen](https://the-guild.dev/graphql/codegen).** Never urql or Apollo Client.

- Write operations as `.graphql` documents under `src/lib/graphql/`; codegen (`codegen.config.ts`) emits React Query hooks to `src/generated/graphql.ts`
- A custom `graphqlFetch` wrapper (`src/lib/graphql/graphqlFetch.ts`) attaches auth; wrap generated hooks with query-options helpers in `src/options/`

**Realtime: GraphQL subscriptions.** Normalize client realtime onto GraphQL. Expose subscriptions server-side via Postgraphile LISTEN/NOTIFY using the native v5 `PgSubscriber` (from `postgraphile/adaptors/pg`) plus the grafast `listen` step (note: the `@graphile/pg-pubsub` package is Graphile v4 and does NOT work with v5). graphql-yoga serves subscriptions over SSE by default, so consume them client-side with [`graphql-sse`](https://github.com/enisdenjo/graphql-sse) (use `graphql-ws` only if a WebSocket transport is explicitly mounted). Prefer subscriptions over ad-hoc WebSockets. Reserve raw WebSockets and LiveKit data channels for media or binary transport, and CloudEvents via Vortex for server-to-server events.

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

- Source format: `omni.<product>` (identifies the product, not the deployment unit)
- Event type format: `<product>.<entity>.<action>` (e.g. `aether.subscription.changed`)
- Always use `createEventsProvider` from `@omnidotdev/providers`, never publish to Iggy directly
- Set `source` once at provider init in `src/lib/providers/index.ts`; all `events.emit()` calls inherit it
- Event schemas are registered in the Vortex seed file or in-service via `registerSchemas()` at boot

## Testing

Follow [STYLEGUIDE.md#testing](./STYLEGUIDE.md#testing).

## Dependencies

Follow [STYLEGUIDE.md#dependencies](./STYLEGUIDE.md#dependencies).
