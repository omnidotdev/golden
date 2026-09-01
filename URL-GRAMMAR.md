# Omni URL Grammar

Canonical, platform-wide URL convention for every Omni product. One grammar,
inherited from `_meta/templates/template-tanstack-start`, not reinvented per app.

**Status:** Approved 2026-08-18; reaffirmed and rolled out fleet-wide 2026-09-01.
Supersedes the design draft `plans/2026-06-12-omni-url-grammar-design.md`.

The canonical shape is `@{$workspaceSlug}` for the handle segment and the `~`
sentinel for admin, inherited from `_meta/templates/template-tanstack-start` and
applied uniformly by every product.

---

## The grammar at a glance

```
/@acme                          workspace / org home
/@acme/my-board                 a user-minted resource (slug), any app
/@acme/my-board/API-42          an item inside it (see "Items")
/@acme/~/settings               workspace admin, behind the ~ sentinel
/@acme/~/members
/explore  /pricing  /login      app pages (no @, global)
/api/...                        programmatic, stays explicit and verbose
```

- `@handle` is the workspace/org namespace.
- `~` is the **admin sentinel**: everything after `/~/` is app UI, never a
  user-named slug.
- The public spine (`@handle`, resources) stays short and brandable. Admin and
  API stay explicit, because nobody shares those.

---

## The three collision layers, and how each is solved

A handle-based URL scheme has to answer three separate "what if two things want
the same URL" questions. All three are handled; none rely on a maintained
blocklist.

| Layer | Question | Solution |
|---|---|---|
| **1. Handle uniqueness** | Can a user `@brian` and an org `@brian` both exist? | **No.** Gatekeeper enforces a single unified namespace across usernames and org slugs (`NamespaceAvailability` in `@omnidotdev/providers`). Every `@handle` resolves to exactly one entity, platform-wide. |
| **2. Handle vs app route** | Does `/@brian` collide with `/explore`? | **No.** The `@` prefix is itself the separator. Handles are always `@`-prefixed; global app pages never are. |
| **3. User slug vs admin route** | Does a board named "settings" collide with the settings page? | **No.** Admin lives behind `/~/`. A board named "settings" is `/@acme/settings`; workspace settings is `/@acme/~/settings`. |

Layer 1 is owned by identity (Gatekeeper) and already built. Layers 2 and 3 are
owned by this grammar.

---

## Rules

1. **Workspaces/orgs are `@handle`, path-based.** `/@acme/...`, never
   `/workspaces/acme/...` or `/org/{uuid}/...`. Path-based, not subdomain: one
   origin keeps auth, CORS, OG, and CDN trivial.

2. **The workspace stays in the URL.** Admin is scoped by the handle in the
   path (`/@acme/~/settings`), not by a global "active workspace" switcher.
   This is a one-way door: it is required so a user can open two workspaces in
   two tabs at once (agencies on Halo/Fractal, multi-client Backfeed/Runa). You
   cannot retrofit it later without breaking shared links.

3. **User-minted slugs are flat under the handle.** `/@acme/my-board`, not
   `/@acme/projects/my-board`. The resource type is implied by position.

4. **Admin routes live behind the `~` sentinel.** `/@acme/~/settings`,
   `/@acme/~/members`, `/@acme/~/billing`. `~` means "the workspace's own
   system area" (Unix `~` = home; Bitbucket `~user`). It is an RFC 3986
   unreserved character (safe unencoded everywhere) and is **not** a TanStack
   Router token; if a raw `~` directory ever confuses the route generator,
   escape it as `[~]`. The sentinel applies **uniformly at every resource
   level**: a resource nested under the handle keeps its own admin behind `~`
   too (`/@acme/roadmap/~/settings`), never flat (`/@acme/roadmap/settings`).
   One rule, no exceptions. Reserving `~` at each level up front is the cheap,
   reversible move: it costs a slightly longer admin URL (which nobody shares)
   and guarantees no future admin route or free-form child slug ever forces a
   link-breaking migration to carve the sentinel in later.

5. **Items carry a self-describing key.** `/@acme/my-board/API-42-login-bug`,
   where `API-42` (prefix + per-project number) is the canonical key and the
   trailing slug is decorative and 301s to canonical when stale. Keep the
   prefix even though the project is in the path: `Fixed in API-42` must be
   self-describing when pasted into a changelog, PR, or another product.

6. **Shorten only the public spine.** `@` replaces `/workspaces/`; position
   replaces `/projects/`. Never abbreviate a noun into something cryptic
   (`/ws/acme/pr/...`). Admin (behind `~`) and the API stay verbose.

7. **Global app pages have no handle.** `/explore`, `/pricing`, `/login`,
   `/-/status` style system pages live at the root without an `@`.

8. **User slugs are bare and start alphanumeric; the platform owns every
   sigil-prefixed segment.** A project/board/store is `@acme/roadmap`, never
   `@acme/@roadmap` or `@acme/+roadmap`. `@` marks a globally-unique registered
   identity (the workspace/org) and appears **exactly once** per URL; a project
   slug is only unique within its workspace, so it carries no `@`. Enforce
   fleet-wide that a user-minted slug must begin with a letter or number: this
   keeps the primary resource bare and brandable today, keeps `~` safe forever,
   and reserves all leading-punctuation space so any future typed namespace
   (`&team`, `+doc`) slots in with no link-breaking migration. `~` is the only
   such platform sigil in use today.

