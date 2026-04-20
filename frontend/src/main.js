import './styles.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000/api').replace(/\/$/, '');

const state = {
  projects: [],
  system: null,
  loading: true,
  message: '',
  error: ''
};

const app = document.querySelector('#app');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setNotice(message = '', type = 'info') {
  state.message = message;
  state.error = type === 'error' ? message : '';
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`Could not connect to ${url}. ${error.message}`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed with HTTP ${response.status}.`);
  }
  return data;
}

async function downloadArtifact(projectId, artifactKey, suggestedName) {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/download/${artifactKey}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Download failed.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function badge(text, tone = '') {
  return `<span class="pill ${tone}">${escapeHtml(text)}</span>`;
}

function statusTone(value) {
  if (value === 'built' || value === 'validated') return 'ok';
  if (value === 'failed' || value === 'invalid') return 'bad';
  if (value === 'building') return 'warn';
  return '';
}

function scoreTone(score) {
  if (score >= 80) return 'ok';
  if (score >= 50) return 'warn';
  return 'bad';
}

function selectedOptions(name) {
  return Array.from(document.querySelector(`[name="${name}"]`)?.selectedOptions || []).map((option) => option.value);
}

function artifactButtons(project) {
  const files = [
    ['apkRelativePath', 'app-release.apk'],
    ['aabRelativePath', 'app-release.aab'],
    ['projectZipRelativePath', 'project-export.zip'],
    ['iosHandoffZipRelativePath', 'ios-handoff.zip'],
    ['reviewPackRelativePath', 'store-review-pack.json'],
    ['buildLogRelativePath', 'build.log'],
    ['uploadedZipRelativePath', 'uploaded-source.zip']
  ].filter(([key]) => project.artifacts?.[key]);

  if (!files.length) return '<p class="muted">No downloadable artifacts yet.</p>';

  return `
    <div class="artifact-grid">
      ${files
        .map(
          ([key, label]) =>
            `<button class="button tiny secondary download-btn" data-project-id="${project._id}" data-artifact-key="${key}" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`
        )
        .join('')}
    </div>
  `;
}

function notesList(notes = []) {
  if (!Array.isArray(notes) || !notes.length) return '<p class="muted">No validation notes yet.</p>';
  return `<ul class="note-list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`;
}

function statCard(label, value, detail = '', tone = '') {
  return `
    <article class="stat-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
    </article>
  `;
}

function projectCard(project) {
  const validation = project.validation || {};
  const score = Number(validation.installableScore || 0);
  const platforms = Array.isArray(project.requestedPlatforms) && project.requestedPlatforms.length ? project.requestedPlatforms.join(', ') : 'android';

  return `
    <article class="project-card">
      <div class="project-head">
        <div>
          <div class="project-kicker">${project.sourceType === 'url' ? 'Hosted site project' : 'Uploaded ZIP project'}</div>
          <h3>${escapeHtml(project.appName)}</h3>
          <p class="muted project-subtext">${project.sourceType === 'url' ? escapeHtml(project.siteUrl || 'Hosted URL') : `Uploaded ZIP: ${escapeHtml(project.uploadOriginalName || 'project.zip')}`}</p>
          <p class="muted">Package ID: ${escapeHtml(project.packageId || '')}</p>
        </div>
        <div class="status-chip ${statusTone(project.status)}">${escapeHtml(project.status || 'draft')}</div>
      </div>

      <div class="score-band ${scoreTone(score)}">
        <span>Validation score</span>
        <strong>${score}%</strong>
      </div>

      <div class="meta-row wrap">
        ${badge(`Platforms: ${platforms}`)}
        ${badge(`Manifest ${validation.manifestFound ? 'found' : 'missing'}`, validation.manifestFound ? 'ok' : 'bad')}
        ${badge(`Service worker ${validation.serviceWorkerDetected ? 'detected' : 'missing'}`, validation.serviceWorkerDetected ? 'ok' : 'bad')}
        ${badge(`Icons ${validation.hasAnyIcon ? 'ready' : 'missing'}`, validation.hasAnyIcon ? 'ok' : 'bad')}
        ${badge(`Android ${validation.buildReady ? 'ready' : 'needs fixes'}`, validation.buildReady ? 'ok' : 'warn')}
        ${badge(`iOS ${validation.iosReady ? 'handoff ready' : 'needs review'}`, validation.iosReady ? 'ok' : 'warn')}
      </div>

      <div class="project-body-grid">
        <div>
          <h4>Validation notes</h4>
          ${notesList(validation.notes)}
        </div>
        <div class="mini-panel">
          <h4>Output summary</h4>
          <div class="summary-list">
            <div><span>Status</span><strong>${escapeHtml(project.status || '-')}</strong></div>
            <div><span>Android</span><strong>${validation.buildReady ? 'Ready' : 'Needs fixes'}</strong></div>
            <div><span>iOS</span><strong>${validation.iosReady ? 'Handoff ready' : 'Needs review'}</strong></div>
          </div>
        </div>
      </div>

      ${project.lastBuildError ? `<div class="error-box">${escapeHtml(project.lastBuildError)}</div>` : ''}

      <div class="actions-row wrap">
        <button class="button primary build-btn" data-id="${project._id}">Generate build/export</button>
        <button class="button secondary refresh-project-btn" data-id="${project._id}">Refresh details</button>
      </div>

      <div class="artifact-section">
        <h4>Artifacts</h4>
        ${artifactButtons(project)}
      </div>
    </article>
  `;
}

