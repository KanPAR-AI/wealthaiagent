// services/repositories/index.ts
// Central export for all repositories

export { filesRepository } from './files-repository';
export { chatsRepository } from './chats-repository';
export { messagesRepository } from './messages-repository';
export { stocksRepository } from './stocks-repository';
export { portfolioRepository } from './portfolio-repository';
export { marketRepository } from './market-repository';
export { apiCacheRepository } from './api-cache-repository';

// Export types
export type { BaseRepository, CachedRepository } from './base-repository';

