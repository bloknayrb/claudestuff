// Messages shaped like the ones that presented the two mislabelled items on 2026-11-05: a short
// "Recorded" line, the item restated in bold, context, and options as a numbered list with bold labels.
// Synthetic, topics included (the real ones stay out of this public repo); the shape is what matters.
// Docket recorded the user's "option 2" (typed for the item before) as their answer to the first, and
// their "1" (typed for the first) as their answer to the second, each because a full check judged an
// earlier reply against the next message's options.

export const ITEM_41 = 'Choose whether the app keeps following the system theme or switches to dark mode'
export const ITEM_42 = 'Decide how the settings cache is refreshed after an update'

export const MSG_41 = `Recorded: the next PR adds the banner.

---

**#41: "${ITEM_41}"**

The app follows the system theme today, so it turns light at sunrise even when the room is dark. A fixed theme would stop that.

1. **Keep the default (recommended).** It follows the system theme, as now.
2. **Switch to dark mode.** Dark always, whatever the system says.`

export const MSG_42 = `Recorded #41 as keep the default.

---

**#42: "${ITEM_42}"**

After an update the old settings cache is still read, so a changed default shows only after a restart.

1. **Keep the cache and add a version stamp (recommended).** A stale cache is detected and rebuilt.
2. **Clear the cache on every update instead.** Simpler, slower first start.
3. **Leave it.** A changed default still waits for a restart.`
