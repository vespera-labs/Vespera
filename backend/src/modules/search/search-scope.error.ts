import { BadRequestException } from '@nestjs/common';

export class SearchScopeError extends BadRequestException {
  constructor(message = 'Search requires a server-derived tenant scope') {
    super({
      code: 'SEARCH_SCOPE_ERROR',
      message,
    });
    this.name = 'SearchScopeError';
  }
}
