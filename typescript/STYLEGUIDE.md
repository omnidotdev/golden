# TypeScript & React Style Guide

If this conflicts with root `STYLEGUIDE.md`, **this file takes precedence**.

## Tooling

- **[Biome](https://biomejs.dev)** for formatting and linting
- **[Knip](https://knip.dev)** for dead code and unused dependency detection
- **[bun](https://bun.sh)** for package management and scripts
- `bun lint` / `bun test` exposed in all projects

## Pre-commit Hooks

Run in order via [husky](https://typicode.github.io/husky):

1. `bun knip` - catch unused code/dependencies
2. `bun biome check --write --staged` - format and lint
3. `bun tsc --noEmit` - type check

## TypeScript

- Strict mode always
- Prefer `type` over `interface` (use interface only for declaration merging)
- Avoid `any` (use `unknown`)
- Prefer union types over enums
- Use `satisfies` for type narrowing with inference

## Exports

- One export per file, `export default` at bottom
- Named exports allowed for: config files, barrel files, type definitions
- Barrel files must be small and explicit

## Imports

Use `@/` for internal imports:

```ts
import { db } from "@/lib/db";
```

Order (Biome enforces):

1. Node/Bun builtins
2. External packages
3. Internal modules (`@/*`)
4. Relative imports
5. Type imports (separated)

Avoid wildcard imports except for namespaced libraries (e.g. Radix primitives).

## Naming

- **PascalCase**: Components, types
- **camelCase**: Variables, functions, hooks
- **SCREAMING_SNAKE**: True constants (exported only)

File names:

- Components: `ComponentName.tsx`
- Hooks: `useThing.ts`
- Utils: `thing.ts`
- Tests: `*.test.ts`

## Error Handling

- Return `null`/`undefined` for expected failures (not found, empty results)
- Throw for unexpected failures (network errors, invalid state)
- Use typed error classes for domain-specific errors
- Error boundaries at route level minimum; component-level for isolated failures

## React

- One component per file
- Props type when non-trivial
- Prefer local state; context sparingly
- Use the project's CSS framework (e.g. Panda, Tailwind); avoid raw inline styles except for dynamic values

## Accessibility

- Semantic HTML first (`button`, `nav`, `main`); ARIA only when needed
- All interactive elements keyboard accessible
- Visible focus states; never `outline: none` without replacement
- Images need `alt`; decorative images use `alt=""`
- Form inputs need associated labels

## JSDoc

Common divergence points, normalized:

- **`@returns`** not `@return` (TypeScript convention)
- **No blank line** between description and tags
- **Hyphen after param name**: `@param name - Description`
- **Period at end** of descriptions
- **Skip obvious docs**: don't document self-evident params/returns
- **`@throws`** not `@exception`
- **`@example`** with language identifier:
  ````ts
  /**
   * Parse a timestamp.
   * @param input - ISO 8601 string.
   * @returns Parsed date or null if invalid.
   * @example
   * ```ts
   * parseTimestamp("2024-01-01T00:00:00Z");
   * ```
   */
  ````

## Discouraged

- `any` without justification
- Giant barrel re-exports
- Wildcard imports (prefer explicit)
- Inline styles (except dynamic values)
- Files growing unwieldy (split them)
