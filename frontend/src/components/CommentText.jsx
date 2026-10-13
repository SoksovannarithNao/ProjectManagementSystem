import { splitMentions } from '../api/mentions'

// A comment's text with the people it @mentions highlighted. Built from React text nodes (never
// HTML), so a message can't inject markup.
export function CommentText({ message, mentions }) {
  return (
    <p className="text-muted text-[12px] leading-normal break-words">
      {splitMentions(message, mentions).map((part, i) =>
        part.mention ? (
          <span
            key={i}
            data-mention={part.mention.username}
            title={part.mention.fullName}
            className="text-lavender font-semibold"
          >
            {part.text}
          </span>
        ) : (
          part.text
        )
      )}
    </p>
  )
}
