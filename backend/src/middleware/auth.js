import User from '../models/User.js';
import { verifyAuthToken } from '../utils/auth.js';

export async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyAuthToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const user = await User.findById(payload.sub).lean();
  if (!user) {
    return res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' });
  }

  req.auth = {
    userId: String(user._id),
    email: user.email,
    name: user.name
  };
  next();
}
