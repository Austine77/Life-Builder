import fs from 'fs/promises';
import unzipper from 'unzipper';
import { normalizeSiteUrl, isHttpsUrl, isRenderHostedUrl } from '../utils/url.js';

function resolveUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return '';
  }
}

function findManifestHref(html) {
  const manifestMatch = html.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i);
  return manifestMatch?.[1] || '';
}

function detectServiceWorker(html) {
  return /navigator\.serviceWorker|serviceWorker\.register|workbox/i.test(html);
}

function detectHtmlIconReferences(html) {
  return [...html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)].length > 0;
}

function scoreValidation(result) {
  const checks = [
    result.reachable,
    result.https,
    result.renderHosted,
    result.manifestFound,
    result.serviceWorkerDetected,
    result.hasAnyIcon,
    result.hasMaskableIcon,
    result.iosReady,
    result.appStoreReady
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

function pushUnique(notes, message) {
  if (!notes.includes(message)) notes.push(message);
}

async function inspectManifestText(result, notes, manifestText) {
  try {
    const manifest = JSON.parse(manifestText);
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    result.hasAnyIcon = result.hasAnyIcon || icons.length > 0;
    result.hasMaskableIcon = icons.some((icon) => String(icon.purpose || '').includes('maskable'));

    if (manifest.start_url) pushUnique(notes, `Manifest start_url detected: ${manifest.start_url}`);
    else pushUnique(notes, 'Manifest should include start_url.');

    if (manifest.display && ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
      pushUnique(notes, `Manifest display mode is ${manifest.display}.`);
    } else {
      pushUnique(notes, 'Manifest display should be standalone, fullscreen, or minimal-ui.');
    }

    if (!manifest.name && !manifest.short_name) {
      pushUnique(notes, 'Manifest should include name or short_name.');
    }

    result.iosReady = Boolean(manifest.name || manifest.short_name) && Boolean(result.hasAnyIcon);
    result.appStoreReady = result.iosReady && result.hasMaskableIcon;

    if (!result.hasMaskableIcon) {
      pushUnique(notes, 'Maskable icon not found in manifest. Recommended for Android quality.');
    }
  } catch (error) {
    pushUnique(notes, `Manifest validation failed: ${error.message}`);
  }
}

export async function validateHostedSite(siteUrl) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const notes = [];
  const result = {
    reachable: false,
    https: isHttpsUrl(normalizedSiteUrl),
    renderHosted: isRenderHostedUrl(normalizedSiteUrl),
    manifestFound: false,
    manifestUrl: '',
    serviceWorkerDetected: false,
    hasAnyIcon: false,
    hasMaskableIcon: false,
    iosReady: false,
    appStoreReady: false,
    installableScore: 0,
    notes,
    buildReady: false,
    finalUrl: normalizedSiteUrl,
    sourceSummary: 'Hosted URL'
  };

  if (!result.https) pushUnique(notes, 'Site must use HTTPS.');

  let response;
  try {
    response = await fetch(normalizedSiteUrl, {
      redirect: 'follow',
      headers: { 'user-agent': 'SP-Builder/2026 (+validation)' },
      signal: AbortSignal.timeout(20_000)
    });
  } catch (error) {
    pushUnique(notes, `Site request failed: ${error.message}`);
    result.installableScore = scoreValidation(result);
    return { normalizedSiteUrl, validation: result };
  }

  result.finalUrl = response.url || normalizedSiteUrl;
  result.renderHosted = isRenderHostedUrl(result.finalUrl);

  if (!result.renderHosted) pushUnique(notes, 'This hosted URL is reachable but is not ending in onrender.com.');
  if (!response.ok) {
    pushUnique(notes, `Site could not be reached successfully. HTTP ${response.status}.`);
    result.installableScore = scoreValidation(result);
    return { normalizedSiteUrl, validation: result };
  }

  result.reachable = true;
  const html = await response.text();
  const manifestHref = findManifestHref(html);
  result.serviceWorkerDetected = detectServiceWorker(html);
  result.hasAnyIcon = detectHtmlIconReferences(html);

  if (manifestHref) {
    result.manifestFound = true;
    result.manifestUrl = resolveUrl(result.finalUrl, manifestHref);
    pushUnique(notes, 'Manifest link found in HTML.');
  } else {
    pushUnique(notes, 'Manifest link missing from HTML. Add <link rel="manifest" href="/manifest.webmanifest">.');
  }

  pushUnique(notes, result.serviceWorkerDetected ? 'Service worker registration signal detected.' : 'No service worker registration signal found in the page source.');
  pushUnique(notes, result.hasAnyIcon ? 'At least one icon reference was found in HTML.' : 'No icon reference was found in HTML.');

  if (result.manifestUrl) {
    try {
      const manifestResponse = await fetch(result.manifestUrl, {
        redirect: 'follow',
        headers: { 'user-agent': 'SP-Builder/2026 (+manifest-check)' },
        signal: AbortSignal.timeout(20_000)
      });
      if (manifestResponse.ok) {
        await inspectManifestText(result, notes, await manifestResponse.text());
      } else {
        pushUnique(notes, `Manifest could not be fetched successfully. HTTP ${manifestResponse.status}.`);
      }
    } catch (error) {
      pushUnique(notes, `Manifest validation failed: ${error.message}`);
    }
  }

  result.installableScore = scoreValidation(result);
  result.buildReady = Boolean(result.reachable && result.https && result.manifestFound && result.serviceWorkerDetected && result.hasAnyIcon);
  pushUnique(notes, result.buildReady ? 'This project passed the core checks for Android packaging.' : 'This project needs one or more fixes before Android packaging should be attempted.');
  if (!result.iosReady) pushUnique(notes, 'iOS wrapper export can still be prepared, but final App Store submission will still require Xcode on macOS and an Apple Developer account.');

  return { normalizedSiteUrl, validation: result };
}

export async function validateUploadedProjectZip(zipPath) {
  const notes = [];
  const result = {
    reachable: true,
    https: false,
    renderHosted: false,
    manifestFound: false,
    manifestUrl: '',
    serviceWorkerDetected: false,
    hasAnyIcon: false,
    hasMaskableIcon: false,
    iosReady: false,
    appStoreReady: false,
    installableScore: 0,
    notes,
    buildReady: false,
    finalUrl: '',
    sourceSummary: 'Uploaded project ZIP'
  };

  const directory = await unzipper.Open.file(zipPath);
  const files = directory.files.map((file) => file.path);
  const htmlEntry = directory.files.find((file) => /(^|\/)index\.html?$/i.test(file.path));
  const manifestEntry = directory.files.find((file) => /(manifest\.webmanifest|manifest\.json)$/i.test(file.path));
  const swEntry = directory.files.find((file) => /(service-worker|sw)\.(js|ts)$/i.test(file.path));

  if (!htmlEntry) pushUnique(notes, 'ZIP is missing index.html or a main HTML entry file.');
  else pushUnique(notes, `HTML entry found: ${htmlEntry.path}`);

  if (manifestEntry) {
    result.manifestFound = true;
    result.manifestUrl = manifestEntry.path;
    pushUnique(notes, `Manifest found in ZIP: ${manifestEntry.path}`);
    const manifestText = await manifestEntry.buffer().then((buffer) => buffer.toString('utf8'));
    await inspectManifestText(result, notes, manifestText);
  } else {
    pushUnique(notes, 'Manifest file not found in ZIP.');
  }

  if (swEntry) {
    result.serviceWorkerDetected = true;
    pushUnique(notes, `Service worker file found: ${swEntry.path}`);
  }

  const iconEntries = files.filter((file) => /(icon|favicon|apple-touch-icon).+\.(png|jpg|jpeg|webp|svg)$/i.test(file));
  result.hasAnyIcon = iconEntries.length > 0;
  if (iconEntries.length) {
    pushUnique(notes, `${iconEntries.length} icon file(s) found in ZIP.`);
  } else {
    pushUnique(notes, 'No icon files were found in the ZIP.');
  }

  if (htmlEntry) {
    const html = await htmlEntry.buffer().then((buffer) => buffer.toString('utf8'));
    result.serviceWorkerDetected = result.serviceWorkerDetected || detectServiceWorker(html);
    result.hasAnyIcon = result.hasAnyIcon || detectHtmlIconReferences(html);
  }

  result.iosReady = result.manifestFound && result.hasAnyIcon;
  result.appStoreReady = result.iosReady;
  result.buildReady = result.manifestFound && result.serviceWorkerDetected && result.hasAnyIcon;
  result.installableScore = scoreValidation(result);

  pushUnique(notes, result.buildReady ? 'ZIP project passed the core checks for Android wrapper preparation.' : 'ZIP project needs a manifest, icons, and service worker before production packaging.');
  pushUnique(notes, 'For iOS, SP Builder can prepare an export package and review pack, but final IPA signing and App Store submission still require Xcode on macOS.');

  return { normalizedSiteUrl: '', validation: result };
}

export async function saveUploadedZip(filePath) {
  const stats = await fs.stat(filePath);
  return { size: stats.size };
}
