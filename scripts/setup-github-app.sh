#!/bin/bash
# setup-github-app.sh - Set up a GitHub App for sandboxed agent access
#
# Gives Claude (or any agent) its own GitHub identity, scoped to specific repos
# with specific permissions. PRs created by the app require human approval.
#
# What this script does:
#   1. Walks you through creating and installing a GitHub App
#   2. Generates and verifies an installation token
#   3. Wires a SessionStart hook into .claude/settings.json to auto-refresh tokens
#   4. Adds .gh-app-token and state files to .gitignore
#   5. Updates shell profile so GH_TOKEN uses the app token
#
# Usage:
#   ./scripts/setup-github-app.sh [app-name] [repo]
#
# Examples:
#   ./scripts/setup-github-app.sh                        # auto-detect repo, default name
#   ./scripts/setup-github-app.sh claude-bot owner/repo
#
# Idempotent: safe to run multiple times. Skips completed steps.
# No dependency on any secrets manager.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

APP_NAME="${1:-claude-bot}"

# Auto-detect repo from git remote
if [ -n "${2:-}" ]; then
    REPO="$2"
else
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
    if [ -z "$REMOTE_URL" ]; then
        echo "ERROR: No git remote found. Pass repo as second argument: $0 $APP_NAME owner/repo"
        exit 1
    fi
    REPO=$(echo "$REMOTE_URL" | sed -E 's#.*github\.com[:/](.+)(\.git)?$#\1#' | sed 's/\.git$//')
fi

STATE_FILE=".github-app-state.json"

echo "=== GitHub App Setup ==="
echo "App name:   $APP_NAME"
echo "Repository: $REPO"
echo ""

# --- Helpers ---
read_state() {
    if [ -f "$STATE_FILE" ]; then
        jq -r ".$1 // empty" "$STATE_FILE" 2>/dev/null || true
    fi
}

write_state() {
    local key="$1" value="$2"
    if [ -f "$STATE_FILE" ]; then
        jq ".$key = \"$value\"" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    else
        echo "{\"$key\": \"$value\"}" > "$STATE_FILE"
    fi
    chmod 600 "$STATE_FILE"
}

# ============================================================
# Step 1: Create the GitHub App
# ============================================================
APP_ID=$(read_state "app_id")

if [ -n "$APP_ID" ]; then
    echo "Step 1: App already created (ID: $APP_ID) — skipping"
else
    echo "Step 1: Create the GitHub App"
    echo ""
    echo "  Go to: https://github.com/settings/apps/new"
    echo ""
    echo "  Fill in:"
    echo "    App name:      $APP_NAME"
    echo "    Homepage URL:  https://github.com/$REPO"
    echo "    Webhook:       UNCHECK 'Active'"
    echo ""
    echo "  Repository permissions:"
    echo "    Contents:        Read & Write"
    echo "    Pull requests:   Read & Write"
    echo "    Issues:          Read & Write"
    echo "    Checks:          Read"
    echo "    Metadata:        Read (auto-granted)"
    echo ""
    echo "  Where can this app be installed: Only on this account"
    echo ""
    echo "  Click 'Create GitHub App'"
    echo ""
    read -rp "  Enter the App ID (shown on the app settings page): " APP_ID

    if [ -z "$APP_ID" ]; then
        echo "ERROR: App ID is required"
        exit 1
    fi
    write_state "app_id" "$APP_ID"
    echo "  Saved."
fi

# ============================================================
# Step 2: Private key
# ============================================================
PRIVATE_KEY_FILE=$(read_state "private_key_file")

if [ -n "$PRIVATE_KEY_FILE" ] && [ -f "$PRIVATE_KEY_FILE" ]; then
    echo "Step 2: Private key exists ($PRIVATE_KEY_FILE) — skipping"
else
    PRIVATE_KEY_FILE=".github-app-${APP_NAME}.pem"
    echo ""
    echo "Step 2: Generate a private key"
    echo ""
    echo "  Go to: https://github.com/settings/apps/${APP_NAME}"
    echo "  Scroll to 'Private keys' -> 'Generate a private key'"
    echo "  A .pem file will download."
    echo ""
    read -rp "  Enter the path to the downloaded .pem file: " PEM_PATH

    if [ ! -f "$PEM_PATH" ]; then
        echo "ERROR: File not found: $PEM_PATH"
        exit 1
    fi
    cp "$PEM_PATH" "$PRIVATE_KEY_FILE"
    chmod 600 "$PRIVATE_KEY_FILE"
    write_state "private_key_file" "$PRIVATE_KEY_FILE"
    echo "  Copied to $PRIVATE_KEY_FILE"
fi

# ============================================================
# Step 3: Install the app
# ============================================================
INSTALLATION_ID=$(read_state "installation_id")

if [ -n "$INSTALLATION_ID" ]; then
    echo "Step 3: App already installed (Installation ID: $INSTALLATION_ID) — skipping"
else
    echo ""
    echo "Step 3: Install the app on your repo"
    echo ""
    echo "  Go to: https://github.com/settings/apps/${APP_NAME}/installations"
    echo "  Click 'Install' -> select 'Only select repositories' -> choose '$REPO'"
    echo ""
    echo "  After installing, the URL will be:"
    echo "    https://github.com/settings/installations/<number>"
    echo "  That number is your Installation ID."
    echo ""
    read -rp "  Enter the Installation ID: " INSTALLATION_ID

    if [ -z "$INSTALLATION_ID" ]; then
        echo "ERROR: Installation ID is required"
        exit 1
    fi
    write_state "installation_id" "$INSTALLATION_ID"
    echo "  Saved."
