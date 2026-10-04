#!/usr/bin/env node
/**
 * Static inventory of every `data-testid` in the charts / dashboards / reports UI.
 *
 *   node e2e/scripts/interaction-inventory.mjs          # print counts
 *   node e2e/scripts/interaction-inventory.mjs --json   # dump the full inventory
 *
 * Parsed with the TypeScript compiler API. Each `data-testid` value becomes an exact string or a
 * regex (template literals → `.+` for the dynamic parts, `a ? 'x' : 'y'` → both, `a || b` → both).
 *
 * Prop-forwarded test ids are resolved through their call sites: when a testid depends on a
 * component prop (Combobox `id`, DatePicker `testId`, ConfirmationDialog `testIdPrefix`, or any
 * local component doing the same), one DERIVED entry is emitted per JSX usage of that component,
 * located at the usage, with the prop's value substituted (or its default when the usage omits it).
 * The generic entry in the component itself is then a TEMPLATE and not counted.
 *
 * Imported by interaction-report.mjs (`buildInventory`).
 */
import { readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SCAN_DIRS = [
  'app/charts',
  'app/dashboards',
  'app/reports',
  'app/share',
  'components/charts',
  'components/dashboard',
  'components/dashboards',
  'components/reports',
  'components/access',
];
const SCAN_FILES = [
  'components/ui/share-modal.tsx',
  'components/ui/confirmation-dialog.tsx',
  'components/ui/date-picker.tsx',
  'components/ui/combobox.tsx',
  'components/kpis/kpi-card.tsx',
];

/**
 * Files the coverage docs call dead / never rendered:
 * charts.md §0 point 1, dashboards.md §14 "Unused files and code", reports.md §5 "Dead or unused code".
 */
export const DEAD_FILES = new Set([
  'components/charts/ChartBuilder.tsx',
  'components/charts/ChartFiltersConfiguration.tsx',
  'components/charts/ChartSortConfiguration.tsx',
  'components/charts/ChartPaginationConfiguration.tsx',
  'components/charts/TableConfiguration.tsx',
  'components/charts/SimpleTableConfiguration.tsx',
  'components/charts/ChartExport.tsx',
  'components/charts/MiniChart.tsx',
  'components/charts/WorkInProgress.tsx',
  'components/charts/map/LayerConfiguration.tsx',
  'components/charts/map/MultiSelectLayerCard.tsx',
  'components/charts/types/map/MapChartCustomizations.tsx',
  'components/charts/types/table/ColumnAlignmentSection.tsx',
  'components/charts/types/table/ColumnOrderSection.tsx',
  'components/dashboard/DashboardMiniPreview.tsx',
  'components/dashboard/GridGuides.tsx',
  'components/dashboard/SpaceMakingIndicators.tsx',
  'components/dashboard/SnapIndicators.tsx',
  'components/reports/report-share-menu.tsx',
]);

const INTERACTIVE_TAGS = new Set([
  'button',
  'Button',
  'a',
  'Link',
  'input',
  'Input',
  'textarea',
  'Textarea',
  'select',
  'Select',
  'SelectTrigger',
  'SelectItem',
  'Switch',
  'Checkbox',
  'RadioGroupItem',
  'TabsTrigger',
  'DropdownMenuTrigger',
  'DropdownMenuItem',
  'DropdownMenuCheckboxItem',
  'PopoverTrigger',
  'Slider',
  'DebouncedInput',
]);
const INTERACTIVE_ATTRS = new Set([
  'onClick',
  'onKeyDown',
  'onChange',
  'onPointerDown',
  'draggable',
  // Radix / custom equivalents of onClick/onChange
  'onCheckedChange',
  'onValueChange',
  'onSelect',
  'onDoubleClick',
  'onMouseDown',
]);

/** `<MultiComboboxInner {...props}>` inside `Combobox` only renders for `mode="multi"` usages. */
const SPREAD_CONSTRAINTS = {
  'Combobox>MultiComboboxInner': { attr: 'mode', eq: 'multi' },
  'Combobox>SingleComboboxInner': { attr: 'mode', neq: 'multi' },
};

const MAX_DEPTH = 5;

// ─── files ───────────────────────────────────────────────────

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(full, out);
    } else if (name.endsWith('.tsx') && !/\.(test|spec|stories)\.tsx$/.test(name)) {
      out.push(full);
    }
  }
}

