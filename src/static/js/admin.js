(() => {
  const REPO = 'adal-o/Blog';
  const BRANCH = 'main';
  const POSTS_PATH = 'src/posts';
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

  function getPat() { return localStorage.getItem('gh_pat') || ''; }

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

  savePatBtn.addEventListener('click', () => {
    const pat = patInput.value.trim();
    if (!pat) return;
    localStorage.setItem('gh_pat', pat);
    showMain();
  });

  patInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePatBtn.click();
  });

  signOutBtn.addEventListener('click', () => {
    localStorage.removeItem('gh_pat');
    patInput.value = '';
    showAuth();
  });

  newPostBtn.addEventListener('click', () => {
    window.location.href = '/admin/tool/';
  });

  async function loadPosts() {
    postsLoading.style.display = 'block';
    postsList.innerHTML = '';
    postsError.style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${POSTS_PATH}`, {
        headers: ghHeaders(),
      });
      if (res.status === 401) { showAuth(); return; }
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

      const files = await res.json();
      const mdFiles = files.filter(f => f.name.endsWith('.md'));

      postsLoading.style.display = 'none';

      if (mdFiles.length === 0) {
        postsList.innerHTML = '<p class="empty-msg">No posts yet. Create your first one!</p>';
        return;
      }

      const cards = await Promise.all(mdFiles.map(f => buildPostCard(f)));
      cards.forEach(card => postsList.appendChild(card));
    } catch (err) {
      postsLoading.style.display = 'none';
      postsError.style.display = 'block';
      postsError.textContent = `Failed to load posts: ${err.message}`;
    }
  }

  async function buildPostCard(file) {
    let title = file.name.replace(/\.md$/, '');
    let datePosted = '';
    let sha = file.sha;

    try {
      const res = await fetch(file.url, { headers: ghHeaders() });
      const data = await res.json();
      sha = data.sha;
      const raw = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      const titleMatch = raw.match(/^title:\s*"?([^"\n]+)"?/m);
      const dateMatch = raw.match(/^datePosted:\s*(.+)/m);
      if (titleMatch) title = titleMatch[1].trim();
      if (dateMatch) datePosted = dateMatch[1].trim();
    } catch (_) {}

    const card = document.createElement('div');
    card.className = 'post-card-admin';
    card.innerHTML = `
      <div class="post-card-info">
        <span class="post-card-title">${escHtml(title)}</span>
        <span class="post-card-date">${escHtml(datePosted)}</span>
        <span class="post-card-file">${escHtml(file.name)}</span>
      </div>
      <div class="post-card-actions">
        <button class="btn-edit">Edit</button>
        <button class="btn-delete">Delete</button>
      </div>
    `;

    card.querySelector('.btn-edit').addEventListener('click', () => {
      window.location.href = `/admin/tool/?file=${encodeURIComponent(file.name)}`;
    });

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if (!confirm(`Delete "${title}"?\n\nThis cannot be undone.`)) return;
      await deletePost(file.name, sha, card);
    });

    return card;
  }

  async function deletePost(filename, sha, cardEl) {
    try {
      const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${POSTS_PATH}/${filename}`, {
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
        postsList.innerHTML = '<p class="empty-msg">No posts yet. Create your first one!</p>';
      }
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
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
