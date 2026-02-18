# Project Instructions

## Git Worktrees

Always create worktrees as **sibling directories** to the project, never inside `.worktrees/` within the project. Placing worktrees inside the project causes Node module resolution to walk up and find the main repo's `node_modules`, leading to duplicate dependency issues (e.g., dual React instances breaking hooks).

```
# Good - sibling directory
git worktree add ../church-event-<feature-name> -b feature/<feature-name>

# Bad - inside project
git worktree add .worktrees/<feature-name> -b feature/<feature-name>
```
