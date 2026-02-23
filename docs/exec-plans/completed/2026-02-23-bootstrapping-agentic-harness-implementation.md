# bootstrapping-agentic-harness Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a personal Claude Code skill at `~/.claude/skills/bootstrapping-agentic-harness/` that bootstraps agentic development harness artifacts for any project.

**Architecture:** Three files — SKILL.md (process guide), templates.md (short templates for docs structure), and PLANS.md (the full ExecPlan specification that gets copied into projects). The skill is adaptive: it detects what exists, fills what's missing, and audits the codebase to populate ARCHITECTURE.md.

**Tech Stack:** Claude Code skill (Markdown files, no code dependencies)

---

### Task 1: Create Skill Directory

**Files:**

- Create: `~/.claude/skills/bootstrapping-agentic-harness/`

**Step 1: Create directory**

Run: `mkdir -p ~/.claude/skills/bootstrapping-agentic-harness`

**Step 2: Verify**

Run: `ls ~/.claude/skills/bootstrapping-agentic-harness`
Expected: empty directory

**Step 3: Commit** — skip (no git repo for personal skills)

---

### Task 2: Write SKILL.md

**Files:**

- Create: `~/.claude/skills/bootstrapping-agentic-harness/SKILL.md`

**Step 1: Write the skill file with the following exact content:**

