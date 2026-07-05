**TL;DR** — This is a `factory.md` v1 file encoding how an autonomous coding agent should ship code in a Stripe-style repo. Every rule is derived from publicly available Stripe material: the 12 `stripe/*` GitHub repos (stripe-node, stripe-ruby, stripe-python, stripe-go, stripe-java, stripe-php, stripe-dotnet, stripe-cli, stripe-mock, smokescreen, veneur, sorbet), Stripe's engineering blog (both `stripe.com/blog/engineering` and the canonical `stripe.dev/blog` — 20 engineering posts deep-read), Stripe docs (API reference, webhooks, idempotency, rate limits, security), Brandur Leach's essays on brandur.org (idempotency keys, canonical log lines, API versioning, transactionally-staged job drains, Postgres patterns), Patrick Collison's writing (patrickcollison.com — "Fast", advice), Stripe engineer essays via Increment magazine (Nelson Elhage, Michelle Bu, Charity Majors), Will Larson's posts on Stripe's practices, and Gergely Orosz's Pragmatic Engineer deep-dives on Stripe's engineering culture ("Inside Stripe's Engineering Culture" Parts 1 & 2, "The Pulse #87"). Rules prefixed with `!` are **strict**: a framework must verify them deterministically (CI check, lint, type check, test gate) or the pipeline fails. Every rule is traceable to a URL in the `## Sources` appendix. Where `stripe/stripe-ruby` and `stripe/stripe-node` diverge, SDK-specific rules are flagged; shared rules are treated as canonical.

Preamble philosophy (drawn from Patrick Collison's *Fast* and *Advice*, Brandur's *Minimalism*, Charity Majors' *I test in production*, and Stripe's stated engineering principles): **passive safety, idempotency, ACID by default, one wide structured log line per request, date-pinned API versions, zero-downtime migrations, throughput over ceremony, and taking pride in debuggability and quality**. Collison: "Being way more persistent than others and being ok with taking longer than any reasonable person would." Majors: "A modern software engineer's job is not done until they have watched users use their code in production." Brandur: "API backends should aim to be passively safe — no matter what kind of failures are thrown at them they'll end up in a stable state." Elhage: "There is no magic. There is no layer beyond which we leave the realm of logic."

---

```
---
name: stripe
version: 2
framework_min_version: 1
---
```

# stripe factory

Rules for an autonomous agent to ship code in a Stripe-style repo. Derived entirely from public Stripe, Stripe-engineer, and Brandur Leach sources. Rules prefixed with `!` are strict.

**v2 — whole-factory.** The `## stages` section declares the pipeline and maps the 8 gate categories to lifecycle stages. `## triage` and `## plan` are **executable prompts** the agent runs; the eight category sections carry the `!`+`check:` rules the framework enforces at each stage.

## stages
- triage: prompt
- plan: prompt
- build: style, build, environment
- check: testing, quality, documentation, security
- ship: security, documentation
- monitor: observability

## triage

> stage: triage — executable prompt. The agent runs this to route an incoming idea.

Classify the idea, then emit exactly one line: `route: build` or `route: plan` + a one-sentence reason.

- **`route: build`** — simple and unambiguous: typo, copy, config, single-file change, no new API or dependency.
- **`route: plan`** — complex or ambiguous: new API surface, touches >1 SDK/service, schema/migration/behavior change, or any new dependency.
- When in doubt, `route: plan`. Validate the concept against a hypothetical integration guide before building — if no one could build from it, the design is wrong (Payment APIs: First 10 Years).

## plan

> stage: plan — executable prompt. The agent fills this template into `plan.md`; a human approves it before Build.

```
# <title>

## Intent            (product)
What changes for the user, and the invariant that must hold after (payments require 100% accuracy — a mostly-correct change is a failure).

## Out of scope
What this explicitly does NOT do.

## Targets           (tech)
Files/functions to touch, with paths. Any new dependency (must clear the `build` rules). Migrations follow the zero-downtime dual-write pattern.

## Acceptance
Deterministic checks that prove it works — each a command or an observable, script-generated artifact. Never accept an error response as a success signal.
```

- The plan must be buildable from itself; error and edge behavior are part of Intent, not an afterthought (Michelle Bu: actionable errors).
- Prefer acceptance items that reuse existing `check`-stage rules; don't reinvent a gate that already exists.

## style

- All field, parameter, and JSON key names are `snake_case` (evident from every Stripe API example: `starting_after`, `has_more`, `payment_intent`, `decline_code`)
- Every resource has an `id` string and an `object` string field naming its type; treat `id` as opaque — never parse prefixes like `ch_`, `cus_`, `pi_`
- Every resource collection exposes plural-noun endpoints and the standard list envelope `{object: "list", data: [...], has_more: bool, url: string}`
- Paginate list endpoints with `limit` (1–100, default 10), `starting_after`, and `ending_before` cursors (mutually exclusive); return results in reverse chronological order
- Never parse or validate Stripe object ID prefixes in client code — "Changes to opaque string formatting, including ID prefixes, are considered backward-compatible"
- Request bodies are `application/x-www-form-urlencoded`; response bodies are `application/json`
- No bulk updates — "work on only one object per request"
- Field additions and new endpoints are non-breaking and land without a new API version; removing a field, renaming a field, or changing a field's type is breaking and requires a new version
- Language-specific formatters are pinned and enforced on every PR (not suggestions): Prettier in stripe-node, RuboCop 1.75.2 in stripe-ruby, ruff in stripe-python, gofmt + goimports in stripe-go/stripe-cli, Spotless `googleJavaFormat` in stripe-java, `php-cs-fixer` in stripe-php, `dotnet format` in stripe-dotnet, `clang-format` in sorbet
- `stripe-node` Prettier settings: `{arrowParens: "always", trailingComma: "es5", bracketSpacing: false, singleQuote: true}`
- `stripe-ruby` RuboCop: double-quoted string literals, frozen string literal comment always, consistent trailing commas, inline access modifiers, max method length 55, max block length 40, max parameter list 8, `AbcSize`/`ClassLength`/`ModuleLength` disabled
- `stripe-node` ESLint bans `no-eval`, `no-implied-eval`, `no-new-func`, `no-sync`, `no-await-in-loop`, `no-nested-ternary`, `no-warning-comments`, `no-throw-literal`; requires `curly`, `prefer-const`, `prefer-promise-reject-errors`, `require-await`, `radix`; `@typescript-eslint/explicit-function-return-type: error` on non-test code
- `stripe-python` ruff `line-length = 79`; custom `flake8_stripe` plugin bans public methods where forbidden (BAN), enforces typing import conventions (SPY), Stripe import conventions (IMP), and async naming conventions (ASY); re-enables B006 (forbid mutable default args)
- `stripe-go` uses `staticcheck` with `checks = ["all", "-ST1005", "-ST1021"]` — every other staticcheck is an error
- `stripe-cli` uses golangci-lint v2.10.1 with 16 enabled linters including `bodyclose`, `dupl`, `gocritic`, `gocyclo`, `govet` (all), `ineffassign`, `misspell`, `nakedret`, `staticcheck`, `unused`, `whitespace`
- `stripe-java` compiles with `-Werror` (warnings are errors), `-Xlint:all`, Errorprone, and JDK 17 pinned as the build JVM
- `stripe-php` runs PHPStan at `level: 2` with a committed baseline file, and PHP-CS-Fixer ruleset `@PSR2 + @PhpCsFixer + @PhpCsFixer:risky`
- Error messages should be actionable: "Error messages should include instructions on how to fix the problem" (Michelle Bu)
- Prefer structural correctness to conventions: split request handling into a **load phase** (bulk-load everything for N resources) and a **render phase** with zero database access, to prevent N+1s at the type level (brandur two-phase render)
- Do not use soft deletion — "in ten plus years, did anyone ever actually use soft deletion to undelete something?" Use a dedicated `deleted_record` table with JSONB row storage instead (brandur)
- Standardize on one database, one language/runtime, one job queue, one web server, one reverse proxy per repo; when introducing new tech, retire old tech simultaneously (brandur minimalism)
- Payment-method eligibility (and other policy-heavy configuration) is externalized to Dashboard/config, not hardcoded in client code — "simpler, safer, and more future-proof" (Dynamic Payment Methods post)
- API design principle: package APIs for different user needs — "simple surface for common cases, deeper power when required"; "a great API product stays out of the developer's way for as long as possible" (Payment APIs: First 10 Years)
- Validate API concepts against a hypothetical integration guide before committing to them — if no one could build from the guide, the design is wrong (Payment APIs: First 10 Years)
- In API design sessions: close laptops, sketch with colors/shapes before naming concepts (to avoid definition anchoring), pace decisions across sessions (Payment APIs: First 10 Years)

