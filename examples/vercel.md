**TL;DR** — This is a `factory.md` v1 file encoding how an autonomous coding agent should ship code in a Vercel-style repo. Every rule is derived from publicly available Vercel material: the `vercel/style-guide` package (archived 2025-02-11 but still canonical), `vercel/next.js` and `vercel/turborepo` repo configs, `vercel-labs/agent-skills` (`react-best-practices`, `composition-patterns`, etc.), Vercel's docs on Environments / Environment Variables / Security / Firewall / Observability / Agent PR Review / Production Checklist, the Vercel blog (notably "Security Boundaries in Agentic Architectures"), and Guillermo Rauch's essays on rauchg.com (read from the open-source `rauchg/blog` repo). Rules prefixed with `!` are **strict**: a framework must verify them deterministically (CI check, lint, type, test) or the pipeline fails. Every rule is traceable to a URL in the `## Sources` appendix.

---

```
---
name: vercel
version: 2
framework_min_version: 1
---
```

# vercel factory

Rules for an autonomous agent to ship code in a Vercel-style repo. Derived entirely from public Vercel and `rauchg` sources. Where `vercel/next.js` and `vercel/style-guide` disagree, `vercel/next.js` wins for production conventions (semicolons, default exports on page files) and `vercel/style-guide` wins for library code. Rules prefixed with `!` are strict.

**v2 — whole-factory.** The `## stages` section declares the pipeline and maps the 8 gate categories to lifecycle stages. `## triage` and `## spec` are **executable prompts** the agent runs; the eight category sections carry the `!`+`check:` rules the framework enforces at each stage.

## stages
- triage: prompt
- spec: prompt
- build: style, build, environment
- check: testing, quality, documentation, security
- ship: security, documentation
- monitor: observability

## triage

> stage: triage — executable prompt. The agent runs this to route an incoming idea.

Classify the idea, then emit exactly one line: `route: build` or `route: spec` + a one-sentence reason.

- **`route: build`** — simple and unambiguous: typo, copy, config, single-file change, no new API or dependency.
- **`route: spec`** — complex or ambiguous: new surface area, touches >1 subsystem, schema/API/behavior change, or any new dependency.
- When in doubt, `route: spec`. Steering a plan is cheaper than steering a diff.

## spec

> stage: spec — executable prompt. The agent fills this template into `spec.md`; a human approves it before Build.

```
# <title>

## Intent            (product)
What changes for the user, and the invariant that must hold after.

## Out of scope
What this explicitly does NOT do.

## Targets           (tech)
Files/functions to touch, with paths. Any new dependency (must clear the `build` rules).

## Acceptance
Checks that prove it works — each a command or an observable behavior.
```

- The spec must be buildable from itself — if an engineer couldn't implement from it, it isn't done (Vercel "Production Checklist" discipline).
- Prefer acceptance items that reuse existing `check`-stage rules; don't reinvent a gate that already exists.

## style

