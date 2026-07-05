# factory.md checker

A minimal, zero-dependency reference checker. It parses the strict (`!`) rules
that carry an inline `` `check:` `` suffix and runs each against a repo — the
deterministic slice of the spec any framework can reuse.

```bash
# run every check: gate against the current branch
node factory.mjs ../examples/vercel.md --repo /path/to/repo

# run only one stage's gates (uses the v2 ## stages section)
node factory.mjs ../examples/vercel.md --repo /path/to/repo --stage check
```

Flags: `--repo <dir>` (default cwd), `--base <branch>` (default main/master),
`--branch <branch>` (default HEAD), `--stage <build|check|ship|monitor>`.

Exit code = number of failing rules. It runs only rules with a `check:` suffix;
plain-language rules are left for an agent-driven framework like
[Shipyard](https://github.com/stevederico/shipyard).
