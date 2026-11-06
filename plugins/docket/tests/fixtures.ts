// Messages shaped like the ones that presented the two mislabelled items on 2026-11-05: a short
// "Recorded" line, the item restated in bold, context, and options as a numbered list with bold labels.
// Synthetic (the real ones stay out of this public repo); the shape and the labels are what matter.
// Docket recorded the user's "option 2" (typed for the item before) as their answer to the first, and
// their "1" (typed for the first) as their answer to the second, each because a full check judged an
// earlier reply against the next message's options.

export const ITEM_41 = 'Choose whether an answer on a resolved comment stays silent or reopens the comment'
export const ITEM_42 = 'Decide how an accepted rewrite is shown, so it is not credited to the wrong author'

export const MSG_41 = `Recorded: the next PR adds the badge.

---

**#41: "${ITEM_41}"**

When an answer lands on a comment you have just resolved, the app has to do something with it. Today it notifies, but the card is hidden, so the notice leads nowhere.

1. **Stay silent (recommended).** No notification for an answer on a resolved comment; it is still in the thread.
2. **Reopen the comment.** The answer reopens it and notifies as normal.`

export const MSG_42 = `Recorded #41 as stay silent.

---

**#42: "${ITEM_42}"**

An accepted rewrite is stored on the original comment, so it is shown under the wrong author.

1. **Keep the storage and add attribution (recommended).** Record where the rewrite came from and show it.
2. **Store the acceptance on the reply instead.** Cleaner data, more rework.
3. **Leave it.** The rewrite keeps showing under the wrong author.`
