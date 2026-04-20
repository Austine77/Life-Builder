export function normalizeSiteUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function isHttpsUrl(rawUrl) {
  try {
    return new URL(rawUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isRenderHostedUrl(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname === 'onrender.com' || hostname.endsWith('.onrender.com');
  } catch {
    return false;
  }
}
