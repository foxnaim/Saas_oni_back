// ─────────────────────────────────────────────
//  Telegram bot message templates (ru / en / kk)
// ─────────────────────────────────────────────

export const MESSAGES = {
  ru: {
    // ── /start ────────────────────────────────
    welcome: `👋 *Добро пожаловать в SayLess Bot!*\n\nЯ помогаю компаниям получать анонимные отзывы от сотрудников.\n\n*Что умеет этот бот:*\n• 📨 Уведомления о новых сообщениях\n• 📊 Статистика компании\n• 💬 Ответы на анонимные отзывы прямо из Telegram\n\nВыберите действие ниже 👇`,

    // ── /register ─────────────────────────────
    registerStart: `🏢 *Регистрация компании*\n\nДля регистрации перейдите по ссылке ниже и создайте аккаунт компании. После регистрации используйте /link для привязки этого чата.\n\n🔗 Ссылка для регистрации:`,
    registerCode: (code: string) =>
      `🔑 Ваш временный код подтверждения:\n\n\`${code}\`\n\n⏱ Действует 15 минут. Введите его на сайте при регистрации.`,

    // ── /link ─────────────────────────────────
    linkUsage: `⚠️ Использование: /link <КОД_КОМПАНИИ>\n\nПример: \`/link ABC12345\``,
    linkNotFound: (code: string) =>
      `❌ Компания с кодом *${code}* не найдена.\n\nПроверьте код и попробуйте снова.`,
    linkSuccess: (name: string) =>
      `✅ *Готово!* Этот чат привязан к компании *${name}*.\n\nТеперь вы будете получать уведомления о новых анонимных сообщениях.`,
    alreadyLinked: (name: string) =>
      `ℹ️ Этот чат уже привязан к компании *${name}*.`,

    // ── /stats ────────────────────────────────
    notLinked: `❌ Этот чат не привязан ни к одной компании.\n\nИспользуйте /link <КОД> для привязки.`,
    stats: (
      name: string,
      total: number,
      pending: number,
      resolved: number,
      rejected: number,
      thisMonth: number,
    ) =>
      `📊 *Статистика компании: ${name}*\n\n` +
      `📨 Всего сообщений: *${total}*\n` +
      `🕐 Ожидают ответа: *${pending}*\n` +
      `✅ Решено: *${resolved}*\n` +
      `❌ Отклонено: *${rejected}*\n` +
      `📅 В этом месяце: *${thisMonth}*`,

    // ── /messages ─────────────────────────────
    noMessages: `📭 Новых сообщений нет.`,
    messagesHeader: (count: number) =>
      `📨 *Последние ${count} сообщений:*\n`,
    messageItem: (index: number, text: string, date: string, status: string) =>
      `*${index}.* ${text}\n📅 ${date} | ${status}`,

    // ── Notifications ─────────────────────────
    newMessage: (companyName: string, text: string, messageId: string) =>
      `📨 *Новое анонимное сообщение*\n🏢 Компания: *${companyName}*\n\n💬 "${text}"\n\n🆔 ID: \`${messageId}\``,
    messageStatusChanged: (
      companyName: string,
      messageId: string,
      newStatus: string,
    ) =>
      `🔄 *Статус сообщения изменён*\n🏢 ${companyName}\n🆔 \`${messageId}\`\n📌 Новый статус: *${newStatus}*`,
    companyReply: (companyName: string, replyText: string) =>
      `💬 *Ответ от компании ${companyName}*\n\n"${replyText}"`,

    // ── Inline reply flow ─────────────────────
    replyPrompt: `✏️ Напишите ваш ответ на это сообщение:`,
    replySent: `✅ Ваш ответ отправлен анонимному пользователю.`,
    replyFailed: `❌ Не удалось отправить ответ. Попробуйте позже.`,
    messageResolved: `✅ Сообщение помечено как решённое.`,
    messageRejected: `❌ Сообщение отклонено.`,
    actionFailed: `❌ Действие не удалось. Попробуйте позже.`,

    // ── /help ─────────────────────────────────
    help: `📖 *Доступные команды:*\n\n` +
      `/start — Главное меню\n` +
      `/register — Зарегистрировать компанию\n` +
      `/link <КОД> — Привязать аккаунт компании\n` +
      `/stats — Статистика компании\n` +
      `/messages — Последние сообщения\n` +
      `/help — Показать эту справку\n\n` +
      `По вопросам обращайтесь в поддержку.`,

    cancel: `🚫 Действие отменено.`,
    unknownCommand: `❓ Неизвестная команда. Используйте /help для списка команд.`,
    error: `⚠️ Произошла ошибка. Попробуйте позже.`,
  },

  en: {
    welcome: `👋 *Welcome to SayLess Bot!*\n\nI help companies receive anonymous feedback from employees.\n\n*What I can do:*\n• 📨 Notifications about new messages\n• 📊 Company statistics\n• 💬 Reply to anonymous feedback directly from Telegram\n\nChoose an action below 👇`,

    registerStart: `🏢 *Company Registration*\n\nVisit the link below to create a company account. After registration use /link to connect this chat.\n\n🔗 Registration link:`,
    registerCode: (code: string) =>
      `🔑 Your temporary confirmation code:\n\n\`${code}\`\n\n⏱ Valid for 15 minutes. Enter it on the website during registration.`,

    linkUsage: `⚠️ Usage: /link <COMPANY_CODE>\n\nExample: \`/link ABC12345\``,
    linkNotFound: (code: string) =>
      `❌ Company with code *${code}* not found.\n\nCheck the code and try again.`,
    linkSuccess: (name: string) =>
      `✅ *Done!* This chat is now linked to company *${name}*.\n\nYou will receive notifications about new anonymous messages.`,
    alreadyLinked: (name: string) =>
      `ℹ️ This chat is already linked to company *${name}*.`,

    notLinked: `❌ This chat is not linked to any company.\n\nUse /link <CODE> to link.`,
    stats: (
      name: string,
      total: number,
      pending: number,
      resolved: number,
      rejected: number,
      thisMonth: number,
    ) =>
      `📊 *Company Stats: ${name}*\n\n` +
      `📨 Total messages: *${total}*\n` +
      `🕐 Pending reply: *${pending}*\n` +
      `✅ Resolved: *${resolved}*\n` +
      `❌ Rejected: *${rejected}*\n` +
      `📅 This month: *${thisMonth}*`,

    noMessages: `📭 No new messages.`,
    messagesHeader: (count: number) => `📨 *Latest ${count} messages:*\n`,
    messageItem: (index: number, text: string, date: string, status: string) =>
      `*${index}.* ${text}\n📅 ${date} | ${status}`,

    newMessage: (companyName: string, text: string, messageId: string) =>
      `📨 *New Anonymous Message*\n🏢 Company: *${companyName}*\n\n💬 "${text}"\n\n🆔 ID: \`${messageId}\``,
    messageStatusChanged: (
      companyName: string,
      messageId: string,
      newStatus: string,
    ) =>
      `🔄 *Message Status Changed*\n🏢 ${companyName}\n🆔 \`${messageId}\`\n📌 New status: *${newStatus}*`,
    companyReply: (companyName: string, replyText: string) =>
      `💬 *Reply from ${companyName}*\n\n"${replyText}"`,

    replyPrompt: `✏️ Write your reply to this message:`,
    replySent: `✅ Your reply has been sent to the anonymous user.`,
    replyFailed: `❌ Failed to send reply. Please try again later.`,
    messageResolved: `✅ Message marked as resolved.`,
    messageRejected: `❌ Message rejected.`,
    actionFailed: `❌ Action failed. Please try again later.`,

    help: `📖 *Available commands:*\n\n` +
      `/start — Main menu\n` +
      `/register — Register a company\n` +
      `/link <CODE> — Link company account\n` +
      `/stats — Company statistics\n` +
      `/messages — Recent messages\n` +
      `/help — Show this help\n\n` +
      `Contact support for assistance.`,

    cancel: `🚫 Action cancelled.`,
    unknownCommand: `❓ Unknown command. Use /help for a list of commands.`,
    error: `⚠️ An error occurred. Please try again later.`,
  },

  kk: {
    welcome: `👋 *SayLess Bot-қа қош келдіңіз!*\n\nМен компанияларға қызметкерлерден анонимді пікірлер алуға көмектесемін.\n\n*Бот мүмкіндіктері:*\n• 📨 Жаңа хабарламалар туралы хабарландырулар\n• 📊 Компания статистикасы\n• 💬 Telegram арқылы анонимді пікірлерге жауап беру\n\nТөмендегі әрекетті таңдаңыз 👇`,

    registerStart: `🏢 *Компанияны тіркеу*\n\nКомпания аккаунтын жасау үшін төмендегі сілтемеге өтіңіз. Тіркелгеннен кейін чатты байланыстыру үшін /link пайдаланыңыз.\n\n🔗 Тіркелу сілтемесі:`,
    registerCode: (code: string) =>
      `🔑 Уақытша растау кодыңыз:\n\n\`${code}\`\n\n⏱ 15 минут жарамды. Оны тіркелу кезінде сайтқа енгізіңіз.`,

    linkUsage: `⚠️ Пайдалану: /link <КОМПАНИЯ_КОДЫ>\n\nМысал: \`/link ABC12345\``,
    linkNotFound: (code: string) =>
      `❌ *${code}* кодымен компания табылмады.\n\nКодты тексеріп, қайталаңыз.`,
    linkSuccess: (name: string) =>
      `✅ *Дайын!* Бұл чат *${name}* компаниясымен байланыстырылды.\n\nЖаңа анонимді хабарламалар туралы хабарландырулар аласыз.`,
    alreadyLinked: (name: string) =>
      `ℹ️ Бұл чат *${name}* компаниясымен байланыстырылған.`,

    notLinked: `❌ Бұл чат ешқандай компанияға байланыстырылмаған.\n\nБайланыстыру үшін /link <КОД> пайдаланыңыз.`,
    stats: (
      name: string,
      total: number,
      pending: number,
      resolved: number,
      rejected: number,
      thisMonth: number,
    ) =>
      `📊 *Компания статистикасы: ${name}*\n\n` +
      `📨 Барлық хабарламалар: *${total}*\n` +
      `🕐 Жауап күтуде: *${pending}*\n` +
      `✅ Шешілді: *${resolved}*\n` +
      `❌ Қабылданбады: *${rejected}*\n` +
      `📅 Осы айда: *${thisMonth}*`,

    noMessages: `📭 Жаңа хабарламалар жоқ.`,
    messagesHeader: (count: number) => `📨 *Соңғы ${count} хабарлама:*\n`,
    messageItem: (index: number, text: string, date: string, status: string) =>
      `*${index}.* ${text}\n📅 ${date} | ${status}`,

    newMessage: (companyName: string, text: string, messageId: string) =>
      `📨 *Жаңа анонимді хабарлама*\n🏢 Компания: *${companyName}*\n\n💬 "${text}"\n\n🆔 ID: \`${messageId}\``,
    messageStatusChanged: (
      companyName: string,
      messageId: string,
      newStatus: string,
    ) =>
      `🔄 *Хабарлама мәртебесі өзгерді*\n🏢 ${companyName}\n🆔 \`${messageId}\`\n📌 Жаңа мәртебе: *${newStatus}*`,
    companyReply: (companyName: string, replyText: string) =>
      `💬 *${companyName} компаниясының жауабы*\n\n"${replyText}"`,

    replyPrompt: `✏️ Хабарламаға жауабыңызды жазыңыз:`,
    replySent: `✅ Жауабыңыз анонимді пайдаланушыға жіберілді.`,
    replyFailed: `❌ Жауап жіберу сәтсіз болды. Кейінірек қайталаңыз.`,
    messageResolved: `✅ Хабарлама шешілді деп белгіленді.`,
    messageRejected: `❌ Хабарлама қабылданбады.`,
    actionFailed: `❌ Әрекет орындалмады. Кейінірек қайталаңыз.`,

    help: `📖 *Қолжетімді командалар:*\n\n` +
      `/start — Басты мәзір\n` +
      `/register — Компанияны тіркеу\n` +
      `/link <КОД> — Компания аккаунтын байланыстыру\n` +
      `/stats — Компания статистикасы\n` +
      `/messages — Соңғы хабарламалар\n` +
      `/help — Осы анықтаманы көрсету\n\n` +
      `Сұрақтар бойынша қолдау қызметіне хабарласыңыз.`,

    cancel: `🚫 Әрекет бас тартылды.`,
    unknownCommand: `❓ Белгісіз команда. Командалар тізімі үшін /help пайдаланыңыз.`,
    error: `⚠️ Қате орын алды. Кейінірек қайталаңыз.`,
  },
} as const;

export type SupportedLocale = keyof typeof MESSAGES;

/** Default locale used across the bot */
export const DEFAULT_LOCALE: SupportedLocale = 'ru';

/** Callback-query action prefixes */
export const CALLBACK = {
  RESOLVE_MESSAGE: 'resolve:',
  REJECT_MESSAGE: 'reject:',
  REPLY_MESSAGE: 'reply:',
  LANG_SELECT: 'lang:',
} as const;

/** Conversation-state keys stored in Telegraf session */
export const SESSION_KEY = {
  AWAITING_REPLY_FOR: 'awaitingReplyFor',
  LINKED_COMPANY_CODE: 'linkedCompanyCode',
  LANG: 'lang',
} as const;

/** Registration temp-code TTL in milliseconds (15 min) */
export const REGISTER_CODE_TTL_MS = 15 * 60 * 1000;
