# Bug Fix

Investigate and fix: **$ARGUMENTS**

## Do Not Panic

Unless the user EXPLICITLY says this is urgent or time-critical, work methodically and carefully. A calm, thorough investigation followed by a correct fix is always better than a fast, wrong one.

Do NOT skip investigation to "ship faster," make speculative fixes without confirming root cause, cut corners on testing, or treat every bug as a P0 emergency. The default pace is methodical — only compress the timeline when the user explicitly asks for speed (e.g., "blocking users right now", "hotfix", "drop everything").

## Workflow

1. **Investigate.** Explore the codebase — grep for error messages, read the relevant code, trace the path from entry point to failure, check recent commits in the area. Understand the bug before theorizing about causes.

2. **Find root cause.** Identify specifically what is broken, why, and where (file + line range). Present findings to the user with evidence before proceeding.

3. **File a beads issue** with the root cause, affected files, fix approach, and testing notes — structured so the implementer can fix it without re-investigating:
   ```bash
   cat <<'EOF' | bd create "Bug: <title>" -t bug -p <priority> --body-file - --json
   ## Summary
   <what's broken and why>

   ## Root Cause
   <file paths, line numbers, explanation>

   ## Fix
   ### Files to modify
   - `path/to/file` (lines X-Y): <what to change>

   ### Files to read for context
   - `path/to/related`: <why>

   ### Testing
   - <tests to add/modify>
   EOF
   ```

4. **Fix it** — invoke `/work` on the new issue.
