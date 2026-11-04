# Docket

Docket keeps a list of everything Claude has said in its prose that is yours to decide or do: "your
call: SQLite or Postgres?", "you'll need to run `gh auth login`", "merge #18 when you're ready". Questions Claude
asks through the AskUserQuestion tool are left out, since that tool already stops for you. Each item
drops off the list when you decide or act on it, when Claude reports it done or moot, or when you
dismiss it.

## Install

```
/plugin marketplace add bloknayrb/claudestuff
/plugin install docket@claudestuff-marketplace
```

Requires Claude Code 2.1.317 or newer (function-hook mods).

## Using it

- **The button above the prompt.** While anything is open, an amber `◇ 2 for you to decide or do ·
  click to show` sits above the prompt. Clicking it opens or closes the panel. It is hidden when
  nothing is open, and it makes room for a survey.
- **`/docket`** opens or closes the panel too. `/docket add <text>` adds an item Docket missed;
  `/docket clear` dismisses everything (one "Reopen all" brings it back). `/docket carry on|off`
  sends the docket on to the next session here (below). `/docket forget` erases the saved copy of
  this conversation's docket and turns carry off (see Files).
- **Your docket survives quitting.** Come back with `claude --resume`, `--continue` or `/resume` and
  the list is as you left it.
- **The panel** lists open items under **Decide** and **Do**, each with its age in turns (`now`,
  `2t`). Once items have been carried in, it groups them by the session they were first raised in:
  **This session** first, then `From Nov 1 session (↪ 2d)` and so on, newest first, each with its own
  Decide and Do. Each item has three buttons:
  - **Reply** puts `Re: <item> — ` in your prompt box (after anything you have typed) so your answer
    names the item. Focus stays in the panel: click the prompt or press Esc to type.
  - **Done** closes it as handled by you, for things you did outside the chat.
  - **✕** dismisses it. The digit keys `1`-`9` do the same, in the order shown, while the panel has
    the keys (`ctrl+x tab`).
- Tab onto an item to see the words of Claude's it came from.
- **`N closed · show`** at the bottom lists recent closes with the reason (you, Claude, dismissed) and
  a Reopen button each. Reopen is the undo for a wrong close.
- After any change to the list the digit keys pause for 1.1 s, and each press during the pause
  restarts it, so a list that just reordered cannot turn a press into the wrong dismiss.

## Carrying the docket to the next session