function appView() {
  const system = state.system || {};
  const database = system.database || {};
  const noticeHtml = state.error
    ? `<div class="notice error">${escapeHtml(state.error)}</div>`
    : state.message
      ? `<div class="notice info">${escapeHtml(state.message)}</div>`
      : '';

  return `
    <div class="marketing-shell">
      <section class="shell app-shell">
        <header class="marketing-topbar panel compact-panel">
          <div class="brand-lockup">
            <div class="brand-mark">LB</div>
            <div>
              <div class="brand-title">Life Builder</div>
              <div class="brand-subtitle">Simple website-to-app export workspace</div>
            </div>
          </div>
          <div class="trust-copy">No signup. No login. Submit a hosted link or ZIP and generate Android and iOS export files.</div>
        </header>

        ${noticeHtml}

        <section class="landing-grid section-gap">
          <div class="hero-card hero-surface">
            <div class="eyebrow">Professional app conversion platform</div>
            <h1>Turn your website or source ZIP into real mobile app delivery files.</h1>
            <p class="lead">Life Builder checks installability, prepares Android export packages, creates iOS handoff files, and keeps each submission in one clean workspace.</p>
            <div class="hero-tags">
              ${badge('Simple public workspace')}
              ${badge('Hosted URL validation')}
              ${badge('ZIP upload validation')}
              ${badge('Android and iOS outputs')}
            </div>
            <div class="showcase-grid section-gap-small">
              ${statCard('Projects', String(state.projects.length), 'Recent submissions on this workspace')}
              ${statCard('Android builds', system.androidBuildsEnabled ? 'Enabled' : 'Export mode', system.androidBuildsEnabled ? 'Bubblewrap runtime available' : 'Exports and review packs only', system.androidBuildsEnabled ? 'ok' : 'warn')}
              ${statCard('Database', database.connected ? 'Connected' : 'Offline', database.connected ? 'Ready for submissions' : (database.lastError || 'Check MONGODB_URI'), database.connected ? 'ok' : 'bad')}
            </div>
          </div>

          <div class="panel stack side-panel">
            <div>
              <div class="eyebrow">How it works</div>
              <h2>Three clear steps</h2>
            </div>
            <div class="timeline-list">
              <div class="timeline-item"><strong>1. Submit</strong><span>Paste a hosted link or upload your project ZIP.</span></div>
              <div class="timeline-item"><strong>2. Validate</strong><span>Check manifest, icons, service worker, and app-store readiness signals.</span></div>
              <div class="timeline-item"><strong>3. Export</strong><span>Generate Android export files, iOS handoff bundles, and review packs.</span></div>
            </div>
          </div>
        </section>

        <section class="submission-grid section-gap">
          <form id="urlForm" class="panel stack">
            <div>
              <div class="eyebrow">Hosted URL</div>
              <h2>Submit a live site</h2>
              <p class="muted">Best for deployed PWAs and live web apps.</p>
            </div>
            <label><span>Site URL</span><input name="siteUrl" type="url" placeholder="https://your-app.onrender.com" required /></label>
            <label><span>App name</span><input name="appName" type="text" placeholder="My App" required /></label>
            <label><span>Launcher name</span><input name="launcherName" type="text" placeholder="My App" required /></label>
            <label><span>Package ID</span><input name="packageId" type="text" placeholder="com.company.myapp" /></label>
            <label><span>Platforms</span>
              <select name="requestedPlatforms" multiple>
                <option value="android" selected>Android</option>
                <option value="ios" selected>iOS</option>
              </select>
            </label>
            <button class="button primary" type="submit">Validate and create project</button>
          </form>

          <form id="uploadForm" class="panel stack" enctype="multipart/form-data">
            <div>
              <div class="eyebrow">Project ZIP</div>
              <h2>Upload source files</h2>
              <p class="muted">Best for source packages that are not hosted yet.</p>
            </div>
            <label><span>Project ZIP</span><input name="projectZip" type="file" accept=".zip" required /></label>
            <label><span>App name</span><input name="appName" type="text" placeholder="My App" required /></label>
            <label><span>Launcher name</span><input name="launcherName" type="text" placeholder="My App" required /></label>
            <label><span>Package ID</span><input name="packageId" type="text" placeholder="com.company.myapp" /></label>
            <label><span>Platforms</span>
              <select name="requestedPlatforms" multiple>
                <option value="android" selected>Android</option>
                <option value="ios" selected>iOS</option>
              </select>
            </label>
            <button class="button primary" type="submit">Upload and create project</button>
          </form>
        </section>

        <section class="panel section-gap">
          <div class="section-head">
            <div>
              <div class="eyebrow">Workspace projects</div>
              <h2>Recent submissions</h2>
            </div>
            <button class="button secondary" id="refreshProjectsBtn">Refresh list</button>
          </div>
          <div id="projectsWrap" class="stack project-stack">
            ${state.loading ? '<p class="muted">Loading projects...</p>' : state.projects.length ? state.projects.map(projectCard).join('') : '<p class="muted">No projects yet. Submit a hosted link or ZIP above.</p>'}
          </div>
        </section>
      </section>
    </div>
  `;
}

