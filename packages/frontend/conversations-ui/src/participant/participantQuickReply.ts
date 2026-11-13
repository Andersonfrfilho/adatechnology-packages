/** Fills the composer text with a quick reply; the caller must never send because of it. */
export function applyQuickReply(currentText: string, replyText: string): string {
  if (replyText === '') return currentText
  if (currentText.trim() === '') return replyText
  return /\s$/.test(currentText) ? `${currentText}${replyText}` : `${currentText} ${replyText}`
}