## build

- Code is generated from an OpenAPI spec + private codegen; generated files carry the marker `File generated from our OpenAPI spec.`; edits to generated blocks outside the unmanaged regions are forbidden
- Every SDK repo ships `VERSION`, `CODEGEN_VERSION`, and `OPENAPI_VERSION` files at the root
- `just` is the canonical task runner; every SDK CI invokes `just lint`, `just format-check`, `just test`, `just ci-test`, `just build`; `Makefile` wrappers are marked deprecated
- Contributors sign the CLA via `@CLAassistant` before any PR is mergeable
- Supported-version windows are defined at https://docs.stripe.com/sdks/versioning and encoded in the CI test matrix — not fabricated per repo
- `stripe-node` requires Node `>=18`; CI matrix: Node 18, 20, 22, 24 on `ubuntu-24.04`; publishing uses OIDC trusted publishing to npm
- `stripe-ruby` requires Ruby `>= 2.7.0`; CI matrix: 2.7, 3.0, 3.1, 3.2, 3.3, 3.4, jruby-9.4, truffleruby-25
- `stripe-python` requires Python `>=3.9`; CI matrix: 3.9–3.14 + pypy 3.9/3.10/3.11
- `stripe-go` requires the 4 most recent Go versions (currently 1.22+); every CI run also executes `govulncheck ./...` as a separate job
- `stripe-java` targets Java 1.8 sourceCompat but **must** be built with JDK 17 (enforced at build-script level via `GradleException`); CI tests against Java 1.8, 11, 17, 21, 25, 26
- `stripe-java` runs a binary-compatibility gate (`japi-compliance-checker`) on every PR; `stripe-dotnet` runs `/p:RunBaselineCheck=true`; breaking binary compatibility blocks the PR
- `stripe-php` tests across PHP 7.2, 7.3, 7.4, 8.0, 8.1, 8.2, 8.3, 8.4, 8.5 × autoload {0, 1} (18 jobs)
- `stripe-cli` requires Go 1.26.0 and tests on Linux, macOS, and Windows
- `stripe-mock` (the OpenAPI mock server) is a required CI dependency in every SDK — test jobs boot it via the reusable action `stripe/openapi/actions/stripe-mock@master`
- Release channel is encoded in the version string: plain semver → `latest`, `-beta.X` → `public-preview`, `-alpha.X` → `private-preview` (consistent across stripe-node, stripe-ruby, stripe-python, stripe-go, stripe-java, stripe-dotnet)
- Auto-merge is restricted to `squash` (or `merge` only on branches containing `/merge-`) and enforced in CI via `rules.yml`
- CI workflows trigger on branches `master`, `beta`, `sdk-release/**`, `feature/**` and on tags `v[0-9]+.[0-9]+.[0-9]+*`; root `permissions: {}` with per-job least-privilege overrides
- Tagged pushes invoke the publish job; post-publish, `stripe/openapi/actions/notify-release@master` posts to Slack with `SLACK_BOT_TOKEN`
- Database migrations are zero-downtime and follow the four-phase dual-write pattern: (1) dual-write old + new, (2) migrate all read paths, (3) migrate all write paths to new only, (4) drop old data — never in maintenance windows
- During migrations, use GitHub's Scientist library (or equivalent) to read from both old and new paths in parallel and fail loudly on discrepancy
- Date-based API versioning: each major version is a date string with a flower codename (e.g. `2026-03-25.dahlia`); accounts are automatically pinned to the current version on their first API request; per-request override via the `Stripe-Version` header
- "We never attempted to change more than a few hundred lines of code at one time" (Online Migrations at Scale)
- Feature-stability rule for platform dependencies (from Kubernetes operating experience): "only use stable features after they've been stable for more than one release" — wait at least one release cycle after GA
- Never use new technology the day, or even the year, that it's initially released (brandur minimalism)
- Primary backend stack is a Ruby monorepo (20M+ lines — "the world's largest Ruby codebase"), plus significant Java and Go services; no language mandate for new joiners (Pragmatic Engineer)
- Almost all services are auto-deployed and gradually rolled out via custom deploy tooling + feature flags; automated deployments have measurably better reliability than human-supervised ones (Pragmatic Engineer)
- Core services deploy **~16 times per day** (2022 core payments API: 5,978 deploys/year, 1,100 automatically rolled back for failing acceptance criteria) — CI + acceptance checks must be fast and trustworthy enough to support this cadence
- CI must verify every change within **15 minutes** end-to-end; investing in test infrastructure scale is mandatory ("500,000 CPU cores" dedicated to running the test suite — more than entire company infrastructures at other engineering orgs) (Pragmatic Engineer)
- Large-scale language migrations run as a **one-shot codemod merge**, not a gradual dual-maintenance conversion. Precedent: the Flow → TypeScript migration converted ~3.7M lines in a single PR, applied `@ts-expect-error` suppressions to unblock the merge, used TypeScript project references to bound compiler memory, and was merged during off-hours with the repo locked (stripe.dev/blog "Migrating to TypeScript")
- CI uses hermetic, hardware-virtualized sandboxes for cache-producing builds: Bazel + Firecracker + KVM + copy-on-write LVM snapshots. Only authorized remote execution workers may write to the action cache (prevents cache poisoning — "a malicious actor could replace a business-critical binary trusted to securely handle invoice billing"). Filesystem emulation (gVisor) is rejected as prohibitively slow for Ruby/Java/JS workloads (stripe.dev/blog "Fast, secure builds")
- CI remote-execution optimizations: dedupe identical in-flight actions (schedule once, fan results out), cache expensive dependency-graph flattening via a TreeCache
- Shift feedback left: local lint must run in **< 5 seconds** before push; CI should need at most one autofix round before human review (Minions agent post)

## testing

