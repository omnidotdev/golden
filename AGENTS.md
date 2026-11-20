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
- Tenancy terminology: the tenant a user belongs to is a **"workspace"** in all USER-FACING copy (labels, headings, buttons, placeholders, toasts, nav, docs, marketing). It maps 1:1 to an Omni org (see [URL-GRAMMAR.md](./URL-GRAMMAR.md) Rule 9). Keep **"organization"** only in CODE and identity internals (the Better Auth `organization` plugin, `authClient.organization.*`, DB tables/columns, GraphQL fields, `*.organization.*` CloudEvent types, the `workspaceSlug` route param stays as-is). "Team" is reserved for org-internal sub-groups only, never the tenant itself. A creator's public identity is their `@handle` page, never called a "workspace". **Product-owned UI identifiers follow the display term** (normalized fleet-wide 2026-10-18): the React provider/hook/context (`WorkspaceProvider`, `useWorkspace`, the local JWT-claim model type `Workspace` and its `workspaces`/`activeWorkspace`/`personalWorkspace`/etc context fields), the `CreateWorkspaceButton`/`WorkspaceSwitcher`/`WorkspacesConsole` components, and their files (`workspace.context.tsx`, `components/workspaces/`) are named "workspace". **But the Better Auth `organization` entity and every wire/storage/URL contract stay "organization" permanently** - they cannot be renamed without forking Better Auth or breaking cross-service consumers: `authClient.organization.*` and `.organization.` session/result property access, the JWT `claims/organizations` wire key + `OrganizationClaim` type, DB tables/columns, GraphQL fields + `organizationId` args, `*.organization.*` CloudEvent types, authz tuples, generated code, the TanStack route-context `organizations` field, and the `/organizations` route URLs + `$workspaceSlug` param. A nested resource WITHIN a workspace is a **"Resource"** (keyed on `$resourceSlug`), never a second "workspace" level (URL-GRAMMAR Rule 9). Rule of thumb: if an identifier is ours and lives in the product/UI layer, it is "workspace"; if it is Better Auth's, a wire/storage contract, or a URL, it is "organization"
- Every Omni product must have a UNIQUE emoji icon. The icon is how a product is recognized at a glance everywhere it surfaces (nav, docs, footers, launchers, the "Made with `<symbol>` by Omni" credit), so two products sharing an emoji makes them indistinguishable. The catalog is the SSOT (`api-stack/services/api/src/lib/db/catalog/products.ts`) and uniqueness is locked by a test (`src/__tests__/catalog/products.test.ts`); when adding a product or picking an icon, pick one no other product uses. A product icon must also not reuse a REALM's icon (`realmMeta.ts`), since realms and products render side by side. Non-catalog products (internal tools, e.g. bifrost) must also not reuse a catalog product's or realm's emoji

## Documentation

