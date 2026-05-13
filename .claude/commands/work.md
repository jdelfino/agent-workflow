# Work Coordinator

User request: $ARGUMENTS

**All work happens in a worktree under `.claude/worktrees/`.** The directory you're in may be irrelevant — re-evaluate from the request above.

Run `git worktree list`, then:

1. Extending an in-flight change → enter its existing worktree.
2. Stacking new work on an in-flight branch → new worktree from that branch.
3. Otherwise → new worktree from `origin/main`.

To create one (from the main repo root):

```bash
git fetch origin <base> --quiet
git worktree add .claude/worktrees/<slug> -b feature/<slug> origin/<base>
```

If your project requires per-worktree setup (node_modules symlink, lockfile resolution, generated files), run that here.

Then `EnterWorktree(path: .claude/worktrees/<slug>)`. If already in a worktree, `ExitWorktree(action: "keep")` first.

@.claude/skills/coordinator/SKILL.md
