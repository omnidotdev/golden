# Omni URL Grammar

Canonical, platform-wide URL convention for every Omni product. One grammar,
inherited from `_meta/templates/template-tanstack-start`, not reinvented per app.

**Status:** Approved 2026-08-18. Supersedes the design draft
`plans/2026-06-12-omni-url-grammar-design.md`.

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
   escape it as `[~]`.

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

---

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
