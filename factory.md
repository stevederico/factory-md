# factory.md specification

**Version 2**

`factory.md` is a single markdown file at the root of a repository. It holds the standards an autonomous coding agent must follow to ship code in that repo — coding style, build environment, testing, documentation, dev environment, code quality, observability, and security — all in one place.

## Why not AGENTS.md?

`AGENTS.md` is freeform prose about how to write code in a repo. `factory.md` is a fixed set of named sections any framework can parse. They are complementary: a repo may have both.

## Location

Place `factory.md` at the root of the repository. Frameworks should look for it before falling back to framework-specific config.

## Format

Standard CommonMark markdown. H2 headings (`##`) are reserved section names. Every section is a bullet list of rules. Frameworks read what they understand and ignore the rest. **All sections are optional.**

## The 8 sections

| # | Section | What it covers |
|---|---|---|
| 1 | `## style` | Formatting, naming, function size, imports, changelog hygiene |
| 2 | `## build` | Runtime, package manager, CI workflow, version bumping |
| 3 | `## testing` | Test framework, colocations, pass/fail gates |
| 4 | `## documentation` | Doc comments, README, AGENTS.md updates |
| 5 | `## environment` | Dev tools, branching rules, worktrees |
| 6 | `## quality` | File size, function size, TODO/FIXME, complexity |
| 7 | `## observability` | Logging, error reporting, tracing |
| 8 | `## security` | Hardcoded credentials, dangerous patterns, dependency checks |

Each section is a bullet list. Every bullet is one rule. Plain English.

## Rule dispatch

Frameworks read each bullet and decide what to do with it:

- **Recognized as a gate** — the framework runs a check. If it passes, the pipeline continues. If it fails, the pipeline blocks (or a remediation stage kicks in).
- **Recognized as a runtime hint** — the framework uses it to configure the environment (e.g. `node 20` → install Node 20).
- **Unrecognized** — the framework forwards the bullet to the agent as an additional rule to honor.

The spec does not prescribe which bullets must be gates vs hints vs forwarded. Authors write rules in plain English; frameworks do the best they can and forward the rest.

### Optional inline check (`check:` suffix)

A bullet may carry its own verification command in a trailing backtick block prefixed with `check:`. A framework that understands the suffix runs the command and uses its exit code (0 = pass, non-zero = fail). Frameworks that do not understand it ignore the suffix and fall back to keyword matching or agent forwarding.

```markdown
- ! No console.* in committed code `check: ! git diff $BASE_BRANCH...$BRANCH | grep -qE '^\+.*console\.'`
- ! Prettier clean `check: pnpm prettier --check .`
```

The suffix is a framework-specific hint, not a portable contract: the shell dialect, available commands, and exported environment variables are defined by the framework running the check. Authors should only add a `check:` suffix when they know which framework will consume it.

## Strict rules (`!` prefix)

A rule prefixed with `!` is **strict**: it must be verified by deterministic code. If the framework does not recognize the rule, the pipeline fails — the rule is never trusted to the agent alone.

`!` is a contract with the **consuming framework**, not a badge describing how the originating organization enforces the rule internally. Only mark a rule strict if the framework running the factory.md can verify it with a deterministic check — a shell one-liner, a file-existence test, an `eslint`/`tsc`/`prettier` invocation the framework actually runs, or a `` `check:` `` suffix. Do not mark a rule strict just because the authoring team gates it in their own CI; if the consumer has no way to run that gate, leave the bullet plain and it will be forwarded to the agent.

```markdown
## security
- ! No hardcoded credentials
- ! No eval
- Dependency audit clean
```

Here the first two bullets block the pipeline unless a deterministic check exists for them. The third falls through to the agent if unrecognized.

Use strict prefixes for rules you refuse to trust a model on — security gates, correctness invariants, release-critical checks. Leave rules plain when natural-language enforcement by the agent is acceptable.

The `!` is stripped before matching, so `! No eval` and `No eval` hit the same check implementation. Only the dispatch behavior on the unrecognized path differs.

## Stages (v2)

v1 declares *rules*, grouped into the 8 gate categories above. It does not say *when* in the lifecycle each runs — the consuming framework decides. **v2 adds an optional stage layer** so a `factory.md` can declare the pipeline itself. It is fully backward-compatible: a v1 file (no stage sections) behaves exactly as before.

Three new reserved sections:

| Section | Kind | Purpose |
|---|---|---|
| `## stages` | declaration | Ordered pipeline; maps each stage to the gate categories that run in it |
| `## triage` | prompt | Freeform prompt: classify an incoming task and route it |
| `## plan` | prompt | Freeform prompt/template the agent fills before building |

