// Keep the input's path/query intact: subscription tokens may contain encoded characters.
export function getSubscriptionUrlCandidates(input: string): string[] {
  const value = input.trim()
  if (!value || value.startsWith('/')) return []
  for (const character of value) {
    if (character === '\\' || character.charCodeAt(0) <= 0x20) return []
  }

  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
  if (!hasProtocol && /^https?:/i.test(value)) return []
  const primary = hasProtocol ? value : `https://${value}`
  try {
    const parsed = new URL(primary)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return []
    if (!hasProtocol && (parsed.username || parsed.password)) return []
    return hasProtocol ? [value] : [primary, `http://${value}`]
  } catch {
    return []
  }
}
