import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Create a unique temporary directory
 * @param prefix - Prefix for the temp directory name
 * @returns Promise<string> - Path to the created directory
 */
export async function makeTempDir(prefix: string): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return tempDir;
}

/**
 * Recursively delete a directory and all its contents
 * @param dirPath - Path to the directory to delete
 */
export async function cleanupDir(dirPath: string): Promise<void> {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}
