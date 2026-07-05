# factory.md — workflow

The end-to-end flow that turns an idea into a merged PR. One idea in, one PR out.
Humans touch only two gates: **approve the spec** and **merge the PR**. Everything else is automated.

```
IDEA ─► SPEC ─►[human]─► BUILD ─► CHECK ─┬─fail─► BUILD (loop)
                                          └─pass─► SHIP ─►[human]─► MONITOR ─► IDEA
```

---

## Files

```
factory.md          rules — the house style (style/build/testing/docs/env/quality/security/observability)
spec.md             the plan for one change (product intent + tech targets)
checker/factory.mjs     the grader (CHECK). Runs every `!` rule's `check:` command.
```

`factory.md` is the constant. `spec.md` is regenerated per idea. The grader never changes between ideas.

---

## Stages

### 1. Idea
- **In:** one line of intent ("add a dark-mode toggle").
- **Source:** you, a ticket, a Slack message, or a Monitor signal (stage 6).
- **Out:** a string. No file yet.

### 2. Spec  →  `factory spec "<idea>"`
- **In:** the idea string + `factory.md` (so the plan already respects house rules).
- **Action:** an agent drafts a plan: what changes, which files, acceptance criteria.
- **Out:** `spec.md`.
- **Gate (human):** you read/edit/approve `spec.md`. This is the cheapest place to correct course — do it here, not after code exists.

### 3. Build  →  `factory run spec.md`  (part 1)
- **In:** approved `spec.md` + `factory.md` as context.
- **Action:** a coding agent writes a diff on a fresh branch.
- **Out:** uncommitted changes in the working tree.

### 4. Check  →  `factory run spec.md`  (part 2, automatic)
- **In:** the working-tree diff + `factory.md`.
- **Action:** `checker/factory.mjs` parses every `! … check:` rule and runs its shell command against the branch.
- **Out:** per-rule ✓/✗ and an exit code = number of failures.
- **Decision:**
  - `exit ≠ 0` → collect the failing rules + their `check:` output, feed back to **Build**. Loop.
  - `exit = 0` → the diff is provably in-spec. Continue to Ship.
- **Loop guard:** cap at N attempts (e.g. 5). If still failing, stop and hand the failures to a human.

### 5. Ship  →  (end of `factory run`)
- **In:** a green diff.
- **Action:** commit, push branch, open PR. PR body = the spec + the grader's green report.
- **Gate (human):** you review and merge. Risk management, not rule-checking — the rules already passed.
- **Security note:** `security` rules are a hard gate here — a secret-leak `check:` failing blocks Ship even if everything else is green.

### 6. Monitor
- **In:** the shipped change, live.
- **Action:** watch crashes / usage / errors (the `observability` rules define what's logged).
- **Out:** a signal. Regressions or new needs become a fresh **Idea** → back to stage 1.

---

## The rulebook maps to stages

The 8 `##` sections in `factory.md` are **not** stages — they are *what the gates enforce*.

| section | enforced at |
|---|---|
| style, build, testing, documentation, environment, quality | Check |
| security | Check **and** Ship |
| observability | Monitor |

---

## Human-in-the-loop

Two gates only:
1. **Approve spec** (stage 2) — steer before any code exists.
2. **Merge PR** (stage 5) — final risk call on a pre-verified diff.

Everything between them runs unattended.

---

## Status

| piece | state |
|---|---|
| `factory.md` rules | ✅ exist (stripe, vercel) |
| Check / grader (`checker/factory.mjs`) | ✅ built, passing |
| `factory spec` (stage 2) | ⬜ to build |
| `factory run` build+loop (stages 3–5) | ⬜ to build |
| Monitor (stage 6) | ⬜ later |

**Next:** wire stages 2–5 into the `factory` CLI so `factory spec` → `factory run` completes the loop around the grader that already works.
