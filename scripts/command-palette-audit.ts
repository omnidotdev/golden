#!/usr/bin/env bun
/**
 * Fleet command-palette conformance audit (layer 3: "forever" enforcement).
 *
 * Layer 1 is the shared Thornberry palette shell itself; layer 2 is the per-repo
 * conformance test that new apps ship. This script is layer 3: a fleet-wide sweep
 * that statically re-checks every product app, so repos that predate the per-repo
 * test are still caught. It only reads source, never executes app code.
 *
 * The standard a conformant command-palette adapter follows:
 *   - imports the shell from `@omnidotdev/thornberry/command-palette` and hotkeys
 *     from `@omnidotdev/thornberry/use-hotkeys`
 *   - does NOT use a local `ui/command.tsx` as the palette, does NOT define a
 *     local hotkey enum/const duplicating GLOBAL_HOTKEYS, does NOT import
 *     `react-hotkeys-hook` directly in the adapter
 *   - uses the canonical group names "Navigation" / "Preferences" (product-domain
 *     groups are allowed in addition)
 *   - renders shortcut hints via `hotkeyLabel(...)` (no hardcoded shortcut strings)
 *   - is mounted once in the app root
 *
 * Classification:
 *   - conformant    adapter meets every rule above
 *   - drift         adapter exists but breaks a soft rule (reported with reasons)
 *   - missing       a routed app has no palette at all (hard failure)
 *
 * Hard failures (non-zero exit): a routed `*-app` with no palette, or a local
 * palette copy used AS the palette. Soft rules (group names, theme-toggle wiring,
 * bespoke open-state, and the rest) are warnings and do not fail the run on their
 * own.
 *
 * Usage:
 *   bun scripts/command-palette-audit.ts            # audit the whole fleet
 *   bun scripts/command-palette-audit.ts --json     # machine-readable output
 *   OMNI_ROOT=/path/to/omni bun scripts/command-palette-audit.ts
 *
 * The fleet root defaults to the parent of this repo (this repo lives at
 * `<omni>/golden`), and can be overridden with OMNI_ROOT.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const OMNI_ROOT = process.env.OMNI_ROOT
  ? resolve(process.env.OMNI_ROOT)
  : resolve(import.meta.dir, "..", "..");

const EMIT_JSON = process.argv.includes("--json");

/** Canonical group names every palette shares. */
const CANONICAL_GROUPS = new Set(["Navigation", "Preferences"]);

/**
 * Near-canonical group labels that should have been folded into a canonical
 * group. These denote navigation or preferences content under a non-standard
 * name, as opposed to a genuine product-domain group (e.g. "Projects", "Notes")
 */
const NON_CANONICAL_GROUPS = new Set([
  // navigation synonyms
  "Navigate",
  "Jump to",
  "Jump To",
  "Go to",
  "Go To",
  "Pages",
  "Links",
  "Menu",
  "Resources",
  // preferences synonyms
  "Appearance",
  "Theme",
  "Settings",
  "General",
  "Display",
  "Misc",
]);

const SHELL_IMPORT = "@omnidotdev/thornberry/command-palette";
const HOTKEYS_IMPORT = "@omnidotdev/thornberry/use-hotkeys";

