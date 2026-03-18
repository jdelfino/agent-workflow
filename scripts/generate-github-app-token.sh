#!/bin/bash
# generate-github-app-token.sh - Generate a GitHub App installation token
#
# Reads credentials from environment variables, files, or arguments.
# Outputs the token to .gh-app-token and configures git/gh to use it.
#
# Usage:
#   ./scripts/generate-github-app-token.sh
#
# Credential sources (checked in order):
#   1. Environment: GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY
#   2. State file: .github-app-state.json + .pem file referenced within
#   3. Arguments: --app-id, --installation-id, --private-key-file
#
# Run this on container start and when tokens expire (every hour).
set -euo pipefail

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        --app-id) APP_ID="$2"; shift 2 ;;
        --installation-id) INSTALLATION_ID="$2"; shift 2 ;;
        --private-key-file) PRIVATE_KEY_FILE="$2"; shift 2 ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

STATE_FILE=".github-app-state.json"

# --- Resolve credentials ---
read_state() {
    if [ -f "$STATE_FILE" ]; then
        jq -r ".$1 // empty" "$STATE_FILE" 2>/dev/null || true
    fi
}

APP_ID="${APP_ID:-${GITHUB_APP_ID:-$(read_state app_id)}}"
INSTALLATION_ID="${INSTALLATION_ID:-${GITHUB_APP_INSTALLATION_ID:-$(read_state installation_id)}}"

if [ -z "${PRIVATE_KEY_FILE:-}" ]; then
    if [ -n "${GITHUB_APP_PRIVATE_KEY:-}" ]; then
        PRIVATE_KEY="$GITHUB_APP_PRIVATE_KEY"
    else
        PRIVATE_KEY_FILE=$(read_state private_key_file)
    fi
fi

if [ -z "$APP_ID" ] || [ -z "$INSTALLATION_ID" ]; then
    echo "ERROR: Missing credentials."
    echo "  Set GITHUB_APP_ID + GITHUB_APP_INSTALLATION_ID environment variables,"
    echo "  or run scripts/setup-github-app.sh first."
    exit 1
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
    if [ -z "${PRIVATE_KEY_FILE:-}" ] || [ ! -f "${PRIVATE_KEY_FILE:-}" ]; then
        echo "ERROR: Private key not found."
        echo "  Set GITHUB_APP_PRIVATE_KEY env var, or pass --private-key-file."
        exit 1
    fi
    PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE")
fi

# --- Generate JWT ---
NOW=$(date +%s)
IAT=$((NOW - 60))
EXP=$((NOW + 600))

HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
PAYLOAD=$(echo -n "{\"iat\":${IAT},\"exp\":${EXP},\"iss\":\"${APP_ID}\"}" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

SIGNATURE=$(echo -n "${HEADER}.${PAYLOAD}" | \
    openssl dgst -sha256 -sign <(echo "$PRIVATE_KEY") -binary | \
    openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

JWT="${HEADER}.${PAYLOAD}.${SIGNATURE}"

# --- Exchange for installation token ---
RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer ${JWT}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens")

TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to generate GitHub App installation token"
    echo "Response: $RESPONSE"
    exit 1
fi

# --- Configure environment ---
echo "$TOKEN" > .gh-app-token
chmod 600 .gh-app-token

git config url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"

echo "GitHub App token generated (expires in 1 hour)"
