#!/usr/bin/env bash
# One-shot codex delegation. Prints only the final agent message.
# Usage: ask.sh [-m MODEL] [-e EFFORT] [-C DIR] [-s SCHEMA.json] [-t SECONDS] [-b] "prompt"
#   -b  background: start codex, print pid/paths, exit 0 — collect OUT yourself when done
set -euo pipefail

MODEL="gpt-5.6-sol"
EFFORT="high"
DIR="$PWD"
SCHEMA=""
TIMEOUT=540   # < the harness 600s foreground Bash cap; use -b for anything longer
BG=0

while getopts "m:e:C:s:t:b" opt; do
  case "$opt" in
    m) MODEL=$OPTARG ;;
    e) EFFORT=$OPTARG ;;
    C) DIR=$OPTARG ;;
    s) SCHEMA=$OPTARG ;;
    t) TIMEOUT=$OPTARG ;;
    b) BG=1 ;;
    *) exit 2 ;;
  esac
done
shift $((OPTIND - 1))
[ $# -eq 1 ] || { echo "usage: ask.sh [-m model] [-e effort] [-C dir] [-s schema.json] [-t secs] [-b] \"prompt\"" >&2; exit 2; }

OUT=$(mktemp /tmp/codex-ask-out.XXXXXX)
LOG=$(mktemp /tmp/codex-ask-log.XXXXXX)

args=(exec --skip-git-repo-check --sandbox danger-full-access
      -m "$MODEL" -c "model_reasoning_effort=$EFFORT" -C "$DIR" -o "$OUT")
[ -n "$SCHEMA" ] && args+=(--output-schema "$SCHEMA")

# Detached (setsid) + paths printed up front: a killed wrapper never orphans a hidden run.
# </dev/null: open stdin hangs exec.
setsid "$HOME/.local/bin/codex" "${args[@]}" "$1" </dev/null >"$LOG" 2>&1 &
PID=$!
echo "codex pid=$PID out=$OUT log=$LOG" >&2

[ "$BG" -eq 1 ] && exit 0

SECS=0
while kill -0 "$PID" 2>/dev/null; do
  if [ "$SECS" -ge "$TIMEOUT" ]; then
    echo "ask.sh: timeout ${TIMEOUT}s — codex (pid $PID) left running; collect $OUT when it exits" >&2
    exit 124
  fi
  sleep 5
  SECS=$((SECS + 5))
done

rc=0
wait "$PID" 2>/dev/null || rc=$?
if [ "$rc" -ne 0 ]; then
  echo "codex failed (exit $rc); log tail:" >&2
  tail -n 20 "$LOG" >&2
  exit "$rc"
fi
cat "$OUT"
rm -f "$OUT" "$LOG"
