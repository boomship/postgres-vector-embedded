/**
 * @boomship/postgres-vector-embedded
 *
 * Embedded PostgreSQL with pgvector extension for Node.js applications
 */

export { downloadBinaries } from './download.js';
export { PostgresServer } from './server.js';
export {
  detectPlatform,
  validatePlatformArch,
  getBinaryFilename,
  getDownloadUrl,
} from './platform.js';

export type {
  Platform,
  Architecture,
  DownloadOptions,
  PlatformInfo,
  DownloadProgress,
  PostgresServerOptions,
} from './types.js';