export function scannedFiles() {
  const out = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), out);
  for (const f of SCAN_FILES) out.push(path.join(ROOT, f));
  return [...new Set(out)].sort();
}

// ─── symbolic values ─────────────────────────────────────────
// A value is a list of alternatives; an alternative is a list of parts:
//   { lit: 'text' } | { wild: reason } | { prop, comp, fallback: alts|null }

const lit = (s) => [[{ lit: s }]];
const wild = (reason) => [[{ wild: reason }]];

function concat(a, b) {
  const out = [];
  for (const x of a) for (const y of b) out.push([...x, ...y]);
  return out;
}

const rel = (sf) => path.relative(ROOT, sf.fileName);
const lineOf = (node) => {
  const sf = node.getSourceFile();
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
};

function unwrap(e) {
  while (
    e &&
    (ts.isParenthesizedExpression(e) ||
      ts.isAsExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isTypeAssertionExpression?.(e) ||
      ts.isSatisfiesExpression?.(e))
  ) {
    e = e.expression;
  }
  return e;
}

/** Name of the component a function node defines, or null if it isn't a PascalCase component. */
function componentName(fn) {
  let name = null;
  if (ts.isFunctionDeclaration(fn) && fn.name) name = fn.name.text;
  else if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
    let p = fn.parent;
    while (p && ts.isCallExpression(p)) p = p.parent; // memo(...) / forwardRef(...)
    if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) name = p.name.text;
  }
  return name && /^[A-Z]/.test(name) ? name : null;
}

function enclosingComponent(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) {
      const n = componentName(p);
      if (n) return { name: n, fn: p };
    }
  }
  return null;
}

/** If `param` is the first parameter of a component, the component's name. */
function propsParamOf(param) {
  if (!ts.isParameter(param)) return null;
  const fn = param.parent;
  if (!ts.isFunctionLike(fn) || fn.parameters[0] !== param) return null;
  return componentName(fn);
}

class Evaluator {
  constructor(checker) {
    this.checker = checker;
  }

  decl(ident) {
    const sym = this.checker.getSymbolAtLocation(ident);
    return sym?.valueDeclaration || sym?.declarations?.[0] || null;
  }

  /** Is `expr` the props object of a component? → component name */
  propsObject(expr) {
    expr = unwrap(expr);
    if (!ts.isIdentifier(expr)) return null;
    const d = this.decl(expr);
    return d ? propsParamOf(d) : null;
  }

  evalDecl(d, depth) {
    if (ts.isVariableDeclaration(d)) {
      return d.initializer ? this.eval(d.initializer, depth + 1) : wild('dynamic');
    }
    if (ts.isBindingElement(d)) {
      const propName =
        d.propertyName && ts.isIdentifier(d.propertyName) ? d.propertyName.text : d.name.text;
      const fallback = d.initializer ? this.eval(d.initializer, depth + 1) : null;
      const pattern = d.parent;
      const holder = pattern.parent;
      let comp = null;
      if (ts.isParameter(holder)) comp = propsParamOf(holder);
      else if (ts.isVariableDeclaration(holder) && holder.initializer) {
        comp = this.propsObject(holder.initializer);
      }
      if (comp) return [[{ prop: propName, comp, fallback }]];
      return fallback ? [...fallback, [{ wild: 'dynamic' }]] : wild('dynamic');
    }
    return wild('dynamic');
  }

