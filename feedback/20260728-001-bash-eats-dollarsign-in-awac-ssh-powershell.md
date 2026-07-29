# Bash eats `$_`/`$var` in double-quoted ssh→AWAC PowerShell commands

- date: 2026-07-28 · project: tempTurboBlender prep (workspace/AWAC ops) · run: n/a
- component: front door / remote-command authoring (AWAC ssh)

## What happened
Running `ssh AWAC "powershell -Command \"... | ForEach-Object { Write-Host ('=== ' + $_) ... }\""`
from aidev: local bash expanded `$_` before the command left the box, so PowerShell received
`unsetenv` in its place and threw parser errors ("You must provide a value expression following
the '+' operator"). Recurring pattern — happens whenever PowerShell pipeline variables or `$var`
appear inside the double-quoted ssh command string.

## Expected
`$_` reaches PowerShell intact. Workarounds when authoring AWAC remote commands: escape as
`\$_`, prefer single-quote outer quoting where feasible, or fall back to cmd builtins
(`dir`, `type`, `findstr`) that need no `$`.