```markdown
---
name: bootstrapping-agentic-harness
description: Use when starting a new project or onboarding to an existing codebase that lacks agentic harness artifacts — ARCHITECTURE.md, docs/PLANS.md, or structured docs/ with exec-plans
---

# Bootstrapping Agentic Harness

## Overview

Bootstrap the agentic development harness for any project. Detects existing state, creates missing docs structure, audits the codebase to write ARCHITECTURE.md, installs the ExecPlan specification, and wires CLAUDE.md for the agent workflow loop.

**Core principle:** After this skill runs, a stateless agent can open the repo and know: what this project is (ARCHITECTURE.md), how to write plans (docs/PLANS.md), where active work lives (docs/exec-plans/active/), and what technical debt exists (docs/exec-plans/tech-debt.md).

## When to Use

- Starting a new project from scratch
- Onboarding to an existing codebase for the first time
- Repo has code but no ARCHITECTURE.md or structured docs/
- You want ExecPlan-driven development but the harness isn't set up

**When NOT to use:**

- Harness already exists (ARCHITECTURE.md + docs/PLANS.md + docs/exec-plans/ all present)
- Quick one-off scripts or throwaway prototypes

## Checklist

You MUST complete these steps in order:

1. **DETECT** — scan repo for existing harness artifacts and tech stack
2. **PLAN** — determine what's missing, present plan to user for confirmation
3. **CREATE** — build folder structure and template files
4. **AUDIT** — read codebase to populate ARCHITECTURE.md and tech-debt.md
5. **WIRE** — create/update CLAUDE.md with harness pointers and agent workflow
6. **VERIFY** — confirm all artifacts are consistent and complete

## Step 1: DETECT

Scan the repo and classify each artifact:

| Artifact        | Where to check   | States                                  |
| --------------- | ---------------- | --------------------------------------- |
| ARCHITECTURE.md | repo root        | missing / skeleton / complete           |
| docs/           | repo root        | missing / flat / structured             |
| docs/PLANS.md   | docs/            | missing / present                       |
| tech-debt.md    | docs/exec-plans/ | missing / present                       |
| CLAUDE.md       | repo root        | missing / no-harness-section / complete |

Detect tech stack by reading config files:

- `package.json` → Node/JS/TS (read scripts for test commands, deps for frameworks)
- `pyproject.toml` → Python (read for test command, build system, deps)
- `go.mod` → Go
- `Cargo.toml` → Rust
- `pom.xml` or `build.gradle` → Java/Kotlin
- If none found, fall back to directory structure patterns

Check for existing docs that might need migration (e.g., a flat `docs/plans/` or `docs/` with loose files). Note these for the PLAN step.

## Step 2: PLAN

Present findings to the user:

- List each artifact and its state (will create / will skip / will update)
- If migration is needed, propose a mapping (e.g., "move docs/plans/\*.md to docs/exec-plans/completed/")
- Wait for user confirmation before proceeding

## Step 3: CREATE

Build the target structure. Read `templates.md` in this skill directory for all template content. Skip any file/folder that already exists and is populated.

Target structure:

    ARCHITECTURE.md
    CLAUDE.md
    docs/
      PLANS.md
      README.md
      product-specs/
      design-docs/
        index.md
        decisions/
          _template.md
        features/
      exec-plans/
        tech-debt.md
        active/
        completed/
      references/

For docs/PLANS.md, copy the content from `PLANS.md` in this skill directory verbatim.

## Step 4: AUDIT

Read the codebase to populate ARCHITECTURE.md and tech-debt.md. This step is tech-stack agnostic — adapt to whatever you find.

**ARCHITECTURE.md** must follow the matklad style (https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html). Required sections:

1. **Overview** — what problem this project solves, in 2-3 sentences
2. **Codemap** — coarse-grained module map. Answer: "where's the thing that does X?" and "what does this thing I'm looking at do?" This is a map of a country, not an atlas of its states.
3. **Named Entities** — important files, modules, and types by name (no direct links — they go stale). Use `module_name` style so readers can symbol-search.
4. **Architectural Invariants** — constraints and critical design decisions, especially those expressed through absence of dependencies. Example: "services never import from UI components", "all DB access goes through the repository layer."
5. **Layer Boundaries** — system boundaries that define implementation constraints. Example: "API routes are thin handlers — auth, call service, return JSON."
6. **Cross-Cutting Concerns** — auth, logging, error handling, caching, etc.

Keep it concise — every recurring contributor reads this. Target 150-300 lines. Name files and modules precisely but don't add clickable links.

**tech-debt.md** — scan for:

- Missing test coverage (modules without corresponding test files)
- TODO/FIXME/HACK comments in source
- Missing CI/CD, pre-commit hooks, linting
- Architectural gaps (no error boundaries, no i18n, etc.)
- Classify as High / Medium / Low priority

## Step 5: WIRE

Create or update CLAUDE.md. Preserve any existing content. Add these sections if missing:

**Documentation section** — links to all harness artifacts:

- ARCHITECTURE.md, docs/PLANS.md, docs/exec-plans/, docs/README.md

**ExecPlans section:**
"When writing complex features or significant refactors, use an ExecPlan (as described in docs/PLANS.md) from design to implementation."

**Testing section** — detected test commands from the project's config files.

**Agent Workflow section** — session start/end protocol:

- Starting: read ARCHITECTURE.md, check exec-plans/active/ for in-progress work
- Ending: update the active ExecPlan's Progress section, update tech-debt.md if needed

See templates.md for the exact CLAUDE.md section template.

## Step 6: VERIFY

Confirm all artifacts are present and consistent:

- All target folders exist
- ARCHITECTURE.md has all matklad-required sections and reflects the actual codebase
- docs/PLANS.md contains the full ExecPlan specification
- tech-debt.md has at least one entry
- CLAUDE.md points to all harness artifacts
- docs/README.md navigation links match what actually exists

Report the results to the user. Do NOT make git commits — the user decides when to commit.

## Common Mistakes

- **Writing ARCHITECTURE.md from imagination** — always read the actual source tree, config files, and schema files first. Never guess.
- **Over-populating tech-debt.md** — only include real, actionable debt. Don't pad it with hypothetical improvements.
- **Clobbering existing CLAUDE.md** — always preserve existing content. Append harness sections, don't replace.
- **Creating empty placeholder files** — every file should have real content. An empty tech-debt.md with just headings is fine, but don't create empty .md files in product-specs/ just to fill the folder.
- **Adding clickable links in ARCHITECTURE.md** — matklad explicitly warns against this. Use names that can be symbol-searched instead.
```

**Step 2: Verify the file exists and check line count**

Run: `wc -l ~/.claude/skills/bootstrapping-agentic-harness/SKILL.md`
Expected: approximately 130-150 lines

---

### Task 3: Write templates.md

**Files:**

- Create: `~/.claude/skills/bootstrapping-agentic-harness/templates.md`

**Step 1: Write the templates file with the following exact content:**