  evalBinary(e, depth) {
    const op = e.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) {
      return concat(this.eval(e.left, depth + 1), this.eval(e.right, depth + 1));
    }
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      const left = this.eval(e.left, depth + 1);
      const right = this.eval(e.right, depth + 1);
      // `prop || default` → the default applies when a usage omits the prop
      if (left.length === 1 && left[0].length === 1 && left[0][0].prop && !left[0][0].fallback) {
        return [[{ ...left[0][0], fallback: right }]];
      }
      return [...left, ...right];
    }
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return this.eval(e.right, depth + 1);
    return wild('dynamic');
  }

  eval(e, depth = 0) {
    e = unwrap(e);
    if (!e || depth > 12) return wild('dynamic');
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return lit(e.text);
    if (ts.isNumericLiteral(e)) return lit(e.text);
    if (e.kind === ts.SyntaxKind.NullKeyword) return [];
    if (ts.isIdentifier(e) && e.text === 'undefined') return [];
    if (ts.isTemplateExpression(e)) {
      let v = lit(e.head.text);
      for (const span of e.templateSpans) {
        v = concat(v, this.eval(span.expression, depth + 1));
        if (span.literal.text) v = concat(v, lit(span.literal.text));
      }
      return v;
    }
    if (ts.isConditionalExpression(e)) {
      return [...this.eval(e.whenTrue, depth + 1), ...this.eval(e.whenFalse, depth + 1)];
    }
    if (ts.isBinaryExpression(e)) return this.evalBinary(e, depth);
    if (ts.isIdentifier(e)) {
      const d = this.decl(e);
      return d ? this.evalDecl(d, depth) : wild('dynamic');
    }
    if (ts.isPropertyAccessExpression(e)) {
      const comp = this.propsObject(e.expression);
      if (comp) return [[{ prop: e.name.text, comp, fallback: null }]];
      return wild('dynamic');
    }
    if (ts.isCallExpression(e)) {
      const callee = e.expression.getText();
      if (/(^|\.)useId$/.test(callee)) return wild('auto-id');
      return wild('dynamic');
    }
    return wild('dynamic');
  }
}

// ─── JSX helpers ─────────────────────────────────────────────

function tagName(el) {
  const t = el.tagName;
  return ts.isIdentifier(t) ? t.text : t.getText();
}

function attrsOf(el) {
  const named = new Map();
  const spreads = [];
  for (const a of el.attributes.properties) {
    if (ts.isJsxAttribute(a)) named.set(a.name.getText(), a);
    else if (ts.isJsxSpreadAttribute(a)) spreads.push(a);
  }
  return { named, spreads };
}

function isInteractive(el) {
  if (INTERACTIVE_TAGS.has(tagName(el))) return true;
  const { named } = attrsOf(el);
  for (const n of named.keys()) if (INTERACTIVE_ATTRS.has(n)) return true;
  return false;
}

function attrStringValue(attr) {
  const init = attr?.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = unwrap(init.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  }
  return null;
}

// ─── patterns ────────────────────────────────────────────────

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Concrete alternative (no prop parts) → { value | regex, loose } */
function toPattern(alt) {
  const merged = [];
  for (const p of alt) {
    const last = merged[merged.length - 1];
    if (p.lit !== undefined && last?.lit !== undefined) last.lit += p.lit;
    else if (p.wild && last?.wild) last.reasons.add(p.wild);
    else if (p.lit !== undefined) merged.push({ lit: p.lit });
    else merged.push({ wild: true, reasons: new Set([p.wild]) });
  }
  const hasWild = merged.some((p) => p.wild);
  const loose =
    merged.length === 0 ||
    Boolean(merged[0].wild) ||
    merged.some((p) => p.wild && (p.reasons.has('auto-id') || p.reasons.has('unresolved-prop')));
  if (!hasWild) return { value: merged.map((p) => p.lit).join(''), loose: false };
  const source = '^' + merged.map((p) => (p.wild ? '.+' : escapeRe(p.lit))).join('') + '$';
  return { regex: source, loose };
}

// ─── inventory ───────────────────────────────────────────────

