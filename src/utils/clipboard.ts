export function extractCodeText(codeElement: HTMLElement): string {
  const lineElements = codeElement.querySelectorAll('[data-line]')
  if (lineElements.length === 0) return codeElement.textContent ?? ''
  return Array.from(lineElements)
    .map((el) => el.textContent ?? '')
    .join('\n')
}

export async function writeToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '0'
      textarea.style.left = '0'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}

