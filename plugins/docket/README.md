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
  `/docket clear` dismisses everything (one "Reopen all" brings it back).
- **The panel** lists open items under **Decide** and **Do**, each with its age in turns (`now`,
  `2t`). Each item has three buttons:
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

- **Session only.** `/clear` and `/resume` empty the list. If items were open, your next prompt shows
  a line naming what was dropped.
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

A heartbeat at `~/.claude/state/mods/docket/<session-id>.json`: counts and timestamps, and
`lastError` after a hook failure. It never holds item text or model output.

## Development

```
claude plugin test plugins/docket
claude plugin validate plugins/docket
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which the engine writes when the mod
loads (it is gitignored). `types/index.d.ts` holds the mod's state contract.
