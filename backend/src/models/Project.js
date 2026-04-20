import mongoose from 'mongoose';

const validationSchema = new mongoose.Schema(
  {
    reachable: { type: Boolean, default: false },
    https: { type: Boolean, default: false },
    renderHosted: { type: Boolean, default: false },
    manifestFound: { type: Boolean, default: false },
    manifestUrl: { type: String, default: '' },
    serviceWorkerDetected: { type: Boolean, default: false },
    hasAnyIcon: { type: Boolean, default: false },
    hasMaskableIcon: { type: Boolean, default: false },
    iosReady: { type: Boolean, default: false },
    appStoreReady: { type: Boolean, default: false },
    installableScore: { type: Number, default: 0 },
    notes: { type: [String], default: [] },
    buildReady: { type: Boolean, default: false },
    finalUrl: { type: String, default: '' },
    sourceSummary: { type: String, default: '' }
  },
  { _id: false }
);

const artifactSchema = new mongoose.Schema(
  {
    apkRelativePath: { type: String, default: '' },
    aabRelativePath: { type: String, default: '' },
    projectZipRelativePath: { type: String, default: '' },
    androidProjectRelativePath: { type: String, default: '' },
    iosHandoffZipRelativePath: { type: String, default: '' },
    reviewPackRelativePath: { type: String, default: '' },
    buildLogRelativePath: { type: String, default: '' },
    uploadedZipRelativePath: { type: String, default: '' },
    builtAt: Date
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    siteUrl: { type: String, default: '' },
    normalizedSiteUrl: { type: String, default: '', index: true },
    appName: { type: String, required: true },
    launcherName: { type: String, required: true },
    packageId: { type: String, required: true, unique: true },
    sourceType: { type: String, enum: ['url', 'zip'], required: true },
    requestedPlatforms: { type: [String], default: ['android'], enum: ['android', 'ios'] },
    status: {
      type: String,
      enum: ['validated', 'invalid', 'building', 'built', 'failed'],
      default: 'invalid'
    },
    uploadOriginalName: { type: String, default: '' },
    validation: { type: validationSchema, default: () => ({}) },
    artifacts: { type: artifactSchema, default: () => ({}) },
    lastBuildError: { type: String, default: '' }
  },
  { timestamps: true }
);

projectSchema.index({ updatedAt: -1 });

export default mongoose.model('Project', projectSchema);
