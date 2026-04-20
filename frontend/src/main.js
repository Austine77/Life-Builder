import './styles.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000/api').replace(/\/$/, '');

const state = {
  projects: [],
  system: null
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

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`Network error while contacting ${url}. ${error.message}`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed with HTTP ${response.status}.`);
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
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function badge(text, tone = '') {
  return `<span class="pill ${tone}">${escapeHtml(text)}</span>`;
}

function notesList(notes = []) {
  return Array.isArray(notes) && notes.length
    ? `<ul class="note-list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
    : '<p class="muted">No validation notes yet.</p>';
}

function artifactButtons(project) {
  const entries = [
    ['apkRelativePath', 'app-release.apk'],
    ['aabRelativePath', 'app-release.aab'],
    ['projectZipRelativePath', 'project-export.zip'],
    ['iosHandoffZipRelativePath', 'ios-handoff.zip'],
    ['reviewPackRelativePath', 'store-review-pack.json'],
    ['buildLogRelativePath', 'build-log.txt'],
    ['uploadedZipRelativePath', 'uploaded-source.zip']
  ].filter(([key]) => project.artifacts?.[key]);

  if (!entries.length) return '<p class="muted">No artifacts generated yet.</p>';

  return `<div class="artifact-grid">${entries
    .map(([key, label]) => `<button class="button tiny secondary download-btn" data-project-id="${project._id}" data-artifact-key="${key}" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`)
    .join('')}</div>`;
}

function projectHealthTone(project) {
  const score = Number(project.validation?.installableScore || 0);
  if (score >= 80) return 'ok';
  if (score >= 50) return 'warn';
  return 'bad';
}

function projectCard(project) {
  const platforms = (project.requestedPlatforms || []).join(', ') || 'android';
  const score = Number(project.validation?.installableScore || 0);

  return `
    <article class="project-card">
      <div class="project-head">
        <div>
          <div class="project-kicker">${project.sourceType === 'url' ? 'Hosted site project' : 'Uploaded source project'}</div>
          <h3>${escapeHtml(project.appName)}</h3>
          <p class="muted project-subtext">${project.sourceType === 'url' ? escapeHtml(project.siteUrl || 'Hosted URL') : `Uploaded ZIP: ${escapeHtml(project.uploadOriginalName || 'project.zip')}`}</p>
          <p class="muted">Package ID: ${escapeHtml(project.packageId)}</p>
        </div>
        <div class="status-chip ${escapeHtml(project.status)}">${escapeHtml(project.status)}</div>
      </div>

      <div class="score-band ${projectHealthTone(project)}">
        <span>Validation score</span>
        <strong>${score}%</strong>
      </div>

      <div class="meta-row wrap">
        ${badge(`Source: ${project.sourceType.toUpperCase()}`)}
        ${badge(`Platforms: ${platforms}`)}
        ${badge(`Manifest ${project.validation?.manifestFound ? 'found' : 'missing'}`, project.validation?.manifestFound ? 'ok' : 'bad')}
        ${badge(`Service worker ${project.validation?.serviceWorkerDetected ? 'detected' : 'missing'}`, project.validation?.serviceWorkerDetected ? 'ok' : 'bad')}
        ${badge(`Icons ${project.validation?.hasAnyIcon ? 'ready' : 'missing'}`, project.validation?.hasAnyIcon ? 'ok' : 'bad')}
        ${badge(`Android ${project.validation?.buildReady ? 'ready' : 'not ready'}`, project.validation?.buildReady ? 'ok' : 'warn')}
        ${badge(`iOS ${project.validation?.iosReady ? 'handoff ready' : 'needs review'}`, project.validation?.iosReady ? 'ok' : 'warn')}
      </div>

      <div class="project-body-grid">
        <div>
          <h4>Validation notes</h4>
          ${notesList(project.validation?.notes)}
        </div>
        <div class="mini-panel">
          <h4>Output summary</h4>
          <div class="summary-list">
            <div><span>Status</span><strong>${escapeHtml(project.status)}</strong></div>
            <div><span>Android</span><strong>${project.validation?.buildReady ? 'Ready' : 'Needs fixes'}</strong></div>
            <div><span>iOS</span><strong>${project.validation?.iosReady ? 'Handoff ready' : 'Needs review'}</strong></div>
          </div>
        </div>
      </div>

      ${project.lastBuildError ? `<div class="error-box">${escapeHtml(project.lastBuildError)}</div>` : ''}

      <div class="actions-row">
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

function statCard(label, value, detail = '', tone = '') {
  return `
    <article class="stat-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
    </article>
  `;
}

function featureCard(title, text) {
  return `
    <article class="feature-card panel">
      <div class="feature-icon"></div>
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(text)}</p>
    </article>
  `;
}

function appView() {
  return `
    <div class="marketing-shell">
      <section class="shell app-shell">
        <div class="marketing-topbar">
          <div class="brand-lockup">
            <div class="brand-mark">SP</div>
            <div>
              <div class="brand-title">Life Builder</div>
              <div class="brand-subtitle">Simple app conversion workspace</div>
            </div>
          </div>
          <div class="trust-copy">No signup. No login. Paste a link or upload a ZIP and generate your export package.</div>
        </div>

        <section class="landing-grid">
          <div class="hero-card hero-surface">
            <div class="eyebrow">Fast app conversion flow</div>
            <h1>Turn your website or ZIP project into mobile app export packages.</h1>
            <p class="lead">Life Builder checks app readiness, prepares Android export artifacts, creates iOS handoff files, and keeps everything in one simple dashboard for your team.</p>
            <div class="hero-tags">
              ${badge('No signup needed')}
              ${badge('Hosted URL or ZIP upload')}
              ${badge('Android export workflow')}
              ${badge('iOS handoff workflow')}
            </div>
            <div class="showcase-grid">
              ${statCard('Submission modes', '2', 'Hosted URL and project ZIP')}
              ${statCard('Outputs', 'Android + iOS', 'Export and handoff packs')}
              ${statCard('Experience', 'Simple', 'Direct public workspace')}
            </div>
          </div>
          <div class="stack">
            ${featureCard('Submit a hosted URL', 'Validate a live PWA or website and prepare Android and iOS-ready export packages.')}
            ${featureCard('Upload a project ZIP', 'Send your packaged source files to check icons, manifest, service worker, and store readiness.')}
            ${featureCard('Generate deliverables', 'Download build logs, store review packs, exported project files, and iOS handoff bundles.')}
          </div>
        </section>

        <section class="dashboard-stats compact">
          ${statCard('Projects', String(state.projects.length), 'All recent submissions on this workspace')}
          ${statCard('Android builds', state.system?.androidBuildsEnabled ? 'Enabled' : 'Disabled', state.system?.androidBuildsEnabled ? 'Bubblewrap runtime available' : 'Exports only until enabled')}
          ${statCard('Database', state.system?.database?.connected ? 'Connected' : 'Offline', state.system?.database?.connected ? 'Ready for project records' : 'Check MongoDB connection', state.system?.database?.connected ? 'ok' : 'bad')}
        </section>

        <section class="submission-grid section-gap">
          <form id="urlForm" class="panel stack">
            <div>
              <div class="eyebrow">Hosted URL</div>
              <h2>Submit a live site</h2>
              <p class="muted">Paste your deployed URL and choose the platforms you want to prepare.</p>
            </div>
            <label><span>Site URL</span><input name="siteUrl" type="url" placeholder="https://your-app.onrender.com" required /></label>
            <label><span>App name</span><input name="appName" placeholder="My App" required /></label>
            <label><span>Launcher name</span><input name="launcherName" placeholder="My App" required /></label>
            <label><span>Package ID</span><input name="packageId" placeholder="com.company.myapp" /></label>
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
              <div class="eyebrow">ZIP upload</div>
              <h2>Upload a project ZIP</h2>
              <p class="muted">Upload your app source ZIP to validate its installability and export readiness.</p>
            </div>
            <label><span>Project ZIP</span><input name="projectZip" type="file" accept=".zip" required /></label>
            <label><span>App name</span><input name="appName" placeholder="My App" required /></label>
            <label><span>Launcher name</span><input name="launcherName" placeholder="My App" required /></label>
            <label><span>Package ID</span><input name="packageId" placeholder="com.company.myapp" /></label>
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
          <div id="projectsWrap" class="stack">
            ${state.projects.length ? state.projects.map(projectCard).join('') : '<p class="muted">No projects yet. Submit a hosted link or ZIP above.</p>'}
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
    if (target.dataset.originalText) target.textContent = target.dataset.originalText;
  }
}

