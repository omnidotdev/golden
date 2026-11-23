#!/usr/bin/env bun
/**
 * Fleet thornberry shadow audit.
 *
 * Product code imports UI primitives from thornberry
 * (`@omnidotdev/thornberry/<component>`). A local `ui/<name>` file that shares
 * its name with a thornberry component is a shadow copy: it drifts from the
 * shared one, so styling, accessibility, and hotkey fixes made in thornberry
 * never reach that product. This script lists every shadow copy in the fleet so
 * the remaining migration debt is visible. It only reads source, never executes
 * app code.
 *
 * It also reports which of the shared `GLOBAL_HOTKEYS` each routed app binds
 * (directly, or through a thornberry component that binds it for the app, such
 * as the command palette shell or the sidebar).
 *
 * This is a warning, never a gate: it always exits 0.
 *
 * Usage:
 *   bun scripts/thornberry-shadow-audit.ts               # audit the whole fleet
 *   bun scripts/thornberry-shadow-audit.ts --json        # machine-readable output
 *   bun scripts/thornberry-shadow-audit.ts --path .      # audit one service (pre-commit)
 *   OMNI_ROOT=/path/to/omni bun scripts/thornberry-shadow-audit.ts
 *
 * The fleet root defaults to the parent of this repo (this repo lives at
 * `<omni>/golden`), and can be overridden with OMNI_ROOT. The thornberry
 * component list is read from `<omni>/thornberry`, so new components are picked
 * up without editing this script.
 *
 * Wire it into a product's pre-commit as a non-blocking warning:
 *   OMNI=../../.. ; [ -f "$OMNI/golden/scripts/thornberry-shadow-audit.ts" ] \
 *     && bun "$OMNI/golden/scripts/thornberry-shadow-audit.ts" --path . || true
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const argv = process.argv.slice(2);

const OMNI_ROOT = process.env.OMNI_ROOT
  ? resolve(process.env.OMNI_ROOT)
  : resolve(import.meta.dir, "..", "..");

const EMIT_JSON = argv.includes("--json");

const pathFlag = argv.indexOf("--path");
const SINGLE_PATH =
  pathFlag !== -1 && argv[pathFlag + 1] ? resolve(argv[pathFlag + 1]!) : null;

const THORNBERRY_DIR = join(OMNI_ROOT, "thornberry");
const THORNBERRY_COMPONENTS_DIR = join(
  THORNBERRY_DIR,
  "src",
  "registry",
  "thornberry",
  "components",
);

/**
 * Local names that shadow a thornberry component under a different name (the
 * shadcn/Radix spellings most old copies use)
 */
const ALIASES: Record<string, string> = {
  "alert-dialog": "confirm-dialog",
  "dropdown-menu": "menu",
  "context-menu": "menu",
  drawer: "sheet",
  "input-otp": "pin-input",
  "data-grid": "data-table",
  textfield: "input",
  "text-field": "input",
};

/** Directories never worth descending into */
const SKIP_DIRS = new Set([
  "node_modules",
  ".output",
  ".nitro",
  ".vinxi",
  ".tanstack",
  "dist",
  "build",
  ".git",
  "coverage",
  ".turbo",
  "generated",
]);

interface Shadow {
  /** Thornberry component the local file shadows */
  component: string;
  /** Local file name, without extension */
  local: string;
  /** Local file, relative to the fleet root */
  file: string;
  /** Source files importing the local copy (0 means a dead copy) */
  importers: number;
}

interface HotkeyCoverage {
  bound: string[];
  missing: string[];
}

interface ServiceReport {
  product: string;
  service: string;
  dir: string;
  shadows: Shadow[];
  hotkeys: HotkeyCoverage | null;
}

/** Recursively collect `.ts`/`.tsx` file paths under a directory */
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
    if (st.isDirectory()) collectSourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) out.push(full);
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

/** `ConfirmDialog` / `confirmDialog` / `confirm_dialog` -> `confirm-dialog` */
const toKebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();

/** Strip extension and test/story suffixes: `avatar.test.tsx` -> `avatar` */
const componentStem = (file: string): string =>
  basename(file)
    .replace(/\.tsx?$/, "")
    .replace(/\.(test|spec|stories)$/, "");

const loadThornberryComponents = (): Set<string> => {
  if (!existsSync(THORNBERRY_COMPONENTS_DIR)) {
    console.error(
      `thornberry components not found at ${relative(OMNI_ROOT, THORNBERRY_COMPONENTS_DIR) || THORNBERRY_COMPONENTS_DIR}`,
    );
    process.exit(0);
  }
  return new Set(
    readdirSync(THORNBERRY_COMPONENTS_DIR)
      .filter((f) => f.endsWith(".tsx") && !/\.(test|spec)\.tsx?$/.test(f))
      .map((f) => f.replace(/\.tsx$/, "")),
  );
};

