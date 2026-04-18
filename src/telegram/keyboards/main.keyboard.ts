import { Markup } from 'telegraf';

// ─────────────────────────────────────────────
//  Reusable Telegram keyboard layouts
// ─────────────────────────────────────────────

/**
 * Main menu – shown to every user on /start or when not linked to a company.
 */
export function mainMenuKeyboard() {
  return Markup.keyboard([
    ['🏢 Register Company', '🔗 Link Account'],
    ['❓ Help'],
  ])
    .resize()
    .persistent();
}

/**
 * Company menu – shown when the chat is already linked to a company.
 */
export function companyMenuKeyboard() {
  return Markup.keyboard([
    ['📊 Stats', '📨 Messages'],
    ['⚙️ Settings', '❓ Help'],
  ])
    .resize()
    .persistent();
}

/**
 * Inline keyboard attached to each incoming anonymous-message notification.
 * @param messageId  MongoDB ObjectId (string) of the message document.
 */
export function messageActionsKeyboard(messageId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Resolve', `resolve:${messageId}`),
      Markup.button.callback('💬 Reply', `reply:${messageId}`),
      Markup.button.callback('❌ Reject', `reject:${messageId}`),
    ],
  ]);
}

/**
 * Inline keyboard for already-resolved / rejected messages (view only).
 * @param messageId  MongoDB ObjectId (string).
 */
export function resolvedMessageKeyboard(messageId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💬 Reply', `reply:${messageId}`)],
  ]);
}

/**
 * Inline keyboard for language selection.
 */
export function languageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇷🇺 Русский', 'lang:ru'),
      Markup.button.callback('🇬🇧 English', 'lang:en'),
      Markup.button.callback('🇰🇿 Қазақша', 'lang:kk'),
    ],
  ]);
}

/**
 * Cancel-only inline keyboard – used during reply flow.
 */
export function cancelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🚫 Cancel', 'cancel')],
  ]);
}
