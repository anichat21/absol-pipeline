#!/usr/bin/env bash
# One-shot codex delegation. Prints only the final agent message.
# Usage: ask.sh [-m MODEL] [-e EFFORT] [-C DIR] [-s SCHEMA.json] [-t SECONDS] "prompt"
set -euo pipefail

MODEL="gpt-5.6-sol"
EFFORT="high"
DIR="$PWD"
SCHEMA=""
TIMEOUT=900

while getopts "m:e:C:s:t:" opt; do
  case "$opt" in
    m) MODEL=$OPTARG ;;
    e) EFFORT=$OPTARG ;;
    C) DIR=$OPTARG ;;
    s) SCHEMA=$OPTARG ;;
    t) TIMEOUT=$OPTARG ;;
    *) exit 2 ;;
  esac
done
shift $((OPTIND - 1))
[ $# -eq 1 ] || { echo "usage: ask.sh [-m model] [-e effort] [-C dir] [-s schema.json] [-t secs] \"prompt\"" >&2; exit 2; }

OUT=$(mktemp) LOG=$(mktemp)
trap 'rm -f "$OUT" "$LOG"' EXIT

args=(exec --skip-git-repo-check --sandbox danger-full-access
      -m "$MODEL" -c "model_reasoning_effort=$EFFORT" -C "$DIR" -o "$OUT")
[ -n "$SCHEMA" ] && args+=(--output-schema "$SCHEMA")

# </dev/null: open stdin hangs exec. Log kept off the caller's context; tail shown on failure.
if ! timeout "$TIMEOUT" "$HOME/.local/bin/codex" "${args[@]}" "$1" </dev/null >"$LOG" 2>&1; then
  rc=$?
  echo "codex failed (exit $rc); log tail:" >&2
  tail -n 20 "$LOG" >&2
  exit "$rc"
fi
cat "$OUT"