function getSelectedValues(select) {
  return Array.from(select?.selectedOptions || []).map((option) => option.value);
}

async function refreshProjects() {
  const data = await fetchJson(`${API_BASE_URL}/projects`);
  state.projects = data.projects || [];
}

async function refreshSystem() {
  state.system = await fetchJson(`${API_BASE_URL}/system/status`);
}

async function refreshProject(projectId) {
  const data = await fetchJson(`${API_BASE_URL}/projects/${projectId}`);
  const index = state.projects.findIndex((item) => item._id === projectId);
  if (index >= 0) state.projects[index] = data.project;
  else state.projects.unshift(data.project);
}

function bindAppEvents() {
  document.querySelector('#refreshProjectsBtn')?.addEventListener('click', async () => {
    try {
      await refreshProjects();
      render();
    } catch (error) {
      alert(error.message);
    }
  });

  document.querySelector('#urlForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Submitting...');
    try {
      const body = {
        siteUrl: form.siteUrl.value,
        appName: form.appName.value,
        launcherName: form.launcherName.value,
        packageId: form.packageId.value,
        requestedPlatforms: getSelectedValues(form.requestedPlatforms)
      };
      const data = await fetchJson(`${API_BASE_URL}/projects/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      state.projects.unshift(data.project);
      form.reset();
      render();
      alert('Project created successfully.');
    } catch (error) {
      alert(error.message);
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
      getSelectedValues(form.requestedPlatforms).forEach((value) => dataForm.append('requestedPlatforms', value));
      const data = await fetchJson(`${API_BASE_URL}/projects/upload`, {
        method: 'POST',
        body: dataForm
      });
      state.projects.unshift(data.project);
      form.reset();
      render();
      alert('ZIP project created successfully.');
    } catch (error) {
      alert(error.message);
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
        render();
        alert('Build/export completed.');
      } catch (error) {
        alert(error.message);
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
        render();
      } catch (error) {
        alert(error.message);
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
      } catch (error) {
        alert(error.message);
      } finally {
        setBusy(button, false);
      }
    });
  });
}

function render() {
  app.innerHTML = appView();
  bindAppEvents();
}

async function init() {
  try {
    await Promise.all([refreshSystem(), refreshProjects()]);
  } catch (error) {
    console.error(error);
  }
  render();
}

init();
