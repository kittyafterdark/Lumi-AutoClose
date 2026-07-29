# Lumi Auto-Close

A tiny frontend-only Lumiverse/Spindle extension that auto-closes common dialogue, Markdown, and bracket markers across Lumiverse text fields.

## Where it works

Version 1.1 expands auto-close beyond the chat composer. It now applies to visible, editable:

- Chat composers
- Character editor fields and modals
- Lorebook metadata and entry content
- Prompt and preset editors
- Expanded text editors
- Standard single-line text fields
- Compatible `contenteditable` editing surfaces

Password fields, disabled/read-only fields, hidden backing inputs, and elements marked with `data-lumi-autoclose="off"` are ignored.

## Included pairs

- `""` straight dialogue quotes
- `“”` curly dialogue quotes
- `**` action / emphasis markers
- `` `` `` inline-code markers
- `()` parentheses
- `[]` square brackets
- `{}` braces

Typing an opening marker inserts both characters and leaves the caret between them. Typing the closer when it is already under the caret moves across it instead of duplicating it. Pressing Backspace between an empty pair removes both characters. Selecting text and typing an opening marker wraps the selection.

The **Extras** popover in the chat input bar gets an `Auto-close markers: On/Off` session toggle. The toggle controls the extension globally, including editors and modals.

## Install

Copy the repository's url to the Lumiverse Extensions tab and select staging

## Customize pairs

Edit the `PAIRS` object at the top of `src/frontend.ts`, then rebuild. Avoid adding straight apostrophes (`'`) unless you enjoy contractions fighting back.

## Compatibility notes

The extension uses one delegated `beforeinput` listener, so fields mounted later by React portals or lazy-loaded editor screens are handled automatically. Native value setters and bubbling input events keep controlled React fields synchronized.

`contenteditable` support is intentionally conservative and plain-text oriented. Native Lumiverse textareas and text inputs are the primary supported path.
