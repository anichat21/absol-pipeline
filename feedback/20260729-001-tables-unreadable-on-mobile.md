# Markdown tables unreadable on mobile — prefer code-block layout for data readouts

- date: 2026-07-29 · project: tempTurboBlender (session, not an absol run) · run: n/a
- component: front door / output formatting (all agents that render data to the user)

## What happened

During a Blender collection-hierarchy review, the assistant presented two file trees as
indented monospace code blocks instead of the usual markdown tables. User (reading on the
Claude mobile app): "the way you presented this code block is very good for reading data in
general on claude mobile app. The normal tables you make suck cuz they don't wrap and i
have to scroll to the side."

## Expected

Data readouts (hierarchies, inventories, comparisons) rendered as wrapped/indented
monospace code blocks by default; markdown tables reserved for genuinely short rows that
fit a phone screen without horizontal scrolling.
