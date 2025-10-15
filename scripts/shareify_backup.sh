#!/usr/bin/env bash
# Periodically compress a directory, encrypt+upload via shareify_cli.py, then delete the local archive.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CLI="${SCRIPT_DIR}/shareify_cli.py"

usage() {
  cat <<'EOF'
Usage: shareify_backup.sh --source DIR [--interval MINUTES] [--credential-file PATH]
                          [--encryption-password PASSWORD] [--base-url URL]
                          [--directory-id ID] [--share-hash HASH]
                          [--archive-dir DIR] [--run-once]
                          [--no-exit-prompt]

Options:
  --source DIR                Directory to compress and back up (required).
  --interval MINUTES          Minutes between backups (default: 60).
  --credential-file PATH      Credential file for shareify_cli (default: scripts/.credential if present).
  --encryption-password PASS  Encryption password (falls back to credential file or prompt).
  --base-url URL              Shareify base URL (default: http://localhost:3000).
  --directory-id ID           Target directory ID in Shareify (optional).
  --share-hash HASH           Writable share hash for shared uploads (optional).
  --archive-dir DIR           Directory to store temporary archives (default: /tmp/shareify_backups).
  --run-once                  Perform a single backup then exit.
  --no-exit-prompt            Do not prompt before the script exits (useful for automation).
  -h, --help                  Show this help message.

Set SHAREIFY_EXTRA_ARGS to append additional arguments to shareify_cli.py.
EOF
}

SOURCE_DIR=""
INTERVAL_MINUTES=60
CREDENTIAL_FILE=""
ENCRYPTION_PASSWORD=""
BASE_URL="http://localhost:3000"
DIRECTORY_ID=""
SHARE_HASH=""
ARCHIVE_DIR="/tmp/shareify_backups"
RUN_ONCE=false
EXIT_PROMPT=true

prompt_on_exit() {
  local status=$?
  trap - EXIT
  if $EXIT_PROMPT && [[ -t 1 ]]; then
    echo
    read -rp "Press Enter to close this window..." _
  fi
  exit "$status"
}

trap prompt_on_exit EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --interval)
      INTERVAL_MINUTES="$2"
      shift 2
      ;;
    --credential-file)
      CREDENTIAL_FILE="$2"
      shift 2
      ;;
    --encryption-password)
      ENCRYPTION_PASSWORD="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --directory-id)
      DIRECTORY_ID="$2"
      shift 2
      ;;
    --share-hash)
      SHARE_HASH="$2"
      shift 2
      ;;
    --archive-dir)
      ARCHIVE_DIR="$2"
      shift 2
      ;;
    --run-once)
      RUN_ONCE=true
      shift 1
      ;;
    --no-exit-prompt)
      EXIT_PROMPT=false
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_DIR" ]]; then
  echo "--source DIR is required" >&2
  usage >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory '$SOURCE_DIR' does not exist" >&2
  exit 1
fi

if [[ ! -f "$CLI" ]]; then
  echo "Cannot find shareify_cli.py at $CLI" >&2
  exit 1
fi

mkdir -p "$ARCHIVE_DIR"

# Default credential file lookup mirrors shareify_cli.py behavior.
if [[ -z "$CREDENTIAL_FILE" ]]; then
  if [[ -n "${SHAREIFY_CREDENTIAL_FILE:-}" ]]; then
    CREDENTIAL_FILE="$SHAREIFY_CREDENTIAL_FILE"
  elif [[ -f "${SCRIPT_DIR}/.credential" ]]; then
    CREDENTIAL_FILE="${SCRIPT_DIR}/.credential"
  fi
fi

echo "Starting Shareify backup loop for $SOURCE_DIR"

GLOBAL_ARGS=()
if [[ -n "$BASE_URL" ]]; then
  GLOBAL_ARGS+=("--base-url" "$BASE_URL")
fi

while true; do
  TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
  ARCHIVE_PATH="$ARCHIVE_DIR/$(basename "$SOURCE_DIR")-${TIMESTAMP}.tar.gz"

  echo "[$(date +"%Y-%m-%d %H:%M:%S")] Creating archive $ARCHIVE_PATH"
  tar -czf "$ARCHIVE_PATH" -C "$(dirname "$SOURCE_DIR")" "$(basename "$SOURCE_DIR")"

  CLI_ARGS=("upload" "$ARCHIVE_PATH" "--encrypt")

  if [[ -n "$CREDENTIAL_FILE" ]]; then
    CLI_ARGS+=("--credential-file" "$CREDENTIAL_FILE")
  fi

  if [[ -n "$ENCRYPTION_PASSWORD" ]]; then
    CLI_ARGS+=("--encryption-password" "$ENCRYPTION_PASSWORD")
  fi

  if [[ -n "$DIRECTORY_ID" ]]; then
    CLI_ARGS+=("--directory-id" "$DIRECTORY_ID")
  fi

  if [[ -n "$SHARE_HASH" ]]; then
    CLI_ARGS+=("--share-hash" "$SHARE_HASH")
  fi

  if [[ -n "${SHAREIFY_EXTRA_ARGS:-}" ]]; then
    # shellcheck disable=SC2206
    EXTRA_ARRAY=($SHAREIFY_EXTRA_ARGS)
    CLI_ARGS+=("${EXTRA_ARRAY[@]}")
  fi

  echo "[$(date +"%Y-%m-%d %H:%M:%S")] Uploading archive via shareify_cli.py"
  if python3 "$CLI" "${GLOBAL_ARGS[@]}" "${CLI_ARGS[@]}"; then
    echo "Upload succeeded, removing local archive"
    rm -f "$ARCHIVE_PATH"
  else
    echo "Upload failed; keeping archive at $ARCHIVE_PATH" >&2
  fi

  if $RUN_ONCE; then
    break
  fi

  echo "Sleeping for $INTERVAL_MINUTES minute(s)..."
  sleep "$((INTERVAL_MINUTES * 60))"
done

