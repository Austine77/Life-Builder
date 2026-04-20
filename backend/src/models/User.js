import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    company: { type: String, default: '', trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'developer' }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
