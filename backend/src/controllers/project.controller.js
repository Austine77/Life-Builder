import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import Project from '../models/Project.js';
import BuildJob from '../models/BuildJob.js';
import { validateHostedSite, validateUploadedProjectZip } from '../services/validation.service.js';
import { buildProjectArtifacts, createPackageId } from '../services/builder.service.js';
import { env } from '../config/env.js';
import { sanitizeName, isValidPackageId } from '../utils/project.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.join(env.STORAGE_DIR, 'uploads', 'incoming');
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    }
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.zip$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only ZIP uploads are supported.'));
  }
});


const ALLOWED_ARTIFACT_KEYS = new Set([
  'apkRelativePath',
  'aabRelativePath',
  'projectZipRelativePath',
  'androidProjectRelativePath',
  'iosHandoffZipRelativePath',
  'reviewPackRelativePath',
  'buildLogRelativePath',
  'uploadedZipRelativePath'
]);

function requestedPlatformsFrom(raw) {
  const source = Array.isArray(raw) ? raw : String(raw || '').split(',');
  const values = source.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  const allowed = values.filter((value) => ['android', 'ios'].includes(value));
  return allowed.length ? [...new Set(allowed)] : ['android'];
}

async function validateCommonAndCreateProject({ req, res, sourceType, validationResult, siteUrl = '', uploadInfo = null }) {
  const raw = req.body || {};
  const appName = sanitizeName(raw.appName);
  const launcherName = sanitizeName(raw.launcherName, appName);
  const providedPackageId = String(raw.packageId || '').trim();
  const requestedPlatforms = requestedPlatformsFrom(raw.requestedPlatforms || ['android']);

  if (!appName) return res.status(400).json({ message: 'App name is required.' });
  if (appName.length > env.MAX_APP_NAME_LENGTH) return res.status(400).json({ message: `App name must be ${env.MAX_APP_NAME_LENGTH} characters or less.` });
  if (launcherName.length > env.MAX_LAUNCHER_NAME_LENGTH) return res.status(400).json({ message: `Launcher name must be ${env.MAX_LAUNCHER_NAME_LENGTH} characters or less.` });

  const projectCount = await Project.countDocuments({});
  if (projectCount >= env.MAX_PROJECTS) return res.status(503).json({ message: 'Project capacity reached on this server.' });

  const finalPackageId = providedPackageId || createPackageId(appName);
  if (!isValidPackageId(finalPackageId)) {
    return res.status(400).json({ message: 'Package ID must look like com.company.appname using lowercase letters, numbers, underscores, and dots.' });
  }

  const existingPackageId = await Project.findOne({ packageId: finalPackageId }).lean();
  if (existingPackageId) return res.status(409).json({ message: 'Package ID already exists. Use a different app name or package ID.' });

  const { normalizedSiteUrl, validation } = validationResult;
  if (normalizedSiteUrl) {
    const existingSite = await Project.findOne({ normalizedSiteUrl }).lean();
    if (existingSite) return res.status(409).json({ message: 'This hosted site has already been submitted on this server.' });
  }

  const status = validation.buildReady ? 'validated' : 'invalid';
  const project = await Project.create({
    siteUrl,
    normalizedSiteUrl,
    appName,
    launcherName,
    packageId: finalPackageId,
    sourceType,
    requestedPlatforms,
    uploadOriginalName: uploadInfo?.originalname || '',
    validation,
    artifacts: {
      uploadedZipRelativePath: uploadInfo?.relativePath || ''
    },
    status
  });

  return res.status(201).json({ project });
}

export function uploadZipMiddleware() {
  return upload.single('projectZip');
}

export async function listProjects(req, res) {
  const projects = await Project.find({}).sort({ updatedAt: -1 }).limit(env.MAX_PROJECTS).lean();
  return res.json({ projects });
}

export async function createProjectFromUrl(req, res) {
  const siteUrl = String(req.body?.siteUrl || '').trim();
  if (!siteUrl) return res.status(400).json({ message: 'Site URL is required.' });

  const validationResult = await validateHostedSite(siteUrl);
  return validateCommonAndCreateProject({ req, res, sourceType: 'url', validationResult, siteUrl });
}

export async function createProjectFromUpload(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Project ZIP is required.' });

  const validationResult = await validateUploadedProjectZip(req.file.path);
  const tempRelative = path.relative(env.STORAGE_DIR, req.file.path).replaceAll(path.sep, '/');

  return validateCommonAndCreateProject({
    req,
    res,
    sourceType: 'zip',
    validationResult,
    uploadInfo: {
      originalname: req.file.originalname,
      relativePath: tempRelative
    }
  });
}

export async function getProject(req, res) {
  const project = await Project.findById(req.params.projectId).lean();
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const buildJobs = await BuildJob.find({ projectId: project._id }).sort({ createdAt: -1 }).lean();
  return res.json({ project, buildJobs });
}

export async function startBuild(req, res) {
  const project = await Project.findById(req.params.projectId).lean();
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  if (!project.validation?.buildReady && !project.requestedPlatforms?.includes('ios')) {
    return res.status(400).json({ message: 'This project is not ready for packaging yet.' });
  }

  try {
    const result = await buildProjectArtifacts(project._id);
    return res.json({ message: 'Build completed.', project: result.project, job: result.job });
  } catch (error) {
    return res.status(500).json({ message: `Build failed: ${error.message}` });
  }
}


export async function downloadProjectArtifact(req, res) {
  const project = await Project.findById(req.params.projectId).lean();
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const artifactKey = String(req.params.artifactKey || '');
  if (!ALLOWED_ARTIFACT_KEYS.has(artifactKey)) {
    return res.status(400).json({ message: 'Unknown artifact requested.' });
  }

  const relativePath = project.artifacts?.[artifactKey];
  if (!relativePath) {
    return res.status(404).json({ message: 'Artifact not found for this project.' });
  }

  const absolutePath = path.join(env.STORAGE_DIR, relativePath);
  return res.download(absolutePath, path.basename(absolutePath));
}
