// services/db-migration.ts
// Migration script to move data from old IndexedDB structure to new Dexie structure

import { db } from './db';
import { filesRepository } from './repositories';
import { getCacheTimes } from './cache-config';

/**
 * Old file cache interface (from file-cache.ts)
 */
interface OldCachedFile {
  url: string;
  blob: Blob;
  type: string;
  name: string;
  size: number;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Migration result
 */
interface MigrationResult {
  success: boolean;
  filesCount: number;
  errors: string[];
  duration: number;
}

/**
 * Check if old database exists
 */
async function checkOldDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open('FileCacheDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const hasOldStore = db.objectStoreNames.contains('files');
      db.close();
      resolve(hasOldStore);
    };
    
    request.onerror = () => {
      resolve(false);
    };
  });
}

/**
 * Get all files from old database
 */
async function getOldFiles(): Promise<OldCachedFile[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FileCacheDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains('files')) {
        db.close();
        resolve([]);
        return;
      }

      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        db.close();
        resolve(getAllRequest.result as OldCachedFile[]);
      };

      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Migrate files from old database to new Dexie database
 */
export async function migrateFileCache(): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let filesCount = 0;

  try {
    console.log('[Migration] Starting file cache migration...');

    // Check if old database exists
    const hasOldDb = await checkOldDatabase();
    
    if (!hasOldDb) {
      console.log('[Migration] No old database found, skipping migration');
      return {
        success: true,
        filesCount: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // Get all files from old database
    const oldFiles = await getOldFiles();
    console.log(`[Migration] Found ${oldFiles.length} files in old database`);

    if (oldFiles.length === 0) {
      console.log('[Migration] No files to migrate');
      return {
        success: true,
        filesCount: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // Migrate each file to new database
    for (const oldFile of oldFiles) {
      try {
        const times = getCacheTimes('files');
        
        await filesRepository.put({
          id: crypto.randomUUID(),
          url: oldFile.url,
          blob: oldFile.blob,
          name: oldFile.name,
          type: oldFile.type,
          size: oldFile.size,
          ...times,
          lastAccessedAt: oldFile.cachedAt,
          accessCount: 1,
        });

        filesCount++;
      } catch (error) {
        const errorMsg = `Failed to migrate file ${oldFile.name}: ${error}`;
        console.error(`[Migration] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Migration] Migration completed in ${duration}ms`);
    console.log(`[Migration] Migrated ${filesCount}/${oldFiles.length} files`);

    if (errors.length > 0) {
      console.log(`[Migration] ${errors.length} errors occurred`);
    }

    return {
      success: errors.length < oldFiles.length / 2, // Success if less than 50% errors
      filesCount,
      errors,
      duration,
    };
  } catch (error) {
    console.error('[Migration] Fatal error during migration:', error);
    return {
      success: false,
      filesCount,
      errors: [...errors, `Fatal error: ${error}`],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Delete old database after successful migration
 */
export async function deleteOldDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('[Migration] Deleting old database...');
    
    const request = indexedDB.deleteDatabase('FileCacheDB');
    
    request.onsuccess = () => {
      console.log('[Migration] Old database deleted successfully');
      resolve(true);
    };
    
    request.onerror = () => {
      console.error('[Migration] Error deleting old database:', request.error);
      resolve(false);
    };
    
    request.onblocked = () => {
      console.warn('[Migration] Database deletion blocked');
      resolve(false);
    };
  });
}

/**
 * Run full migration process
 */
export async function runMigration(options: {
  deleteOldDb?: boolean;
} = {}): Promise<MigrationResult> {
  try {
    // Run migration
    const result = await migrateFileCache();

    // Delete old database if requested and migration was successful
    if (options.deleteOldDb && result.success) {
      const deleted = await deleteOldDatabase();
      
      if (!deleted) {
        result.errors.push('Failed to delete old database');
      }
    }

    return result;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return {
      success: false,
      filesCount: 0,
      errors: [`Migration failed: ${error}`],
      duration: 0,
    };
  }
}

/**
 * Check if migration is needed
 */
export async function needsMigration(): Promise<boolean> {
  try {
    const hasOldDb = await checkOldDatabase();
    
    if (!hasOldDb) {
      return false;
    }

    const oldFiles = await getOldFiles();
    return oldFiles.length > 0;
  } catch (error) {
    console.error('[Migration] Error checking if migration is needed:', error);
    return false;
  }
}

/**
 * Auto-run migration on app start (silent)
 */
export async function autoMigrate(): Promise<void> {
  try {
    const needs = await needsMigration();
    
    if (!needs) {
      console.log('[Migration] No migration needed');
      return;
    }

    console.log('[Migration] Starting automatic migration...');
    const result = await runMigration({ deleteOldDb: true });

    if (result.success) {
      console.log('[Migration] Automatic migration completed successfully');
      console.log(`[Migration] Migrated ${result.filesCount} files in ${result.duration}ms`);
    } else {
      console.error('[Migration] Automatic migration failed');
      console.error(`[Migration] Errors:`, result.errors);
    }
  } catch (error) {
    console.error('[Migration] Auto-migration error:', error);
  }
}

// Run migration automatically on module load (non-blocking)
setTimeout(() => {
  autoMigrate().catch(error => {
    console.error('[Migration] Failed to auto-migrate:', error);
  });
}, 1000); // Wait 1 second after app load