```markdown
# Templates for Agentic Harness

Reference file for bootstrapping-agentic-harness skill. Contains all template content used when creating harness artifacts. The agent reads this file during the CREATE step and adapts templates to the specific project.

## docs/README.md Template

    # Documentation

    ## Navigation

    | What | Where |
    | ---- | ----- |
    | Architecture overview | [ARCHITECTURE.md](../ARCHITECTURE.md) |
    | ExecPlan specification | [PLANS.md](PLANS.md) |
    | Active execution plans | [exec-plans/active/](exec-plans/active/) |
    | Completed plans | [exec-plans/completed/](exec-plans/completed/) |
    | Technical debt | [exec-plans/tech-debt.md](exec-plans/tech-debt.md) |
    | Design documents | [design-docs/](design-docs/) |
    | Architecture decisions | [design-docs/decisions/](design-docs/decisions/) |
    | Product specifications | [product-specs/](product-specs/) |
    | References | [references/](references/) |

    ## Folder Purposes

    - **product-specs/** — Product requirements, user stories, scope definitions. The "what."
    - **design-docs/** — Feature designs and architecture decision records. The "why."
    - **exec-plans/** — Living execution plans (ExecPlan format). Active work in active/, finished work in completed/.
    - **references/** — External knowledge, cost analyses, vendor documentation.

## docs/design-docs/index.md Template

    # Design Documents

    Catalog of feature design docs and architecture decisions.

    ## Feature Designs

    (Add entries as features are designed)

    ## Architecture Decision Records

    See [decisions/](decisions/) for ADRs. Use [_template.md](decisions/_template.md) for new records.

## ADR Template (docs/design-docs/decisions/\_template.md)

    # ADR-NNNN: [Title]

    ## Status

    Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

    ## Context

    What is the issue that we're seeing that is motivating this decision or change?

    ## Decision

    What is the change that we're proposing and/or doing?

    ## Consequences

    What becomes easier or more difficult to do because of this change?

## docs/exec-plans/tech-debt.md Template

    # Technical Debt

    Known debt items, ordered by priority. Update this when debt is introduced or resolved.

    ## High Priority

    (Items that block feature work or cause recurring issues)

    ## Medium Priority

    (Items that slow development but have workarounds)

    ## Low Priority

    (Nice-to-have improvements, minor inconsistencies)

## ARCHITECTURE.md Skeleton (matklad style)

    # Architecture

    This document describes the high-level architecture of [PROJECT NAME].
    If you want to familiarize yourself with the codebase, you are in the right place.

    ## Overview

    [2-3 sentences: what problem does this project solve? Who uses it?]

    ## Codemap

    [Coarse-grained module map. For each major directory or module, one paragraph
    explaining what it does and how it relates to other modules. Answer: "where's
    the thing that does X?" This is a map of a country, not an atlas of its states.]

    ## Architectural Invariants

    [Constraints and critical design decisions. Focus on rules expressed through
    absence of dependencies — what does NOT depend on what, and why.]

    ## Cross-Cutting Concerns

    [Auth, logging, error handling, caching, configuration — anything that spans
    multiple modules.]

## CLAUDE.md Harness Section

Append this to the project's CLAUDE.md (preserve existing content):

    ## Documentation

    | What | Where |
    | ---- | ----- |
    | Architecture overview | [ARCHITECTURE.md](ARCHITECTURE.md) |
    | Docs navigation | [docs/README.md](docs/README.md) |
    | ExecPlan specification | [docs/PLANS.md](docs/PLANS.md) |
    | Active plans | [docs/exec-plans/active/](docs/exec-plans/active/) |
    | Technical debt | [docs/exec-plans/tech-debt.md](docs/exec-plans/tech-debt.md) |

    ## ExecPlans

    When writing complex features or significant refactors, use an ExecPlan
    (as described in docs/PLANS.md) from design to implementation.

    ## Agent Workflow

    Starting a session:
    1. Read ARCHITECTURE.md for orientation
    2. Check docs/exec-plans/active/ for in-progress plans
    3. If continuing work, read the active ExecPlan's Progress section

    Ending a session:
    1. Update the active ExecPlan's Progress section
    2. Update docs/exec-plans/tech-debt.md if debt was introduced or resolved
```

**Step 2: Verify**

Run: `wc -l ~/.claude/skills/bootstrapping-agentic-harness/templates.md`
Expected: approximately 120-140 lines

---

### Task 4: Write PLANS.md (ExecPlan Specification)

**Files:**

- Create: `~/.claude/skills/bootstrapping-agentic-harness/PLANS.md`

This is the full ExecPlan specification from OpenAI Codex that gets copied verbatim into projects as `docs/PLANS.md`.

**Step 1: Write the PLANS.md file with the following exact content:**

