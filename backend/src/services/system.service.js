import { spawn } from 'child_process';
import { env } from '../config/env.js';
import { getDatabaseState } from '../lib/db.js';

function checkCommand(command, args = ['--version']) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', () => resolve({ available: false, version: '' }));
    child.on('close', (code) => {
      resolve({
        available: code === 0,
        version: output.trim().split('\n').find(Boolean) || ''
      });
    });
  });
}

export async function getSystemStatus() {
  const [java, bubblewrap] = await Promise.all([
    checkCommand('java', ['-version']),
    checkCommand('bubblewrap', ['--version'])
  ]);

  const database = getDatabaseState();
  const androidToolingReady = java.available && bubblewrap.available;

  return {
    appName: env.APP_NAME,
    environment: env.NODE_ENV,
    database,
    builds: {
      enabled: env.ENABLE_ANDROID_BUILDS,
      androidToolingReady,
      java,
      bubblewrap,
      iosExportAvailable: true
    },
    limits: {
      maxProjects: env.MAX_PROJECTS,
      maxAppNameLength: env.MAX_APP_NAME_LENGTH,
      maxLauncherNameLength: env.MAX_LAUNCHER_NAME_LENGTH,
      maxUploadMb: env.MAX_UPLOAD_MB
    },
    frontendOrigin: env.FRONTEND_ORIGIN,
    timestamp: new Date().toISOString()
  };
}
