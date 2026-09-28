/**
 * The on-disk schema version.
 *
 * STATE_MODEL.md: readers refuse a version they do not understand rather than
 * guessing. Bumping this is a migration, not a detail.
 */
export const SCHEMA_VERSION = 1;