- Formatter is Prettier; canonical config is `@vercel/style-guide/prettier`
- `printWidth: 80`, `tabWidth: 2`, `useTabs: false`, `endOfLine: 'lf'`, `singleQuote: true`
- Pin Prettier defaults explicitly; EditorConfig must not override (`charset=utf-8`, `end_of_line=lf`, `indent_size=2`, `insert_final_newline=true`, `trim_trailing_whitespace=true` except `*.md`)
- For application code following `vercel/next.js` conventions, also set `trailingComma: 'es5'` and `semi: false`
- ESLint base configs for library/general code are `@vercel/style-guide/eslint/browser` + `/node`, loaded via `require.resolve()`; add `/react`, `/next`, `/typescript`, `/jest`, `/vitest`, `/playwright-test` as applicable
- Identifiers are `camelCase`; React components are `PascalCase`; type/enum/interface names are `PascalCase`
- No Hungarian `I`-prefix on interfaces (banned pattern `^I[A-Z]`); names `Interface`, `Props`, `State` are forbidden as standalone type names
- ! All filenames are `kebab-case` (`unicorn/filename-case`) `check: ! git diff $BASE_BRANCH...$BRANCH --name-only --diff-filter=A 2>/dev/null | grep -E "/[^/]*[A-Z_][^/]*\.[a-z]+$"`
- Node built-ins must use the `node:` protocol (`import 'node:fs'`, not `import 'fs'`)
- Imports are ordered `builtin → external → internal → parent → sibling → index` with no blank lines between groups
- No default exports in library code (`import/no-default-export`); Next.js page/route files are the only exception
- No import cycles (`import/no-cycle`)
- No absolute-path imports (`import/no-absolute-path`)
- No mutable exports (`import/no-mutable-exports`)
- TypeScript imports use inline type specifiers (`import { type Foo }`) and never `import type { ... }` with standalone annotations
- Triple equals only (`eqeqeq`)
- ! `const` by default, `let` only when reassigned, never `var` (`no-var`) `check: ! git diff $BASE_BRANCH...$BRANCH -- '*.js' '*.jsx' '*.ts' '*.tsx' 2>/dev/null | grep -qE "^\+[[:space:]]*var[[:space:]]"`
- ! No `console.*` in committed code (`no-console`) `check: ! git diff $BASE_BRANCH...$BRANCH -- '*.js' '*.jsx' '*.ts' '*.tsx' 2>/dev/null | grep -qE "^\+[^-].*console\."`
- ! No `alert`, `eval`, `new Function`, `javascript:` URLs (`no-alert`, `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`)
- No `new` without assignment (`no-new`) and no primitive wrappers (`no-new-wrappers`)
- No parameter reassignment (`no-param-reassign`) — pure-function bias
- No nested ternaries (`no-nested-ternary`)
- No bitwise operators (`no-bitwise`)
- Switch statements on union types must be exhaustive (`@typescript-eslint/switch-exhaustiveness-check`)
- Prefer template literals over string concat (`prefer-template`)
- Prefer object shorthand and rest/spread (`object-shorthand`, `prefer-rest-params`, `prefer-spread`)
- Prefer `.flatMap` over `.filter().map()` chains for single-pass map+filter
- Prefer immutable array methods: `.toSorted()`, `.toReversed()`, `.toSpliced()`, `.with()` (Node 20+, Chrome 110+, Safari 16+, Firefox 115+)
- No unused variables; ignore pattern is `^_` (`no-unused-vars`)
- Every `eslint-disable` directive must carry a description (`eslint-comments/require-description`)
- Unused `eslint-disable` directives are reported as errors (`reportUnusedDisableDirectives: true`)
- TSDoc syntax is enforced on all TypeScript files (`tsdoc/syntax`)

## build

- ! Runtime is Node LTS; pin with `.node-version` (preferred over `.nvmrc`); current production pin is `>=20.9.0` `check: test -f $REPO_DIR/.node-version || test -f $REPO_DIR/.nvmrc`
- Package manager is pnpm; pin exact version via `packageManager` in `package.json` (current: `pnpm@10.x`); use `corepack enable` to activate
- Monorepos use pnpm workspaces (`pnpm-workspace.yaml`); `publicHoistPattern: ['*eslint*']` for cross-package lint visibility
- Dependency build scripts are blocked by default; maintain an explicit `allowBuilds` / `ignoredBuiltDependencies` allowlist in `pnpm-workspace.yaml`
- Task graph runner is Turborepo (`turbo.json`); root `//#quality` task composes `//#lint`, `//#format`, type-check, and docs lint
- ! Commit lockfile (`pnpm-lock.yaml`) to pin dependencies `check: test -f $REPO_DIR/pnpm-lock.yaml || test -f $REPO_DIR/package-lock.json || test -f $REPO_DIR/yarn.lock`
- CI blocks PRs on the full lint pipeline: prettier-check, eslint (`--max-warnings=0`), ast-grep lint, language lint, and type check
- CI runs two ESLint configs — a fast non-type-checked config for IDEs, and a type-checked config (`parserOptions.project: true`) for CI gates
- CI runs a test matrix across supported Node versions plus Windows
- Commit messages follow Conventional Commits; `@commitlint/config-conventional` with the type-enum `build|ci|docs|feat|fix|perf|refactor|revert|style|test|release`
- Releases are automated via `semantic-release`; `main` = stable channel, `canary` = prerelease channel; commits to `canary` trigger pre-releases, canary→main merges trigger stable
- ! Version bumped per release by `semantic-release` from commit types; no manual version edits
- Build output contract (Next.js legend): `○` Static / `●` SSG / `λ` Lambda — each page must have a known classification
- Every Vercel deployment is served over HTTPS with an automatically generated certificate; no plaintext endpoints

