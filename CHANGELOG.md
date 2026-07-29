# Changelog

## 1.1.0

- Expanded auto-close from the chat composer to all visible editable textareas and supported text inputs.
- Added support for character editors, lorebook fields, prompt/preset editors, expanded text editors, and React-mounted modal fields.
- Added conservative support for compatible `contenteditable` surfaces.
- Preserved controlled React field synchronization through native value setters and bubbling input events.
- Added explicit exclusions for password, disabled, read-only, hidden, inert, and opted-out fields.
- Added `data-lumi-autoclose="off"` as a per-element or ancestor opt-out.
- Kept the existing global session toggle in the chat input-bar Extras menu.
