# Omni AI Agent Rules

Canonical rules for AI agents working in Omni codebases. See [STYLEGUIDE.md](./STYLEGUIDE.md) for code style conventions. See [ARCHITECTURE.md](./ARCHITECTURE.md) for project structure patterns. See [URL-GRAMMAR.md](./URL-GRAMMAR.md) for the platform-wide URL convention (`@handle` workspaces, `~` admin sentinel).

## General

- Never hallucinate paths, APIs, or environment variables
- Make minimal, focused changes
- Match existing patterns and style
- When scaffolding a new service/app/repo, start from the matching `template-*` in `~/projects/omni/_meta/templates/` (that directory is the source of truth: `ls` it for the current set; the names describe the stack) rather than hand-rolling or ad-hoc copying another product. If none fits, mirror the closest existing fleet service and say so
- Code comments must never end with trailing punctuation (does not apply to doc comments like `///`, JSDoc, TSDoc, etc.)
- No em dashes in any output (use "to", commas, or parentheses instead)
- Never mention competitors by name
- Terminology: use "whitelist"/"blacklist", never "allowlist"/"denylist" (applies to code identifiers, env vars, comments, and prose)
- Every Omni product must have a UNIQUE emoji icon. The icon is how a product is recognized at a glance everywhere it surfaces (nav, docs, footers, launchers, the "Made with `<symbol>` by Omni" credit), so two products sharing an emoji makes them indistinguishable. The catalog is the SSOT (`api-stack/services/api/src/lib/db/catalog/products.ts`) and uniqueness is locked by a test (`src/__tests__/catalog/products.test.ts`); when adding a product or picking an icon, pick one no other product uses. A product icon must also not reuse a REALM's icon (`realmMeta.ts`), since realms and products render side by side. Non-catalog products (internal tools, e.g. bifrost) must also not reuse a catalog product's or realm's emoji

## Documentation

- Keep docs in sync with the app: when a change alters user-facing behavior, features, commands, APIs, config, or flows, update the corresponding docs in the same change (product docs, README, a docs site/service, env templates). Applies to every project (Omni services, ThreadsCrush, Thraddies, and the rest)
- If docs covering the changed area exist but you can't update them, say so explicitly rather than leaving them silently stale
- This does not override the "never commit `docs/` without explicit consent" rule: make the doc updates in your working changes and surface them for review
- Order doc sections by the user journey, not by feature grouping or internal model. Sequence pages the way a real user sets up and adopts the product: intro, then getting started, then the setup a user does first (profile, preferences, and anything matching/output depends on), then the core feature loops, then advanced/secondary features, then paid tiers, with reference/utility pages (settings, safety, troubleshooting) pinned last. A feature page should not precede the setup it relies on. This applies to product/end-user and onboarding docs; for reference-heavy or API docs, organize by document type (tutorial / how-to / reference / explanation, per [Diátaxis](https://diataxis.fr)) rather than forcing a single linear journey, and keep reference entries grouped/alphabetized
- When you reorder a docs nav/manifest (e.g. `meta.json`), also reorder any in-page lists that mirror it (intro "Features" lists, overview tables) so the two stay consistent

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

## Access-gated features

When a feature is intentionally restricted to a subset of accounts (whitelist, admin/owner-only, beta testers, dev-mode or config gate), make the restriction visible in the UI to the users who can see it, do not ship it silently gated.

- Show an admin-style indicator on the gated surface: a clear label or badge such as "Admin only", "Restricted", or "Beta", so it is obvious the surface is not shown to all users
- Rationale: an unlabeled hidden feature is easy to forget it exists, accidentally widen to everyone, or misjudge in review. The label makes the limited visibility explicit
- The gate itself is enforced server-side (the label is UX, never the access control), and default to hidden when the gate is unset

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