```markdown
# Codex Execution Plans (ExecPlans)

This document describes the requirements for an execution plan ("ExecPlan"), a design document that a coding agent can follow to deliver a working feature or system change. Treat the reader as a complete beginner to this repository: they have only the current working tree and the single ExecPlan file you provide. There is no memory of prior plans and no external context.

## How to use ExecPlans and PLANS.md

When authoring an executable specification (ExecPlan), follow PLANS.md _to the letter_. If it is not in your context, refresh your memory by reading the entire PLANS.md file. Be thorough in reading (and re-reading) source material to produce an accurate specification. When creating a spec, start from the skeleton and flesh it out as you do your research.

When implementing an executable specification (ExecPlan), do not prompt the user for "next steps"; simply proceed to the next milestone. Keep all sections up to date, add or split entries in the list at every stopping point to affirmatively state the progress made and next steps. Resolve ambiguities autonomously, and commit frequently.

When discussing an executable specification (ExecPlan), record decisions in a log in the spec for posterity; it should be unambiguously clear why any change to the specification was made. ExecPlans are living documents, and it should always be possible to restart from _only_ the ExecPlan and no other work.

When researching a design with challenging requirements or significant unknowns, use milestones to implement proof of concepts, "toy implementations", etc., that allow validating whether the user's proposal is feasible. Read the source code of libraries by finding or acquiring them, research deeply, and include prototypes to guide a fuller implementation.

## Requirements

NON-NEGOTIABLE REQUIREMENTS:

- Every ExecPlan must be fully self-contained. Self-contained means that in its current form it contains all knowledge and instructions needed for a novice to succeed.
- Every ExecPlan is a living document. Contributors are required to revise it as progress is made, as discoveries occur, and as design decisions are finalized. Each revision must remain fully self-contained.
- Every ExecPlan must enable a complete novice to implement the feature end-to-end without prior knowledge of this repo.
- Every ExecPlan must produce a demonstrably working behavior, not merely code changes to "meet a definition".
- Every ExecPlan must define every term of art in plain language or do not use it.

Purpose and intent come first. Begin by explaining, in a few sentences, why the work matters from a user's perspective: what someone can do after this change that they could not do before, and how to see it working. Then guide the reader through the exact steps to achieve that outcome, including what to edit, what to run, and what they should observe.

The agent executing your plan can list files, read files, search, run the project, and run tests. It does not know any prior context and cannot infer what you meant from earlier milestones. Repeat any assumption you rely on. Do not point to external blogs or docs; if knowledge is required, embed it in the plan itself in your own words. If an ExecPlan builds upon a prior ExecPlan and that file is checked in, incorporate it by reference. If it is not, you must include all relevant context from that plan.

## Formatting

Format and envelope are simple and strict. Each ExecPlan must be one single fenced code block labeled as `md` that begins and ends with triple backticks. Do not nest additional triple-backtick code fences inside; when you need to show commands, transcripts, diffs, or code, present them as indented blocks within that single fence. Use indentation for clarity rather than code fences inside an ExecPlan to avoid prematurely closing the ExecPlan's code fence. Use two newlines after every heading, use # and ## and so on, and correct syntax for ordered and unordered lists.

When writing an ExecPlan to a Markdown (.md) file where the content of the file _is only_ the single ExecPlan, you should omit the triple backticks.

Write in plain prose. Prefer sentences over lists. Avoid checklists, tables, and long enumerations unless brevity would obscure meaning. Checklists are permitted only in the `Progress` section, where they are mandatory. Narrative sections must remain prose-first.

## Guidelines

Self-containment and plain language are paramount. If you introduce a phrase that is not ordinary English ("daemon", "middleware", "RPC gateway", "filter graph"), define it immediately and remind the reader how it manifests in this repository (for example, by naming the files or commands where it appears). Do not say "as defined previously" or "according to the architecture doc." Include the needed explanation here, even if you repeat yourself.

Avoid common failure modes. Do not rely on undefined jargon. Do not describe "the letter of a feature" so narrowly that the resulting code compiles but does nothing meaningful. Do not outsource key decisions to the reader. When ambiguity exists, resolve it in the plan itself and explain why you chose that path. Err on the side of over-explaining user-visible effects and under-specifying incidental implementation details.

Anchor the plan with observable outcomes. State what the user can do after implementation, the commands to run, and the outputs they should see. Acceptance should be phrased as behavior a human can verify ("after starting the server, navigating to http://localhost:8080/health returns HTTP 200 with body OK") rather than internal attributes ("added a HealthCheck struct"). If a change is internal, explain how its impact can still be demonstrated (for example, by running tests that fail before and pass after, and by showing a scenario that uses the new behavior).

Specify repository context explicitly. Name files with full repository-relative paths, name functions and modules precisely, and describe where new files should be created. If touching multiple areas, include a short orientation paragraph that explains how those parts fit together so a novice can navigate confidently. When running commands, show the working directory and exact command line. When outcomes depend on environment, state the assumptions and provide alternatives when reasonable.

Be idempotent and safe. Write the steps so they can be run multiple times without causing damage or drift. If a step can fail halfway, include how to retry or adapt. If a migration or destructive operation is necessary, spell out backups or safe fallbacks. Prefer additive, testable changes that can be validated as you go.

Validation is not optional. Include instructions to run tests, to start the system if applicable, and to observe it doing something useful. Describe comprehensive testing for any new features or capabilities. Include expected outputs and error messages so a novice can tell success from failure. Where possible, show how to prove that the change is effective beyond compilation (for example, through a small end-to-end scenario, a CLI invocation, or an HTTP request/response transcript). State the exact test commands appropriate to the project's toolchain and how to interpret their results.

Capture evidence. When your steps produce terminal output, short diffs, or logs, include them inside the single fenced block as indented examples. Keep them concise and focused on what proves success. If you need to include a patch, prefer file-scoped diffs or small excerpts that a reader can recreate by following your instructions rather than pasting large blobs.

## Milestones

Milestones are narrative, not bureaucracy. If you break the work into milestones, introduce each with a brief paragraph that describes the scope, what will exist at the end of the milestone that did not exist before, the commands to run, and the acceptance you expect to observe. Keep it readable as a story: goal, work, result, proof. Progress and milestones are distinct: milestones tell the story, progress tracks granular work. Both must exist. Never abbreviate a milestone merely for the sake of brevity, do not leave out details that could be crucial to a future implementation.

Each milestone must be independently verifiable and incrementally implement the overall goal of the execution plan.

## Living Plans and Design Decisions

- ExecPlans are living documents. As you make key design decisions, update the plan to record both the decision and the thinking behind it. Record all decisions in the `Decision Log` section.
- ExecPlans must contain and maintain a `Progress` section, a `Surprises & Discoveries` section, a `Decision Log`, and an `Outcomes & Retrospective` section. These are not optional.
- When you discover optimizer behavior, performance tradeoffs, unexpected bugs, or inverse/unapply semantics that shaped your approach, capture those observations in the `Surprises & Discoveries` section with short evidence snippets (test output is ideal).
- If you change course mid-implementation, document why in the `Decision Log` and reflect the implications in `Progress`. Plans are guides for the next contributor as much as checklists for you.
- At completion of a major task or the full plan, write an `Outcomes & Retrospective` entry summarizing what was achieved, what remains, and lessons learned.

## Prototyping Milestones and Parallel Implementations

It is acceptable — and often encouraged — to include explicit prototyping milestones when they de-risk a larger change. Examples: adding a low-level operator to a dependency to validate feasibility, or exploring two composition orders while measuring optimizer effects. Keep prototypes additive and testable. Clearly label the scope as "prototyping"; describe how to run and observe results; and state the criteria for promoting or discarding the prototype.

Prefer additive code changes followed by subtractions that keep tests passing. Parallel implementations (e.g., keeping an adapter alongside an older path during migration) are fine when they reduce risk or enable tests to continue passing during a large migration. Describe how to validate both paths and how to retire one safely with tests. When working with multiple new libraries or feature areas, consider creating spikes that evaluate the feasibility of these features _independently_ of one another, proving that the external library performs as expected and implements the features we need in isolation.

## Skeleton of a Good ExecPlan

    # <Short, action-oriented description>

    This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

    If PLANS.md file is checked into the repo, reference the path to that file here from the repository root and note that this document must be maintained in accordance with PLANS.md.

    ## Purpose / Big Picture

    Explain in a few sentences what someone gains after this change and how they can see it working. State the user-visible behavior you will enable.

    ## Progress

    Use a list with checkboxes to summarize granular steps. Every stopping point must be documented here, even if it requires splitting a partially completed task into two ("done" vs. "remaining"). This section must always reflect the actual current state of the work.

    - [x] (2025-10-01 13:00Z) Example completed step.
    - [ ] Example incomplete step.
    - [ ] Example partially completed step (completed: X; remaining: Y).

    Use timestamps to measure rates of progress.

    ## Surprises & Discoveries

    Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation. Provide concise evidence.

    - Observation: ...
      Evidence: ...

    ## Decision Log

    Record every decision made while working on the plan in the format:

    - Decision: ...
      Rationale: ...
      Date/Author: ...

    ## Outcomes & Retrospective

    Summarize outcomes, gaps, and lessons learned at major milestones or at completion. Compare the result against the original purpose.

    ## Context and Orientation

    Describe the current state relevant to this task as if the reader knows nothing. Name the key files and modules by full path. Define any non-obvious term you will use. Do not refer to prior plans.

    ## Plan of Work

    Describe, in prose, the sequence of edits and additions. For each edit, name the file and location (function, module) and what to insert or change. Keep it concrete and minimal.

    ## Concrete Steps

    State the exact commands to run and where to run them (working directory). When a command generates output, show a short expected transcript so the reader can compare. This section must be updated as work proceeds.

    ## Validation and Acceptance

    Describe how to start or exercise the system and what to observe. Phrase acceptance as behavior, with specific inputs and outputs. If tests are involved, say "run <project's test command> and expect <N> passed; the new test <name> fails before the change and passes after".

    ## Idempotence and Recovery

    If steps can be repeated safely, say so. If a step is risky, provide a safe retry or rollback path. Keep the environment clean after completion.

    ## Artifacts and Notes

    Include the most important transcripts, diffs, or snippets as indented examples. Keep them concise and focused on what proves success.

    ## Interfaces and Dependencies

    Be prescriptive. Name the libraries, modules, and services to use and why. Specify the types, traits/interfaces, and function signatures that must exist at the end of the milestone. Prefer stable names and paths such as crate::module::function or package.submodule.Interface.

If you follow the guidance above, a single, stateless agent — or a human novice — can read your ExecPlan from top to bottom and produce a working, observable result. That is the bar: SELF-CONTAINED, SELF-SUFFICIENT, NOVICE-GUIDING, OUTCOME-FOCUSED.

When you revise a plan, you must ensure your changes are comprehensively reflected across all sections, including the living document sections, and you must write a note at the bottom of the plan describing the change and the reason why. ExecPlans must describe not just the what but the why for almost everything.
```

