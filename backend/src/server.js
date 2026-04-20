import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { connectDatabase, getDatabaseState } from './lib/db.js';
import { ensureStorageDirs } from './services/storage.service.js';
import { env } from './config/env.js';
import projectRoutes from './routes/project.routes.js';
import systemRoutes from './routes/system.routes.js';
import { assignRequestId, basicRateLimit, basicSecurityHeaders } from './middleware/security.js';

const app = express();
const storageAbsolute = path.resolve(env.STORAGE_DIR);
const host = '0.0.0.0';

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(assignRequestId);
app.use(basicSecurityHeaders);
app.use(cors({ origin: env.FRONTEND_ORIGIN === '*' ? true : env.FRONTEND_ORIGIN, credentials: false }));
app.use(express.json({ limit: '4mb' }));
app.use(basicRateLimit);
app.use(morgan(':method :url :status :res[content-length] - :response-time ms req=:req[x-request-id]'));

app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: `${env.APP_NAME} backend is running`,
    appName: env.APP_NAME,
    environment: env.NODE_ENV,
    health: '/api/health',
    projects: '/api/projects',
    systemStatus: '/api/system/status',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'API is available',
    appName: env.APP_NAME,
    endpoints: {
      health: '/api/health',
        projects: '/api/projects',
      systemStatus: '/api/system/status'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  const database = getDatabaseState();
  const httpStatus = database.connected ? 200 : 503;

  res.status(httpStatus).json({
    ok: database.connected,
    appName: env.APP_NAME,
    publicAccess: true,
    androidBuildsEnabled: env.ENABLE_ANDROID_BUILDS,
    timestamp: new Date().toISOString(),
    database
  });
});

app.use('/api/system', systemRoutes);
app.use('/api/projects', (req, res, next) => {
  const database = getDatabaseState();
  if (!database.connected) {
    return res.status(503).json({
      message: 'Database is unavailable. Check MONGODB_URI and MongoDB network access, then retry.',
      requestId: req.requestId,
      database
    });
  }
  return next();
}, projectRoutes);

app.use('/downloads', express.static(storageAbsolute, { index: false, dotfiles: 'deny', fallthrough: false }));

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Route not found', path: req.originalUrl, method: req.method, requestId: req.requestId });
});

app.use((error, req, res, _next) => {
  console.error('Unhandled error', { requestId: req.requestId, message: error.message, stack: error.stack });
  res.status(500).json({ ok: false, message: error.message || 'Unexpected server error.', requestId: req.requestId });
});

async function start() {
  await ensureStorageDirs();
  await connectDatabase();
  app.listen(env.PORT, host, () => {
    console.log(`${env.APP_NAME} backend listening on http://${host}:${env.PORT}`);
  });
}

start().catch((error) => {
  console.error('Startup failed', error);
  process.exit(1);
});
