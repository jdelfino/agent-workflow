#!/bin/bash
# Hook: Block commands that bypass git hooks (--no-verify, --no-gpg-sign, LEFTHOOK=0, etc.)
cmd=$(jq -r '.tool_input.command')
if echo "$cmd" | grep -qiE '(--no-verify|--no-gpg-sign|LEFTHOOK=0|LEFTHOOK_SKIP|HUSKY=0)'; then
  echo '{"decision":"block","reason":"BLOCKED: Never bypass git hooks. If hooks fail, investigate the underlying cause — or ask the user."}'
else
  echo '{}'
fi
