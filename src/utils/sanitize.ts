/**
 * Утилиты для санитизации пользовательского ввода
 * Защита от XSS атак
 */

import sanitizeHtml from "sanitize-html";

/**
 * Санитизирует HTML контент, удаляя опасные теги и атрибуты
 * Разрешает только безопасные теги для форматирования текста
 */
export const sanitizeMessageContent = (content: string): string => {
  return sanitizeHtml(content, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
    ],
    allowedAttributes: {},
    allowedStyles: {},
    // Запрещаем все скрипты и события
    disallowedTagsMode: "discard",
    // Максимальная длина контента после санитизации
    textFilter: (text: string) => {
      // Удаляем множественные пробелы и переносы строк
      return text.replace(/\s+/g, " ").trim();
    },
  });
};

/**
 * Санитизирует обычный текст (удаляет все HTML теги)
 */
export const sanitizeText = (text: string): string => {
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });
};
