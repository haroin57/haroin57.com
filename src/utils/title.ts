export const SITE_TITLE = 'haroin57 web'

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function looksLikeSlugOrUrlPrefix(prefix: string) {
  if (!prefix) return false
  if (/\s/.test(prefix)) return false
  if (prefix.length > 80) return false
  if (/^https?:\/\//i.test(prefix)) return true
  if (!/^[a-z0-9][a-z0-9._/:~-]*[a-z0-9]$/i.test(prefix)) return false
  return /[._/:~-]/.test(prefix)
}

export function stripLeadingSlugOrUrl(value: string) {
  const title = normalizeSpaces(value)
  if (!title) return ''

  const trimmedUrl = title.replace(/^https?:\/\/(www\.)?/i, '')
  if (trimmedUrl !== title && trimmedUrl) return trimmedUrl

  const sep = ' - '
  const idx = title.indexOf(sep)
  if (idx > 0) {
    const prefix = title.slice(0, idx).trim()
    const rest = title.slice(idx + sep.length).trim()
    if (rest && looksLikeSlugOrUrlPrefix(prefix)) return rest
  }

  return title
}

export function buildDocumentTitle(parts: Array<string | null | undefined>) {
  const cleaned = parts
    .map((p) => (p ? normalizeSpaces(p) : ''))
    .filter((p) => p.length > 0)
    .slice(0, 4)
  return cleaned.join(' | ')
}

