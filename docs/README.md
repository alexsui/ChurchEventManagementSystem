# Documentation

Navigation hub for all project documentation.

For architecture overview, see [`ARCHITECTURE.md`](../ARCHITECTURE.md) at the
project root.

## Folder Structure

### [`product-specs/`](product-specs/)

**What we're building.** Product requirements and scope definitions.

| File                                                                         | Description                                           |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| [PRD.md](product-specs/PRD.md)                                               | Original product requirements document **[OUTDATED]** |
| [requirements_discovery_doc.md](product-specs/requirements_discovery_doc.md) | Requirements discovery notes                          |

### [`design-docs/`](design-docs/)

**Why we built it this way.** Design rationale and architecture decisions.

- [`design-docs/index.md`](design-docs/index.md) — Catalog of all design docs
- [`design-docs/features/`](design-docs/features/) — Per-feature design docs
- [`design-docs/decisions/`](design-docs/decisions/) — Architecture Decision Records (ADRs)

### [`exec-plans/`](exec-plans/)

**Execution state and tracking.** The operational cockpit.

| File                                              | Description                               |
| ------------------------------------------------- | ----------------------------------------- |
| [feature-list.json](exec-plans/feature-list.json) | Feature acceptance list (source of truth) |
| [agent-progress.md](exec-plans/agent-progress.md) | Cross-session handoff log                 |
| [tech-debt.md](exec-plans/tech-debt.md)           | Known technical debt                      |
| [`active/`](exec-plans/active/)                   | Plans currently being worked on           |
| [`completed/`](exec-plans/completed/)             | Archived execution plans                  |

### [`references/`](references/)

**External knowledge.** Cost estimates, vendor research, API references.

| File                                                                                | Description           |
| ----------------------------------------------------------------------------------- | --------------------- |
| [vercel-supabase-cost-estimation.md](references/vercel-supabase-cost-estimation.md) | Hosting cost analysis |