`/docket carry on` (or **turn on** in the panel's bottom row) sends whatever is open when you leave
to the next session in the same folder: a fresh `claude`, or a `/clear`. It stays on: the session
that receives the items starts with carry on too, so the docket follows you until you turn it off.

- **`/docket carry`** says whether it's on; **`/docket carry off`** stops it.
- **While it's on**, the button reads `◇ 2 for you to decide or do · ↪ next session`, and the
  handoff is rewritten with every change, so closing the terminal tab doesn't lose it. Items you
  close before leaving don't travel.
- **The next session** starts with them and says `◇ 2 carried from your previous session here` above
  the prompt; your first prompt there gets one line saying so. Carried items show `↪ 2d`: their age
  since they first appeared, however many sessions they have crossed. Reply on one includes what
  Claude originally said, since the new conversation doesn't know it, and a bare "yes" can't close
  one.
- **Each handoff is taken once.** The session that takes it leaves a small claim; a session still
  open that was carried from shows `taken by a later session` in its row. `/docket carry off` then
  `on` there makes a fresh handoff.
- Only interactive sessions carry: a scripted `claude -p` run never writes or takes one. Resuming a
  conversation (`--resume`, `--continue`, `/resume`) brings back its own docket, not a carry.

## How it decides

After each turn Docket sends a judge model what Claude wrote that turn (its text and a one-line
summary of each tool call), what you typed since the last check, and the open and recently closed
items. The judge answers with items to add and items to close. When you submit a prompt while items
are open, a smaller check sends your words, the open items and the end of Claude's latest message
(so a reply like "2. done" can be read against its list), and an answer closes its item right away
instead of a turn later. That latest message is context only: a close still has to quote your words.

Code checks the judge's answer before anything changes:

- Each new item must quote Claude's words exactly, and each close must quote the words that justify
  it (yours, or Claude's text or tool lines) exactly. Quotes are matched with whitespace and curly
  quotes straightened.
- A close cannot rest on words written before the item existed, or on the words that closed it
  before you reopened it.
- A bare go-ahead ("make it so", "yes", "ok") or refusal ("no") closes an item only when exactly one
  item was opened in the turn just before and Claude had recommended one option.
- Only prompts you typed (or sent through Remote Control) count as your words, plus your `!` shell
  commands. Prompts from channels, other sessions, plugins and scheduled tasks never do.
- At most 6 adds and 3 closes per check; what the judge returns is shown as plain text, with control
  and invisible characters stripped.

The judge model is a setting (`/config`, Docket → Judge model): `haiku` (the default), `sonnet` or
`opus`. A check is about 2-8k tokens. Docket makes one check after each turn, plus one for each
prompt you send while items are open. It uses your session's own model access.

## What gets sent, and to whom

The judge call goes through your session's own client, to the same provider as the session. Before
sending, Docket replaces token-shaped strings (GitHub tokens, `sk-` keys, AWS key ids, JWTs, `Bearer`
values, PEM private keys) with `[redacted]`. Tool *results* are never sent, only the tool name and
its command or path. Other installed mods that hook `model.complete` can read the judge's prompt, as
they can any plugin's model call.

## Limits

- **One docket per conversation.** `/clear` starts a new conversation with an empty docket; the old
  one is saved, and `/resume` (or `claude --resume` / `--continue`) brings it back. Between leaving a
  conversation and landing on the next, the button draws nothing for a moment.
- **One conversation open in two terminals at once** (the same `--resume` twice) gives two writers on
  the same save files; whichever wrote last is what comes back.
- **Carry limits:**
  - Two fresh sessions started in one folder within the same split second can both take the
    handoff, so both get the items.
  - A session still open in another terminal hands its items to a new session started in that
    folder; the old one then shows "taken by a later session". The items live on in both until each
    is closed, and items the old one adds afterwards stay with it. **If you run several Claude
    windows in one project, keep carry on in only one of them**, or turn it on just before you quit.
  - Resuming a session whose items were carried on still shows them open there.
  - If you type before Claude Code finishes switching conversations, a fork, or a `/resume` onto a
    conversation that never had items, can receive the handoff as a `/clear` would.
  - A `/clear` straight after launch can leave the handoff for the next fresh session instead of
    this one; nothing is lost.
  - A handoff older than 14 days is left alone, and a line says so.
- **The last moments before a crash** can be lost: each change is saved straight after it happens,
  and the turn whose check was still running when the process died is not saved.
- **Main conversation only.** Subagents' text is not read; Claude relays what a subagent needs from
  you in its own words, which Docket does see.
- **Things you do outside the chat** close an item only if Claude's later text or a tool line shows
  them (a `gh pr view` saying merged, say). Otherwise use Done.
- **An answer typed while Claude is still working** on the turn that asked doesn't close that ask,
  because it was written before the item existed. Claude usually reports such an answer back, which
  closes it; otherwise use Done.
- **The judge can miss an ask or misread an answer.** Reopen undoes a wrong close; `/docket add`
  covers a miss.
- **The panel never opens by itself.** A mod cannot see other mods' panels, so opening unasked could
  cover a Bridge decision card.
- **The button is drawn on terminal and desktop only.** Elsewhere, use `/docket`.

## Files

Everything lives under `<config>/state/mods/docket/`, where `<config>` is `CLAUDE_CONFIG_DIR` if set,
else `~/.claude`:

- **`sessions/<session-id>.a.json` and `.b.json`**: the saved docket for each conversation that had
  an item, written in turn so a write cut off halfway costs one save, never the docket. They hold the
  item text, the words of Claude's each item came from, your `/docket add` text and the
  AskUserQuestion questions Docket keeps out of the list, Claude's last message, and the
  conversation's project folder path. Only token-shaped strings (GitHub tokens, `sk-` keys, AWS key
  ids, JWTs, `Bearer` values, PEM keys) are replaced by `[redacted]`; a password or connection string
  in one of those texts is saved as written. They don't hold what you typed, Claude's earlier turn
  text, or tool lines. A closed item's note is dropped.
- **`roots/<folder-key>/carry/<session-id>.a.json` and `.b.json`** (carry on only): the handoff for
  the next session in that folder: the open items, with the same fields and redaction as above, and
  the folder path. `<folder-key>` is a short hash of the folder path.
- **`roots/<folder-key>/claims/<session-id>/<n>/<taker-id>.json`**: which session took a handoff.
  Ids and a timestamp only.
- **`<session-id>.json`**: a heartbeat with counts, timestamps and `lastError` after a failure. Never
  item text or model output.

A file read back is checked field by field; anything malformed is ignored whole. Saved dockets not
touched for 30 days are overwritten with a small `"gone"` stub (a mod can't delete files), so the
folder only grows by stubs, heartbeats and claims. Handoffs and claims are never stubbed (a handoff
past 14 days is ignored anyway). Deleting the whole folder (`rm -r`) is safe: Docket starts
empty. `/docket forget` erases this conversation's saved copy (the panel is unchanged) and stops
saving until a new item arrives. The files get your account's default permissions, like Claude
Code's transcripts, and other installed mods that hook `fs.*` see the writes. Docket keeps these files
rather than using the mod `$.store`, whose behaviour with two Claude windows open isn't documented.

## Development

```
claude plugin test plugins/docket
claude plugin validate plugins/docket
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which the engine writes when the mod
loads (it is gitignored). `types/index.d.ts` holds the mod's state contract.
