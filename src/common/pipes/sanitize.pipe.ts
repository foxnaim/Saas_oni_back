import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * Default allow-list for sanitize-html.
 * Allows a safe subset of inline / block formatting tags while stripping
 * all scripts, styles, and event handler attributes.
 */
const DEFAULT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'u', 's', 'strike',
    'p', 'br', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Strip (rather than escape) disallowed tags so their text content survives.
  disallowedTagsMode: 'discard',
};

/**
 * SanitizePipe
 *
 * Recursively walks the incoming value and strips potentially dangerous HTML
 * from every string it encounters using `sanitize-html`.
 *
 * Supported value shapes:
 *  - `string`         → sanitized directly
 *  - plain `object`   → each string property is sanitized (shallow + deep)
 *  - `array`          → each element is sanitized recursively
 *  - non-string primitives / `null` / `undefined` → passed through unchanged
 *
 * Custom sanitize-html options can be injected at instantiation time:
 * ```ts
 * // Strip ALL tags (plain-text only)
 * new SanitizePipe({ allowedTags: [], allowedAttributes: {} })
 * ```
 *
 * @example
 * ```ts
 * // Globally in main.ts
 * app.useGlobalPipes(new SanitizePipe());
 *
 * // Or per-route
 * @Post()
 * create(@Body(SanitizePipe) dto: CreateMessageDto) { ... }
 * ```
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  private readonly options: sanitizeHtml.IOptions;

  constructor(options?: sanitizeHtml.IOptions) {
    this.options = options ?? DEFAULT_SANITIZE_OPTIONS;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return this.sanitize(value);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      return sanitizeHtml(value, this.options);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value !== null && typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    // Primitives (number, boolean, null, undefined) pass through unmodified.
    return value;
  }
}