`## triage` and `## plan` are **prompt sections** — freeform markdown the framework runs as an agent prompt, *not* bullet-list gates. The 8 gate sections are unchanged.

### `## stages`

One bullet per stage, in execution order — `- <stage>: <value>`:

- `<value>` = `prompt` → run the executable prompt in the like-named section (`## triage`, `## plan`).
- `<value>` = a comma-list of gate-category names → run those categories' rules as gates at this stage.

A category may appear in more than one stage; its gates run at each (e.g. `security` gates both `test` and `ship`). Stages execute top to bottom.

```markdown
## stages
- triage: prompt
- plan: prompt
- build: style, build, environment
- test: testing, quality, documentation, security
- ship: security, documentation
- monitor: observability

## triage
Classify the task, then emit one line — `route: build` or `route: plan` — plus a one-sentence reason.
- route: build — simple, unambiguous, single-file, no new dependency.
- route: plan — new surface, >1 subsystem, schema/behavior change, or any new dependency.
When in doubt, route: plan.

## plan
Fill this template into plan.md; a human approves it before build.
- Intent (product): what changes for the user, and the invariant that must hold after.
- Out of scope: what this explicitly does not do.
- Targets (tech): files/functions to touch, with paths; any new dependency.
- Acceptance: checks that prove it works — each a command or an observable behavior.
```

### Backward compatibility

`## stages` is optional. A framework that doesn't understand it — or a `factory.md` without it — falls back to v1 behavior: run every recognized gate in one pass. No existing `factory.md` breaks.

## Minimal example

```markdown
## style
- camelCase functions, PascalCase components
- Functions max 50 lines
- ! No secrets in diff
- ! CHANGELOG updated per PR

## testing
- Vitest, colocated .test.js
- ! All tests pass before PR

## security
- ! No hardcoded credentials
- ! No eval
```

## Full example

````markdown
---
name: detroit
version: 1
---

# detroit factory

Rules prefixed with `!` are strict: the framework must verify them deterministically or the pipeline fails.

## style
- camelCase functions, PascalCase components, UPPER_SNAKE_CASE constants
- Booleans prefixed with `is`, `has`, or `should`
- Functions max 50 lines, single responsibility, early returns, no magic numbers
- Imports ordered: external then internal then relative
- ! No secrets, .env, .pem, .key, credentials, or tokens in committed files
- ! CHANGELOG.md updated per PR

## build
- node 20
- gh CLI authenticated
- CI workflow at `.github/workflows/ci.yml` (auto-generate if missing)
- ! `package.json` version bumped per PR (minor bump by default)

## testing
- Vitest, colocated `.test.js` files
- ! All tests must pass before a PR is opened
- New code requires new tests

## documentation
- JSDoc on exported/public functions (`#` for Shell, `///` for Swift)
- README updated for user-facing changes
- AGENTS.md or CLAUDE.md updated for agent-facing changes
- Doc comments must match the implementation

## environment
- bash + python3 + gh CLI
- Worktrees for parallel-safe feature branches
- Never commit directly to the default branch

## quality
- ! No files over 500 lines
- No functions over 50 lines
- ! No new TODO or FIXME introduced in the diff

## observability
- Log errors with context at system boundaries
- Error reporting on new error paths
- Never swallow errors silently

## security
- ! No hardcoded credentials, API keys, or access tokens
- ! No `eval()` or equivalent
- ! No `child_process.exec` with interpolated user input
````

## Parsing rules

1. Section headings are matched case-insensitively against the reserved names (8 gate sections + the v2 `stages`, `triage`, `plan` sections).
2. Bullets can use `-`, `*`, or `+` markers.
3. A leading `!` (before or after whitespace) marks a bullet as strict.
4. Unknown sections are preserved and ignored.
5. YAML frontmatter is allowed for metadata: `name`, `version`, `framework_min_version`.
6. Anything before the first H2 is preamble.
7. **(v2)** `## stages` bullets are `name: value`, where `value` is `prompt` or a comma-list of gate-category names. Stages execute top to bottom; a category may repeat across stages.
8. **(v2)** `## triage` and `## plan` are prompt sections — their freeform body is run as an agent prompt, not parsed as gates.

## Spec versioning

This document describes `factory.md` **v2**. Versions are backward-compatible at the section level: existing reserved names never change meaning, and new reserved sections are always optional. **v2** added the stage layer (`## stages`, `## triage`, `## plan`); a v1 file remains valid and runs unchanged under a v2 framework.
