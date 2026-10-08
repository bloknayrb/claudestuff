# quartermaster

A Claude Code mod that keeps subagent spending deliberate.

- **Model guard.** A spawn of a model-less agent type (`general-purpose`, `claude` by default) that sets no
  `model` is denied once with a reminder to choose one from the task. Re-issue the identical call to run it
  on the inherited model anyway.
- **Heavy-model guard.** A spawn that will run on a heavy model (`opus`, `fable` by default) while the
  five-hour window is at or past `warnAt` (75%) is denied once with the reading and the projected cap time.
  Re-issue unchanged to spend it anyway, or name a model: choosing a heavy one after seeing the reading
  passes.
- **Pace line.** One status line: when the five-hour window will cap at the current pace, and how many
  subagents this session has run. `QM pace: cap ~15:40 (resets 17:00) · agents 4 (2 opus)`. Hidden off a
  subscription.
- **Threshold toasts** at 50, 75 and 90% of the five-hour window, once each per window.
- **`/quartermaster`** reports each guard's fires, re-issues and changes, the pace and the config.

Spawns made by other plugins or by workflow scripts can't re-issue, so for them the guards never deny: they
toast, once per plugin and agent type (model guard) or per plugin and window (heavy guard).

## Requirements

Quartermaster is a function-hooks plugin, built against Claude Code 2.1.292. That hooks API is early access
and moves between releases, so a newer build may need changes here. The pace line and toasts need a
subscription that reports rate limits.

## Install

```
/plugin marketplace add bloknayrb/claudestuff
/plugin install quartermaster@claudestuff-marketplace
```

## Config

| Field | Type | Default | Meaning |
|---|---|---|---|
| `warnAt` | number | 75 | Five-hour usage (%) at which the heavy-model guard starts |
| `heavyModels` | list | `opus`, `fable` | Model names or id fragments, matched case-insensitively |
| `guardTypes` | list | `general-purpose`, `claude` | Agent types with no model of their own |
| `requireModel` | boolean | true | Turns the model guard on or off |

The heavy-model guard knows a spawn's model only when the call names one, when it is a fork, or when its
type is in `guardTypes` (it then inherits the parent's). It assumes no default subagent model is configured;
with one, those spawns run on the default instead. Other agent types that set no model go unjudged.

## How a soft deny works

A denied call's identity is a hash of `prompt`, `description`, `subagentType` and `model`, never the tool
call id. The identical call issued again within ten minutes, from the same agent, runs. The same task
(`prompt` and `description`) with another model or agent type counts as acting on the deny. Counters
(`fires`, `reissued`, `changed`) and the last 200 outcomes are kept so a guard that is mostly re-issued can be
narrowed or removed.

## What it writes

- The plugin's own store (pace readings for the current and previous window, toasts sent, counters, the fire
  ring).
- A heartbeat at `~/.claude/state/mods/quartermaster/<sessionId>.json`:
  `{ "loadedAt", "lastError" }`.
  One file is written per session id and never pruned; they are small and safe to delete.

It makes no model calls. A guard that fails lets the spawn through and logs to the debug log.

## Limits

- A Workflow's agents get a toast, not a deny, by design: nothing can re-issue a spawn a Workflow script
  starts, so a deny would only kill the step. That path was not observed live; the tests cover it.

## Developing

`claude plugin test plugins/quartermaster` runs the tests. `tsconfig.json` extends
`.claude-plugin/types/tsconfig.json`, which Claude Code writes when it first loads the mod from a folder you
own (`--plugin-dir`, or a mods folder). Load it once before running `tsc -p`. Every function that takes `$`
lives in `hooks/register.ts`, because the validator refuses `$` passed across an import.
