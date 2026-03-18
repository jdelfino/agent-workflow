# Work Coordinator

Coordinate work on **$ARGUMENTS** using the coordinator workflow.

## 1. Parse Input

- **`bd-*`** (beads ID): `bd show $ARGUMENTS --json`. If epic: `bd list --parent $ARGUMENTS --json`
- **`#<number>`** (GitHub issue): Fetch and convert to beads issue:
  ```bash
  gh issue view <number> --json title,body,labels,number
  bd create "<title>" -d "GitHub: #<number> — <description>" -t <type> -p <priority> --json
  ```
  Map GitHub labels to beads types. Priority 1 for bugs, 2 for features/tasks.
- **Other** (ad-hoc description): The coordinator will create a beads issue.

## 2. Follow the coordinator skill instructions below

---

@.claude/skills/coordinator/SKILL.md