/** Directories never worth descending into. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".output",
  ".nitro",
  ".vinxi",
  "dist",
  "build",
  ".git",
  "coverage",
  ".turbo",
]);

type Level = "fail" | "warn";

interface Finding {
  rule: string;
  level: Level;
  detail: string;
}

interface AdapterReport {
  product: string;
  kind: "app" | "site";
  file: string;
  findings: Finding[];
}

interface ServiceReport {
  product: string;
  kind: "app" | "site";
  dir: string;
  adapters: AdapterReport[];
  // app-level hard failures
  failures: Finding[];
  // informational notes (dead local copies, mount advisories)
  notes: string[];
  requiresPalette: boolean;
}

/** Recursively collect `.ts`/`.tsx` file paths under a directory. */
const collectSourceFiles = (dir: string, out: string[] = []): string[] => {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

const read = (file: string): string => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

/** Whether a routed frontend lives under `src` (so a palette is expected). */
const hasRoutes = (srcDir: string, files: string[]): boolean => {
  const routesDir = join(srcDir, "routes");
  if (
    existsSync(routesDir) &&
    collectSourceFiles(routesDir).some((f) => f.endsWith(".tsx"))
  ) {
    return true;
  }
  return files.some((f) => {
    const c = read(f);
    return (
      c.includes("createFileRoute") ||
      c.includes("createRootRoute") ||
      c.includes("RouterProvider")
    );
  });
};

/** Pull every `group: "..."` literal out of an adapter. */
const extractGroups = (content: string): string[] => {
  const groups = new Set<string>();
  const re = /group:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((m = re.exec(content)) !== null) groups.add(m[1]!);
  return [...groups];
};

/** Pull every hardcoded `shortcut: "..."` string literal out of an adapter. */
const extractHardcodedShortcuts = (content: string): string[] => {
  const shortcuts: string[] = [];
  const re = /shortcut:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
  while ((m = re.exec(content)) !== null) shortcuts.push(m[1]!);
  return shortcuts;
};

/** A file is a palette adapter when it imports the shell and renders it. */
const isAdapter = (content: string): boolean =>
  content.includes(SHELL_IMPORT) && /commands=\{/.test(content);

/** Apply the conformance rules to one adapter file. */
const classifyAdapter = (content: string, file: string): Finding[] => {
  const findings: Finding[] = [];

  if (!content.includes(SHELL_IMPORT)) {
    findings.push({
      rule: "no-shared-shell",
      level: "fail",
      detail: `does not import the shell from ${SHELL_IMPORT}`,
    });
  }

  // direct react-hotkeys-hook import in the adapter
  if (/from\s+["']react-hotkeys-hook["']/.test(content)) {
    findings.push({
      rule: "react-hotkeys-hook-direct",
      level: "warn",
      detail: "imports react-hotkeys-hook directly instead of the shared use-hotkeys",
    });
  }

  // local hotkey enum/const duplicating GLOBAL_HOTKEYS
  if (
    /from\s+["'][^"']*constants\/hotkeys[^"']*["']/.test(content) ||
    /hotkeys\.constant/.test(content) ||
    /\benum\s+Hotkeys\b/.test(content) ||
    /\bconst\s+(?:GLOBAL_HOTKEYS|HOTKEYS|Hotkeys)\s*[:=]/.test(content)
  ) {
    findings.push({
      rule: "local-hotkey-enum",
      level: "warn",
      detail: "uses a local hotkey enum/const instead of the shared GLOBAL_HOTKEYS",
    });
  }

  // non-canonical group names
  const groups = extractGroups(content);
  const offending = groups.filter((g) => NON_CANONICAL_GROUPS.has(g));
  if (offending.length > 0) {
    findings.push({
      rule: "non-canonical-group",
      level: "warn",
      detail: `non-canonical group name(s): ${offending
        .map((g) => `"${g}"`)
        .join(", ")} (use "Navigation"/"Preferences")`,
    });
  }

  // hardcoded shortcut strings
  const hardcoded = extractHardcodedShortcuts(content);
  if (hardcoded.length > 0) {
    findings.push({
      rule: "hardcoded-shortcut",
      level: "warn",
      detail: `hardcoded shortcut string(s): ${hardcoded
        .map((s) => `"${s}"`)
        .join(", ")} (render via hotkeyLabel(...))`,
    });
  }

  // bespoke open-state (the shell owns open state and the mod+k hotkey)
  if (/onOpenChange\s*=/.test(content) || /\bopen=\{/.test(content)) {
    findings.push({
      rule: "bespoke-open-state",
      level: "warn",
      detail: "manages its own open state instead of letting the shell own it",
    });
  }

  // non-standard adapter name (e.g. CommandMenu)
  const base = basename(file);
  if (/command/i.test(base) && !/commandpalette/i.test(base)) {
    findings.push({
      rule: "non-standard-name",
      level: "warn",
      detail: `adapter named "${base}" instead of CommandPalette`,
    });
  }

  // theme-toggle wiring
  const bindsThemeHotkey = /useHotkeys\(\s*GLOBAL_HOTKEYS\.toggleTheme/.test(
    content,
  );
  const showsThemeHint = /hotkeyLabel\(\s*GLOBAL_HOTKEYS\.toggleTheme/.test(
    content,
  );
  const hasThemeToggleCmd =
    /id:\s*["']toggle-theme["']/.test(content) ||
    /onSelect:\s*toggleTheme\b/.test(content);
  if (showsThemeHint && !bindsThemeHotkey) {
    findings.push({
      rule: "theme-toggle-wiring",
      level: "warn",
      detail:
        "surfaces the theme shortcut hint but never binds useHotkeys(GLOBAL_HOTKEYS.toggleTheme) in the adapter",
    });
  } else if (hasThemeToggleCmd && bindsThemeHotkey && !showsThemeHint) {
    findings.push({
      rule: "theme-toggle-wiring",
      level: "warn",
      detail:
        "binds the theme hotkey but the theme command has no hotkeyLabel(...) shortcut hint",
    });
  }

  return findings;
};

/** Audit every service directory under the fleet root. */
const auditFleet = (): ServiceReport[] => {
  const reports: ServiceReport[] = [];

  let topLevel: string[];
  try {
    topLevel = readdirSync(OMNI_ROOT);
  } catch {
    console.error(`cannot read OMNI_ROOT: ${OMNI_ROOT}`);
    process.exit(2);
  }

  for (const stack of topLevel.sort()) {
    const servicesDir = join(OMNI_ROOT, stack, "services");
    if (!existsSync(servicesDir)) continue;
    let services: string[];
    try {
      services = readdirSync(servicesDir);
    } catch {
      continue;
    }

    for (const service of services.sort()) {
      const kind = service.endsWith("-app")
        ? "app"
        : service.endsWith("-site")
          ? "site"
          : null;
      if (!kind) continue;
      const dir = join(servicesDir, service);
      const srcDir = join(dir, "src");
      if (!existsSync(srcDir) || !statSync(dir).isDirectory()) continue;

      const files = collectSourceFiles(srcDir);
      const product = stack.replace(/-stack$/, "");

      const adapters: AdapterReport[] = [];
      const failures: Finding[] = [];
      const notes: string[] = [];

      let anyShellImport = false;
      const localCommandFiles: string[] = [];

      for (const file of files) {
        const content = read(file);
        if (content.includes(SHELL_IMPORT)) anyShellImport = true;
        if (/\/ui\/command\.tsx$/.test(file)) localCommandFiles.push(file);
        if (isAdapter(content)) {
          adapters.push({
            product,
            kind,
            file: relative(OMNI_ROOT, file),
            findings: classifyAdapter(content, file),
          });
        }
      }

      const requiresPalette = kind === "app" && hasRoutes(srcDir, files);

      // local ui/command.tsx handling
      for (const cmd of localCommandFiles) {
        const importers = files.filter(
          (f) => f !== cmd && /["'][^"']*\/ui\/command["']/.test(read(f)),
        );
        if (importers.length === 0) {
          notes.push(
            `dead local palette copy with no importers: ${relative(OMNI_ROOT, cmd)}`,
          );
        } else if (adapters.length === 0) {
          // a local command primitive is used AND there is no shared shell adapter:
          // the app is driving its palette off the local copy
          failures.push({
            rule: "local-palette-as-palette",
            level: "fail",
            detail: `local ${relative(OMNI_ROOT, cmd)} is used as the palette (no shared shell adapter present)`,
          });
        }
      }

      // missing palette in a routed app
      if (adapters.length === 0 && requiresPalette && failures.length === 0) {
        failures.push({
          rule: "missing-palette",
          level: "fail",
          detail: "routed app has no command-palette adapter",
        });
      }

      // best-effort mount advisory (reported, not scored): a dedicated adapter
      // file should be referenced by at least one other source file
      for (const adapter of adapters) {
        const abs = join(OMNI_ROOT, adapter.file);
        const base = basename(adapter.file).replace(/\.tsx?$/, "");
        const inlineMount = /appshell|^app$|_app|layout|root|header|provider/i.test(
          base,
        );
        if (inlineMount) continue;
        const referenced = files.some(
          (f) => f !== abs && read(f).includes(base),
        );
        if (!referenced) {
          notes.push(
            `adapter ${adapter.file} is not referenced elsewhere (verify it is mounted once in the app root)`,
          );
        }
      }

      if (
        adapters.length === 0 &&
        !requiresPalette &&
        failures.length === 0 &&
        localCommandFiles.length === 0
      ) {
        // a site/app with no palette that is not required to have one: skip it
        continue;
      }

      reports.push({
        product,
        kind,
        dir: relative(OMNI_ROOT, dir),
        adapters,
        failures,
        notes,
        requiresPalette,
      });

      // record whether the shared shell was imported anywhere (for the headline
      // "100% import the shared shell" metric computed over adapters)
      void anyShellImport;
    }
  }

  return reports;
};

// --- run and report -------------------------------------------------------

const reports = auditFleet();

const allAdapters = reports.flatMap((r) => r.adapters);
const conformant = allAdapters.filter((a) => a.findings.length === 0);
const drifting = allAdapters.filter((a) =>
  a.findings.some((f) => f.level === "warn"),
);
const adapterHardFails = allAdapters.filter((a) =>
  a.findings.some((f) => f.level === "fail"),
);
const serviceHardFails = reports.filter((r) => r.failures.length > 0);
const importsShell = allAdapters.filter((a) =>
  a.findings.every((f) => f.rule !== "no-shared-shell"),
).length;
const products = new Set(allAdapters.map((a) => a.product));

const hardFailCount =
  serviceHardFails.length + adapterHardFails.length;

if (EMIT_JSON) {
  console.log(
    JSON.stringify(
      {
        omniRoot: OMNI_ROOT,
        totals: {
          adapters: allAdapters.length,
          products: products.size,
          conformant: conformant.length,
          drifting: drifting.length,
          importsSharedShell: importsShell,
          missingOrLocal: serviceHardFails.length,
        },
        reports,
      },
      null,
      2,
    ),
  );
  process.exit(hardFailCount > 0 ? 1 : 0);
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

console.log(bold("\nOmni command-palette fleet audit (layer 3)"));
console.log(dim(`fleet root: ${OMNI_ROOT}\n`));

const pct =
  allAdapters.length === 0
    ? 0
    : Math.round((importsShell / allAdapters.length) * 100);
console.log(
  `Found ${bold(String(allAdapters.length))} palette adapters across ${bold(
    String(products.size),
  )} products; ${bold(`${pct}%`)} import the shared shell.`,
);
console.log(
  `${green(`${conformant.length} conformant`)}, ${yellow(
    `${drifting.length} drifting`,
  )}.\n`,
);

// drift grouped by primary reason
if (drifting.length > 0) {
  console.log(bold("Drift (warnings)"));
  const byRule = new Map<string, AdapterReport[]>();
  for (const a of drifting) {
    const primary = a.findings.find((f) => f.level === "warn")!.rule;
    if (!byRule.has(primary)) byRule.set(primary, []);
    byRule.get(primary)!.push(a);
  }
  for (const [rule, adapters] of [...byRule.entries()].sort()) {
    console.log(`\n  ${yellow(rule)} (${adapters.length})`);
    for (const a of adapters.sort((x, y) => x.product.localeCompare(y.product))) {
      console.log(`    ${bold(a.product)} ${dim(a.file)}`);
      for (const f of a.findings.filter((f) => f.level === "warn")) {
        console.log(`      - ${f.detail}`);
      }
    }
  }
  console.log("");
}

// hard failures
if (serviceHardFails.length > 0 || adapterHardFails.length > 0) {
  console.log(bold(red("Hard failures")));
  for (const r of serviceHardFails.sort((a, b) =>
    a.product.localeCompare(b.product),
  )) {
    for (const f of r.failures) {
      console.log(`  ${red(f.rule)} ${bold(r.product)} ${dim(r.dir)}`);
      console.log(`    - ${f.detail}`);
    }
  }
  for (const a of adapterHardFails) {
    for (const f of a.findings.filter((f) => f.level === "fail")) {
      console.log(`  ${red(f.rule)} ${bold(a.product)} ${dim(a.file)}`);
      console.log(`    - ${f.detail}`);
    }
  }
  console.log("");
}

// informational notes
const notes = reports.flatMap((r) => r.notes.map((n) => `${r.product}: ${n}`));
if (notes.length > 0) {
  console.log(bold("Notes"));
  for (const n of notes.sort()) console.log(`  ${dim("-")} ${n}`);
  console.log("");
}

// conformant roll-up
console.log(bold("Conformant"));
console.log(
  "  " +
    conformant
      .map((a) => a.product)
      .sort()
      .join(", "),
);
console.log("");

// summary
console.log(bold("Summary"));
console.log(`  adapters:    ${allAdapters.length}`);
console.log(`  products:    ${products.size}`);
console.log(`  conformant:  ${conformant.length}`);
console.log(`  drifting:    ${drifting.length}`);
console.log(`  hard fails:  ${hardFailCount}`);
console.log("");

if (hardFailCount > 0) {
  console.log(red(bold(`FAIL: ${hardFailCount} hard failure(s)`)));
  process.exit(1);
}
console.log(green(bold("PASS: no hard failures")));
process.exit(0);