**Step 2: Verify**

Run: `wc -l ~/.claude/skills/bootstrapping-agentic-harness/PLANS.md`
Expected: approximately 150-180 lines

---

### Task 5: Verify Complete Skill

**Step 1: List all files in the skill directory**

Run: `ls -la ~/.claude/skills/bootstrapping-agentic-harness/`
Expected: SKILL.md, templates.md, PLANS.md (3 files)

**Step 2: Check that SKILL.md frontmatter is valid**

Run: `head -4 ~/.claude/skills/bootstrapping-agentic-harness/SKILL.md`
Expected:
---
name: bootstrapping-agentic-harness
description: Use when starting a new project or onboarding to an existing codebase that lacks agentic harness artifacts — ARCHITECTURE.md, docs/PLANS.md, or structured docs/ with exec-plans
---

**Step 3: Verify word counts are reasonable**

Run: `wc -w ~/.claude/skills/bootstrapping-agentic-harness/SKILL.md ~/.claude/skills/bootstrapping-agentic-harness/templates.md`
Expected: SKILL.md under 1500 words, templates.md under 800 words

---

### Task 6: Test the Skill on Current Project

This is the validation step. Run the skill manually on the current church event management project to verify it works end-to-end.

**Step 1: Invoke the skill**

In a Claude Code session in this project, invoke `/bootstrapping-agentic-harness` (or the agent should suggest it since this project currently lacks docs/PLANS.md).

**Step 2: Verify DETECT step**

The skill should detect:

- ARCHITECTURE.md: missing
- docs/: structured (already has the folder structure from prior work)
- docs/PLANS.md: missing
- tech-debt.md: present (already exists)
- CLAUDE.md: exists but needs harness section updates

**Step 3: Verify CREATE step**

The skill should:

- Create docs/PLANS.md (from the PLANS.md template)
- Skip existing folders (docs/exec-plans/, docs/design-docs/, etc.)
- Skip tech-debt.md (already exists)

**Step 4: Verify AUDIT step**

The skill should:

- Read the codebase and write ARCHITECTURE.md in matklad style
- Identify the Next.js + Prisma + NextAuth stack
- Map the service layer, API routes, component structure
- Note architectural invariants (services don't import from components, etc.)

**Step 5: Verify WIRE step**

The skill should update CLAUDE.md with:

- Documentation section pointing to all harness artifacts
- ExecPlans section referencing docs/PLANS.md
- Agent Workflow section

**Step 6: Review all generated artifacts**

Read each generated file and confirm:

- ARCHITECTURE.md accurately reflects the codebase
- docs/PLANS.md contains the full ExecPlan specification
- CLAUDE.md has correct links and preserved existing content
- No broken cross-references
