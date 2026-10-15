#!/usr/bin/env bash
set -uo pipefail

max_attempts="${RETRY_MAX_ATTEMPTS:-3}"
base_delay_seconds="${RETRY_BASE_DELAY_SECONDS:-30}"

if [[ "$#" == "0" ]]; then
  echo "Usage: retry-command.sh <command> [args...]" >&2
  exit 2
fi

if [[ ! "${max_attempts}" =~ ^[1-9][0-9]*$ ]]; then
  echo "RETRY_MAX_ATTEMPTS must be a positive integer." >&2
  exit 2
fi

if [[ ! "${base_delay_seconds}" =~ ^[0-9]+$ ]]; then
  echo "RETRY_BASE_DELAY_SECONDS must be a non-negative integer." >&2
  exit 2
fi

attempt=1
while true; do
  if "$@"; then
    exit 0
  else
    exit_code=$?
  fi

  if (( attempt >= max_attempts )); then
    echo "::error::Command failed after ${attempt} attempts." >&2
    exit "${exit_code}"
  fi

  delay_seconds=$((base_delay_seconds * attempt))
  echo "::warning::Command failed on attempt ${attempt}/${max_attempts}; retrying in ${delay_seconds}s." >&2
  sleep "${delay_seconds}"
  attempt=$((attempt + 1))
done
