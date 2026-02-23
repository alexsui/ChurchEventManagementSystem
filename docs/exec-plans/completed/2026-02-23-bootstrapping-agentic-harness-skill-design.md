# Design: bootstrapping-agentic-harness Skill

## Purpose

A personal Claude Code skill that bootstraps the agentic development harness for any project. When invoked, it detects the current state of a repo, creates missing documentation structure, audits the codebase to write ARCHITECTURE.md, and wires up CLAUDE.md for the ExecPlan-driven agent workflow.

After running this skill, the repo is ready for the agentic coding loop: read ARCHITECTURE.md for orientation, check exec-plans/ for active work, write ExecPlans per docs/PLANS.md, implement, verify, update the plan.

## Decisions

- **Name:** bootstrapping-agentic-harness
- **Location:** ~/.claude/skills/bootstrapping-agentic-harness/ (SKILL.md + templates.md)
- **Scope:** Adaptive (detects existing state, fills gaps)
- **Tech stack:** Agnostic (detects from package.json, pyproject.toml, go.mod, etc.)
- **Trigger:** Suggested when ARCHITECTURE.md + docs/PLANS.md both missing. Never auto-runs.
- **Tracking model:** ExecPlans are the tracking mechanism (Progress, Decision Log, Surprises & Discoveries, Outcomes & Retrospective). No separate feature-list.json or agent-progress.md — the plans themselves handle handoff and status.

## Harness Structure Created

    ARCHITECTURE.md               # matklad-style architecture map (root)
    CLAUDE.md                     # Agent instructions with harness pointers (root)

    docs/
      PLANS.md                    # ExecPlan specification (rules for writing/executing plans)
      README.md                   # Navigation hub for all docs
      product-specs/              # WHAT we're building (PRDs, requirements)
      design-docs/                # WHY decisions were made
        index.md                  # Catalog of design docs
        decisions/                # Architecture Decision Records
          _template.md            # ADR template
        features/                 # Per-feature design docs
      exec-plans/                 # Living execution plans
        tech-debt.md              # Known technical debt
        active/                   # ExecPlans in progress
        completed/                # Finished ExecPlans (archive)
      references/                 # External knowledge, cost analysis, vendor docs

## Skill Files

### SKILL.md (~200 lines, process guide)

Frontmatter:

    name: bootstrapping-agentic-harness
    description: Use when starting a new project or onboarding to an existing
    codebase that lacks agentic harness artifacts — ARCHITECTURE.md,
    docs/PLANS.md, or structured docs/ folder

Sections:

1. Overview — what this skill does (2 sentences)
2. When to Use — triggering conditions
3. Process Flow — the 6-step checklist (DETECT, PLAN, CREATE, AUDIT, WIRE, VERIFY)
4. Detection Logic — what artifacts to check and how to classify them
5. Audit Guidelines — how to read any codebase and extract architecture
6. Common Mistakes — pitfalls

### templates.md (~150 lines, file content)

Contains the raw templates used when creating files:

1. Docs folder structure (the target tree)
2. PLANS.md (full ExecPlan specification from OpenAI Codex)
3. tech-debt.md template (High / Medium / Low priority sections)
4. ADR template (Status, Context, Decision, Consequences)
5. docs/README.md template (navigation hub)
6. ARCHITECTURE.md skeleton (matklad-style section headings)
7. CLAUDE.md agent workflow section (ExecPlans reference + documentation pointers)

## Process Detail

### Step 1: DETECT

Scan repo for existing harness artifacts:

    Artifact            Check                                 States
    ARCHITECTURE.md     Exists at root?                       missing / skeleton / complete
    docs/               Directory exists?                     missing / flat / structured
    docs/PLANS.md       ExecPlan spec exists?                 missing / present
    tech-debt.md        Exists in docs/exec-plans/?           missing / present
    CLAUDE.md           Exists at root? Has workflow section?  missing / no-workflow / complete

Detect tech stack by looking for config files:

- package.json (Node/JS/TS) — read scripts, deps, test framework
- pyproject.toml (Python) — read deps, test command, build system
- go.mod (Go), Cargo.toml (Rust), pom.xml / build.gradle (Java)
- Fall back to directory patterns if no config found

Detect existing docs that might need migration (e.g., flat docs/plans/).

### Step 2: PLAN

Based on detection, generate a plan:

- List artifacts to create, update, or skip
- If migration is needed (e.g., old flat folder), propose migration mapping
- Present plan to user for confirmation before proceeding

### Step 3: CREATE

Build folder structure and template files from templates.md. Skip any folder or file that already exists and is populated. Create docs/PLANS.md with the full ExecPlan specification.

### Step 4: AUDIT

Read the codebase to populate content. This is tech-stack agnostic — the agent reads whatever config files exist and adapts:

For ARCHITECTURE.md (matklad style):

- Project overview (what problem does this solve)
- Codemap (coarse-grained module map — where is the thing that does X)
- Important named entities (files, modules, types — by name, no links)
- Architectural invariants (constraints, critical design decisions, dependency rules)
- Layer boundaries (system boundaries that constrain implementation)
- Cross-cutting concerns (auth, logging, error handling, etc.)

For tech-debt.md:

- Scan for missing test coverage
- Scan for TODO/FIXME/HACK comments
- Note architectural gaps
- Classify by priority

### Step 5: WIRE

Create or update CLAUDE.md:

- Add Documentation section with links to all harness artifacts
- Add ExecPlans section: "When writing complex features or significant refactors, use an ExecPlan (as described in docs/PLANS.md) from design to implementation."
- Add Testing section with detected test commands
- Preserve any existing CLAUDE.md content

### Step 6: VERIFY

Confirm:

- All target folders exist
- ARCHITECTURE.md has all matklad-required sections
- docs/PLANS.md contains the ExecPlan specification
- tech-debt.md exists with initial entries
- CLAUDE.md points to all harness artifacts
- docs/README.md navigation links are consistent

## What This Skill Does NOT Do

- Does not create init.sh or smoke test scripts
- Does not set up CI/CD pipelines
- Does not install dependencies or dev tooling
- Does not create or run tests
- Does not make git commits (user decides when to commit)
- Does not create feature-list.json or agent-progress.md (exec plans handle tracking)
