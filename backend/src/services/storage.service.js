import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

export async function ensureStorageDirs() {
  await fs.mkdir(env.STORAGE_DIR, { recursive: true });
  await fs.mkdir(path.join(env.STORAGE_DIR, 'builds'), { recursive: true });
  await fs.mkdir(path.join(env.STORAGE_DIR, 'uploads'), { recursive: true });
  await fs.mkdir(path.join(env.STORAGE_DIR, 'exports'), { recursive: true });
}

export function buildProjectDir(projectId) {
  return path.join(env.STORAGE_DIR, 'builds', String(projectId));
}

export function uploadDirForProject(projectId) {
  return path.join(env.STORAGE_DIR, 'uploads', String(projectId));
}

export async function ensureProjectDir(projectId) {
  const dir = buildProjectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureUploadDir(projectId) {
  const dir = uploadDirForProject(projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
