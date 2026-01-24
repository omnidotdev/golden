# Rust Style Guide

If this conflicts with root `STYLEGUIDE.md`, **this file takes precedence**.

## Tooling

- **[rustfmt](https://rust-lang.github.io/rustfmt)** for formatting
- **[Clippy](https://doc.rust-lang.org/clippy)** with `clippy::pedantic` preferred (`-D warnings` acceptable per-project)
- **[cargo-deny](https://embarkstudios.github.io/cargo-deny)** for dependency auditing

Expose: `cargo fmt --check && cargo clippy && cargo test`

## Structure

```
src/
  lib.rs
  main.rs (thin entry point only)
  module_name/
tests/
```

Lib-first: put logic in `lib.rs`, not `main.rs`.

## Naming

- **snake_case**: modules, functions, variables
- **PascalCase**: types, enums, structs, traits
- **SCREAMING_SNAKE**: constants
- Acronyms: `HttpClient`, `JsonValue` (Rust convention)

## Derives

- Always `#[derive(Debug)]` on structs/enums
- `Clone` only when semantically appropriate (not for resource handles)
- Consider `Default`, `PartialEq` when useful

## Error Handling

- Use `Result<T, E>` for fallible operations
- **[thiserror](https://docs.rs/thiserror)** for library error types (typed, composable)
- **[anyhow](https://docs.rs/anyhow)** for application error handling (context, backtraces)
- Propagate with `?`; handle at appropriate level
- Add context: `.context("failed to parse config")?`

## Logging

Use **[tracing](https://docs.rs/tracing)**, not `log`. Never log secrets.

```rust
tracing::info!(user_id = %id, "user logged in");
```

## Imports

Order:

1. `std::` modules
2. External crates
3. Internal modules

Sort alphabetically within groups.

## Doc Comments

Common divergence points, normalized:

- **`///`** for items, **`//!`** for module-level docs only
- **First line is the summary**: one sentence, imperative mood
- **Blank line** between summary and body
- **Standard sections** (in order): `# Examples`, `# Errors`, `# Panics`, `# Safety`
- **`# Examples`** required for public APIs; use `rust` code blocks
- **`# Errors`** required if returning `Result`
- **`# Panics`** required if function can panic
- **`# Safety`** required for `unsafe` functions
- **Intra-doc links**: `[`OtherType`]` not full paths
- **Skip private items** unless complex

````rust
/// Parse a timestamp from an ISO 8601 string.
///
/// Returns `None` if the input is malformed.
///
/// # Examples
///
/// ```rust
/// let ts = parse_timestamp("2024-01-01T00:00:00Z");
/// assert!(ts.is_some());
/// ```
````

## Release Profile

For binaries, optimize for size and performance:

```toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
```

## Discouraged

- `unwrap()` / `expect()` in non-test code (use `?` or handle explicitly)
- Global mutable state (`static mut`)
- `unsafe` without justification
- Catch-all error handling without context
- Files growing unwieldy (split into modules)
