import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

const PAIRS: Readonly<Record<string, string>> = Object.freeze({
  '"': '"',
  '“': '”',
  '*': '*',
  '`': '`',
  '(': ')',
  '[': ']',
  '{': '}',
})

const CLOSERS = new Set(Object.values(PAIRS))

const COMPOSER_ROOT_SELECTOR = [
  '[data-component="InputBar"]',
  '[data-component="MessageInput"]',
  '[data-component="ChatInput"]',
  '[data-testid="message-input"]',
  '[data-testid="chat-input"]',
  '.inputbar-container',
  '[class*="InputBar"]',
  '[class*="inputbar"]',
  '[class*="MessageInput"]',
].join(',')

function isTextArea(value: EventTarget | null): value is HTMLTextAreaElement {
  return value instanceof HTMLTextAreaElement
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
}

function looksLikeChatComposer(element: HTMLTextAreaElement): boolean {
  if (element.disabled || element.readOnly || !isVisible(element)) return false
  if (element.closest(COMPOSER_ROOT_SELECTOR)) return true

  const hint = [
    element.placeholder,
    element.getAttribute('aria-label'),
    element.getAttribute('name'),
    element.id,
  ].filter(Boolean).join(' ')

  if (/message|chat|reply|send/i.test(hint)) return true

  // Last-resort fallback for localized builds: a visible textarea near the bottom
  // with a nearby submit/send button is almost certainly the chat composer.
  const rect = element.getBoundingClientRect()
  const nearBottom = rect.top >= window.innerHeight * 0.5
  const searchRoot = element.closest('form') ?? element.parentElement?.parentElement
  const hasNearbySend = Boolean(searchRoot?.querySelector(
    'button[type="submit"], button[aria-label*="send" i], button[title*="send" i]'
  ))

  return nearBottom && hasNearbySend
}

function setNativeValue(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
  if (descriptor?.set) descriptor.set.call(element, value)
  else element.value = value
}

function emitInput(element: HTMLTextAreaElement, inputType: string, data: string | null): void {
  let event: Event
  try {
    event = new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType,
      data,
    })
  } catch {
    event = new Event('input', { bubbles: true, composed: true })
  }
  element.dispatchEvent(event)
}

function restoreCaret(element: HTMLTextAreaElement, position: number, scrollTop: number): void {
  const apply = () => {
    if (!element.isConnected) return
    element.setSelectionRange(position, position)
    element.scrollTop = scrollTop
  }

  apply()
  queueMicrotask(apply)
  requestAnimationFrame(apply)
}

function replaceRange(
  element: HTMLTextAreaElement,
  start: number,
  end: number,
  replacement: string,
  caret: number,
  inputType: string,
  data: string | null,
): void {
  const nextValue = element.value.slice(0, start) + replacement + element.value.slice(end)
  const scrollTop = element.scrollTop
  setNativeValue(element, nextValue)
  emitInput(element, inputType, data)
  restoreCaret(element, caret, scrollTop)
}

export function setup(ctx: SpindleFrontendContext) {
  let enabled = true

  const beforeInput = (event: Event) => {
    if (!enabled || !(event instanceof InputEvent) || event.isComposing) return
    if (!isTextArea(event.target) || !looksLikeChatComposer(event.target)) return

    const element = event.target
    const start = element.selectionStart
    const end = element.selectionEnd
    if (start == null || end == null) return

    if (event.inputType === 'deleteContentBackward' && start === end && start > 0) {
      const opener = element.value[start - 1]
      const closer = element.value[start]
      if (PAIRS[opener] === closer) {
        event.preventDefault()
        replaceRange(element, start - 1, start + 1, '', start - 1, 'deleteContentBackward', null)
      }
      return
    }

    if (event.inputType !== 'insertText' || !event.data || event.data.length !== 1) return

    const typed = event.data

    // If the expected closer already exists at the caret, move across it.
    if (start === end && CLOSERS.has(typed) && element.value[start] === typed) {
      event.preventDefault()
      restoreCaret(element, start + 1, element.scrollTop)
      return
    }

    const closer = PAIRS[typed]
    if (!closer) return

    event.preventDefault()

    if (start !== end) {
      const selected = element.value.slice(start, end)
      const replacement = typed + selected + closer
      replaceRange(
        element,
        start,
        end,
        replacement,
        start + replacement.length,
        'insertText',
        replacement,
      )
      return
    }

    replaceRange(element, start, end, typed + closer, start + typed.length, 'insertText', typed + closer)
  }

  document.addEventListener('beforeinput', beforeInput, true)

  let action: ReturnType<SpindleFrontendContext['ui']['registerInputBarAction']> | null = null
  let unsubscribeAction: (() => void) | null = null

  try {
    action = ctx.ui.registerInputBarAction({
      id: 'toggle-auto-close',
      label: 'Auto-close markers: On',
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17h4V9H5v5h2v3Zm10 0h4V9h-6v5h2v3Z"/></svg>',
      enabled: true,
    })

    unsubscribeAction = action.onClick(() => {
      enabled = !enabled
      action?.setLabel(`Auto-close markers: ${enabled ? 'On' : 'Off'}`)
    })
  } catch {
    // The typing helper still works if this Lumiverse build predates Input Bar Actions.
  }

  return () => {
    document.removeEventListener('beforeinput', beforeInput, true)
    unsubscribeAction?.()
    action?.destroy()
  }
}
