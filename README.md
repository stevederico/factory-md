```
           ~ ~       ~
          ~ ~ ~     ~ ~
           ~ ~       ~
            |         |
       _____|_________|_____
      |                     |
      |   [#]   [#]   [#]   |
      |   [#]   [#]   [#]   |
      |_____________________|

        f a c t o r y . m d
```

# factory.md

**A Dockerfile for code factories.**

`factory.md` is a single markdown file at the root of a repository. It holds the standards an autonomous coding agent must follow to ship code in that repo — coding style, build environment, testing, documentation, dev environment, code quality, observability, and security — all in one place.

Clone a factory, run it anywhere.

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

## Strict rules (`!` prefix)

A rule prefixed with `!` is **strict**: it must be verified by deterministic code. If the framework does not recognize the rule, the pipeline fails — the rule is never trusted to the agent alone.

```markdown
## security
- ! No hardcoded credentials
- ! No eval
- Dependency audit clean
```

Here the first two bullets block the pipeline unless a deterministic check exists for them. The third falls through to the agent if unrecognized.

Use strict prefixes for rules you refuse to trust a model on — security gates, correctness invariants, release-critical checks. Leave rules plain when natural-language enforcement by the agent is acceptable.

The `!` is stripped before matching, so `! No eval` and `No eval` hit the same check implementation. Only the dispatch behavior on the unrecognized path differs.

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

See `examples/` for real-world factory files.

## Parsing rules

1. Section headings are matched case-insensitively against the 8 reserved names.
2. Bullets can use `-`, `*`, or `+` markers.
3. A leading `!` (before or after whitespace) marks a bullet as strict.
4. Unknown sections are preserved and ignored.
5. YAML frontmatter is allowed for metadata: `name`, `version`, `framework_min_version`.
6. Anything before the first H2 is preamble.

## Spec versioning

This document describes `factory.md` **v1**. Future versions are backward-compatible at the section level: existing reserved names will not change meaning. New reserved sections may be added in later versions.

## Implementations

- **[Shipyard](https://github.com/stevederico/shipyard)** — reference implementation. `factory.sh` reads `factory.md` from the repo root, injects every section into the agent prompt as rules, and dispatches bullets against a built-in check library. Unrecognized plain bullets are forwarded to the agent; unrecognized strict bullets block the pipeline.
- *(your framework here — PRs welcome)*

## Contributing

Open an issue or PR. Spec changes should land as discussion first.

## License

MIT — see [LICENSE](LICENSE).
