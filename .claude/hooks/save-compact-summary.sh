#!/bin/bash
# PostCompact: save the compaction summary as a handoff file.
python3 -I -c '
import json, sys, os, datetime
d = json.load(sys.stdin)
s = d.get("compact_summary") or ""
if not s: sys.exit(0)
dirp = os.path.expanduser("~/.claude/handoffs"); os.makedirs(dirp, exist_ok=True)
now = datetime.datetime.now()
p = os.path.join(dirp, now.strftime("%Y-%m-%d-%H%M") + "-compact-" + d.get("session_id","x")[:8] + ".md")
with open(p, "w") as f:
    f.write("# Compaction handoff, %s (trigger: %s, session %s)\n\n%s\n" % (now.isoformat(timespec="seconds"), d.get("trigger","?"), d.get("session_id","?"), s))
'
