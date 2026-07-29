# Lumi Auto-Close

A tiny frontend-only Lumiverse/Spindle extension that auto-closes common dialogue, Markdown, and bracket markers in the chat composer.

## Included pairs

- `""` straight dialogue quotes
- `“”` curly dialogue quotes
- `**` action / emphasis markers
- `` `` `` inline-code markers
- `()` parentheses
- `[]` square brackets
- `{}` braces

Typing an opening marker inserts both characters and leaves the caret between them. Typing the closer when it is already under the caret moves across it instead of duplicating it. Pressing Backspace between an empty pair removes both characters. Selecting text and typing an opening marker wraps the selection.

The **Extras** popover in the input bar gets an `Auto-close markers: On/Off` session toggle.

## Install

Push this folder to a GitHub repository, then install that repository URL from Lumiverse's Spindle extension panel.

The prebuilt `dist/frontend.js` is committed, so the repository is installable as-is. To rebuild after editing:

```bash
bun install
bun run build
```

## Customize pairs

Edit the `PAIRS` object at the top of `src/frontend.ts`, then rebuild. Avoid adding straight apostrophes (`'`) unless you enjoy contractions fighting back.

## Notes

This uses a delegated `beforeinput` listener because the current public Spindle frontend API provides input-bar actions but not a first-class chat-composer text mutation hook. Composer detection is intentionally narrow and includes Lumiverse's `.inputbar-container` plus several stable-looking accessibility/data selectors and a localized-layout fallback.
