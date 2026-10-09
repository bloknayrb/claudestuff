# Bridge

Bridge gives Claude a tool for decisions that are really yours: Claude queues the question with everything
needed to judge it and keeps working on what doesn't depend on the answer. You answer from a pane with one
key, and the answer reaches Claude as a message, waking it if it was idle.

## Install

```
/plugin marketplace add bloknayrb/claudestuff
/plugin install bridge@claudestuff-marketplace
```

Requires Claude Code 2.1.292 or newer (function-hook mods).

## Answering a decision

Claude queues a decision with the `mcp__bridge__decide` tool. The call returns at once ("Logged as
decision #N…") and the turn goes on.

- **The band.** While decisions are pending and the pane is not showing, a band above the prompt reads
  `⚑ N decisions pending · /bridge`. It only counts; it answers nothing. The band is the notice of a new
  decision: Bridge raises no toast for one.
- **The pane.** `/bridge` opens it (it works mid-turn). In fullscreen mode with at least 144 columns, the pane
  also opens by itself, without taking focus, when a decision arrives. Each card shows the question, the
  context, 2 to 4 options, Claude's recommendation and why, and why Claude thinks the call is yours.
- **Keys** act on the oldest card: `1`-`4` picks an option, `m` ("Make it so") takes the recommended one,
  and `o` opens Other for your own words (Enter sends). If the pane lacks the keys, `ctrl+x tab` gives
  them to it. Later cards' buttons work by Tab or click.
- **The key pause.** After an answer the keys pause for 1.1 s ("Keys paused a moment: let go of the
  key."), and each press during the pause restarts it, so a double-tap or a held key cannot answer a card
  you have not read. 1.1 s sits above Windows' largest keyboard repeat delay (1000 ms; Windows allows
  250-1000 ms). The cost is a 1.1 s wait before the next card's keys work.
- The pane closes itself when the last pending decision is answered. `/bridge` with nothing pending
  prints "Bridge: no decisions pending."

Decisions are answered only from the pane. Typing "make it so" or "engage" at the prompt does not answer
one: it reaches Claude as an ordinary message, and the decision stays pending. (An earlier build let a
typed go-ahead resolve the one pending decision, but the row it appended reached the model only after the
turn's first tool call, about 4 s after the prompt, so the path was removed.)

## What Claude receives

Each answer is appended to the conversation as one row, in exactly one of these shapes:

```
Bridge decision: {"id":3,"question":"Which database?","choice":"label","label":"SQLite"}
Bridge decision: {"id":3,"question":"Which database?","choice":"other","text":"Neither; use the existing file store"}
```

The object is written by `JSON.stringify` with the keys in this order. Only `text`, present when `choice`
is `"other"`, is the user's own words; `question` and `label` are Claude's. A strict consumer can rely on
that.

If Claude was idle, Bridge then submits a wake, `<bridge-wake/>`, which arrives framed as "The bridge
plugin sent a message". Answers given together share one wake. An answer given during a turn needs no
wake if a later step of that turn reads it; otherwise one wake follows when the turn ends with an answer.
After a turn that was interrupted, refused or ended in an error, nothing wakes, and the answer reaches Claude with
your next prompt. Bridge never adds anything to a prompt you type.

If a wake cannot be submitted, a toast says "Bridge: answer saved; it reaches Claude with your next
prompt." If the row itself cannot be appended, a toast names the decision and it is pending again. These
two toasts are the only notice of a lost answer.

## Limits

- **Main loop only.** A subagent's call is refused, since the subagent may be gone when the answer
  arrives; it is told to put the question in its report.
- **A decision lives for the session.** `/clear` and `/resume` empty the queue (ids restart at 1) and
  close the pane.
- **An answer given in prose does not close a card.** Answer from the pane.
- **The band** is drawn on terminal and desktop only, and yields to a survey. Elsewhere (Remote Control,
  an IDE) a queued decision shows only as the tool call in the transcript, unless the pane is open.
- **On the phone there is no Other field** (the surface draws no text input). The pick and Make it so
  buttons are drawn there; answering from the phone was not tried live.
- **The key pause is sized for Windows.** macOS and X11 repeat delays can be set slower than 1.1 s, and
  there a held key can still answer the next card. The value comes from one live failure (holding `m`
  answered two cards at the old 400 ms pause, with a 500 ms repeat delay) and has not yet been re-run live.
- **No toast for a new decision.** An earlier build raised one, but in testing none was ever seen from
  the decide tool's path while the band showed every time, so Bridge no longer raises it. That was outside fullscreen mode, where a toast is a 4 s line on the
  notification bar, so the cause is unproven; the band is the notice either way.

## Shared code

`hooks/delivery.ts` (when a row is read, and when an idle wake is due) is shared byte for byte with the
Red Team mod, which is not yet published; the copies were checked identical on 2026-10-08. Change both
together.

## Files

A heartbeat at `~/.claude/state/mods/bridge/<session-id>.json`: `{"loadedAt": …, "lastError": null}`, or
`lastError: {ts, message}` after a hook failure. It is written at session start, on a failure, and at the
first main turn after `/clear` or `/resume` (the session id changes and no session start fires).

## Development

```
claude plugin test plugins/bridge
claude plugin validate plugins/bridge
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which the engine writes when the mod loads
(it is gitignored). `types/index.d.ts` holds the mod's own types (its state, the tool input, answers).
