# Interactive sessions: stream the discussion answer first, run tool work after it

- date: 2026-07-26 · project: huntrx · run: RUN-2026-07-26
- component: front door / scratchpad (session conduct)

## What happened

Owner, mid-scratchpad, after asking a discussion question alongside actionable work: "Remember
you stream text to me. So discuss this with me first. While I read it you can do the other
stuff and it'll keep getting streamed below — otherwise I have to wait for you to do random
boring stuff and not be able to get my answers."

The default habit is tools-first (launch agents, write events, commit) with the substantive
answer at the end — which serializes the human behind the machinery. Streaming inverts it for
free: the owner reads the answer while the dispatches run below it.

## Expected

When a turn contains both a discussion answer and delegable/mechanical work, emit the
discussion text FIRST, then run the tool calls. Owner reads in parallel; nothing is lost.
Worth a line in scratchpad/doctrine conduct rules.
