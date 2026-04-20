# Life Builder

Life Builder is a full-stack developer platform for validating hosted PWAs or uploaded project ZIP files and preparing delivery outputs for Android and iOS publishing workflows.

## What this upgraded version does

- Developer account registration and sign-in
- Private project workspace per user
- Submit a hosted site URL or upload a project ZIP
- Validate manifest, icons, service worker, installability, and store-readiness signals
- Track requested platforms: Android and/or iOS
- Generate Android build/export flow for hosted PWAs when Bubblewrap tooling is enabled
- Generate project export ZIP, store review pack, build log, and iOS handoff ZIP for submission workflows

## Important truth about iOS

This project now supports **real iOS handoff preparation**, but it does **not** magically bypass Apple's requirements.
Final iOS signing, archiving, and App Store submission still require:

- macOS
- Xcode
- an Apple Developer account

## Local development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Key backend env values

- `MONGODB_URI` - MongoDB connection string
- `AUTH_SECRET` - secret used for signing auth tokens
- `FRONTEND_ORIGIN` - allowed frontend origin(s)
- `ENABLE_ANDROID_BUILDS=true` - allows hosted URL Android Bubblewrap builds
- `MAX_UPLOAD_MB` - max ZIP upload size

## Render deployment

Use the root `render.yaml` blueprint after pushing the repo to GitHub.

- `frontend` deploys as a static site.
- `backend` deploys as a Docker web service.
- Set `MONGODB_URI`, `AUTH_SECRET`, and `FRONTEND_ORIGIN` in the backend service.
- Set `VITE_API_BASE_URL` in the frontend service to your backend URL plus `/api`.

## Android build note

Automatic APK/AAB generation only happens when all of these are true:

- the submission source is a hosted PWA URL
- Bubblewrap is installed on the backend runtime
- Java and Android tooling are available
- `ENABLE_ANDROID_BUILDS=true`

If those are not available, Life Builder still generates the project export and review artifacts.
