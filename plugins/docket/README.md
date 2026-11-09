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
  Decide and Do. Each item has these buttons:
  - **Reply here** puts `Re: <item> — ` in your prompt box (after anything you have typed) so your
    answer names the item. Focus stays in the panel: click the prompt or press Esc to type.
  - **Reply new** answers the item in a new Claude Code window instead (below). Shown on Windows
    when Windows Terminal and PowerShell 7 are installed.
  - **/btw** puts `/btw can you remind me what this item is and give me more context for making a
    decision? "<item>"` (with Claude's words about it) in your prompt box. Focus stays in the panel,
    so press Esc (or click the prompt), then Enter to ask. Claude
    answers on the side, even mid-turn, and the answer neither enters the conversation nor closes the
    item. It needs an empty box, or that item's own Reply lead with nothing typed after it.
  - **Done** closes it as handled by you, for things you did outside the chat.
  - **✕** dismisses it, after a second press to confirm. The digit keys `1`-`9` do the same, in the
    order shown, while the panel has the keys (`ctrl+x tab`).
- Tab onto an item to see the words of Claude's it came from.
- **`N closed · show`** at the bottom lists recent closes, each with its #number and the reason (you, Claude, dismissed) and
  a Reopen button each. Reopen is the undo for a wrong close.
- Since v0.8.0 Claude can reopen a wrong close too (see below). A reopened row shows `↺` by its age,
  `↺ reopened by Claude: <reason>`, how it had been closed, and a **Keep closed** button that puts that
  close back exactly. The band says `N reopened by Claude` until you open the panel or type a prompt.
- After any change to the list the digit keys pause for 1.1 s, and each press during the pause
  restarts it, so a list that just reordered cannot turn a press into the wrong dismiss.
- Since v0.7.2 a dismiss takes two presses. The first arms the row: its ✕ reads `✕ wait…`, then
  `✕ again?` once a second press of the same key would count (1.1 s to 5 s later) and dismiss it. A quicker repeat or a held
  key only restarts the arm, another row's key moves it, and after 5 s it lapses.

## Reply new: answer an item in a new window

**Reply new** puts `/docket new #4 (<item>) — ` in your prompt box (or swaps it for the same item's
`Re: … — ` lead, keeping what you typed). Type your reply after the dash and press Enter:

- The item closes here as yours (`you: sent to a new window`); Reopen under `closed · show` brings it
  back.
- A new Windows Terminal window opens in the same folder and starts `claude`. Its prompt box already
  holds your reply: read it and press Enter there. With that first prompt, Docket attaches the item
  and what Claude had said about it, as context for Claude; it doesn't count as your words.
- Your reply never goes on a command line: it waits in a small file that the new window reads once
  and empties. The window doesn't take this folder's carry.
- If no window appears, a toast says so; your reply is still in this window's history (up arrow).
- Reply new needs an empty box, or that item's own Reply here lead: anything else you typed stays
  where it is. A reply starting with `!` or `/` is refused, since in the new box it would run as a
  command.

## Walking through the docket with Claude

Decisions and to-dos are walked separately. Under the **Decide** section, **Walk through the N
decisions with Claude** (or `/docket walk decisions`) asks Claude to take you through the open
decisions one at a time. Under **Do**, **Walk through the N to-dos with Claude** (or
`/docket walk todos`) does the same for the to-dos. Each walk covers every open item of its kind,
carried ones included, so with carried sessions the button sits under the first section of its kind
only. Claude restates each item, says what it recommends, waits for your answer, and stops when
none of that kind remain. A bare `/docket walk` still takes you through everything. Claude reads
the list through a tool, `mcp__docket__list`, which it can also call whenever you ask about your
docket.

- Answer as you would anyway. A bare "yes" or "do it" closes the item Claude just presented, as long
  as it presented only that one and restated it. "skip", "later", "next", "pass" or "not now" leaves
  the item open.
- The panel marks the item being discussed with `▸` and says `walking with Claude`. A walk ends by
  itself once a turn of Claude's ends without presenting an item; then the other kind's walk can
  start. One walk runs at a time.
- Your replies close items, through the same checks as always. Claude can't close an item *as
  yours*; see the next section for what it can do.
- If Claude Code asks permission for the tool on each item, allow it once for good with
  `"mcp__docket__list"` under `permissions.allow` in your settings.

## Claude's corrections

Claude has four tools for fixing the docket. Whatever they do is shown as Claude's, never as yours;
you can Reopen anything Claude closed, and Keep closed undoes anything Claude reopened.

- **`annotate`** puts a note on an item, open or closed: `Claude's note: …`.
- **`amend`** corrects what Docket recorded for an item your reply closed. Claude has to quote your
  own reply, the whole of it or at least 8 characters, and Docket checks the quote against the
  prompts you typed this session. The row then shows your full words, Claude's correction, and the
  reading it replaced. If the reply Claude quotes isn't the one that closed the item, the row says
  `(linked by Claude)`, and the reply has to be tied to the item: you answered it in a walk, you
  pressed Reply on it, or the message you answered was about it.
- **`close`** closes an open item as `closed by Claude: <reason>`, with a kind:
  - `duplicate-of:#N`;
  - `settled-earlier`, citing an item your reply closed;
  - `user-asked`, citing your reply. It has to name the item, or be a reply that Docket's
    3-per-reply limit left the item open from, and a bare "yes" or "1" can't be cited;
  - `done-by-claude`;
  - `stale`.
- **`reopen`** (v0.8.0) reopens a closed item, shown as `reopened by Claude: <reason>` with how it had
  been closed. Without your words, only once per item, and only for:
  - a close by a bare reply ("yes", "1", a plain option pick) that wasn't aimed at the item: not typed
    through its Reply button, not the item Claude was walking you through, not naming it. That is the
    case of a "1" meant for the item before it;
  - Claude's own close as a duplicate, done or stale, or the judge reading Claude's text as done.

  Anything else (an answer you typed out, Done, ✕, clear, a close Claude made at your request, an
  amended item, a second reopen) needs Claude to cite your reply, typed after the close, that names
  the item by its text or was sent through its Reply button; a bare `#4` doesn't count. The row then
  shows that whole reply.

Claude can't add items. The judge reads asks out of Claude's own words, and `/docket add` is yours.

How a closed item reads:

| Shown | Meaning |
|---|---|
| `you chose option 1, "Keep the default (recommended)"` | You replied with an option's number or letter, and Docket read the option's own label from the message you were answering. |
| `you said: "…"` | Your words as you typed them. Beside it, `Docket's reading: …` is what the judge model took them to mean. That reading is not yours. |
| `you marked it done` / `you sent it to a new window` | You pressed Done or Reply new. |
| `per Claude's report: …` | Claude's own text or tool calls showed it done. |
| `closed by Claude: …` | Claude closed it with its tool. |

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
summary of each tool call) and the open and recently closed items. The judge answers with items to
add, and with items that Claude's own work closed.

