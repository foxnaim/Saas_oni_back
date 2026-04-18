import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ParseObjectIdPipe (renamed for historical compat — now validates UUIDs)
 *
 * Validates that a route parameter is a valid UUID v4 string.
 * Throws a `BadRequestException` if the value is malformed.
 *
 * @example
 * ```ts
 * @Get(':id')
 * findOne(@Param('id', ParseObjectIdPipe) id: string) { ... }
 * ```
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!UUID_REGEX.test(value)) {
      const paramLabel = metadata.data ? `'${metadata.data}'` : 'parameter';
      throw new BadRequestException(
        `Invalid UUID for ${paramLabel}: "${value}"`,
      );
    }

    return value.toLowerCase();
  }
}
