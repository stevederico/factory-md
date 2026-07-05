```
███████╗ █████╗  ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗
██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝
█████╗  ███████║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ 
██╔══╝  ██╔══██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  
██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   
╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   
```

# factory.md

**A Dockerfile for code factories.**

`factory.md` is a single markdown file that holds every standard an autonomous coding agent must follow to ship code in a repo — coding style, build environment, testing, documentation, dev environment, code quality, observability, and security — in 8 named sections.

**v2** adds an optional stage layer (`## stages`, `## triage`, `## spec`) so one file can declare the whole pipeline — triage → spec → build → check → ship → monitor — not just the rules. Backward-compatible: v1 files run unchanged.

Clone a factory, run it anywhere.

## Specification

The canonical spec lives in **[factory.md](factory.md)**.

## Implementations

- **[Shipyard](https://github.com/stevederico/shipyard)** — reference implementation. `factory.sh` reads `factory.md` from the repo root, injects every section into the agent prompt as rules, and dispatches bullets against a built-in check library.
- *(your framework here — PRs welcome)*

## Contributing

Open an issue or PR. Spec changes should land as discussion first.

## License

MIT — see [LICENSE](LICENSE).
