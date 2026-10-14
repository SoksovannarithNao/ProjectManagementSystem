// @mentions in comments (G-14, D-21). The rules mirror the server's (backend.util.Mentions): a
// mention is "@" followed by a username (letters, digits, dots, underscores and hyphens), not
// glued to a preceding word or "@"; punctuation after the name is not part of it. The server
// decides who is actually mentioned and notified; these helpers only drive the autocomplete and
// the highlighting.

const NAME_CHARS = 'A-Za-z0-9._-'
const MENTION = new RegExp(`(?<![@${NAME_CHARS}])@([A-Za-z0-9][${NAME_CHARS}]{0,49})`, 'g')
const QUERY_AT_END = new RegExp(`(^|[^@${NAME_CHARS}])@([${NAME_CHARS}]{0,50})$`)

const isSeparator = (c) => c === '.' || c === '_' || c === '-'

// The "@word" being typed just before the caret, or null: { start, query }, where `start` is the
// index of the "@" and `query` what follows it so far.
export function mentionQueryAt(text, caret) {
  const before = (text ?? '').slice(0, caret ?? 0)
  const match = QUERY_AT_END.exec(before)
  if (!match) return null
  return { start: before.length - match[2].length - 1, query: match[2] }
}

// Replaces the "@query" being typed (from `start` to the caret) with "@username " and says where
// the caret goes.
export function applyMention(text, start, caret, username) {
  const insert = `@${username} `
  const next = text.slice(0, start) + insert + text.slice(caret)
  return { text: next, caret: start + insert.length }
}

// The members to offer for what has been typed after the "@": a username or name that starts with
// it comes first, then one that contains it. Never the author. At most `limit`.
export function mentionCandidates(members, query, excludeId, limit = 6) {
  const q = (query ?? '').toLowerCase()
  const pool = (members ?? []).filter((m) => m.id !== excludeId)
  const rank = (m) => {
    const username = m.username.toLowerCase()
    const name = (m.fullName ?? '').toLowerCase()
    if (q === '') return 2
    if (username.startsWith(q) || name.startsWith(q)) return 0
    if (username.includes(q) || name.split(/\s+/).some((part) => part.startsWith(q)) || name.includes(q)) return 1
    return 9
  }
  return pool
    .map((m) => ({ m, r: rank(m) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.m.username.localeCompare(b.m.username))
    .slice(0, limit)
    .map((x) => x.m)
}

// Splits a message into plain pieces and mentions, so it can be shown with the mentions
// highlighted without ever putting the text into HTML: [{ text }, { text: '@dev.mia', mention }].
// `mentions` is what the server resolved ([{ id, username, fullName }]); an @word that is not one
// of them stays plain text.
export function splitMentions(message, mentions) {
  const text = message ?? ''
  const byName = new Map((mentions ?? []).map((m) => [m.username.toLowerCase(), m]))
  if (byName.size === 0) return [{ text }]
  const parts = []
  let last = 0
  for (const match of text.matchAll(MENTION)) {
    let name = match[1].toLowerCase()
    let length = match[1].length
    while (name && !byName.has(name)) {
      let end = name.length
      while (end > 0 && isSeparator(name[end - 1])) end -= 1
      if (end === name.length) {
        name = ''
        break
      }
      name = name.slice(0, end)
      length = end
    }
    if (!name) continue
    const from = match.index
    if (from > last) parts.push({ text: text.slice(last, from) })
    parts.push({ text: text.slice(from, from + 1 + length), mention: byName.get(name) })
    last = from + 1 + length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts.length ? parts : [{ text }]
}