/** Keys of `GLOBAL_HOTKEYS`, read from the thornberry source */
const loadGlobalHotkeys = (): string[] => {
  const src = read(join(THORNBERRY_COMPONENTS_DIR, "use-hotkeys.tsx"));
  const block = src.match(/GLOBAL_HOTKEYS\s*=\s*\{([\s\S]*?)\}\s*as const/);
  if (!block) return [];
  return [...block[1]!.matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]!);
};

/**
 * Thornberry components that bind a global hotkey on the app's behalf, so
 * importing them counts as binding the key
 */
const HOTKEY_PROVIDERS: Record<string, string> = {
  commandPalette: "@omnidotdev/thornberry/command-palette",
  toggleSidebar: "@omnidotdev/thornberry/sidebar",
};

/** Raw key strings an app may bind without the constant */
const HOTKEY_LITERALS: Record<string, RegExp> = {
  commandPalette: /["'](?:mod|meta|ctrl)\+k["']/,
  toggleTheme: /useHotkeys\(\s*["']t["']/,
  toggleSidebar: /useHotkeys\(\s*["']b["']/,
  showShortcuts: /["']shift\+slash["']|useHotkeys\(\s*["']\?["']/,
};

const isRoutedApp = (srcDir: string, contents: string[]): boolean =>
  existsSync(join(srcDir, "routes")) ||
  contents.some(
    (c) =>
      c.includes("createFileRoute") ||
      c.includes("createRootRoute") ||
      c.includes("RouterProvider"),
  );

const auditService = (
  dir: string,
  components: Set<string>,
  hotkeys: string[],
): ServiceReport | null => {
  const srcDir = join(dir, "src");
  if (!existsSync(srcDir)) return null;

  const files = collectSourceFiles(srcDir);
  const contents = new Map(files.map((f) => [f, read(f)]));

  const shadows = new Map<string, Shadow>();
  for (const file of files) {
    // only `ui/` directories hold primitive copies; domain components that
    // happen to share a name (e.g. a pricing `Card`) live elsewhere
    if (basename(dirname(file)) !== "ui") continue;
    const stem = toKebab(componentStem(file));
    const component = components.has(stem) ? stem : ALIASES[stem];
    if (!component || !components.has(component)) continue;

    // a test of the local copy belongs to that copy, not a separate shadow
    const key = join(dirname(file), stem);
    const isTest = /\.(test|spec|stories)\.tsx?$/.test(file);
    const existing = shadows.get(key);
    if (existing && isTest) continue;

    const rawStem = componentStem(file);
    const importRe = new RegExp(`["'][^"']*/ui/${rawStem}(?:\\.tsx?)?["']`);
    const importers = files.filter(
      (f) =>
        f !== file &&
        componentStem(f) !== rawStem &&
        importRe.test(contents.get(f) ?? ""),
    ).length;

    shadows.set(key, {
      component,
      local: rawStem,
      file: relative(OMNI_ROOT, file),
      importers,
    });
  }

  let hotkeyCoverage: HotkeyCoverage | null = null;
  const service = basename(dir);
  if (service.endsWith("-app") && isRoutedApp(srcDir, [...contents.values()])) {
    const all = [...contents.values()].join("\n");
    const bound: string[] = [];
    const missing: string[] = [];
    for (const key of hotkeys) {
      const provider = HOTKEY_PROVIDERS[key];
      const literal = HOTKEY_LITERALS[key];
      const isBound =
        new RegExp(`GLOBAL_HOTKEYS\\.${key}\\b`).test(all) ||
        (provider !== undefined && all.includes(provider)) ||
        (literal !== undefined && literal.test(all));
      (isBound ? bound : missing).push(key);
    }
    hotkeyCoverage = { bound, missing };
  }

  return {
    product: basename(dirname(dirname(dir))).replace(/-stack$/, ""),
    service,
    dir: relative(OMNI_ROOT, dir),
    shadows: [...shadows.values()].sort((a, b) =>
      a.component.localeCompare(b.component),
    ),
    hotkeys: hotkeyCoverage,
  };
};

/** Every `<stack>/services/<service>` directory in the fleet */
const listServices = (): string[] => {
  const dirs: string[] = [];
  for (const stack of readdirSync(OMNI_ROOT).sort()) {
    const servicesDir = join(OMNI_ROOT, stack, "services");
    if (!existsSync(servicesDir)) continue;
    let services: string[];
    try {
      services = readdirSync(servicesDir);
    } catch {
      continue;
    }
    for (const service of services.sort()) {
      // hidden entries are scratch worktrees, not services
      if (service.startsWith(".")) continue;
      const dir = join(servicesDir, service);
      try {
        if (statSync(dir).isDirectory()) dirs.push(dir);
      } catch {
        // unreadable entry
      }
    }
  }
  return dirs;
};

// --- run and report -------------------------------------------------------

const components = loadThornberryComponents();
const hotkeys = loadGlobalHotkeys();

const reports = (SINGLE_PATH ? [SINGLE_PATH] : listServices())
  .map((dir) => auditService(dir, components, hotkeys))
  .filter((r): r is ServiceReport => r !== null)
  .filter((r) => r.shadows.length > 0 || (r.hotkeys?.missing.length ?? 0) > 0);

const shadowReports = reports.filter((r) => r.shadows.length > 0);
const totalShadows = shadowReports.reduce((n, r) => n + r.shadows.length, 0);
const deadShadows = shadowReports.reduce(
  (n, r) => n + r.shadows.filter((s) => s.importers === 0).length,
  0,
);
const hotkeyGaps = reports.filter((r) => (r.hotkeys?.missing.length ?? 0) > 0);

if (EMIT_JSON) {
  console.log(
    JSON.stringify(
      {
        omniRoot: OMNI_ROOT,
        globalHotkeys: hotkeys,
        totals: {
          services: shadowReports.length,
          shadows: totalShadows,
          deadShadows,
          hotkeyGaps: hotkeyGaps.length,
        },
        reports,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// single-service mode (pre-commit): print only when there is something to say
if (SINGLE_PATH) {
  const [report] = reports;
  if (!report) process.exit(0);
  if (report.shadows.length > 0) {
    console.warn(
      yellow(
        `thornberry: ${report.shadows.length} local ui file(s) shadow a thornberry component; import @omnidotdev/thornberry/<component> instead:`,
      ),
    );
    for (const s of report.shadows) {
      const note = s.importers === 0 ? dim(" (unused, delete it)") : "";
      console.warn(`  ${relative(SINGLE_PATH, join(OMNI_ROOT, s.file))} -> ${s.component}${note}`);
    }
  }
  if (report.hotkeys && report.hotkeys.missing.length > 0) {
    console.warn(
      yellow(
        `thornberry: GLOBAL_HOTKEYS not bound: ${report.hotkeys.missing.join(", ")}`,
      ),
    );
  }
  process.exit(0);
}

console.log(bold("\nOmni thornberry shadow audit"));
console.log(dim(`fleet root: ${OMNI_ROOT}`));
console.log(
  dim(`${components.size} thornberry components, GLOBAL_HOTKEYS: ${hotkeys.join(", ")}\n`),
);

if (shadowReports.length === 0) {
  console.log(green("No local ui files shadow a thornberry component.\n"));
} else {
  console.log(bold("Shadow copies (most debt first)"));
  for (const r of [...shadowReports].sort(
    (a, b) => b.shadows.length - a.shadows.length || a.dir.localeCompare(b.dir),
  )) {
    console.log(
      `\n  ${bold(String(r.shadows.length).padStart(2))} ${bold(r.service)} ${dim(r.dir)}`,
    );
    console.log(
      `     ${r.shadows
        .map((s) => {
          const label =
            toKebab(s.local) === s.component ? s.component : `${s.local} (${s.component})`;
          return s.importers === 0 ? dim(`${label} unused`) : label;
        })
        .join(", ")}`,
    );
  }
  console.log("");
}

if (hotkeyGaps.length > 0) {
  console.log(bold("Routed apps missing GLOBAL_HOTKEYS"));
  for (const r of hotkeyGaps.sort((a, b) => a.dir.localeCompare(b.dir))) {
    console.log(`  ${bold(r.service)} ${dim(`missing: ${r.hotkeys!.missing.join(", ")}`)}`);
  }
  console.log("");
}

console.log(bold("Summary"));
console.log(`  services with shadows:  ${shadowReports.length}`);
console.log(`  shadow copies:          ${totalShadows} (${deadShadows} unused)`);
console.log(`  apps with hotkey gaps:  ${hotkeyGaps.length}`);
console.log(
  yellow(
    "\nWarning only: migrate shadows to @omnidotdev/thornberry/<component> (see plans/2026-11-22-fleet-thornberry-components.md)\n",
  ),
);
process.exit(0);
