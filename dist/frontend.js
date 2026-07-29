const PAIRS = Object.freeze({
    '"': '"',
    '“': '”',
    '*': '*',
    '`': '`',
    '(': ')',
    '[': ']',
    '{': '}',
});
const CLOSERS = new Set(Object.values(PAIRS));
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel']);
const OPT_OUT_SELECTOR = '[data-lumi-autoclose="off"]';
function isNativeTextControl(value) {
    if (value instanceof HTMLTextAreaElement)
        return true;
    return value instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(value.type.toLowerCase());
}
function isContentEditableRoot(value) {
    return value instanceof HTMLElement && value.isContentEditable;
}
function contentEditableRoot(value) {
    if (!(value instanceof Node))
        return null;
    const element = value instanceof HTMLElement ? value : value.parentElement;
    if (!element)
        return null;
    const candidate = element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]');
    if (!candidate?.isContentEditable)
        return null;
    // Use the outermost active editing host so nested formatting nodes do not
    // become separate fields.
    let root = candidate;
    while (root.parentElement?.isContentEditable)
        root = root.parentElement;
    return root;
}
function resolveEditableTarget(event) {
    for (const item of event.composedPath()) {
        if (isNativeTextControl(item))
            return item;
        const editable = contentEditableRoot(item);
        if (editable)
            return editable;
    }
    if (isNativeTextControl(event.target))
        return event.target;
    return contentEditableRoot(event.target);
}
function isVisible(element) {
    if (element.closest('[hidden], [aria-hidden="true"], [inert]'))
        return false;
    const style = window.getComputedStyle(element);
    return element.getClientRects().length > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
}
function canEdit(element) {
    if (!isVisible(element) || element.closest(OPT_OUT_SELECTOR))
        return false;
    if (isNativeTextControl(element)) {
        return !element.disabled && !element.readOnly;
    }
    return isContentEditableRoot(element)
        && element.getAttribute('aria-readonly') !== 'true';
}
function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set)
        descriptor.set.call(element, value);
    else
        element.value = value;
}
function emitInput(element, inputType, data) {
    let event;
    try {
        event = new InputEvent('input', {
            bubbles: true,
            composed: true,
            inputType,
            data,
        });
    }
    catch {
        event = new Event('input', { bubbles: true, composed: true });
    }
    element.dispatchEvent(event);
}
function restoreNativeCaret(element, position, scrollTop, scrollLeft) {
    const apply = () => {
        if (!element.isConnected)
            return;
        try {
            element.setSelectionRange(position, position);
        }
        catch {
            return;
        }
        element.scrollTop = scrollTop;
        element.scrollLeft = scrollLeft;
    };
    apply();
    queueMicrotask(apply);
    requestAnimationFrame(apply);
}
function replaceNativeRange(element, start, end, replacement, caret, inputType, data) {
    const nextValue = element.value.slice(0, start) + replacement + element.value.slice(end);
    const scrollTop = element.scrollTop;
    const scrollLeft = element.scrollLeft;
    setNativeValue(element, nextValue);
    emitInput(element, inputType, data);
    restoreNativeCaret(element, caret, scrollTop, scrollLeft);
}
function getNativeSelection(element) {
    try {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        return start == null || end == null ? null : { start, end };
    }
    catch {
        return null;
    }
}
function textOffsetWithin(root, container, offset) {
    if (!root.contains(container) && container !== root)
        return null;
    const range = document.createRange();
    range.selectNodeContents(root);
    try {
        range.setEnd(container, offset);
    }
    catch {
        return null;
    }
    return range.toString().length;
}
function pointAtTextOffset(root, targetOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, targetOffset);
    let lastText = null;
    while (walker.nextNode()) {
        const text = walker.currentNode;
        lastText = text;
        if (remaining <= text.data.length)
            return { node: text, offset: remaining };
        remaining -= text.data.length;
    }
    if (lastText)
        return { node: lastText, offset: lastText.data.length };
    return { node: root, offset: root.childNodes.length };
}
function getContentEditableSelection(root) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1)
        return null;
    const range = selection.getRangeAt(0);
    const start = textOffsetWithin(root, range.startContainer, range.startOffset);
    const end = textOffsetWithin(root, range.endContainer, range.endOffset);
    if (start == null || end == null)
        return null;
    return start <= end ? { start, end } : { start: end, end: start };
}
function restoreContentEditableCaret(root, position) {
    const apply = () => {
        if (!root.isConnected)
            return;
        const selection = window.getSelection();
        if (!selection)
            return;
        const point = pointAtTextOffset(root, position);
        const range = document.createRange();
        range.setStart(point.node, point.offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    };
    apply();
    queueMicrotask(apply);
    requestAnimationFrame(apply);
}
function replaceContentEditableRange(root, start, end, replacement, caret, inputType, data) {
    const startPoint = pointAtTextOffset(root, start);
    const endPoint = pointAtTextOffset(root, end);
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    range.deleteContents();
    if (replacement) {
        range.insertNode(document.createTextNode(replacement));
    }
    emitInput(root, inputType, data);
    restoreContentEditableCaret(root, caret);
}
function handleNativeBeforeInput(event, element) {
    const selection = getNativeSelection(element);
    if (!selection)
        return;
    const { start, end } = selection;
    if (event.inputType === 'deleteContentBackward' && start === end && start > 0) {
        const opener = element.value[start - 1];
        const closer = element.value[start];
        if (PAIRS[opener] === closer) {
            event.preventDefault();
            replaceNativeRange(element, start - 1, start + 1, '', start - 1, 'deleteContentBackward', null);
        }
        return;
    }
    if (event.inputType !== 'insertText' || !event.data || event.data.length !== 1)
        return;
    const typed = event.data;
    if (start === end && CLOSERS.has(typed) && element.value[start] === typed) {
        event.preventDefault();
        restoreNativeCaret(element, start + 1, element.scrollTop, element.scrollLeft);
        return;
    }
    const closer = PAIRS[typed];
    if (!closer)
        return;
    event.preventDefault();
    if (start !== end) {
        const selected = element.value.slice(start, end);
        const replacement = typed + selected + closer;
        replaceNativeRange(element, start, end, replacement, start + replacement.length, 'insertText', replacement);
        return;
    }
    replaceNativeRange(element, start, end, typed + closer, start + 1, 'insertText', typed + closer);
}
function handleContentEditableBeforeInput(event, root) {
    const selection = getContentEditableSelection(root);
    if (!selection)
        return;
    const { start, end } = selection;
    const text = root.textContent ?? '';
    if (event.inputType === 'deleteContentBackward' && start === end && start > 0) {
        const opener = text[start - 1];
        const closer = text[start];
        if (PAIRS[opener] === closer) {
            event.preventDefault();
            replaceContentEditableRange(root, start - 1, start + 1, '', start - 1, 'deleteContentBackward', null);
        }
        return;
    }
    if (event.inputType !== 'insertText' || !event.data || event.data.length !== 1)
        return;
    const typed = event.data;
    if (start === end && CLOSERS.has(typed) && text[start] === typed) {
        event.preventDefault();
        restoreContentEditableCaret(root, start + 1);
        return;
    }
    const closer = PAIRS[typed];
    if (!closer)
        return;
    event.preventDefault();
    if (start !== end) {
        const selected = text.slice(start, end);
        const replacement = typed + selected + closer;
        replaceContentEditableRange(root, start, end, replacement, start + replacement.length, 'insertText', replacement);
        return;
    }
    replaceContentEditableRange(root, start, end, typed + closer, start + 1, 'insertText', typed + closer);
}
export function setup(ctx) {
    let enabled = true;
    const beforeInput = (rawEvent) => {
        if (!enabled || !(rawEvent instanceof InputEvent) || rawEvent.isComposing)
            return;
        const target = resolveEditableTarget(rawEvent);
        if (!target || !canEdit(target))
            return;
        if (isNativeTextControl(target))
            handleNativeBeforeInput(rawEvent, target);
        else
            handleContentEditableBeforeInput(rawEvent, target);
    };
    document.addEventListener('beforeinput', beforeInput, true);
    let action = null;
    let unsubscribeAction = null;
    try {
        action = ctx.ui.registerInputBarAction({
            id: 'toggle-auto-close',
            label: 'Auto-close markers: On',
            iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17h4V9H5v5h2v3Zm10 0h4V9h-6v5h2v3Z"/></svg>',
            enabled: true,
        });
        unsubscribeAction = action.onClick(() => {
            enabled = !enabled;
            action?.setLabel(`Auto-close markers: ${enabled ? 'On' : 'Off'}`);
        });
    }
    catch {
        // Auto-close still works if this Lumiverse build predates Input Bar Actions.
    }
    return () => {
        document.removeEventListener('beforeinput', beforeInput, true);
        unsubscribeAction?.();
        action?.destroy();
    };
}
