import mongoose from 'mongoose';
import { env } from '../config/env.js';

const dbState = {
  connected: false,
  lastError: '',
  lastAttemptAt: null
};

function updateConnectedState() {
  dbState.connected = mongoose.connection.readyState === 1;
  if (dbState.connected) {
    dbState.lastError = '';
  }
}

mongoose.connection.on('connected', () => {
  updateConnectedState();
  console.log('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  updateConnectedState();
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  dbState.lastError = error.message;
  updateConnectedState();
  console.error('MongoDB connection error:', error.message);
});

export function getDatabaseState() {
  updateConnectedState();
  return { ...dbState, readyState: mongoose.connection.readyState };
}

export async function connectDatabase() {
  if (!env.MONGODB_URI) {
    dbState.connected = false;
    dbState.lastError = 'MONGODB_URI is required.';
    dbState.lastAttemptAt = new Date().toISOString();
    console.error(dbState.lastError);
    return getDatabaseState();
  }

  dbState.lastAttemptAt = new Date().toISOString();

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: true
    });
    updateConnectedState();
  } catch (error) {
    dbState.connected = false;
    dbState.lastError = error.message;
    console.error('Initial MongoDB connection failed:', error.message);
  }

  return getDatabaseState();
}