function setBusy(target, isBusy, label = 'Please wait...') {
  if (!target) return;
  if (isBusy) {
    target.dataset.originalText = target.textContent;
    target.disabled = true;
    target.textContent = label;
  } else {
    target.disabled = false;
    target.textContent = target.dataset.originalText || target.textContent;
  }
}

async function refreshProjects() {
  const data = await fetchJson(`${API_BASE_URL}/projects`);
  state.projects = Array.isArray(data.projects) ? data.projects : [];
}

async function refreshSystem() {
  state.system = await fetchJson(`${API_BASE_URL}/system/status`);
}

async function refreshProject(projectId) {
  const data = await fetchJson(`${API_BASE_URL}/projects/${projectId}`);
  const incoming = data.project;
  const index = state.projects.findIndex((item) => item._id === incoming._id);
  if (index >= 0) state.projects[index] = incoming;
  else state.projects.unshift(incoming);
}

function bindAppEvents() {
  document.querySelector('#refreshProjectsBtn')?.addEventListener('click', async () => {
    try {
      setNotice('Refreshing project list...');
      render();
      await refreshProjects();
      setNotice('Project list updated.');
      render();
    } catch (error) {
      setNotice(error.message, 'error');
      render();
    }
  });

  document.querySelector('#urlForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Submitting...');
    try {
      const body = {
        siteUrl: form.siteUrl.value.trim(),
        appName: form.appName.value.trim(),
        launcherName: form.launcherName.value.trim(),
        packageId: form.packageId.value.trim(),
        requestedPlatforms: selectedOptions('requestedPlatforms')
      };
      const data = await fetchJson(`${API_BASE_URL}/projects/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      state.projects.unshift(data.project);
      form.reset();
      setNotice('Hosted site project created successfully.');
      render();
    } catch (error) {
      setNotice(error.message, 'error');
      render();
    } finally {
      setBusy(button, false);
    }
  });

  document.querySelector('#uploadForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Uploading...');
    try {
      const dataForm = new FormData(form);
      dataForm.delete('requestedPlatforms');
      Array.from(form.requestedPlatforms.selectedOptions).forEach((option) => {
        dataForm.append('requestedPlatforms', option.value);
      });
      const data = await fetchJson(`${API_BASE_URL}/projects/upload`, {
        method: 'POST',
        body: dataForm
      });
      state.projects.unshift(data.project);
      form.reset();
      setNotice('ZIP project created successfully.');
      render();
    } catch (error) {
      setNotice(error.message, 'error');
      render();
    } finally {
      setBusy(button, false);
    }
  });

  document.querySelectorAll('.build-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const projectId = button.dataset.id;
      setBusy(button, true, 'Generating...');
      try {
        await fetchJson(`${API_BASE_URL}/projects/${projectId}/build`, { method: 'POST' });
        await refreshProject(projectId);
        setNotice('Build/export completed.');
        render();
      } catch (error) {
        setNotice(error.message, 'error');
        render();
      } finally {
        setBusy(button, false);
      }
    });
  });

  document.querySelectorAll('.refresh-project-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const projectId = button.dataset.id;
      setBusy(button, true, 'Refreshing...');
      try {
        await refreshProject(projectId);
        setNotice('Project details refreshed.');
        render();
      } catch (error) {
        setNotice(error.message, 'error');
        render();
      } finally {
        setBusy(button, false);
      }
    });
  });

  document.querySelectorAll('.download-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const projectId = button.dataset.projectId;
      const artifactKey = button.dataset.artifactKey;
      const label = button.dataset.label;
      setBusy(button, true, 'Downloading...');
      try {
        await downloadArtifact(projectId, artifactKey, label);
        setNotice(`Download started for ${label}.`);
        render();
      } catch (error) {
        setNotice(error.message, 'error');
        render();
      } finally {
        setBusy(button, false);
      }
    });
  });
}

function render() {
  if (!app) {
    throw new Error('Root element #app was not found.');
  }
  app.innerHTML = appView();
  bindAppEvents();
}

async function init() {
  render();
  try {
    await Promise.all([refreshSystem(), refreshProjects()]);
    state.loading = false;
    if (!state.system?.database?.connected) {
      setNotice(state.system?.database?.lastError || 'Database is offline. The page still loads, but submissions will fail until MongoDB is connected.', 'error');
    } else {
      setNotice('Life Builder is ready.');
    }
  } catch (error) {
    state.loading = false;
    setNotice(error.message, 'error');
  }
  render();
}

window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
  setNotice(event.error?.message || event.message || 'Unexpected frontend error.', 'error');
  render();
});

init();
