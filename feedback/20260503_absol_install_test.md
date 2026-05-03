# Absol Install & Test — 2026-05-03

For Claude. Walk these steps with the user; pause on any blocker.

## 1. Back up deployed skills

```bash
mkdir -p /mnt/nas/dev/projects/absol/backup-skills
for s in absol-architect absol-finalizer absol-migrate absol-newproject absol-orchestrate grill-me note-taker; do
  if [ -d ~/.claude/skills/$s ]; then
    cp -r ~/.claude/skills/$s /mnt/nas/dev/projects/absol/backup-skills/
  else
    echo "skip $s (not deployed)"
  fi
done
```

## 2. Install new skills

```bash
cp -r /mnt/nas/dev/projects/absol/skills/* ~/.claude/skills/
ls ~/.claude/skills/ | grep -E 'absol|grill|note'
```

## 3. Migrate a snowowl copy

```bash
cp -r /mnt/nas/dev/projects/snowowl /mnt/nas/dev/projects/snowowl-test
```

Tell the user to run `/absol-migrate` from inside `snowowl-test`. Walk the kept/dropped report. User approves. Verify `.absol/` scaffolds and `state.md` regenerates cleanly.

## 4. Shake-down (1 task)

Add one trivial inbox item via `note-taker` (e.g. *"note: small comment in src/foo.ts"*). Tell the user to run `/absol-orchestrate`. Watch the HITL pause + AskUserQuestion + `executor_tier` path on one task end-to-end. Confirm finalize archives + clears.

## 5. Real test

Run `/absol-architect` on `snowowl-test`. Pick a top tech-debt item; promote to inbox. Run `/absol-orchestrate` to plan + execute.

## Rollback

```bash
for s in absol-architect absol-finalizer absol-migrate absol-newproject absol-orchestrate grill-me note-taker; do
  rm -rf ~/.claude/skills/$s
done
cp -r /mnt/nas/dev/projects/absol/backup-skills/* ~/.claude/skills/
rm -rf /mnt/nas/dev/projects/snowowl-test
```