- Every SDK tests against `stripe-mock` booted by `stripe/openapi/actions/stripe-mock@master` in CI; there is no mocked HTTP layer inside the SDK tests — they hit the mock server
- `stripe-ruby` runs `just test typecheck` on every CI matrix row: Sorbet type checking (`srb tc`) is a required gate for every Ruby version ≥ 2.7
- `stripe-python` runs `pyright` across Python 3.6–3.12 and `mypy` at Python 3.10 as separate lint-job steps; types are gated, not optional
- `stripe-python` test runner is pytest with `pytest-xdist` auto parallel (`-n auto`)
- `stripe-node` test runner is Mocha 8 with `.mocharc.js` `parallel: true`, `recursive: true`, `extension: [js, ts]`, and `ts-node/register/transpile-only` loader
- `stripe-go` tests with `-race -failfast -timeout 2m -coverpkg=./... -covermode=atomic -coverprofile=coverage.txt`
- `stripe-java` test task uses JUnit 5, requires `JAVA_TEST_HOME` env var in CI, and sets `stripe.disallowGlobalResponseGetterFallback=true` system property
- `stripe-php` runs three CI jobs: `php-cs-fixer`, `phpstan`, `tests`; lockfile is not committed — cache keys hash on `composer.json`
- ! Tests use **test-mode** API keys with prefix `sk_test_`, `pk_test_`, `rk_test_`; live keys prefix `sk_live_`, `pk_live_` `check: ! git diff $BASE_BRANCH...$BRANCH 2>/dev/null | grep -qE "^\+.*\b(sk|pk|rk)_live_[A-Za-z0-9]+"`
- Stripe Services Agreement forbids testing with real card data in live mode — use only the documented test PANs (Visa `4242424242424242`, Mastercard `5555555555554444`, Amex `378282246310005`, Discover `6011111111111117`) or PaymentMethod tokens like `pm_card_visa`
- Never load-test against test mode; "you might hit rate limits"
- Use Stripe test clocks for time-sensitive subscription/billing tests — do not mock time in-process
- Go tests adopt `t.Parallel()` from the start — retrofitting is hard; each test runs in a transaction that rolls back at the end for isolation
- Use `t.Cleanup()` (not `defer`) in Go test helpers so `*testing.T` can be injected; accept `testing.TB` for benchmark/fuzz compatibility
- Seed test fixtures at database init time, not in per-test upserts — prevents deadlocks under parallelism
- Use `goleak.VerifyTestMain(m)` at the package level to catch goroutine leaks
- Run game-day exercises: intentionally terminate API servers, etcd nodes, and sever worker node connectivity in a staging environment to discover failure modes
- Tests are a classifier — account for false alarms: "If developers are used to fixing flaky tests every time they make a change, there's an increased risk that they disregard a true failure" (Elhage)
- "There's commonly organizational pressure to add tests... try to counterbalance that pressure by acknowledging the costs of brittle tests on productivity" (Elhage)
- Tests serve as shared understanding: "Well-written test cases can often serve as direct examples of a tool's API or usage" (Elhage, *Testing as Communication*)
- "Testing in production is a superpower... It's better to practice risky things often and in small chunks, with a limited blast radius" (Charity Majors)
- Test infrastructure at scale: "50+ million lines of code tested across a distributed testing system" (Pragmatic Engineer)
- Tests must be: "easy to understand with accurate descriptions", "repeatable (identical results across runs)", and "clear about what's tested and why failures occur"; TDD is emphasized but not mandated (Pragmatic Engineer)
- Time-dependent code reads from a `time provider` interface; real provider in production, Stripe test clocks in tests. Test clocks "teleport" to the next meaningful billing event rather than iterating every tick, and the **presentation of objects to the API must be identical** on test and real clocks — no semantic divergence between test and prod paths (stripe.dev/blog "Test clocks")
- Test-clock objects are filtered out of async schedulers; their orchestration must be explicit, not ambient
- Acceptance benchmarks for automated integrations (including agent-built ones) must have **deterministic graders**: exercise the finished software via API, UI, and inspection of Stripe-side artifacts; generate test data via scripts, not by accepting error responses as success signals — "payments require 100% accuracy" and "a mostly correct integration is a failure" (stripe.dev/blog "Can AI agents build real Stripe integrations")
- Long-horizon integration tests must include recovery paths (e.g. browser agents must refresh/refocus on lost state, never swallow it)

## documentation