9. **Org is 1:1 with workspace; the canonical route param is `workspaceSlug`.**
   A workspace is a polymorphic Omni org (personal or brand account), so the
   `@handle` IS the workspace, one level, never an org that contains nested
   sub-workspaces. The handle route segment is `@{$workspaceSlug}` (with braces,
   for the TanStack route generator), fleet-wide. Do NOT spell it `@$orgSlug`,
   `@{$orgSlug}`, or `@{$username}`. Nested resources under the workspace carry
   their own descriptive param (`$storeSlug`, `$boardSlug`, ...), never a second
   workspace level. Renaming an existing product's handle param to
   `workspaceSlug` is URL-invariant (only the code identifier changes, not the
   `/@acme/...` URL), so it needs no redirect.

---

## Why the `~` sentinel: the core trade-off

Layer 3 (a user-minted slug vs a fixed admin route at the same level) is the only
hard collision, and there are exactly three ways to resolve it without a runtime
blocklist. You can have at most two of these three properties:

| Want | Cost |
|---|---|
| flat user slugs (`/@acme/roadmap`) + no blocklist | needs a **sentinel** (our `~`) |
| flat user slugs + no sentinel | needs a **reserved-word blocklist** |
| no sentinel + no blocklist | user slugs **can't be flat** (nest them under a code-owned collection, e.g. `/@acme/boards/roadmap`) |

Omni picks **flat slugs + `~`**, for two reasons:

1. **We want flat, brandable resource URLs.** The products that let a user mint a
   resource directly under the handle are exactly the ones whose URL is public and
   brand-facing: a git repo (`/@owner/repo`, the universal forge convention), a
   storefront, a public roadmap. `/@acme/roadmap` beats `/@acme/boards/roadmap`
   for the links people actually paste.
2. **The sentinel's cost lands only where nobody looks.** `~` prefixes admin and
   system routes, which are never shared. The public spine people do share
   (`/@acme`, `/@acme/roadmap`) is already sentinel-free. So we get the brandable
   flat slug in the shared links AND no maintained blocklist, and the only oddness
   hides in admin URLs.

**Industry framing.** GitHub takes "flat slugs + blocklist" (`/user/repo`, with a
reserved-word list). YouTube takes "no sentinel + no flat slugs": under a
`/@channel` handle it exposes only a *closed, code-owned* set of tabs
(`/videos`, `/shorts`, `/about`) with no custom slugs, puts real user content at
global ID routes (`/watch?v=…`), and runs creator admin on a separate host
(`studio.youtube.com`). YouTube never hits Layer 3 because it never allows a
human-named resource flat under the handle. Omni does want that, so it pays for it
with `~`.

**This is reversible; it is not a one-way door** (unlike Rule 2). Dropping `~` from
admin is free later — admin URLs are never shared, so no redirects. Adding
collection segments to user slugs later is a standard "301 forever" migration. In
both directions the `/@handle` identity spine (the part in bios and bookmarks)
never moves, so the durable anchor is safe. The one discipline that keeps the door
open: keep every shared resource link anchored under `@handle` with a
self-describing key, never a raw UUID and never a feature-first path.

## Decisions we did NOT take, and why

- **Reserved-word blocklist** (GitHub/Linear). Rejected: it is a permanent
  maintenance tax, and adding any new admin route can retroactively collide
  with a slug a user already minted. `~` needs no list.
- **ID-suffixed slugs everywhere** (Notion/Linear/Vercel). Rejected as the
  *primary* strategy: it keeps admin clean but puts an ID in the **shared**
  user URLs, which are exactly the ones that must stay pristine. We use the
  ID/self-describing key only where an item genuinely needs one (Rule 5), not
  on the shareable workspace/resource spine.
- **`-` sentinel** (GitLab's `/-/`). Rejected in favor of `~`: `~` already
  carries the "home/system" meaning, so it reads as intent rather than an
  arbitrary divider.
- **Subdomain-per-workspace** (Slack). Rejected: Shopify migrated *away* from
  this to path-based tenancy; subdomains complicate auth, CORS, and certs.

---

## Migration and redirects

- **Template first.** Land `@handle` routing, the `~` sentinel group, flat
  resource routes, and the item key resolver in
  `_meta/templates/template-tanstack-start`, then propagate.
- **301 forever.** Legacy paths (`/workspaces/{slug}/...`, `/org/{uuid}/...`,
  UUID item URLs) permanently redirect to the new spine so existing shared
  links survive. Stale item slugs redirect to the canonical key.
- **No reserved-slug migration** is needed, thanks to `~`.
- **Greenfield and unlaunched apps keep NO redirect stubs.** "301 forever" exists
  only to protect real external links. An app with no pre-existing shared links
  (unlaunched, or never on the old scheme) adopts the spine directly and deletes
  the old route trees outright, rather than carrying dead passthrough/redirect
  stubs. Do not leave legacy scaffolding behind where nothing links to it.

---

## Per-app examples

```
Crystal   /@aerial-biotechnics                creator/org public page
          /@aerial-biotechnics/~/members       manage members
          /org/{uuid}/members            -->    301 to the above

Backfeed  /@acme/roadmap                       a board (user-minted slug)
          /@acme/roadmap/FEAT-12                a feedback item
          /@acme/~/settings                     workspace settings
          /workspaces/acme/...           -->    301 to the new spine

Halo      /@store                              storefront
          /@store/~/orders                      admin
```

---

## Reference

- Handle namespace + uniqueness: `@omnidotdev/providers`
  (`src/auth/gatekeeperOrg.ts`, `NamespaceAvailability`).
- `~` safety: RFC 3986 unreserved character set.
- Router tokens: TanStack Router file-based routing reserves `$` (param),
  `_` (pathless), `[]` (literal escape); `~` is free.
