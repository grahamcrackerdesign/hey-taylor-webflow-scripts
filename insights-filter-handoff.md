# Insights CMS filter — handoff

Client-side category filtering for the Hey Taylor Insights page (Webflow). Ships as a single
vanilla-JS file pasted into **Page Settings → Custom Code → Before `</body>`**, wrapped in
`<script>` tags. No dependencies, no build step.

Current implementation: `insights-filter.js`

---

## Requirements as agreed

| Decision | Value | Why |
| --- | --- | --- |
| Selection model | Multi-select | Changed from single-select mid-build |
| Match logic | **OR** — a post shows if it matches any selected chip | Each post carries one category, so AND would empty the grid on any 2+ selection |
| Pagination | None — all items render at once | Client-side filtering is safe; revisit if the list ever paginates |
| URL state | Yes — `?category=geo-method,white-label` | Shareable, back/forward-button friendly |
| "All" chip | Static, hardcoded | Not a CMS item — see note below |
| "Clear" chip | Kept | Functionally identical to All; retained by preference |

### Why "All" is not a CMS item

The categories collection drives the chip list, but adding an "All" entry to that collection
would make it assignable to posts, surface it in category dropdowns and reference fields, and
generate a junk `/category/all` template page. It's hardcoded instead.

Structural constraint: `.cms_filter-chips-wrap` **is** the `w-dyn-items` container, so a static
element can't live inside it in the Designer. The All chip sits as a direct child of
`.cms_filter-wrapper`, immediately before the collection list wrapper. The wrapper's flex gap
must match the chips wrap's gap so it reads as one continuous row.

---

## Webflow-side setup

**Custom attributes**

| Element | Attribute | Value |
| --- | --- | --- |
| Static "All" chip | `data-filter-all` | any (presence is what's checked) |
| "Clear" chip | `data-filter-clear` | any |
| CMS chip link | `data-category` | bound to category slug |
| Post card link | `data-category` | bound to category slug |
| Filter row wrapper | `data-filter-bar` | optional |
| Posts `w-dyn-items` | `data-filter-list` | optional |
| Empty-state element | `data-filter-empty` | optional |

The two optional wrapper attributes have class-based fallbacks (`.cms_filter-wrapper` and
`.u-mb-lg .w-dyn-items`) that already match the current markup. `data-category` also falls back
to slugifying the visible `.eyebrow` text, but the attribute is preferred — text matching breaks
silently the moment someone edits a category name's punctuation.

**Classes**

- `cc-selected` — combo class on a selected chip. The script only toggles it; styling is yours.
- `cc-disabled` — existing combo class on Clear. Applied when nothing is selected.
- `is-filtered-out` — injected by the script with `display:none !important`. Not built in Webflow.

**Empty state** — if no `[data-filter-empty]` element exists, the script injects a plain one after
the list. Build a real one if it should be designed.

---

## Behavior notes

- Clicking a category chip toggles it in or out of the selection.
- Clicking All clears the selection. All shows as selected when nothing else is.
- Clear is a no-op when the selection is already empty — no duplicate history entry pushed.
- Chip `href`s are rewritten to `?category=<slug>` (All → bare pathname) so middle-click and
  open-in-new-tab land on a sensible single-category view.
- URL slugs are validated against the chips that actually exist. An unrecognized value is dropped
  rather than filtered on, so a stale link shows the full grid instead of an empty one.
- Keyboard: chips are focusable, Enter/Space activate, `aria-pressed` reflects state, empty state
  is `role="status"` + `aria-live="polite"`.
- Items carry `categoriesOf()` as an **array**, parsed from space- or comma-separated values. If
  categories ever become a multi-reference field, the matching logic already handles it.

---

## Not done / open

- **Not tested in the browser.** Syntax-checked only. Needs a pass on the live Webflow page.
- **Featured post** above the filter bar is intentionally outside the filtered list — confirm that's
  still wanted once real posts exist.
- **All vs. Clear redundancy** — both resolve to the same state. Removing either requires no script
  change if it reads as duplicative in testing.
- **Transitions** — items hard-toggle `display:none`. No fade or reflow animation. Add via CSS
  on `.is-filtered-out` if wanted, though `display` isn't animatable without restructuring.
- **Result count** — not displayed. Straightforward to add; `shown` is already computed in `render()`.
- **No-JS fallback** — chips are real links but nothing server-side reads the query param, so
  filtering requires JS. Acceptable for a Webflow site; note it if that assumption changes.