- Every SDK repo ships `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `VERSION`, `CODEGEN_VERSION`, and `OPENAPI_VERSION`
- Every SDK README contains an explicit language-version support statement linking to `docs.stripe.com/sdks/versioning?lang=<lang>`
- Every public `Error` response carries `type`, `code`, `message`, `param`, `decline_code`, `doc_url`, `request_log_url`, and `charge` fields; `type` is one of `api_error`, `card_error`, `idempotency_error`, `invalid_request_error`
- Every error returned from the API includes a `doc_url` linking to docs and a `request_log_url` linking to the Dashboard request log
- HTTP status code mapping is fixed: 200 OK, 400 Bad Request, 401 Unauthorized, 402 Request Failed, 403 Forbidden, 404 Not Found, 409 Conflict, 424 External Dependency Failed, 429 Too Many Requests, 500/502/503/504 Server Errors
- API documentation uses date-stamped release notes in a public changelog; breaking changes ship under a new dated major version (e.g. `2026-03-25.dahlia`), non-breaking changes ship under monthly backward-compatible snapshots
- ! Every SDK changelog is maintained in `CHANGELOG.md` at the repo root; release notes accompany every tag `check: test -f $REPO_DIR/CHANGELOG.md`
- Document rate limits and service limits publicly: "Be transparent about limits by publishing them publicly" (brandur)
- API schemas are self-validating in CI via JSON Schema / OpenAPI meta-schemas — "schemas self-validate via meta-schemas"
- Doc comments on public SDK functions match the implementation; generated SDK code carries the source marker comment
- Programmatic API map should be reachable at a root endpoint so the API is navigable by agents (brandur accessible APIs)
- Provide LLM-friendly docs / MCP surface so AI agents can integrate the API directly (brandur second-wave API-first)
- Stripe has a **strong culture of writing**, predating remote work and deliberately supporting it. CEO publishes multiple internal posts per month; CTO publishes more than one per month (Pragmatic Engineer)
- **Slack is not canonical**: "expected to disappear or become unfindable". Important information must be moved to searchable, durable artifacts — a wiki system (Stripe calls theirs "Trailhead"), a company-wide URL shortener that indexes link contents (Stripe calls theirs "go/"), or a git-versioned docs repo (Pragmatic Engineer)
- **Friction logs** are a standard documentation artifact: structured end-to-end user-journey docs with context, pros/cons, stream-of-consciousness narrative. Rules: "share size upfront, highlight joys not just frustrations, stay objective" (Pragmatic Engineer)
- Every API-modifying change goes through a dedicated **API Review** process that is "surprisingly important and central" and goes "way beyond normal code review" — a separate gate from general code review (Pragmatic Engineer)
- Docs are built from a constraint-based markup system (Stripe's is Markdoc): extends Markdown with composable tags, **deliberately excludes Turing-complete features** (no loops, no variables) so docs stay declarative and refactorable. Every tag and node has a schema validated in CI and in the IDE in real time. Parse to an AST and treat docs as data for static analysis and automated refactoring. Decouple content from presentation technology so docs survive frontend churn. Favor few highly-composable primitives over many specialized ones (stripe.dev/blog "Markdoc")

## environment

- Developer dev loop uses the `stripe` CLI: `stripe login` to persist keys locally, `stripe listen --forward-to <url>` to tunnel webhooks to localhost, `stripe trigger <event>` to emit test events, `stripe logs tail` to stream test-mode request logs, `stripe fixtures` to execute JSON-scripted API sequences, `stripe events resend` to replay
- Developer-facing code uses test-mode keys locally and in CI; live keys appear only in production secret managers
- ! Secret keys are stored in "a secrets vault or encrypted environment variables" — never in source code or config files in version control
- Exposed keys are proactively scanned by Stripe and auto-rotated; restricted keys (`rk_test_`, `rk_live_`) should be used wherever possible and scoped to specific resources and IP allowlists
- Rollback tooling must be able to flip a deployment back within 5 minutes of detection (Kubernetes operating experience)
- Primary branch is `master`; additional channels `beta`, `sdk-release/**`, `feature/**`, and `private-preview` are first-class CI targets
- Database connections are short-lived: workers hold a connection only while core logic is executing; use node-local pool + PgBouncer transaction mode for app traffic (brandur Postgres connections)
- `LISTEN/NOTIFY` requires session-mode PgBouncer on a dedicated connection per process; multiplex subscribers onto it via an in-process notifier pattern
- Use replica reads with per-user `min_lsn` tracking; fall back to master when no replica is sufficiently caught up (brandur Postgres reads)
- Prefer vertical scale and archiving before partitioning; most workloads are handled by a single well-tuned Postgres instance (brandur ACID)
- Zero-downtime data migration across shards is a **versioned-gating protocol**: atomic traffic switches, version tokens validated on every incoming request via a custom database patch, bidirectional async replication with write tagging to prevent cycles, sorted bulk insertion exploiting B-tree order for ~10× throughput, CDC → Kafka → S3 pipeline that is checkpoint-resumable. Traffic switches must complete in **under 2 seconds** (stripe.dev/blog "How Stripe's document databases supported 99.999% uptime")
- Correctness during migrations is validated via point-in-time snapshot comparisons, not via blocking checks that would freeze writers
- Unattended coding agents run in **isolated pre-warmed devboxes** (cattle not pets), ready in ~10s, QA-only, with no prod data and no internet. "If it's good for humans, it's good for LLMs too" — agents share the human devtool stack (stripe.dev/blog "Minions")
- Agent workflows are encoded as **Blueprints**: deterministic state-machine nodes (git, lint, test) interleaved with agentic subtask nodes; deterministic nodes save tokens at scale and prevent drift (Minions)
- Agent context is delivered via scoped rule files (per-subdirectory, Cursor format) — avoid global rule bloat (Minions)
- Shared agent tools live in a central **MCP Toolshed** (~400–500 tools); each agent gets an intentionally small curated subset, not the full catalog (Minions)
- Provisioning dev infrastructure uses a repeatable, auditable terminal command — resources live in the developer's own provider accounts, credentials are returned in both human and agent-readable formats, and skills are shipped into the local project on provision (stripe.dev/blog "Production-ready dev stack from terminal")
- Anti-pattern: "keys living in Slack messages, old `.env` files, random notes, and half-rotated tokens" — if you observe this, stop and build a provisioning flow (Stripe Projects post)

## quality

- All state-mutating endpoints accept an `Idempotency-Key` header; the idempotency layer saves the status code + body of the first request and replays it on retry (including 500s); parameter changes with the same key return an error
- Idempotency keys are V4 UUIDs or random strings with sufficient entropy, ≤ 255 characters; `Idempotency-Key` is only sent on `POST` requests, never `GET` or `DELETE`
- Idempotency keys are recycled after 24 hours (Stripe docs) to 72 hours (brandur recommendation) — never retained indefinitely
- Sensitive data (emails, personal identifiers) must never be used as idempotency keys
- Every HTTP request maps 1:1 to a database transaction; no transaction may span a foreign (network) call — move foreign calls to background jobs
- Background jobs are transactionally staged: insert into a `staged_jobs` table inside the application transaction, drain via a dedicated enqueuer in `REPEATABLE READ`, delete only after successful transmission — jobs rolled back with the transaction never reach the queue
- Idempotency flow is structured as atomic phases + recovery points: every atomic phase is a database transaction that returns either a `RecoveryPoint`, a final `Response`, or `NoOp`; foreign state mutations get their own atomic phase; "Atomic phases should be safely committed before initiating any foreign state mutation"
- Transactions wrapping idempotent endpoints use `SERIALIZABLE` isolation; on serialization error, return `409 Conflict` and unlock the key
- Every mutating request is passively safe: "no matter what kind of failures are thrown at them they'll end up in a stable state" (brandur)
- Enforce constraints at the database layer (CHECK, FOREIGN KEY, UNIQUE, NOT NULL), not just in application code
- Default all columns to `NOT NULL` unless there is a domain reason for nullability (brandur large-database casualties)
- Use `ON DELETE RESTRICT` or `ON DELETE CASCADE` explicitly on foreign keys; never leave defaults implicit
- API endpoints disallow unknown fields by default (`DisallowUnknownFields`); on rejection, return a "did you mean" hint via Levenshtein distance; webhook receivers are the documented exception (senders add new fields unexpectedly)
- Backward compatibility is a hard invariant: "Fields that were present before should stay present, and fields should always preserve their same type and name"; adding new resources, new optional params, new response properties, reordering properties, and new event types are safe
- Webhook consumers dedupe by event ID (logged locally); for multi-source events, combine `data.object.id` with `event.type` — "guard against duplicated event receipts by logging the event IDs you've processed"
- Webhook handlers return a `2xx` status code "quickly... prior to any complex logic that could cause a timeout"; heavy work happens asynchronously after the ack
- Webhook consumers do not rely on event ordering: "Stripe doesn't guarantee the delivery of events in the order that they're generated"
- Ruby code runs under Sorbet with `# typed: true` minimum for all non-test files; Stripe's internal adoption target is `# typed: strict` for 85%+ of non-test files
- Typed Ruby is a CI-blocking gate: `srb tc` must pass on every matrix row
- Python code passes `pyright` with strict settings (`reportMissingTypeArgument`, `reportUnnecessaryCast`, `reportUnnecessaryComparison`, `reportUnnecessaryContains`, `reportUnnecessaryIsInstance`, `reportPrivateImportUsage`, `reportUnnecessaryTypeIgnoreComment` all `true`) and `mypy` with `disallow_untyped_calls`, `disallow_untyped_defs`, `warn_unused_ignores`, `no_implicit_reexport`
- Never use pessimistic locking as a correctness mechanism; rely on database isolation levels and constraints (brandur ACID)
- SQL is the source of truth; prefer `sqlc`-style compiled queries over runtime string concatenation
- Restrict query API shape to: single-row select/update/delete, multi-row select with explicit index hints; ban unpredictable multi-row updates
- Profile production requests — track allocation delta via `runtime.MemStats.TotalAlloc` and auto-dump pprof when a request exceeds a threshold (brandur profiling production)
- **API reliability target is >99.999% (six nines during peak)**; the core engineering principle is "systematically keeping our promises to users" (CTO David Singleton, via Pragmatic Engineer)
- Defensive design rules for money-moving services: minimize blast radius through **fault domain isolation**, design for every downstream dependency failure, prepare for hardware/network/region failures, proactively gather scaling information for peak loads (Pragmatic Engineer)
- "The vast majority of operational failures stem from changes, not latent issues" — weight reviews and rollbacks accordingly (Stripe CTO)
- Money movement is tracked in an **immutable, double-entry event log** (Stripe's is called Ledger). Every movement is a balance transfer between accounts and the math must balance. Events are never deleted or modified; past state is reconstructed by replay (stripe.dev/blog "Ledger")
- Producer systems that move money are modeled as **state machines of fund flows**, with per-transaction tracing across system boundaries
- Clearing accounts must sum to **zero** at steady state; any drift fires an alert immediately — "a single missing, late, or incorrect transaction immediately creates a detectable accuracy issue"
- Corrections to the ledger require a **two-phase review** with committed impact analysis before execution — no one-step manual fixes to money-moving records
- Data-quality metrics per fund-flow roll up into a single hierarchical health score; DQ drops auto-open tickets with owner, metadata, and tool links (Ledger)
- ML feature definitions are written **once** (e.g. a single Python/SQL file) and drive both online and offline compute paths; online/offline consistency is continuously monitored; benchmarks of third-party components run before integration (stripe.dev/blog "Shepherd")
- Periodically ask "what would we build if we started today?" — be willing to replace working systems when scale economics change, even accepting a temporary recall regression for better architectural headroom (stripe.dev/blog "How we built Stripe Radar")
- Invest in model/system **explainability** to the same degree as detection/accuracy — users need context for decisions (Radar)
- Design spatial/geographic problems as **offline precomputation + online query**: keep hot-path latency bounded. For jurisdictional data, centralize GIS cleanup at ingest; public sources are inconsistent; use a hierarchical spatial index (R-tree with Sort-Tile-Recursive packing); tag boundaries by effective date so retroactive recalculation is possible (stripe.dev/blog "Jurisdiction resolution for Stripe Tax")
- "Start with a feasible solution; progressively optimize pathological cases" — ship iteratively rather than waiting for a complete theoretical solution (Stripe Tax)

## observability

- Every request emits **one wide canonical log line** at the end containing all key characteristics of the request — this is the Stripe observability standard, not a suggestion
- Canonical log lines are in logfmt; emitted via middleware installed high in the stack, captured in an `ensure` block so they fire even on internal failure
- Required fields on every canonical log line: HTTP method, path, status code; authentication type, key ID, user ID; rate-limit status, quota, remaining quota; request duration; database query count; memory allocations; API version; request ID; service name; Git HEAD revision; release number; TLS version
- Structured log format is logfmt: `key=value` pairs on a single line, quoted values containing spaces; keys are snake_case; standard fields `level`, `msg`, `tag`
- Every request is assigned a `Request-ID` (UUID v4) at the middleware layer; the ID is propagated through downstream calls via the `Request-ID` header, included in every log line for that request, and returned to the client in a response header
- When downstream calls forward Request-IDs, the receiving service validates the incoming header as a UUID and chains it: `env["REQUEST_ID"] += "," + env["HTTP_REQUEST_ID"]`
- Pod/process health: the deployment system alerts if a pod does not start on a worker node within 5 minutes (Kubernetes operating experience)
- Alerting follows brandur's 10 rules: 1:1 alert-to-root-cause ratio; alert at the root metric not symptoms; never page for third-party failures you can't fix; safe at rest (no false alarms when idle); wait for evidence not hypotheticals; throttle on slowly (email-level during alpha/beta before paging); eliminate flappy alarms entirely rather than muting; alerts evolve with the system; on-call must be empowered to fix; alert the team responsible for the root cause, not downstream
- Programs report their version (VCS revision) on startup and in logs — "the single most useful piece of version information is the VCS revision" (Stapelberg). Go programs use `runtime/debug.ReadBuildInfo()`
- Dual-sink canonical logs: Splunk (real-time) + Redshift/warehouse (long-term, pruned after 90 days)
- Prefer canonical log lines over metrics + traces for most debugging: "while metrics provide fast feedback... they're not well suited for allowing information to be queried arbitrarily and ad-hoc" (brandur)
- Observability is a product feature: "observability should produce solutions — pull requests, recommendations, and automated actions — not just alerts" (rauchg-style framing also adopted at Stripe)
- Performance is a feature: "Performance — in particular, being notably fast — is a feature in and of its own right, which fundamentally alters how a tool is used" (Elhage)
- Every service has **one comprehensive health dashboard** displaying live metrics for service health and operating characteristics at a glance; rapid issue detection is the goal. No hunting across 10 dashboards during an incident (Pragmatic Engineer)
- Operations have a **Weekly Ops Review** covering: SLA adherence, recent incidents, root-cause patterns, alert noise management, incident remediation tracking (Pragmatic Engineer)
- Real-time analytics systems must deliver **~15 minute freshness** end-to-end and **< 300 ms** dashboard query latency; "the Dashboard remains responsive and useful, not grayed out" (stripe.dev/blog "Real-time analytics for Stripe Billing")
- Real-time metrics pipelines are event-driven end to end (Flink for incremental state, Spark for historical reprocessing, Pinot for serving); no offline pre-aggregation for live metrics — runtime windowed aggregation over pre-aggregated rollups preserves flexibility under metric-definition changes

## security

- Webhook endpoints verify every incoming request against the `Stripe-Signature` header using HMAC-SHA256; unsigned or mis-signed requests are rejected
- `Stripe-Signature` is a comma-separated list of `key=value` pairs: `t=<timestamp>`, `v1=<hex HMAC>` (current), and `v0=` (legacy, verification optional)
- Signed payload construction (in order): `timestamp_as_string + "." + raw_request_body`; HMAC-SHA256 of that payload using the endpoint's signing secret must match the `v1` value via constant-time comparison
- Default webhook timestamp tolerance is **300 seconds (5 minutes)**; requests outside this window are rejected as potential replays
- Never set webhook timestamp tolerance to zero — "this disables the recency check entirely"
- Webhook servers' clocks are kept in sync via NTP; clock skew invalidates signatures
- Webhook endpoints are layered: IP allowlisting + signature verification; "Always verify that webhook events originate from Stripe before acting on them"
- Webhook signing secrets are rotated periodically
- Webhook handlers are idempotent on the receiver side: log event IDs and drop duplicates; for multi-source events use `data.object.id` + `event.type`
- Webhook delivery is at-least-once and unordered; consumers do not rely on ordering
- All external communication uses HTTPS; minimum TLS version is **1.2** — Stripe automatically blocks requests with older TLS
- All internal Stripe server-to-server communication uses mutual TLS (mTLS)
- Stripe is on the HSTS preload list; apps redirecting to Stripe should follow suit
- PCI-covered data (full PAN, CVV, track data) never passes through application servers — use Stripe.js, Elements, or Mobile SDKs to collect directly
- Safe-to-store card fields: card brand, last 4, expiration month/year only — not subject to PCI
- Card numbers are encrypted at rest with AES-256; decryption keys live on separate machines
- ! API secret keys are never committed to source control, exposed in client code, or logged; publishable keys (`pk_*`) are the only keys safe for client-side use
- Restricted keys (`rk_*`) are preferred over full secret keys whenever possible and may be IP-restricted
- Rate limiters are layered and always-on: (1) per-user request-rate limiter, (2) concurrent-request limiter, (3) fleet-usage load shedder reserving ≥20% of infrastructure for critical requests (returns HTTP 503 when exceeded), (4) worker-utilization load shedder that sheds less-critical requests first (test mode → GETs → POSTs → critical)
- Rate limit algorithm is token bucket backed by Redis
- Rate-limited responses return HTTP **429** with an actionable message; fleet-overload responses return HTTP **503**; lock contention returns 429 with code `lock_timeout`
- Rate limiters are deployed dark first to watch the traffic they would block before enforcing; "catch exceptions at all levels so that any coding or operational errors would fail open"; always have a kill switch
- Clients retry rate-limited requests with exponential backoff plus jitter: wait `2^n` seconds with random component to prevent thundering-herd
- Idempotency key TTL allows safe retries across transient failures without duplicate side effects
- Egress traffic from production services goes through a hardened HTTP proxy (smokescreen) that blocks SSRF and enforces allowlists
- Service limits apply across 20+ dimensions (per-user, per-IP, per-endpoint, concurrent, fleet-wide) — "if you don't put a limit on a resource, you can fully expect it to be eventually abused"
- Go repositories run `govulncheck ./...` as a required CI job
- ! Never use `child_process.exec` or equivalent with interpolated user input; `eval`/`new Function` are banned at the linter level (`no-eval`, `no-implied-eval`, `no-new-func`)
- Webhook-receiving services isolate themselves from internal infrastructure so that a compromised sender cannot probe SSRF
- API versioning for webhooks is per-endpoint, not account-wide, so endpoint owners can upgrade independently (brandur)
- Public API parity: "the public API should be powerful enough to run our own dashboard — no private endpoints, no escape hatches" (brandur second-wave API-first)
- Unattended coding agents execute in QA-only isolated devboxes with **no prod data and no internet**; agent actions must be contained to their sandbox and auditable (Minions)
- Agent tool exposure follows least-privilege: each agent invocation gets an intentionally small subset of the central ~400–500-tool MCP catalog, not the entire catalog (Minions)

---

## Sources

### style

- [Stripe API reference](https://stripe.com/docs/api) — snake_case field names, `object` field, plural collections, list envelope, form-encoded requests, JSON responses, no bulk updates
- [Stripe docs: pagination](https://stripe.com/docs/api/pagination) — `limit` 1–100, `starting_after`/`ending_before` cursors, reverse chronological, `has_more`
- [Stripe docs: expanding objects](https://stripe.com/docs/api/expanding_objects) — `expand[]` parameter, dot-nested paths, max depth 4
- [Stripe docs: metadata](https://stripe.com/docs/api/metadata) — 50 keys max, 40-char keys, 500-char values
- [Stripe docs: API upgrades](https://stripe.com/docs/upgrades) — ID format is opaque, fields preserve name and type, breaking vs non-breaking definitions
- [`stripe/stripe-node` .eslintrc.js](https://github.com/stripe/stripe-node/blob/master/.eslintrc.js) — `no-eval`, `no-await-in-loop`, `no-sync`, `no-nested-ternary`, `@typescript-eslint/explicit-function-return-type`
- [`stripe/stripe-node` .prettierrc](https://github.com/stripe/stripe-node/blob/master/.prettierrc) — `arrowParens`, `trailingComma`, `singleQuote`
- [`stripe/stripe-ruby` .rubocop.yml](https://github.com/stripe/stripe-ruby/blob/master/.rubocop.yml) — double quotes, frozen string literal, method length 55, block length 40
- [`stripe/stripe-python` pyproject.toml](https://github.com/stripe/stripe-python/blob/master/pyproject.toml) — ruff `line-length = 79`, pyright strict settings, mypy flags
- [`stripe/stripe-python` .flake8](https://github.com/stripe/stripe-python/blob/master/.flake8) — custom `flake8_stripe` plugin (SPY/IMP/BAN/ASY checkers)
- [`stripe/stripe-go` staticcheck.conf](https://github.com/stripe/stripe-go/blob/master/staticcheck.conf) — `checks = ["all", "-ST1005", "-ST1021"]`
- [`stripe/stripe-cli` .golangci.yml](https://github.com/stripe/stripe-cli/blob/master/.golangci.yml) — 16 linters, govet all, staticcheck all
- [`stripe/stripe-java` build.gradle](https://github.com/stripe/stripe-java/blob/master/build.gradle) — `-Werror`, `-Xlint:all`, JDK 17 pinned, Errorprone, Spotless
- [`stripe/stripe-php` .php-cs-fixer.php](https://github.com/stripe/stripe-php/blob/master/.php-cs-fixer.php) — `@PSR2`, `@PhpCsFixer`, `@PhpCsFixer:risky`
- [brandur — Two-Phase Render](https://brandur.org/two-phase-render) — load/render split, no DB access in render
- [brandur — Soft Deletion](https://brandur.org/soft-deletion) — don't soft-delete; `deleted_record` JSONB table
- [brandur — Minimalism](https://brandur.org/minimalism) — one DB, one language, one queue
- [brandur — logfmt](https://brandur.org/logfmt) — structured logging format
- [Michelle Bu — Eagerly discerning, discerningly eager](https://increment.com/apis/api-design-for-eager-discerning-developers/) — error messages include instructions

### build

- [`stripe/stripe-node` package.json](https://github.com/stripe/stripe-node/blob/master/package.json) — `engines: node >=18`, scripts
- [`stripe/stripe-node` .github/workflows/main.yml](https://github.com/stripe/stripe-node/blob/master/.github/workflows/main.yml) — CI matrix, OIDC npm publish, release channel logic
- [`stripe/stripe-ruby` stripe.gemspec](https://github.com/stripe/stripe-ruby/blob/master/stripe.gemspec) — `required_ruby_version >= 2.7.0`
- [`stripe/stripe-ruby` .github/workflows/ci.yml](https://github.com/stripe/stripe-ruby/blob/master/.github/workflows/ci.yml) — `just test typecheck`, version matrix
- [`stripe/stripe-python` .github/workflows/ci.yml](https://github.com/stripe/stripe-python/blob/master/.github/workflows/ci.yml) — pyright loop across 3.6–3.12, test matrix 3.9–3.14 + pypy
- [`stripe/stripe-go` .github/workflows/ci.yml](https://github.com/stripe/stripe-go/blob/master/.github/workflows/ci.yml) — govulncheck as separate job, rolling 4-version matrix
- [`stripe/stripe-java` build.gradle](https://github.com/stripe/stripe-java/blob/master/build.gradle) — JDK 17 pinned, japi-compliance-checker, sourceCompat 1.8
- [`stripe/stripe-dotnet` .github/workflows/ci.yml](https://github.com/stripe/stripe-dotnet/blob/master/.github/workflows/ci.yml) — dynamic matrix via justfile, `RunBaselineCheck`
- [`stripe/stripe-php` .github/workflows/ci.yml](https://github.com/stripe/stripe-php/blob/master/.github/workflows/ci.yml) — PHP 7.2–8.5, no lockfile committed
- [`stripe/stripe-cli` Makefile](https://github.com/stripe/stripe-cli/blob/master/Makefile) — golangci-lint pinned, cross-platform tests, protoc regeneration gate
- [Stripe blog — Online migrations at scale](https://stripe.com/blog/online-migrations) — 4-phase dual-write, Scientist verification, incremental changes
- [Stripe blog — API versioning at Stripe](https://stripe.com/blog/api-versioning) — version transformer pipeline, date codes, per-request override
- [brandur — API Upgrades](https://brandur.org/api-upgrades) — account pinning, breaking vs non-breaking definitions
- [Stripe blog — Operating Kubernetes reliably](https://stripe.com/blog/operating-kubernetes) — feature stability rule, 5-minute rollback, aggressive scope-cutting

### testing

- [`stripe/stripe-ruby` Makefile / justfile](https://github.com/stripe/stripe-ruby) — `srb tc` in CI
- [Will Larson — Why did Stripe build Sorbet?](https://lethain.com/stripe-sorbet/) — typing enforcement rationale
- [Stripe blog — Sorbet: Stripe's type checker for Ruby](https://stripe.com/blog/sorbet-stripes-type-checker-for-ruby) — 85% `# typed: strict`, 95% `# typed: true`
- [`stripe/stripe-python` pyproject.toml](https://github.com/stripe/stripe-python/blob/master/pyproject.toml) — pyright strict, mypy strict, pytest `-n auto`
- [`stripe/stripe-node` .mocharc.js](https://github.com/stripe/stripe-node/blob/master/.mocharc.js) — `parallel: true`
- [`stripe/stripe-go` Makefile](https://github.com/stripe/stripe-cli/blob/master/Makefile) — `-race -failfast -coverpkg`
- [Stripe docs: testing](https://stripe.com/docs/testing) — test cards, test mode, sandbox isolation, don't load-test
- [Stripe docs: test clocks (Billing)](https://stripe.com/docs/billing/testing/test-clocks) — time simulation
- [Stripe blog — Game day exercises at Stripe](https://stripe.com/blog/game-day-exercises-at-stripe) — intentional failures
- [brandur — t.Parallel()](https://brandur.org/t-parallel) — parallel test isolation, adopt from scratch, fixtures at init, goleak
- [brandur — go-test-tx-using-t-cleanup](https://brandur.org/fragments/go-test-tx-using-t-cleanup) — `t.Cleanup` pattern for transactions
- [brandur — sqlc](https://brandur.org/sqlc) — SQL as source of truth, fewer tests per query
- [Nelson Elhage — Test suites as classifiers](https://blog.nelhage.com/post/test-suites-as-classifiers/) — false-alarm cost, trust decay
- [Nelson Elhage — Testing as communication (Increment 10)](https://increment.com/testing/testing-as-communication/) — tests as shared understanding
- [Charity Majors — I test in production (Increment 10)](https://increment.com/testing/i-test-in-production/) — small-blast-radius practice, testing systems

### documentation

- [Stripe docs: errors](https://stripe.com/docs/api/errors) — error response shape, HTTP status mapping
- [Stripe docs: API versioning](https://stripe.com/docs/api/versioning) — date codenames, changelog structure
- [`stripe/stripe-*` CONTRIBUTING.md (all SDKs)](https://github.com/stripe/stripe-node/blob/master/CONTRIBUTING.md) — codegen boundary, CLA
- [docs.stripe.com/sdks/versioning](https://docs.stripe.com/sdks/versioning) — canonical support policy referenced by all SDK READMEs
- [brandur — Service Limits](https://brandur.org/service-limits) — publish limits publicly
- [brandur — Elegant APIs](https://brandur.org/elegant-apis) — self-validating schemas
- [brandur — Accessible APIs](https://brandur.org/accessible-apis) — programmatic API map
- [brandur — Second-wave API-first](https://brandur.org/second-wave-api-first) — LLM/MCP surface

### environment

- [Stripe docs: CLI](https://stripe.com/docs/cli) — `stripe login`, `listen`, `trigger`, `logs tail`, `fixtures`, `events resend`
- [Stripe docs: security guide](https://stripe.com/docs/security/guide) — secret storage in vault / encrypted env vars
- [Stripe blog — Operating Kubernetes reliably](https://stripe.com/blog/operating-kubernetes) — 5-minute rollback tooling
- [brandur — Postgres connections](https://brandur.org/postgres-connections) — short checkouts, transaction pooling, PgBouncer modes
- [brandur — Postgres reads](https://brandur.org/postgres-reads) — per-user `min_lsn`, replica selection
- [brandur — Notifier](https://brandur.org/notifier) — session-mode PgBouncer for LISTEN/NOTIFY
- [brandur — ACID](https://brandur.org/acid) — Postgres-first, vertical scale before partitioning

### quality

- [Stripe docs: idempotent requests](https://stripe.com/docs/api/idempotent_requests) — `Idempotency-Key` header, POST-only, 24h TTL, parameter validation, PII restriction
- [Stripe blog — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) — retry semantics, exponential backoff + jitter
- [brandur — Idempotency Keys](https://brandur.org/idempotency-keys) — atomic phases + recovery points, state machine DAG, 72h TTL, SERIALIZABLE isolation, schema
- [brandur — HTTP Transactions](https://brandur.org/http-transactions) — HTTP request ≡ DB transaction, no foreign calls in transactions
- [brandur — Transactionally-staged job drain](https://brandur.org/job-drain) — `staged_jobs` table, REPEATABLE READ enqueuer
- [brandur — River](https://brandur.org/river) — Postgres-only queue, NOTIFY wake, strongly-typed jobs
- [brandur — Postgres atomicity](https://brandur.org/postgres-atomicity) — ACID guarantees, MVCC
- [brandur — Postgres queues](https://brandur.org/postgres-queues) — VACUUM hazards, `SKIP LOCKED`, statement_timeout
- [brandur — ACID](https://brandur.org/acid) — DB-layer constraints, no pessimistic locking
- [brandur — Disallow unknown fields](https://brandur.org/disallow-unknown-fields) — `DisallowUnknownFields`, Levenshtein suggestions, webhook exception
- [brandur — Large-database casualties](https://brandur.org/large-database-casualties) — `NOT NULL` defaults, `ON DELETE`, query-shape restrictions
- [brandur — Webhooks](https://brandur.org/webhooks) — dedupe, no ordering, per-endpoint versioning
- [brandur — sqlc](https://brandur.org/sqlc) — compiled queries, SQL source of truth
- [brandur — Profiling production](https://brandur.org/fragments/profiling-production) — `TotalAlloc` monitoring, pprof auto-dump
- [`stripe/stripe-ruby` CI](https://github.com/stripe/stripe-ruby/blob/master/.github/workflows/ci.yml) — `srb tc` blocking
- [`stripe/stripe-python` pyproject.toml pyright + mypy strict settings](https://github.com/stripe/stripe-python/blob/master/pyproject.toml)
- [Stripe docs: webhooks](https://stripe.com/docs/webhooks) — 2xx quickly, dedupe by ID, no ordering, 3-day retries

### observability

- [Stripe blog — Fast and flexible observability with canonical log lines](https://stripe.com/blog/canonical-log-lines) — one wide log line per request, middleware ensure block, dual-sink
- [brandur — Canonical log lines](https://brandur.org/canonical-log-lines) — logfmt, required fields, 90-day retention
- [brandur — logfmt](https://brandur.org/logfmt) — format specification
- [brandur — Request IDs](https://brandur.org/request-ids) — UUID generation, chaining, response header
- [brandur — Alerting](https://brandur.org/alerting) — 10 rules
- [Stripe blog — Operating Kubernetes reliably](https://stripe.com/blog/operating-kubernetes) — 5-minute pod start alert
- [Michael Stapelberg — Stamp it! All programs must report their version](https://michael.stapelberg.ch/posts/2026-04-05-stamp-it-all-programs-must-report-their-version/) — VCS revision stamping
- [Nelson Elhage — Reflections on software performance](https://blog.nelhage.com/post/reflections-on-performance/) — performance as feature

### security

- [Stripe docs: webhooks/signatures](https://stripe.com/docs/webhooks/signatures) — `Stripe-Signature` header, HMAC-SHA256, signed payload construction, 5-minute tolerance, replay prevention, never set tolerance to zero, NTP sync
- [Stripe docs: security](https://stripe.com/docs/security) — TLS 1.2 minimum, HSTS preload, mTLS internal
- [Stripe docs: security guide](https://stripe.com/docs/security/guide) — secret vault, key scanning, restricted keys, IP restrictions
- [Stripe docs: rate limits](https://stripe.com/docs/rate-limits) — 100/sec live, 25/sec sandbox, `Stripe-Rate-Limited-Reason` header, automatic retries
- [Stripe blog — Rate limiters](https://stripe.com/blog/rate-limiters) — 4 limiter types, token bucket Redis, dark launch, kill switch, 429/503 status codes
- [brandur — Rate limiting](https://brandur.org/rate-limiting) — GCRA, Redis TIME, `throttled` library
- [brandur — Service limits](https://brandur.org/service-limits) — 20+ dimensions, publish publicly, moderate limits
- [brandur — Webhooks](https://brandur.org/webhooks) — signing, SSRF isolation, per-endpoint versioning, 72-retry pattern
- [`stripe/smokescreen`](https://github.com/stripe/smokescreen) — egress proxy, SSRF hardening, custom goproxy fork
- [`stripe/stripe-go` CI govulncheck job](https://github.com/stripe/stripe-go/blob/master/.github/workflows/ci.yml)
- [Stripe docs: errors](https://stripe.com/docs/api/errors) — status code table including 424, 429

### meta / preamble

- [Patrick Collison — Fast](https://patrickcollison.com/fast) — project throughput as engineering virtue
- [Patrick Collison — Advice](https://patrickcollison.com/advice) — depth, persistence, "hurry up"
- [Patrick Collison interview in High Growth Handbook (Elad Gil)](https://growth.eladgil.com/book/chapter-5-organizational-structure-and-hypergrowth/you-cant-delegate-culture-an-interview-with-patrick-collison/) — culture cannot be delegated
- [Patrick Collison on CS183C](https://medium.com/notes-essays-cs183c-technology-enabled-blitzscalin/class-11-notes-essay-reid-hoffman-john-lilly-chris-yeh-and-allen-blue-s-cs183c-technology-ebf34cebae26) — hiring persistence, interviews on own laptop, "building roads"
- [Greg Brockman — #define CTO](https://blog.gregbrockman.com/define-cto-openai) — soft vs hard launch dates, focus, delegation
- [Nelson Elhage — Computers can be understood](https://blog.nelhage.com/post/computers-can-be-understood/) — "there is no magic"
- [Julia Evans — How I got better at debugging](https://jvns.ca/blog/2015/11/22/how-i-got-better-at-debugging/) — bugs are logical, be unreasonably confident
- [Charity Majors — I test in production](https://increment.com/testing/i-test-in-production/) — modern SWE job is watching code in production
- [Stripe Press — High Growth Handbook, An Elegant Puzzle, The Dream Machine](https://press.stripe.com) — engineering culture context
- [Increment magazine archive (Stripe)](https://increment.com) — 19-issue engineering magazine covering on-call, cloud, testing, teams, architecture, APIs, reliability, containers, mobile, planning
- [Will Larson — Stripe's product-led, developer-centric growth](https://lethain.com/stripe-product-led-developer-centric-growth/) — developers as wedge
- [Will Larson — Stripe's Lighthouse Hiring](https://lethain.com/lighthouse-hiring/) — recruiting strategy

### round 2 — Stripe engineering blog full crawl + Pragmatic Engineer

- [stripe.dev/blog — How Stripe's document databases supported 99.999% uptime with zero-downtime data migrations](https://stripe.dev/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations) — versioned gating protocol, atomic < 2-second traffic switches, bidirectional replication, 1.5 PB bin-packing
- [stripe.dev/blog — Test clocks: How we made it easier to test Stripe Billing integrations](https://stripe.dev/blog/test-clocks-how-we-made-it-easier-to-test-stripe-billing-integrations) — time-provider interface, teleport-to-next-event, no semantic change between test and prod paths
- [stripe.dev/blog — How we built it: Real-time analytics for Stripe Billing](https://stripe.dev/blog/how-we-built-it-real-time-analytics-for-stripe-billing) — Flink + Spark + Pinot, 15-min freshness, < 300 ms dashboard queries
- [stripe.com/blog — Can AI agents build real Stripe integrations?](https://stripe.com/blog/can-ai-agents-build-real-stripe-integrations) — deterministic graders, "payments require 100% accuracy", recovery paths
- [stripe.dev/blog — Migrating millions of lines of code to TypeScript](https://stripe.dev/blog/migrating-to-typescript) — 3.7M-line one-shot codemod merge, `@ts-expect-error`, TS project references
- [stripe.dev/blog — Fast, secure builds. Choose two.](https://stripe.dev/blog/fast-secure-builds-choose-two) — Bazel + Firecracker microVMs + LVM CoW snapshots, action-cache poisoning threat model, rejection of gVisor for I/O-heavy workloads
- [stripe.dev/blog — Ledger: Stripe's system for tracking and validating money movement](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement) — immutable double-entry log, state machines of fund flows, clearing accounts sum to zero, 99.9999% explainability, two-phase correction review
- [stripe.dev/blog — Shepherd: How Stripe adapted Chronon to scale ML feature development](https://stripe.dev/blog/shepherd-how-stripe-adapted-chronon-to-scale-ml-feature-development) — single feature definition, p99 150 ms feature freshness, online/offline consistency
- [stripe.dev/blog — How we built it: Stripe Radar](https://stripe.dev/blog/how-we-built-it-stripe-radar) — "what would we build today?", parallelized experimentation, explainability
- [stripe.dev/blog — How we built it: Jurisdiction resolution for Stripe Tax](https://stripe.dev/blog/how-we-built-it-jurisdiction-resolution-for-stripe-tax) — offline precompute + online query, R-tree + STR packing, effective-date tagging
- [stripe.dev/blog — How Stripe builds interactive docs with Markdoc](https://stripe.dev/blog/markdoc) — constraint-based markup, no loops/variables, schema-validated tags, AST-based refactoring
- [stripe.dev/blog — Stripe's payments APIs: The first 10 years](https://stripe.dev/blog/payment-api-design) — validate against hypothetical integration guides, packaging for user needs, API design session rules
- [stripe.dev/blog — Minions: Stripe's one-shot end-to-end coding agents (Parts 1 & 2)](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) — isolated devboxes, Blueprints, scoped rules, MCP Toolshed, shift-left feedback, local-lint < 5 s
- [stripe.dev/blog — Provision a production-ready dev stack from your terminal (Stripe Projects)](https://stripe.dev/blog/production-ready-dev-stack-from-terminal) — resources in user accounts, credential sync, repeatable provisioning
- [stripe.dev/blog — Dynamic payment methods](https://stripe.dev/blog/dynamic-payment-methods) — externalize policy from code, Dashboard as config surface
- [Pragmatic Engineer — Inside Stripe's Engineering Culture, Part 1](https://newsletter.pragmaticengineer.com/p/stripe) — 20M-line Ruby monorepo, custom deploy tooling, feature flags, unblocking as cultural duty, biannual planning, L1–L7 ladder, engineerication
- [Pragmatic Engineer — Inside Stripe's Engineering Culture, Part 2](https://newsletter.pragmaticengineer.com/p/stripe-part-2) — 50M-line test system, 15-minute CI, > 99.999% SLA, auto-rolled-back deploys (1,100/yr), defensive design rules, API Review as a separate gate beyond code review, writing culture, friction logs, Slack is not canonical, weekly Ops Review, single service dashboard
- [Pragmatic Engineer — The Pulse #87: Stripe's investment in reliability](https://newsletter.pragmaticengineer.com/p/the-pulse-87-stripes-investment-in) — 500,000 CPU cores dedicated to test infrastructure, 5,978 deploys/year on core payments API, 16.4 deploys/day average, Sorbet LSP maturity
