(() => {
  const REPO = 'angeloutsider/AngelOutsider';
  const BRANCH = 'main';
  const POSTS_PATH = 'src/posts';
  const BASE_URL = document.currentScript.dataset.baseUrl || '/';
  const API_BASE = 'https://api.github.com';

  const patInput = document.getElementById('patInput');
  const savePatBtn = document.getElementById('savePatBtn');
  const authSection = document.getElementById('authSection');
  const mainSection = document.getElementById('mainSection');
  const newPostBtn = document.getElementById('newPostBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const postsLoading = document.getElementById('postsLoading');
  const postsList = document.getElementById('postsList');
  const postsError = document.getElementById('postsError');
  const archivedSection = document.getElementById('archivedSection');
  const archivedList = document.getElementById('archivedList');
  const archivedToggle = document.getElementById('archivedToggle');
  const archivedToggleIcon = document.getElementById('archivedToggleIcon');

  // Clear tokens left by the old localStorage version.
  localStorage.removeItem('gh_pat');
  function getPat() { return sessionStorage.getItem('gh_pat') || ''; }
  function savePat(pat) { sessionStorage.setItem('gh_pat', pat); }
  function clearPat() { sessionStorage.removeItem('gh_pat'); }

  function postUrl(filename) {
    return `${API_BASE}/repos/${REPO}/contents/${POSTS_PATH}/${encodeURIComponent(filename)}`;
  }

  function ghHeaders(extra = {}) {
    return {
      'Authorization': `token ${getPat()}`,
      'Accept': 'application/vnd.github.v3+json',
      ...extra,
    };
  }

  function showAuth() {
    authSection.style.display = 'flex';
    mainSection.style.display = 'none';
  }

  function showMain() {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
    loadPosts();
  }

  savePatBtn.addEventListener('click', async () => {
    const pat = patInput.value.trim();
    if (!pat) return;
    savePatBtn.disabled = true;
    const res = await fetch(`${API_BASE}/repos/${REPO}`, {
      headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    savePatBtn.disabled = false;
    if (!res.ok) {
      patInput.setCustomValidity('Invalid token or no repo access');
      patInput.reportValidity();
      patInput.setCustomValidity('');
      return;
    }
    savePat(pat);
    patInput.value = '';
    showMain();
  });

  patInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePatBtn.click();
  });

  signOutBtn.addEventListener('click', () => {
    clearPat();
    patInput.value = '';
    showAuth();
  });

  newPostBtn.addEventListener('click', () => {
    window.location.href = `${BASE_URL}admin/tool/`;
  });

  let archivedOpen = false;
  archivedToggle.addEventListener('click', () => {
    archivedOpen = !archivedOpen;
    archivedList.style.display = archivedOpen ? 'flex' : 'none';
    archivedToggleIcon.textContent = archivedOpen ? '▼' : '▶';
  });

  async function loadPosts() {
    postsLoading.style.display = 'block';
    postsList.innerHTML = '';
    archivedList.innerHTML = '';
    archivedSection.style.display = 'none';
    archivedOpen = false;
    archivedList.style.display = 'none';
    archivedToggleIcon.textContent = '▶';
    postsError.style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${POSTS_PATH}`, {
        headers: ghHeaders(),
      });
      if (res.status === 401) { clearPat(); showAuth(); return; }
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

      const files = await res.json();
      const mdFiles = files.filter(f => f.name.endsWith('.md'));

      postsLoading.style.display = 'none';

      if (mdFiles.length === 0) {
        postsList.innerHTML = '<p class="empty-msg">No posts yet. Create your first one!</p>';
        return;
      }

      const results = await Promise.all(mdFiles.map(f => buildPostCard(f)));

      let hasActive = false;
      let hasArchived = false;

      results.forEach(({ card, isArchived }) => {
        if (isArchived) {
          archivedList.appendChild(card);
          hasArchived = true;
        } else {
          postsList.appendChild(card);
          hasActive = true;
        }
      });

      if (!hasActive) {
        postsList.innerHTML = '<p class="empty-msg">No active posts.</p>';
      }

      if (hasArchived) {
        archivedSection.style.display = 'block';
      }

    } catch (err) {
      postsLoading.style.display = 'none';
      postsError.style.display = 'block';
      postsError.textContent = `Failed to load posts: ${err.message}`;
    }
  }

  async function buildPostCard(file) {
    let title = file.name.replace(/\.md$/, '');
    let postDate = '';
    let sha = file.sha;
    let isArchived = false;

    try {
      const res = await fetch(file.url, { headers: ghHeaders() });
      const data = await res.json();
      sha = data.sha;
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      const raw = new TextDecoder().decode(bytes);
      const titleMatch = raw.match(/^title:\s*"?([^"\n]+)"?/m);
      const dateMatch = raw.match(/^date:\s*(.+)/m);
      const archivedMatch = raw.match(/^archived:\s*true/im);
      if (titleMatch) title = titleMatch[1].trim();
      if (dateMatch) postDate = dateMatch[1].trim();
      isArchived = !!archivedMatch;
    } catch (_) {}

    const card = document.createElement('div');
    card.className = 'post-card-admin' + (isArchived ? ' archived' : '');
    card.innerHTML = `
      <div class="post-card-info">
        <span class="post-card-title">${escHtml(title)}</span>
        <span class="post-card-date">${escHtml(postDate)}</span>
        <span class="post-card-file">${escHtml(file.name)}</span>
      </div>
      <div class="post-card-actions">
        ${!isArchived ? `<button class="btn-edit">Edit</button>` : ''}
        <button class="${isArchived ? 'btn-unarchive' : 'btn-archive'}">${isArchived ? 'Unarchive' : 'Archive'}</button>
        <button class="btn-delete">Delete</button>
      </div>
    `;

    if (!isArchived) {
      card.querySelector('.btn-edit').addEventListener('click', () => {
        window.location.href = `${BASE_URL}admin/tool/?file=${encodeURIComponent(file.name)}`;
      });
    }

    const toggleBtn = card.querySelector(isArchived ? '.btn-unarchive' : '.btn-archive');
    toggleBtn.addEventListener('click', async () => {
      if (isArchived) {
        await unarchivePost(file.name, card);
      } else {
        await archivePost(file.name, card);
      }
    });

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if (!confirm(`Delete "${title}"?\n\nThis cannot be undone.`)) return;
      await deletePost(file.name, sha, card);
    });

    return { card, isArchived };
  }

  async function archivePost(filename, card) {
    const btn = card.querySelector('.btn-archive');
    if (btn) { btn.disabled = true; btn.textContent = 'Archiving…'; }
    try {
      const res = await fetch(postUrl(filename), {
        headers: ghHeaders(),
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      const raw = new TextDecoder().decode(bytes);
      const updated = setFrontmatterField(raw, 'archived', 'true');
      await commitFileUpdate(filename, updated, data.sha, `Archive post: ${filename}`);
      loadPosts();
    } catch (err) {
      alert(`Failed to archive: ${err.message}`);
      if (btn) { btn.disabled = false; btn.textContent = 'Archive'; }
    }
  }

  async function unarchivePost(filename, card) {
    const btn = card.querySelector('.btn-unarchive');
    if (btn) { btn.disabled = true; btn.textContent = 'Unarchiving…'; }
    try {
      const res = await fetch(postUrl(filename), {
        headers: ghHeaders(),
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      const raw = new TextDecoder().decode(bytes);
      const updated = removeFrontmatterField(raw, 'archived');
      await commitFileUpdate(filename, updated, data.sha, `Unarchive post: ${filename}`);
      loadPosts();
    } catch (err) {
      alert(`Failed to unarchive: ${err.message}`);
      if (btn) { btn.disabled = false; btn.textContent = 'Unarchive'; }
    }
  }

  async function deletePost(filename, sha, cardEl) {
    try {
      const res = await fetch(postUrl(filename), {
        method: 'DELETE',
        headers: ghHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: `Delete post: ${filename}`, sha, branch: BRANCH }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.status);
      }
      cardEl.remove();
      if (!postsList.querySelector('.post-card-admin')) {
        postsList.innerHTML = '<p class="empty-msg">No active posts.</p>';
      }
      if (!archivedList.querySelector('.post-card-admin')) {
        archivedSection.style.display = 'none';
      }
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function commitFileUpdate(filename, content, sha, message) {
    const bytes = new TextEncoder().encode(content);
    const encoded = btoa(String.fromCharCode(...bytes));
    const res = await fetch(
      postUrl(filename),
      {
        method: 'PUT',
        headers: ghHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message, content: encoded, branch: BRANCH, sha }),
      }
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function setFrontmatterField(raw, key, value) {
    return raw.replace(/^---\n([\s\S]*?)\n---/, (_, fm) => {
      const lineRegex = new RegExp(`^${key}:.*$`, 'm');
      const newFm = lineRegex.test(fm)
        ? fm.replace(lineRegex, `${key}: ${value}`)
        : fm + `\n${key}: ${value}`;
      return `---\n${newFm}\n---`;
    });
  }

  function removeFrontmatterField(raw, key) {
    return raw.replace(/^---\n([\s\S]*?)\n---/, (_, fm) => {
      const newFm = fm.replace(new RegExp(`^${key}:.*(\n|$)`, 'm'), '');
      return `---\n${newFm}\n---`;
    });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (getPat()) {
    showMain();
  } else {
    showAuth();
  }
})();
