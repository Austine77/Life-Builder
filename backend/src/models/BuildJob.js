import mongoose from 'mongoose';

const buildJobSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued'
    },
    strategy: { type: String, default: 'bubblewrap' },
    platforms: { type: [String], default: ['android'] },
    logs: { type: [String], default: [] },
    startedAt: Date,
    finishedAt: Date,
    errorMessage: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('BuildJob', buildJobSchema);
