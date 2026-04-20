import 'dotenv/config';
import path from 'path';

function parseOriginList(value) {
  const raw = String(value || '').trim();
  if (!raw) return ['http://localhost:5173'];
  if (raw === '*') return '*';
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 10000),
  APP_NAME: process.env.APP_NAME || 'Life Builder',
  APP_BASE_URL: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 10000}`,
  FRONTEND_ORIGIN: parseOriginList(process.env.FRONTEND_ORIGIN),
  MONGODB_URI: process.env.MONGODB_URI || '',
  AUTH_SECRET: process.env.AUTH_SECRET || 'sp-builder-dev-secret-change-me',
  STORAGE_DIR: process.env.STORAGE_DIR ? path.resolve(process.cwd(), process.env.STORAGE_DIR) : path.resolve(process.cwd(), 'storage'),
  ENABLE_ANDROID_BUILDS: String(process.env.ENABLE_ANDROID_BUILDS || 'false').toLowerCase() === 'true',
  BUILD_TIMEOUT_MS: Number(process.env.BUILD_TIMEOUT_MS || 1800000),
  MAX_PROJECTS: Number(process.env.MAX_PROJECTS || 500),
  MAX_APP_NAME_LENGTH: Number(process.env.MAX_APP_NAME_LENGTH || 60),
  MAX_LAUNCHER_NAME_LENGTH: Number(process.env.MAX_LAUNCHER_NAME_LENGTH || 30),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 50),
  ANDROID_PACKAGE_PREFIX: process.env.ANDROID_PACKAGE_PREFIX || 'com.spbuilder.apps'
};
