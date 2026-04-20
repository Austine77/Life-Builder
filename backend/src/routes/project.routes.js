import { Router } from 'express';
import {
  createProjectFromUpload,
  createProjectFromUrl,
  getProject,
  listProjects,
  startBuild,
  uploadZipMiddleware,
  downloadProjectArtifact
} from '../controllers/project.controller.js';

const router = Router();

router.get('/', listProjects);
router.post('/url', createProjectFromUrl);
router.post('/upload', uploadZipMiddleware(), createProjectFromUpload);
router.get('/:projectId', getProject);
router.get('/:projectId/download/:artifactKey', downloadProjectArtifact);
router.post('/:projectId/build', startBuild);

export default router;
