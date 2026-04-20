import { getSystemStatus } from '../services/system.service.js';

export async function systemStatus(_req, res) {
  const status = await getSystemStatus();
  return res.json(status);
}