fi

# ============================================================
# Step 4: Verify — generate a token and test it
# ============================================================
echo ""
echo "Step 4: Verifying setup..."

PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE")

NOW=$(date +%s)
IAT=$((NOW - 60))
EXP=$((NOW + 600))

HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
PAYLOAD=$(echo -n "{\"iat\":${IAT},\"exp\":${EXP},\"iss\":\"${APP_ID}\"}" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

SIGNATURE=$(echo -n "${HEADER}.${PAYLOAD}" | \
    openssl dgst -sha256 -sign <(echo "$PRIVATE_KEY") -binary | \
    openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

JWT="${HEADER}.${PAYLOAD}.${SIGNATURE}"

RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer ${JWT}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens")

TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
    echo "  ERROR: Failed to generate installation token"
    echo "  Response: $RESPONSE"
    echo ""
    echo "  Common causes:"
    echo "    - Wrong App ID or Installation ID"
    echo "    - Private key doesn't match the app"
    echo "    - App not installed on the repo"
    exit 1
fi

REPO_NAME=$(curl -s -H "Authorization: token $TOKEN" \
    "https://api.github.com/repos/$REPO" | jq -r '.full_name // empty')

if [ "$REPO_NAME" != "$REPO" ]; then
    echo "  ERROR: Token generated but can't access $REPO"
    exit 1
fi

echo "  Token works. App can access $REPO."

# Write the token so the shell profile and generate script can use it
echo "$TOKEN" > .gh-app-token
chmod 600 .gh-app-token
git config url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"

# ============================================================
# Step 5: Wire up .gitignore
# ============================================================
echo ""
echo "Step 5: Updating .gitignore..."

GITIGNORE_ENTRIES=(".gh-app-token" ".github-app-state.json" ".github-app-*.pem")
CHANGED=false

for entry in "${GITIGNORE_ENTRIES[@]}"; do
    if ! grep -qxF "$entry" .gitignore 2>/dev/null; then
        echo "$entry" >> .gitignore
        CHANGED=true
    fi
done

if [ "$CHANGED" = true ]; then
    echo "  Added entries to .gitignore"
else
    echo "  .gitignore already up to date — skipping"
fi

# ============================================================
# Step 6: Wire up Claude Code SessionStart hook
# ============================================================
echo ""
echo "Step 6: Updating .claude/settings.json..."

SETTINGS_FILE=".claude/settings.json"
HOOK_CMD="bash scripts/generate-github-app-token.sh"

if [ ! -f "$SETTINGS_FILE" ]; then
    echo "  WARNING: $SETTINGS_FILE not found — skipping hook setup"
    echo "  Add this hook manually to refresh tokens at session start:"
    echo "    $HOOK_CMD"
else
    # Check if hook is already present
    if grep -qF "generate-github-app-token" "$SETTINGS_FILE" 2>/dev/null; then
        echo "  SessionStart hook already configured — skipping"
    else
        # Add the hook command to the existing SessionStart hooks array
        # The hook array is at .hooks.SessionStart[0].hooks — append to it
        if jq -e '.hooks.SessionStart[0].hooks' "$SETTINGS_FILE" > /dev/null 2>&1; then
            jq '.hooks.SessionStart[0].hooks += [{"type": "command", "command": "'"$HOOK_CMD"'"}]' \
                "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
        else
            # No SessionStart hooks exist — create the structure
            jq '.hooks.SessionStart = [{"hooks": [{"type": "command", "command": "'"$HOOK_CMD"'"}]}]' \
                "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp" && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
        fi
        echo "  Added SessionStart hook to refresh token"
    fi
fi

# ============================================================
# Step 7: Wire up shell profile
# ============================================================
echo ""
echo "Step 7: Updating shell profile..."

PROFILE_LINE="# GitHub App token for agent identity
if [ -f \"$PROJECT_DIR/.gh-app-token\" ]; then
    export GH_TOKEN=\$(cat \"$PROJECT_DIR/.gh-app-token\")
fi"

PROFILE_CHANGED=false

for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$rc" ]; then
        if ! grep -qF "gh-app-token" "$rc" 2>/dev/null; then
            echo "" >> "$rc"
            echo "$PROFILE_LINE" >> "$rc"
            PROFILE_CHANGED=true
            echo "  Updated $(basename "$rc")"
        else
            echo "  $(basename "$rc") already configured — skipping"
        fi
    fi
done

if [ "$PROFILE_CHANGED" = true ]; then
    echo ""
    echo "  NOTE: Run 'source ~/.bashrc' or start a new terminal for GH_TOKEN to take effect."
fi

# ============================================================
# Done
# ============================================================
echo ""
echo "==========================================="
echo "  Setup complete!"
echo "==========================================="
echo ""
echo "  What happened:"
echo "    - GitHub App '$APP_NAME' configured for $REPO"
echo "    - Token generated and verified"
echo "    - .gitignore updated"
echo "    - Claude Code SessionStart hook installed (auto-refreshes tokens)"
echo "    - Shell profile updated (GH_TOKEN set from .gh-app-token)"
echo ""
echo "  Credentials (store in your secrets manager if desired):"
echo "    App ID:          $APP_ID"
echo "    Installation ID: $INSTALLATION_ID"
echo "    Private key:     $PRIVATE_KEY_FILE"
echo "    State file:      $STATE_FILE"
echo ""
echo "  From now on, every Claude session will automatically"
echo "  use the app identity for git and gh operations."
echo ""