- Keep docs in sync with the app: when a change alters user-facing behavior, features, commands, APIs, config, or flows, update the corresponding docs in the same change (product docs, README, a docs site/service, env templates). Applies to every project (Omni services, ThreadsCrush, Thraddies, and the rest)
- If docs covering the changed area exist but you can't update them, say so explicitly rather than leaving them silently stale
- This does not override the "never commit `docs/` without explicit consent" rule: make the doc updates in your working changes and surface them for review
- Order doc sections by the user journey, not by feature grouping or internal model. Sequence pages the way a real user sets up and adopts the product: intro, then getting started, then the setup a user does first (profile, preferences, and anything matching/output depends on), then the core feature loops, then advanced/secondary features, then paid tiers, with reference/utility pages (settings, safety, troubleshooting) pinned last. A feature page should not precede the setup it relies on. This applies to product/end-user and onboarding docs; for reference-heavy or API docs, organize by document type (tutorial / how-to / reference / explanation, per [Diátaxis](https://diataxis.fr)) rather than forcing a single linear journey, and keep reference entries grouped/alphabetized
- When you reorder a docs nav/manifest (e.g. `meta.json`), also reorder any in-page lists that mirror it (intro "Features" lists, overview tables) so the two stay consistent
- Write docs in an **impersonal voice**: address the reader in the second person ("you") or the imperative mood ("Run the server", "Add a script"), and use neutral constructions where neither fits ("The server listens on port 3000"). Do not narrate in the first-person plural (the "editorial we": "we will", "our app", "let's"), and avoid the first-person singular ("I"). This matches the singular-imperative rule for code comments in [STYLEGUIDE.md](./STYLEGUIDE.md). Also drop chatty filler and author asides ("feel free to", "of course", "a bit rough and ready", "more on that later")

## Git

- Follow Extended Conventional Commits (ECC) per [STYLEGUIDE.md#git](./STYLEGUIDE.md#git)
- Never add `Co-Authored-By` lines to commits
- Default branch: `master`

## Changesets and changelogs

Every repo that ships something people use records its user-facing changes with [Changesets](https://github.com/changesets/changesets) and releases through the Changesets release workflow. Changelog history cannot be reconstructed later, and release tags mark exactly what shipped when (rollbacks, incident timelines, public release notes), so start on day one, even while a product is private.

- **In scope**: product apps (web, desktop, mobile), product APIs and services, packages and SDKs (npm or git-dependency), CLIs. When unsure, it is in scope. **Exempt**: IaC (`infra`), stack metarepos, content/meta repos (`golden`, `plans`, docs content), and marketing or docs sites (`*-site`, docs apps), whose changes no reader tracks
- **Setup** (every in-scope repo): `.changeset/config.json` whose changelog `repo` points at the repo itself, plus `.github/workflows/release.yml`. Copy the template that matches: `template-typescript-library` for published packages, `template-tanstack-start` / `template-elysia` for private apps and services (`privatePackages.tag: true` tags the release, nothing is published). A `.changeset/` directory without a release workflow (or one pointing at another repo) is a gap: close it when you find it
- **When to add one**: in the same PR as any change a user, developer, or operator would notice (features, fixes, behavior, API shape, UI copy, performance, security fixes). Skip it for docs-only, test-only, CI, and refactors or dependency bumps with no behavior change
- **Never a CI gate**: a missing changeset must not fail a check. It is a review expectation, not a blocker, so docs or chore PRs (and outside contributors) are never stuck
- **Write it for the product's users**, as it would read in public release notes: what changed and why it matters, in plain language and the impersonal voice. No internal service names, infra, file paths, or ticket links. For security fixes, describe the effect ("Tightened access to tracked links"), never an exploit recipe
- **Bump**: `patch` for fixes, `minor` for features. Breaking changes do not require a major bump; call them out in the changeset body
- **Never release by hand**: no hand-edited versions, `CHANGELOG.md` entries, or tags, and no manual `npm publish`. A release happens only by merging the "version packages" PR the workflow opens

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

## Destructive actions

Any destructive or irreversible user action must be guarded by an explicit confirmation step before the mutation fires. A single click (or misclick) must never permanently delete, remove, revoke, discard, or overwrite user data.

- Applies to: delete/remove/revoke/discard/reset/overwrite/leave/disconnect, hard AND soft deletes (a soft delete still disappears from the user's view), bulk actions, and anything the user cannot trivially undo in the UI
- Confirm with a dialog, not a native `window.confirm`: use the shared `ConfirmDialog` primitive where a product has one (e.g. crystal-app `src/components/ui/confirm-dialog.tsx`), otherwise build one on the product's dialog primitive. Name the specific target in the copy ("Delete tier \"Gold\"?") and state that it cannot be undone
- The confirm button carries the destructive styling (e.g. `variant="destructive"`), the dialog cannot be dismissed while the action is in flight, and the action stays disabled until confirmed
- This is UX, not authorization: still enforce the actual permission server-side
- When adding any new destructive action, wire the confirmation in the same change; do not ship the unguarded action first

## Empty states

An empty state is a starting point, never a dead end. Every empty list, table, or panel must tell the user what belongs there and hand them the control that fills it.

- **Carry the action, don't describe it.** When the user can resolve the empty state, render the action as a real control: a button that opens the create form, or a link to the page where it happens. Copy that names another surface without linking to it ("Use a future send time in Compose") is a defect
- **Lead with the missing prerequisite.** If the action needs something that does not exist yet (a broadcast needs an audience and a verified domain), point at that first, so the user is never sent into a form they cannot complete
- **"Nothing yet" is not "nothing matches".** When a search or filter is active, say so and offer "Clear filters" instead of the first-run copy
- **Gated states link to the upgrade path**, not just a sentence saying a plan is required
- **Respect permissions.** Do not offer an action the viewer cannot take; say who can
- **Passive states may omit the action.** Lists the system fills on its own (suppressions, audit events) explain what will populate them; link to the docs or settings that control them when one exists
- **Errors are not empty states.** A failed load shows a generic, actionable message with a retry, never the empty-state copy and never a raw error
- Use the product's shared `EmptyState` primitive with its action slot (e.g. herald-app `src/components/EmptyState.tsx`, `action` / `secondaryAction`); do not hand-roll one per page

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
