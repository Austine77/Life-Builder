import User from '../models/User.js';
import { createAuthToken, hashPassword, normalizeEmail, verifyPassword } from '../utils/auth.js';

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    company: user.company || '',
    role: user.role || 'developer'
  };
}

export async function register(req, res) {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');
  const company = String(req.body?.company || '').trim();

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const exists = await User.findOne({ email }).lean();
  if (exists) {
    return res.status(409).json({ message: 'An account already exists for that email.' });
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, company, passwordHash });
  const token = createAuthToken({ sub: user._id, name: user.name, email: user.email });

  return res.status(201).json({ token, user: publicUser(user) });
}

export async function login(req, res) {
  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = createAuthToken({ sub: user._id, name: user.name, email: user.email });
  return res.json({ token, user: publicUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.auth.userId).lean();
  return res.json({ user: publicUser(user) });
}
