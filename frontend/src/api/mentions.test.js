import { describe, expect, it } from 'vitest'
import { applyMention, mentionCandidates, mentionQueryAt, splitMentions } from './mentions'

const mia = { id: 2, username: 'dev.mia', fullName: 'Mia Park' }
const raj = { id: 4, username: 'dev.raj', fullName: 'Raj Patel' }
const owen = { id: 5, username: 'lead.owen', fullName: 'Owen Lead' }

describe('mentionQueryAt', () => {
  it('finds the @word being typed before the caret', () => {
    expect(mentionQueryAt('hi @de', 6)).toEqual({ start: 3, query: 'de' })
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQueryAt('line one\n@mi', 12)).toEqual({ start: 9, query: 'mi' })
  })

  it('only looks left of the caret', () => {
    expect(mentionQueryAt('hi @dev.mia and more', 6)).toEqual({ start: 3, query: 'de' })
  })

  it('is not triggered by an e-mail address, a finished word or a double @', () => {
    expect(mentionQueryAt('write to jane@dev', 17)).toBeNull()
    expect(mentionQueryAt('hi @dev.mia ', 12)).toBeNull()
    expect(mentionQueryAt('a @@dev', 7)).toBeNull()
    expect(mentionQueryAt('no mention', 10)).toBeNull()
  })
})

describe('applyMention', () => {
  it('replaces the typed @query with @username and a space, caret after it', () => {
    expect(applyMention('hi @de and more', 3, 6, 'dev.mia')).toEqual({ text: 'hi @dev.mia  and more', caret: 12 })
    expect(applyMention('@', 0, 1, 'dev.raj')).toEqual({ text: '@dev.raj ', caret: 9 })
  })
})

describe('mentionCandidates', () => {
  const members = [raj, owen, mia]

  it('offers everyone but the author for a bare @', () => {
    expect(mentionCandidates(members, '', 4).map((m) => m.username)).toEqual(['dev.mia', 'lead.owen'])
  })

  it('puts a start match before a contains match, ignoring the case', () => {
    expect(mentionCandidates(members, 'DEV').map((m) => m.username)).toEqual(['dev.mia', 'dev.raj'])
    expect(mentionCandidates(members, 'park').map((m) => m.username)).toEqual(['dev.mia'])
    expect(mentionCandidates(members, 'owen').map((m) => m.username)).toEqual(['lead.owen'])
  })

  it('offers nobody for a name nobody has, and is capped', () => {
    expect(mentionCandidates(members, 'zzz')).toEqual([])
    expect(mentionCandidates(members, '', null, 2)).toHaveLength(2)
  })
})

describe('splitMentions', () => {
  it('returns the text whole when nobody is mentioned', () => {
    expect(splitMentions('plain text', [])).toEqual([{ text: 'plain text' }])
    expect(splitMentions('hi @dev.mia', undefined)).toEqual([{ text: 'hi @dev.mia' }])
    expect(splitMentions(null, [mia])).toEqual([{ text: '' }])
  })

  it('marks the resolved mentions and keeps everything else in order', () => {
    expect(splitMentions('Please look @dev.mia, then @dev.raj.', [mia, raj])).toEqual([
      { text: 'Please look ' },
      { text: '@dev.mia', mention: mia },
      { text: ', then ' },
      { text: '@dev.raj', mention: raj },
      { text: '.' },
    ])
  })

  it('ignores the case but shows the text as written', () => {
    expect(splitMentions('@DEV.MIA hi', [mia])).toEqual([{ text: '@DEV.MIA', mention: mia }, { text: ' hi' }])
  })

  it('leaves an @word the server did not resolve as plain text', () => {
    expect(splitMentions('@nobody and @dev.mia', [mia])).toEqual([
      { text: '@nobody and ' },
      { text: '@dev.mia', mention: mia },
    ])
  })

  it('never reads a longer name or an e-mail address as a mention', () => {
    expect(splitMentions('@dev.miax and jane@dev.mia', [mia])).toEqual([{ text: '@dev.miax and jane@dev.mia' }])
  })
})