export function areaOf(file) {
  if (/^(app|components)\/charts\//.test(file)) return 'charts';
  if (/^app\/dashboards\/|^components\/dashboards?\//.test(file)) return 'dashboards';
  if (/^(app|components)\/reports\//.test(file)) return 'reports';
  if (file.startsWith('app/share/')) return 'share (public)';
  if (file.startsWith('components/access/')) return 'access';
  if (file.startsWith('components/kpis/')) return 'kpis';
  if (file.startsWith('components/ui/')) return 'ui (shared)';
  return 'other';
}

export function screenOf(file) {
  return path.dirname(file);
}

/** app/charts/[id]/edit/page.tsx → /^\/charts\/[^/]+\/edit\/?$/ ; null outside app/ */
export function routeOf(file) {
  if (!file.startsWith('app/')) return null;
  const segs = path
    .dirname(file)
    .split('/')
    .slice(1)
    .filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('_'));
  const re = segs
    .map((s) => (/^\[\.\.\..+\]$/.test(s) ? '.+' : /^\[.+\]$/.test(s) ? '[^/]+' : escapeRe(s)))
    .join('/');
  return new RegExp(`^/${re}/?$`);
}

export function buildInventory() {
  const files = scannedFiles();
  const program = ts.createProgram(files, {
    jsx: ts.JsxEmit.Preserve,
    allowJs: false,
    noResolve: true,
    noLib: true,
    target: ts.ScriptTarget.ESNext,
  });
  const checker = program.getTypeChecker();
  const ev = new Evaluator(checker);
  const sources = files.map((f) => program.getSourceFile(f)).filter(Boolean);

  const raw = []; // { file, line, tag, interactive, alts, site }
  const usages = new Map(); // component name → [JSX element]
  const confirmCalls = []; // useConfirmationDialog confirm({...}) calls
  const wrappers = new Map(); // `const A = memo(B)` → B → [A]

  for (const sf of sources) {
    const importsConfirmHook = /useConfirmationDialog/.test(sf.text);
    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = tagName(node);
        if (!usages.has(tag)) usages.set(tag, []);
        usages.get(tag).push(node);
        const attr = attrsOf(node).named.get('data-testid');
        if (attr?.initializer) {
          const expr = ts.isStringLiteral(attr.initializer)
            ? attr.initializer
            : attr.initializer.expression;
          raw.push({
            file: rel(sf),
            line: lineOf(attr),
            tag,
            interactive: isInteractive(node),
            alts: expr ? ev.eval(expr) : wild('dynamic'),
          });
        }
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        /(^|\.)(memo|forwardRef)$/.test(node.initializer.expression.getText()) &&
        node.initializer.arguments[0] &&
        ts.isIdentifier(node.initializer.arguments[0])
      ) {
        const inner = node.initializer.arguments[0].text;
        if (!wrappers.has(inner)) wrappers.set(inner, []);
        wrappers.get(inner).push(node.name.text);
      }
      if (
        importsConfirmHook &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'confirm' &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        confirmCalls.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  const entries = [];
  let templates = 0;

  /** Substitute a component's props with the attributes of one usage. */
  const substituteAt = (alt, comp, usage) => {
    const { named, spreads } = attrsOf(usage);
    const usageComp = enclosingComponent(usage);
    const forwardsProps =
      usageComp && spreads.some((s) => ev.propsObject(s.expression) === usageComp.name);
    const key = `${usageComp?.name}>${comp}`;
    const constraint = forwardsProps ? SPREAD_CONSTRAINTS[key] : null;
    let out = [[]];
    for (const part of alt) {
      let v;
      if (part.prop && part.comp === comp) {
        const attr = named.get(part.prop);
        if (attr) {
          v = attr.initializer
            ? ts.isStringLiteral(attr.initializer)
              ? lit(attr.initializer.text)
              : ev.eval(attr.initializer.expression)
            : wild('dynamic');
        } else if (forwardsProps) {
          v = [[{ prop: part.prop, comp: usageComp.name, fallback: part.fallback }]];
        } else {
          v = part.fallback || [];
        }
      } else {
        v = [[part]];
      }
      out = concat(out, v);
    }
    return out.map((a) => ({ alt: a, constraint }));
  };

  const expand = (alt, site, depth, constraints) => {
    const propPart = alt.find((p) => p.prop);
    if (!propPart) return [{ alt, site, constraints }];
    const comp = propPart.comp;
    const names = [comp, ...(wrappers.get(comp) || [])];
    const uses = depth < MAX_DEPTH ? names.flatMap((n) => usages.get(n) || []) : [];
    const out = [];
    if (!uses.length) {
      // Unused in the scanned files → keep the default and a loose wildcard
      const resolved = alt.flatMap((p) => (p.prop ? [{ wild: 'unresolved-prop' }] : [p]));
      out.push({ alt: resolved, site, constraints });
      if (propPart.fallback) {
        for (const f of propPart.fallback) {
          const withDefault = [];
          for (const p of alt) {
            if (p === propPart) withDefault.push(...f);
            else withDefault.push(p);
          }
          out.push(...expand(withDefault, site, depth + 1, constraints));
        }
      }
      return out;
    }
    for (const u of uses) {
      // A pending spread constraint (e.g. mode="multi") is checked against this usage
      const pending = constraints.filter((c) => c.comp === comp);
      const { named } = attrsOf(u);
      const ok = pending.every((c) => {
        const v = attrStringValue(named.get(c.attr));
        return c.eq !== undefined ? v === c.eq : v !== c.neq;
      });
      if (!ok) continue;
      const rest = constraints.filter((c) => c.comp !== comp);
      const usageSite = { file: rel(u.getSourceFile()), line: lineOf(u), comp };
      for (const { alt: next, constraint } of substituteAt(alt, comp, u)) {
        const usageComp = enclosingComponent(u);
        const cs = constraint ? [...rest, { ...constraint, comp: usageComp.name }] : rest;
        out.push(...expand(next, usageSite, depth + 1, cs));
      }
    }
    return out;
  };

  const seen = new Set();
  const add = (e) => {
    const k = `${e.file}:${e.line}:${e.value ?? e.regex}`;
    if (seen.has(k)) return;
    seen.add(k);
    entries.push(e);
  };

  for (const r of raw) {
    let isTemplate = false;
    for (const alt of r.alts) {
      if (alt.some((p) => p.prop)) isTemplate = true;
      for (const x of expand(alt, { file: r.file, line: r.line }, 0, [])) {
        const derived = x.site.file !== r.file || x.site.line !== r.line;
        add({
          file: x.site.file,
          line: x.site.line,
          tag: r.tag,
          interactive: r.interactive,
          ...toPattern(x.alt),
          derived: derived ? `${r.file}:${r.line}` : null,
        });
      }
    }
    if (isTemplate) templates++;
  }

  // useConfirmationDialog: confirm({ testIdPrefix }) → the hook's ConfirmationDialog test ids
  const dialogTemplates = raw.filter(
    (r) =>
      r.file === 'components/ui/confirmation-dialog.tsx' &&
      r.alts.some((a) => a.some((p) => p.prop === 'testIdPrefix'))
  );
  for (const call of confirmCalls) {
    const prop = call.arguments[0].properties.find(
      (p) => ts.isPropertyAssignment(p) && p.name.getText() === 'testIdPrefix'
    );
    const prefix = prop ? ev.eval(prop.initializer) : null;
    for (const r of dialogTemplates) {
      for (const alt of r.alts) {
        const sub = concat(
          [[]],
          alt.reduce(
            (acc, p) => concat(acc, p.prop === 'testIdPrefix' ? prefix || p.fallback || [] : [[p]]),
            [[]]
          )
        );
        for (const a of sub) {
          add({
            file: rel(call.getSourceFile()),
            line: lineOf(call),
            tag: r.tag,
            interactive: r.interactive,
            ...toPattern(a),
            derived: `${r.file}:${r.line}`,
          });
        }
      }
    }
  }

  for (const e of entries) {
    e.area = areaOf(e.file);
    e.screen = screenOf(e.file);
    e.route = routeOf(e.file);
    e.dead =
      DEAD_FILES.has(e.file) || Boolean(e.derived && DEAD_FILES.has(e.derived.split(':')[0]));
    if (e.regex) e.re = new RegExp(e.regex);
  }
  entries.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { entries, templates, files: files.map((f) => path.relative(ROOT, f)) };
}

export function countInventory(entries) {
  const live = entries.filter((e) => !e.dead);
  return {
    total: entries.length,
    interactive: live.filter((e) => e.interactive).length,
    nonInteractive: live.filter((e) => !e.interactive).length,
    dead: entries.filter((e) => e.dead).length,
    derived: entries.filter((e) => e.derived).length,
    patterns: entries.filter((e) => e.regex).length,
    loose: entries.filter((e) => e.loose).length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { entries, templates, files } = buildInventory();
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        entries.map((e) => ({ ...e, re: undefined, route: e.route?.source ?? null })),
        null,
        2
      )
    );
  } else {
    const c = countInventory(entries);
    console.log(`Scanned ${files.length} files → ${c.total} testid entries`);
    console.log(`  interactive (live)      ${c.interactive}`);
    console.log(`  non-interactive (live)  ${c.nonInteractive}`);
    console.log(`  dead                    ${c.dead}`);
    console.log(`  derived (via usages)    ${c.derived}`);
    console.log(`  regex patterns          ${c.patterns}  (loose: ${c.loose})`);
    console.log(`  templates (not counted) ${templates}`);
  }
}