Your replies are judged separately, one at a time. Each one goes with the message from Claude that
was on screen when you typed it, so a "2" is read against that message's list and never against a
later one. A reply waits until the check of the turn it answered has finished, so that any item it
answers already exists.

(Before v0.7 the after-turn check also carried your recent words. On 2026-11-05 that check read an
"option 2", typed for one item, against the next item's options, and recorded the opposite of what
was chosen.)

When a reply is just an option ("1", "option 2", "b, with X"), code reads the option's label from
that message rather than taking the judge's paraphrase. It does so only when the message is about
the item and the number is unambiguous; otherwise it records your words as typed. A bare option can
close only the item it is tied to: one Claude presented in a walk, one you pressed Reply on, or the
only open item the message was about.

Code checks the judge's answer before anything changes:

- Each new item must quote Claude's words exactly, and each close must quote the words that justify
  it (yours, or Claude's text or tool lines) exactly. Quotes are matched with whitespace and curly
  quotes straightened.
- A close cannot rest on words written before the item existed, or on the words that closed it
  before you reopened it.
- A bare go-ahead ("make it so", "yes", "ok") or refusal ("no") closes an item only when exactly one
  item was opened in the turn just before and Claude had recommended one option, or, in a walk, when
  Claude presented that one item alone and restated it in the turn you answered. In a walk, Claude
  picks which item a bare answer lands on: if it asks about something else in the same message, a
  "yes" can still count for the presented item.
- Only prompts you typed (or sent through Remote Control) count as your words, plus your `!` shell
  commands. Prompts from channels, other sessions, plugins and scheduled tasks never do.
- At most 6 adds and 3 closes per check, and what the judge returns is shown as plain text, with
  control and invisible characters stripped. When one reply would close more than 3 (say, "close the
  settled ones"), the rest stay open, and both the panel and Claude's next `list` say which. Claude
  can then close them with `close` (kind `user-asked`, citing your reply), or ask you.

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
- **The judge can miss an ask or misread an answer.** Reopen undoes a wrong close (and Claude can
  reopen a bare-reply close it spots); `/docket add` covers a miss.
- **Claude's reopen checks who a cited reply is from, when, and that it names the item, not what it
  asks.** "Don't reopen X" names X. The row shows the whole reply, and Keep closed undoes it.
- **A carry starts each item fresh**: a reopen's record and Keep closed stay in the session they
  happened in.
- **The panel never opens by itself.** A mod cannot see other mods' panels, so opening unasked could
  cover a Bridge decision card.
- **The button is drawn on terminal and desktop only.** Elsewhere, use `/docket`.
- **Reply new is Windows-only** (Windows Terminal and PowerShell 7), and the new window is a Windows
  Terminal window whatever terminal you use. The item closes when you press Enter, before the window
  has opened. A window that hasn't picked up its reply within 15 minutes ignores it. The `/docket new`
  line stays in this conversation, and Claude here can read it. The new tab runs PowerShell without
  your profile, so `claude` must be on your normal PATH (not added only in `$PROFILE`); if it isn't,
  the tab shows the error, and Reopen brings the item back.
- **A walk answer typed while Claude is still writing** doesn't get the walk's bare-answer allowance;
  answer once the turn ends.

## Files

Everything lives under `<config>/state/mods/docket/`, where `<config>` is `CLAUDE_CONFIG_DIR` if set,
else `~/.claude`:

- **`sessions/<session-id>.a.json` and `.b.json`**: the saved docket for each conversation that had
  an item, written in turn so a write cut off halfway costs one save, never the docket. They hold the
  item text, the words of Claude's each item came from, your `/docket add` text and the
  AskUserQuestion questions Docket keeps out of the list, Claude's last message, and the
  conversation's project folder path. Since v0.7 they also hold how each kept closed item closed:
  the reply of yours that closed it (up to 200 characters, and the one an amend replaced), Docket's
  reading of it, and Claude's notes, closes and corrections, including a reply of yours a `user-asked`
  close cites (up to 200 characters). Only token-shaped strings (GitHub tokens, `sk-` keys, AWS key
  ids, JWTs, `Bearer` values, PEM keys) are replaced by `[redacted]`; a password or connection string
  in one of those texts is saved as written. They don't hold your other prompts, Claude's earlier
  turn text, or tool lines.
- **`roots/<folder-key>/carry/<session-id>.a.json` and `.b.json`** (carry on only): the handoff for
  the next session in that folder: the open items, with the same fields and redaction as above, and
  the folder path. `<folder-key>` is a short hash of the folder path.
- **`roots/<folder-key>/claims/<session-id>/<n>/<taker-id>.json`**: which session took a handoff.
  Ids and a timestamp only.
- **`<session-id>.json`**: a heartbeat with counts, timestamps and `lastError` after a failure. Never
  item text or model output.
- **`handoff/<nonce>.json`** (Reply new): your reply, the item, Claude's words about it and the
  folder, until the new window takes it. Then only ids remain. One that no window took is blanked
  after 15 minutes (when a later session starts), and `/docket forget` blanks this conversation's.

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