## testing

- Unit/integration test framework is Jest or Vitest depending on the project (`vercel/next.js` uses Jest; newer repos use Vitest)
- E2E test framework is Playwright
- Test titles are lowercase (`jest/prefer-lowercase-title`, `vitest/prefer-lowercase-title`, `playwright/prefer-lowercase-title`)
- No duplicate hooks in a single describe block (`jest/no-duplicate-hooks`, `vitest/no-duplicate-hooks`)
- ! No focused tests in committed code (`playwright/no-focused-test`) `check: ! git diff $BASE_BRANCH...$BRANCH -- '*.test.*' '*.spec.*' 2>/dev/null | grep -qE "^\+.*\b(test|it|describe)\.only\("`
- Playwright interactions must be awaited (`playwright/missing-playwright-await`)
- Playwright must use web-first assertions, not polling (`playwright/prefer-web-first-assertions`)
- Playwright must not rely on `networkidle` (`playwright/no-networkidle`)
- Playwright must not use standalone `expect` outside tests (`playwright/no-standalone-expect`)
- Playwright `expect` titles and selectors must be valid (`playwright/valid-expect`, `playwright/valid-title`)
- No unsafe element references across navigations (`playwright/no-unsafe-references`)
- Testing pyramid is **inverted**: prioritize end-to-end testing of critical paths over deep unit coverage — "prioritizing end-to-end (E2E) testing for the critical parts of your app will reduce risk and give you the best return" (rauchg, "Develop, Preview, Test")
- Staging is ephemeral: run E2E tests against per-commit Preview Deployments, not a single long-lived staging server
- ! All tests must pass before a PR is merged (CI gate in `.github/workflows/build_and_test.yml`)
- Code Review Agent runs generated patches through real builds + tests + linters in a sandbox before suggesting them — a suggestion that fails the sandbox is never shown

## documentation

- Agent instruction file is `AGENTS.md` at the repo root (the canonical form per the Vercel Code Review agent's priority order); `CLAUDE.md` is a fallback, `.github/copilot-instructions.md` is a lower fallback
- Guideline files are hierarchical and directory-scoped: a root `AGENTS.md` applies everywhere; `src/components/AGENTS.md` adds context for that subtree only
- Guidelines support `@import "file.md"` and relative markdown links for composition
- Combined guideline files are capped at 50 KB total
- Guidelines encode: code style not enforced by linters, architecture patterns, project-specific pitfalls, testing requirements
- Guidelines are **context, not instructions**; the Code Review agent's core behavior (bugs, security, performance) overrides any conflicting guideline
- All TypeScript files follow TSDoc syntax (`tsdoc/syntax: error`)
- JSDoc in TypeScript files must not duplicate type info (`jsdoc/no-types: error`, `jsdoc/no-undefined-types: error` in `vercel/next.js`)
- README structure for packages: intro → install → usage → per-export sections; peer-dependency model with explicit install snippets per package manager
- Documentation philosophy (rauchg): frameworks should encode expert best practices so humans don't have to memorize them; "our job is no longer to empower and delight developers, but also their agents" ("The AI Cloud")

## environment

- Three default environments exist: Local, Preview, Production (plus Custom environments for Pro/Enterprise teams: 1 for Pro, 12 per project for Enterprise)
- Local environment is provisioned with `vercel link` then `vercel env pull`, which populates `.env.local`
- Every non-production branch push and every PR creates a Preview Deployment with a unique URL
- Preview URLs come in two forms: branch-specific (always-latest) and commit-specific (immutable)
- Production deploys happen on push/merge to the production branch or via `vercel --prod`
- Custom environments support branch tracking and attached persistent domains: `vercel deploy --target=staging`, `vercel pull --environment=staging`, `vercel env add MY_KEY staging`
- Development workflow mantra is **Develop → Preview → Ship**; preview URLs are the collaboration primitive, replacing monolithic staging servers
- Every Preview Deployment gets HTTPS via an auto-issued certificate
- Dev tooling is bash + gh CLI + pnpm + Node LTS; Git branching uses feature branches plus `canary` prerelease branch for framework packages
- Git worktrees are acceptable for parallel-safe feature work; never commit directly to the default branch
- Environment variables are scoped at team or project level, encrypted at rest, and visible to all project members; safe for tokens and secrets
- Environment variable payload cap is 64 KB per deployment; no single variable may exceed 64 KB; Edge runtime variables are capped at 5 KB each
- Branch-specific environment variables override preview environment variables with the same name
- Environment variable changes only apply to new deployments, never retroactively
- When using `vercel dev`, skip `vercel env pull` — `vercel dev` loads Development Environment Variables into memory automatically

## quality

- No default exports in library code (`import/no-default-export`) — forces single-source-of-truth named exports
- No mutable exports (`import/no-mutable-exports`) — no cross-module mutable state
- No import cycles (`import/no-cycle`)
- Array/object index access returns `T | undefined` (`tsconfig.noUncheckedIndexedAccess: true`)
- Switch exhaustiveness enforced on union types (`@typescript-eslint/switch-exhaustiveness-check`)
- Base TS config is `strict: true`, `noFallthroughCasesInSwitch: true`, `forceConsistentCasingInFileNames: true`, `esModuleInterop: true`, `skipLibCheck: true`
- Unused variables are errors (`no-unused-vars: error`); unused eslint-disable directives are errors (`reportUnusedDisableDirectives`)
- No hard file-size or function-length cap is encoded in the Vercel style guide; quality is enforced via type strictness, exhaustiveness, and import hygiene rather than size limits
- No lint rule blocks TODO/FIXME comments; Vercel does not lint-gate TODOs
- Performance rules from `vercel-labs/agent-skills/react-best-practices` are first-class correctness rules; treat the CRITICAL-impact ones as strict:
- Avoid barrel-file imports from large libraries; use `optimizePackageImports` (Next.js 13.5+) or direct deep imports for `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@headlessui/react`, `@radix-ui/react-*`, `lodash`, `ramda`, `date-fns`, `rxjs`, `react-use`
- No async waterfalls in API routes, Server Actions, or RSC trees; independent awaits must run in parallel via `Promise.all` or chained `.then`
- Check cheap sync conditions before expensive async flags; defer `await` until the branch that needs it
- Server Actions must be treated as public API endpoints — always authenticate and authorize inside each action
- Never define React components inside other components — causes remount on every render
- Use `next/dynamic` for heavy components (Monaco, editors, charts) to keep them out of the initial bundle
- Use `React.cache()` for per-request memoization; use `lru-cache` for cross-request memoization; Next.js `fetch` is already deduped
- Use `after()` from `next/server` for non-blocking post-response work (logging, analytics, cache invalidation)
- Hoist static I/O (fonts, config, logos) to module scope so Fluid Compute can amortize it across requests
- Pass only the fields the client needs across the RSC boundary; serialized payload is embedded in HTML and RSC streams
- Calculate derived state during rendering, not in effects; use `useDeferredValue` (wrapped in `useMemo`) for expensive derivations
- Prefer compound components and context-based DI over boolean prop proliferation; "Lift state, compose internals, make state dependency-injectable" (`composition-patterns`)
- Use Compiler-friendly idioms: React Compiler makes manual `useMemo`/`useCallback` largely unnecessary
- JavaScript-level performance: build `Map` index tables for repeated lookups; use `Set` for O(1) membership; hoist `RegExp` creation; cache repeated pure-function calls at module scope; avoid layout thrashing (don't interleave style writes with layout reads)

## observability

- Instrumentation uses the `@vercel/otel` package; do not roll manual `@opentelemetry/sdk` wiring — Session Tracing and Trace Drains require `@vercel/otel`
- Create `instrumentation.ts` (or `.js`) at project root; for Next.js with `src/`, place it in `src/`
- Minimal init: `registerOTel({ serviceName: 'your-project-name' })` inside an exported `register()` function
- Context propagation is configured via `instrumentationConfig.fetch` with `propagateContextUrls`, `dontPropagateContextUrls`, and `ignoreUrls` allow/deny lists
- Custom spans use `@opentelemetry/api` (`tracer.startSpan`, `span.setAttributes`, `span.end`) inside a try/finally
- Custom spans are **not** supported in the Edge runtime; do not attempt to create them there
- Sampling is AND-based: both the inbound trace decision (if present) and Vercel's sampling rules must agree to sample
- Tracked event categories are fixed: Edge Requests, Vercel Function Invocations, External API Requests, Routing Middleware Invocations, AI Gateway Requests
- Debug production errors by: pick feature → pick time window → inspect Error Rate graph → reorder routes by error rate or duration → drill to function view → follow link to logs
- Required Insights dashboards: Vercel Functions, External APIs, Edge Requests, Middleware, Fast Data Transfer, Image Optimization, ISR, Blob, Build Diagnostics, AI Gateway, Queues, External Rewrites, Microfrontends
- Enable Speed Insights to collect real-user Core Web Vitals (LCP, CLS, INP/FID) from field data
- Enable Log Drains to persist deployment logs and forward to a SIEM
- Use Notebooks to save and share observability queries across the team
- Never swallow errors silently; log with context at system boundaries
- Platform direction (rauchg, "The AI Cloud"): observability should produce pull requests, not just dashboards — "an AI Cloud shouldn't give you problem after problem. It should give you solutions: pull requests, recommendations, and automated actions"

## security

- ! No hardcoded credentials, API keys, or access tokens in committed files; no `.env`, `.pem`, `.key`, or token files in the repo
- Secrets live in Vercel Environment Variables (team- or project-scoped, encrypted at rest); pull locally with `vercel env pull` into `.env.local`
- Server-only code must use the `server-only` package to prevent accidental client exposure
- Never expose environment variables to the client unless they are prefixed `NEXT_PUBLIC_` (or the framework's equivalent)
- ! No `eval`, `new Function`, `no-implied-eval`, or `javascript:` URLs (`no-eval`, `no-new-func`, `no-implied-eval`, `no-script-url`)
- ! Never pass unsanitized user input into `child_process.exec` or equivalent shell-interpolating calls
- Commit the lockfile (`pnpm-lock.yaml`) to pin transitive dependencies
- Dependency post-install build scripts are blocked by default; packages that need to run build scripts must be explicitly allow-listed in `pnpm-workspace.yaml`
- Server Actions must authenticate and authorize on every invocation — "Treat Server Actions with the same security considerations as public-facing API endpoints"
- Implement a Content Security Policy (CSP) and the core security headers on production routes
- Enable Deployment Protection on preview environments exposing sensitive data
- Enable the Vercel WAF with Custom Rules, IP Blocking, and Managed Rulesets; use Attack Challenge Mode when under active attack
- Enable BotID on critical routes to filter sophisticated bots before they reach the backend
- DDoS mitigation (L3/L4/L7) is automatic and free on all plans; blocked traffic is not billed
- Firewall rule evaluation order is fixed: DDoS mitigation → WAF IP blocking → WAF custom rules → WAF Managed Rulesets
- Use Middleware for rate limiting; configure Spend Management with a webhook or project pause as a cost circuit-breaker
- Forward firewall and deployment logs to a SIEM via Log Drains; alert on anomalies to respond quickly to threats
- Cookies must comply with the allowed cookie policy (secure, httpOnly, sameSite where appropriate)
- **Agentic architecture rules** (from "Security Boundaries in Agentic Architectures"):
- The harness must never expose its own credentials to the agent directly
- Agents access capabilities only through scoped tool invocations; tools must be as narrow as possible — prefer a tool scoped to one customer's data over a tool that takes a customer ID parameter (parameters are subject to prompt injection)
- Credentials are injected by a secret-injection proxy outside the main security boundary, intercepting outbound traffic and injecting credentials only at the intended endpoint
- Generated code runs in ephemeral Linux VMs that spin up per execution and are destroyed afterward — never in the harness process
- Code Review suggestions are validated in a sandbox before being surfaced; unvalidated suggestions are never shown to the reviewer

---

## Sources

### style

- [`vercel/style-guide` README](https://github.com/vercel/style-guide) — canonical shared config, archived 2025-02-11
- [`vercel/style-guide/prettier/index.js`](https://github.com/vercel/style-guide/blob/canary/prettier/index.js) — `printWidth: 80`, `tabWidth: 2`, `singleQuote: true`, `endOfLine: 'lf'`
- [`vercel/style-guide/.editorconfig`](https://github.com/vercel/style-guide/blob/canary/.editorconfig)
- [`vercel/next.js/.prettierrc.json`](https://github.com/vercel/next.js/blob/canary/.prettierrc.json) — `trailingComma: 'es5'`, `semi: false`
- [`vercel/style-guide/eslint/rules/stylistic.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/stylistic.js) — `camelcase`, `no-nested-ternary`, `no-bitwise`, `new-cap`
- [`vercel/style-guide/eslint/rules/unicorn.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/unicorn.js) — `filename-case: kebabCase`, `prefer-node-protocol`
- [`vercel/style-guide/eslint/rules/import.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/import.js) — order, `no-default-export`, `no-cycle`, `no-mutable-exports`
- [`vercel/style-guide/eslint/rules/best-practice.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/best-practice.js) — `eqeqeq`, `no-eval`, `no-param-reassign`, etc.
- [`vercel/style-guide/eslint/rules/possible-errors.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/possible-errors.js) — `no-console`
- [`vercel/style-guide/eslint/rules/es6.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/es6.js) — `no-var`, `prefer-const`, `object-shorthand`, `prefer-template`
- [`vercel/style-guide/eslint/rules/typescript/index.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/typescript/index.js) — `naming-convention`, `switch-exhaustiveness-check`, type-import style
- [`vercel/style-guide/eslint/rules/comments.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/comments.js) — `require-description`, `reportUnusedDisableDirectives`
- [`vercel/style-guide/eslint/rules/tsdoc.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/tsdoc.js) — `tsdoc/syntax: error`

### build

- [`vercel/style-guide/package.json`](https://github.com/vercel/style-guide/blob/canary/package.json) — `packageManager: pnpm@8.15.4`, Node `>=18.18`
- [`vercel/next.js/package.json`](https://github.com/vercel/next.js/blob/canary/package.json) — `packageManager: pnpm@10.33.0`, Node `>=20.9.0`
- [`vercel/next.js/.node-version`](https://github.com/vercel/next.js/blob/canary/.node-version)
- [`vercel/next.js/pnpm-workspace.yaml`](https://github.com/vercel/next.js/blob/canary/pnpm-workspace.yaml) — `publicHoistPattern`, `allowBuilds` allowlist
- [`vercel/next.js/.github/workflows/build_and_test.yml`](https://github.com/vercel/next.js/blob/canary/.github/workflows/build_and_test.yml) — CI gates
- [`vercel/next.js/turbo.json`](https://github.com/vercel/next.js/blob/canary/turbo.json)
- [`vercel/turborepo/turbo.json`](https://github.com/vercel/turborepo/blob/main/turbo.json) — `//#quality` composite task
- [`vercel/style-guide/.commitlintrc.js`](https://github.com/vercel/style-guide/blob/canary/.commitlintrc.js) — Conventional Commits, type-enum
- [`vercel/style-guide/.releaserc.js`](https://github.com/vercel/style-guide/blob/canary/.releaserc.js) — `semantic-release`, `main` + `canary` channels
- [Vercel docs: Environments](https://vercel.com/docs/deployments/environments) — production promotion, HTTPS default

### testing

- [`vercel/style-guide/eslint/jest.js`](https://github.com/vercel/style-guide/blob/canary/eslint/jest.js)
- [`vercel/style-guide/eslint/vitest.js`](https://github.com/vercel/style-guide/blob/canary/eslint/vitest.js)
- [`vercel/style-guide/eslint/playwright-test.js`](https://github.com/vercel/style-guide/blob/canary/eslint/playwright-test.js)
- [`vercel/style-guide/eslint/rules/playwright-test.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/playwright-test.js) — `no-focused-test`, `missing-playwright-await`, `prefer-web-first-assertions`, `no-networkidle`, `valid-expect`, `valid-title`
- [`vercel/next.js/package.json`](https://github.com/vercel/next.js/blob/canary/package.json) — `test-unit`, `testonly`, `test-types` scripts
- [rauchg, "Develop, Preview, Test"](https://rauchg.com/2020/develop-preview-test) — inverted testing pyramid, ephemeral staging, test in production
- [Vercel docs: Agent PR Review](https://vercel.com/docs/agent/pr-review) — sandbox validation of suggestions

### documentation

- [Vercel docs: Agent PR Review — Guideline hierarchy](https://vercel.com/docs/agent/pr-review) — `AGENTS.md` > `CLAUDE.md` > `.github/copilot-instructions.md` > Cursor/Windsurf/Cline/Roo/etc., 50 KB cap, directory inheritance, `@import`
- [`vercel/style-guide/eslint/rules/tsdoc.js`](https://github.com/vercel/style-guide/blob/canary/eslint/rules/tsdoc.js)
- [`vercel/next.js/eslint.config.mjs`](https://github.com/vercel/next.js/blob/canary/eslint.config.mjs) — `jsdoc/no-types`, `jsdoc/no-undefined-types`
- [rauchg, "The AI Cloud"](https://rauchg.com/2025/the-ai-cloud) — "our job is no longer to empower and delight developers, but also their agents"

### environment

- [Vercel docs: Environments](https://vercel.com/docs/deployments/environments) — Local/Preview/Production/Custom, branch tracking, CLI targets, auto-HTTPS
- [Vercel docs: Environment Variables](https://vercel.com/docs/environment-variables) — scope, 64 KB cap, 5 KB Edge cap, encryption, branch override semantics, `vercel dev` auto-load
- [rauchg, "Vercel"](https://rauchg.com/2020/vercel) — "Deploy Preview > Code Review. URLs as the Collaboration Primitive"
- [rauchg, "Next for Vercel"](https://rauchg.com/2020/next-for-vercel) — Develop → Preview → Ship mantra
- [rauchg, "Develop, Preview, Test"](https://rauchg.com/2020/develop-preview-test) — preview URLs replace monolithic staging

### quality

- [`vercel/style-guide/typescript/tsconfig.base.json`](https://github.com/vercel/style-guide/blob/canary/typescript/tsconfig.base.json) — `strict: true`, `noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`, `forceConsistentCasingInFileNames: true`
- [`vercel-labs/agent-skills/skills/react-best-practices/AGENTS.md`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md) — 40+ rules across 8 impact-ordered categories (Waterfalls, Bundle, Server, Client, Re-render, Rendering, JavaScript, Advanced)
- [Vercel blog: "How we optimized package imports in Next.js"](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js) — barrel file cost, `optimizePackageImports`, "15-70% faster dev boot, 28% faster builds, 40% faster cold starts"
- [Vercel blog: "How we made the Vercel dashboard twice as fast"](https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast) — module-level Map caching for repeated pure calls
- [`vercel-labs/agent-skills/skills/composition-patterns/AGENTS.md`](https://github.com/vercel-labs/agent-skills/blob/main/skills/composition-patterns/AGENTS.md) — boolean prop proliferation, compound components, lifted state, "Lift state, compose internals, make state dependency-injectable"
- [Next.js docs: Server Actions security](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security) (cited in `react-best-practices`) — "Treat Server Actions with the same security considerations as public-facing API endpoints"

### observability

- [Vercel docs: Observability](https://vercel.com/docs/observability) — tracked events, insights, debugging workflow, Observability Plus
- [Vercel docs: OpenTelemetry / Instrumentation](https://vercel.com/docs/tracing/instrumentation) — `@vercel/otel`, `instrumentation.ts` location, `registerOTel`, context propagation, sampling, Edge-runtime custom-span limitation, Session Tracing / Trace Drains require `@vercel/otel`
- [Vercel docs: Production Checklist](https://vercel.com/docs/production-checklist) — Speed Insights, Log Drains, performance headers
- [rauchg, "The AI Cloud"](https://rauchg.com/2025/the-ai-cloud) — observability should produce PRs, not dashboards
- [rauchg, "Making the Web. Faster."](https://rauchg.com/2021/making-the-web-faster) — Real Experience Score

### security

- [Vercel docs: Security](https://vercel.com/docs/security) — multi-layered protection, HTTPS default
- [Vercel docs: Vercel Firewall](https://vercel.com/docs/vercel-firewall) — WAF tools, rule execution order, JA3/JA4 fingerprinting
- [Vercel docs: DDoS Mitigation](https://vercel.com/docs/vercel-firewall/ddos-mitigation) — automatic L3/L4/L7, free on all plans, Attack Challenge Mode
- [Vercel docs: Environment Variables](https://vercel.com/docs/environment-variables) — encrypted at rest, scope model
- [Vercel docs: Production Checklist](https://vercel.com/docs/production-checklist) — CSP, Deployment Protection, WAF, Log Drains, rate limiting, cookie policy, lockfile commits
- [Vercel blog: "Security Boundaries in Agentic Architectures"](https://vercel.com/blog/security-boundaries-in-agentic-architectures) — harness/agent isolation, scoped tools, secret-injection proxy, ephemeral VMs, "The harness should never expose its own credentials to the agent directly", "The agent should access capabilities through scoped tool invocations, and those tools should be as narrow as possible"
- [Vercel blog: "Introducing BotID"](https://vercel.com/blog/introducing-botid) — invisible bot filtering for critical routes
- [Vercel docs: Agent PR Review](https://vercel.com/docs/agent/pr-review) — sandbox validation, on-demand `@vercel` mentions, training privacy
- [`vercel/next.js/pnpm-workspace.yaml`](https://github.com/vercel/next.js/blob/canary/pnpm-workspace.yaml) — `allowBuilds` allowlist blocks post-install scripts by default
- Next.js docs on `server-only` package and env var precedence (referenced from the Next.js Academy Environment & Security module)

### Meta / direction

- [rauchg, "The AI Cloud" (2025)](https://rauchg.com/2025/the-ai-cloud) — Framework-defined Infrastructure, Code Review Agent as "a dedicated, expert colleague who looks at your code with a healthy amount of skepticism", Firewall Agent, observability → PRs
- [rauchg, "Vercel" (2020)](https://rauchg.com/2020/vercel) — components as the right frontend primitive; speed as a design axis
- [rauchg, "Next for Vercel" (2020)](https://rauchg.com/2020/next-for-vercel) — zero-config, hybrid SSR/SSG, compute everywhere, Core Web Vitals as fitness function
- [rauchg, "Static Hoisting" (2020)](https://rauchg.com/2020/static-hoisting) — hoist computation to the edge, pre-compute as much as possible
- [rauchg, "7 Principles of Rich Web Applications" (2014)](https://rauchg.com/2014/7-principles-of-rich-web-applications) — pre-rendering is not optional; act immediately on user input
- [`vercel-labs/agent-skills` README](https://github.com/vercel-labs/agent-skills) — skill catalog (react-best-practices, composition-patterns, react-native-skills, react-view-transitions, web-design-guidelines, deploy-to-vercel, vercel-cli-with-tokens)
