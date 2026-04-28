(() => {
  // GitHub config
  const REPO = 'angeloutsider/AngelOutsider';
  const BRANCH = 'main';
  const POSTS_PATH = 'src/posts';
  const IMAGES_PATH = 'src/static/images';
  const API_BASE = 'https://api.github.com';

  // State
  let elements = [];
  let dragSrcIndex = null;
  let currentFileSha = null;

  // DOM refs
  const canvas = document.getElementById('canvas');
  const addParagraphBtn = document.getElementById('addParagraph');
  const addHeaderBtn = document.getElementById('addHeader');
  const addImageBtn = document.getElementById('addImage');
  const postDateEl = document.getElementById('postDate');
  const generateMarkdownBtn = document.getElementById('generateMarkdownBtn');
  const outputEl = document.getElementById('output');
  const copyBtn = document.getElementById('copyBtn');
  const previewPageBtn = document.getElementById('previewPageBtn');
  const commitBtn = document.getElementById('commitBtn');
  const commitStatus = document.getElementById('commitStatus');
  const postFileNameEl = document.getElementById('postFileName');
  const editorModeLabel = document.getElementById('editorModeLabel');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  const modalClose = document.getElementById('modalClose');
  const exportMdFromModal = document.getElementById('exportMdFromModal');

  postDateEl.valueAsDate = new Date();

  addParagraphBtn.addEventListener('click', () => addElement('paragraph'));
  addHeaderBtn.addEventListener('click', () => addElement('header'));
  addImageBtn.addEventListener('click', () => addElement('image'));
  generateMarkdownBtn.addEventListener('click', () => generateMarkdown());
  copyBtn.addEventListener('click', () => copyToClipboard());
  previewPageBtn.addEventListener('click', openModalWithRenderedPreview);
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  exportMdFromModal.addEventListener('click', () => generateMarkdown(true));
  commitBtn.addEventListener('click', commitToGitHub);

  // ─── GitHub helpers ───────────────────────────────────────────────────────

  function getPat() {
    return localStorage.getItem('gh_pat') || '';
  }

  function ghHeaders(extra = {}) {
    return {
      'Authorization': `token ${getPat()}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  // Init: check URL params for ?file= to load an existing post
  async function init() {
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) {
      postFileNameEl.value = file.replace(/\.md$/, '');
      if (editorModeLabel) editorModeLabel.textContent = `Editing: ${file}`;
      await loadFromGitHub(file);
    }
  }

  async function loadFromGitHub(filename) {
    setCommitStatus('Loading post…', 'info');
    try {
      const res = await fetch(
        `${API_BASE}/repos/${REPO}/contents/${POSTS_PATH}/${filename}`,
        { headers: ghHeaders() }
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      currentFileSha = data.sha;
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      const raw = new TextDecoder().decode(bytes);
      parseMarkdownPost(raw);
      setCommitStatus('Post loaded.', 'success');
      setTimeout(() => setCommitStatus('', ''), 3000);
    } catch (err) {
      setCommitStatus(`Failed to load: ${err.message}`, 'error');
    }
  }

  function parseMarkdownPost(raw) {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) return;

    const fm = fmMatch[1];
    const body = fmMatch[2].trim();

    function fmGet(key) {
      const m = fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm'));
      return m ? m[1].trim() : '';
    }

    document.getElementById('postTitle').value = fmGet('title');
    document.getElementById('postAuthor').value = fmGet('author');
    document.getElementById('postDate').value = fmGet('datePosted');

    const featuredRaw = fmGet('featuredImage');
    if (featuredRaw) {
      document.getElementById('featuredImage').value = featuredRaw.split('/').pop();
    }

    // Parse body blocks (separated by blank lines)
    elements = [];
    const blocks = body.split(/\n{2,}/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('<p>')) {
        const content = trimmed.replace(/^<p>/, '').replace(/<\/p>$/, '').trim();
        elements.push({ id: nextId(), type: 'paragraph', content: unescHtml(content), imageData: '', styles: {} });

      } else if (trimmed.match(/^<h[1-3]>/)) {
        const content = trimmed.replace(/^<h[1-3]>/, '').replace(/<\/h[1-3]>$/, '').trim();
        elements.push({ id: nextId(), type: 'header', content: unescHtml(content), imageData: '', styles: {} });

      } else if (trimmed.startsWith('<img')) {
        const srcM = trimmed.match(/src="([^"]+)"/);
        const styleM = trimmed.match(/style="([^"]+)"/);
        const src = srcM ? srcM[1] : '';
        // Strip {{ site.baseUrl }}static/images/ or any path prefix
        const cleanSrc = src
          .replace(/\{\{[^}]+\}\}static\/images\//, '')
          .replace(/.*\/static\/images\//, '');
        const styles = styleM ? parseInlineStyle(styleM[1]) : { width: '100%', aspectRatio: 'auto' };
        elements.push({ id: nextId(), type: 'image', content: cleanSrc, imageData: '', styles });
      }
    }

    renderCanvas();
  }

  function parseInlineStyle(styleStr) {
    const styles = {};
    styleStr.split(';').forEach(part => {
      const idx = part.indexOf(':');
      if (idx < 0) return;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      if (key && val) {
        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        styles[camel] = val;
      }
    });
    return styles;
  }

  async function commitToGitHub() {
    const pat = getPat();
    if (!pat) {
      setCommitStatus('No GitHub token. Log in at /admin/ first.', 'error');
      return;
    }

    const rawName = postFileNameEl.value.trim() || 'untitled';
    const filename = rawName.replace(/\.md$/, '') + '.md';
    const markdown = generateMarkdown();

    setCommitStatus('Uploading images…', 'info');
    await uploadPendingImages();

    setCommitStatus('Committing…', 'info');

    // Encode as UTF-8 base64
    const bytes = new TextEncoder().encode(markdown);
    const encoded = btoa(String.fromCharCode(...bytes));

    const body = {
      message: `${currentFileSha ? 'Update' : 'Add'} post: ${filename}`,
      content: encoded,
      branch: BRANCH,
    };
    if (currentFileSha) body.sha = currentFileSha;

    try {
      const res = await fetch(
        `${API_BASE}/repos/${REPO}/contents/${POSTS_PATH}/${filename}`,
        { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      currentFileSha = data.content.sha;
      postFileNameEl.value = filename.replace('.md', '');
      if (editorModeLabel) editorModeLabel.textContent = `Editing: ${filename}`;
      setCommitStatus('Committed & pushed!', 'success');
    } catch (err) {
      setCommitStatus(`Commit failed: ${err.message}`, 'error');
    }
  }

  async function uploadImageToGitHub(filename, base64) {
    let existingSha;
    const checkRes = await fetch(
      `${API_BASE}/repos/${REPO}/contents/${IMAGES_PATH}/${filename}`,
      { headers: ghHeaders() }
    );
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      existingSha = checkData.sha;
    }
    const body = { message: `Upload image: ${filename}`, content: base64, branch: BRANCH };
    if (existingSha) body.sha = existingSha;
    await fetch(
      `${API_BASE}/repos/${REPO}/contents/${IMAGES_PATH}/${filename}`,
      { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }
    );
  }

  async function uploadPendingImages() {
    // Upload featured image if a file was selected
    const featuredFile = document.getElementById('featuredImageFile').files[0];
    if (featuredFile) {
      try {
        const base64 = await fileToBase64(featuredFile);
        await uploadImageToGitHub(featuredFile.name, base64);
      } catch (_) {}
    }

    // Upload body images
    for (const el of elements) {
      if (el.type !== 'image' || !el.imageData || !el.content) continue;
      const base64 = el.imageData.split(',')[1];
      if (!base64) continue;
      try {
        await uploadImageToGitHub(el.content, base64);
        el.imageData = ''; // don't re-upload next time
      } catch (_) {}
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setCommitStatus(msg, type) {
    commitStatus.textContent = msg;
    commitStatus.className = `commit-status ${type}`;
    commitStatus.style.display = msg ? 'block' : 'none';
  }

  // ─── Canvas / element management ─────────────────────────────────────────

  function nextId() {
    return Date.now() + Math.floor(Math.random() * 1000) + elements.length;
  }

  function addElement(type) {
    elements.push({
      id: nextId(),
      type,
      content: '',
      imageData: '',
      styles: type === 'image' ? { width: '100%', aspectRatio: 'auto' } : {},
    });
    renderCanvas();
  }

  function renderCanvas() {
    canvas.innerHTML = '';

    elements.forEach((el, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'element';
      wrapper.draggable = true;
      wrapper.dataset.index = index;

      const header = document.createElement('div');
      header.className = 'element-header';

      const typeSpan = document.createElement('span');
      typeSpan.className = 'element-type';
      typeSpan.textContent = el.type;

      const rightControls = document.createElement('div');
      rightControls.style.display = 'flex';
      rightControls.style.gap = '6px';

      if (el.type === 'image') {
        const styleBtn = document.createElement('button');
        styleBtn.className = 'element-style';
        styleBtn.textContent = 'Styles';
        styleBtn.addEventListener('click', () => openImageStylePanel(el.id));
        rightControls.appendChild(styleBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'element-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeElement(el.id));
      rightControls.appendChild(removeBtn);

      header.appendChild(typeSpan);
      header.appendChild(rightControls);
      wrapper.appendChild(header);

      let inputEl;
      if (el.type === 'paragraph') {
        inputEl = document.createElement('textarea');
        inputEl.placeholder = 'Enter paragraph text';
        inputEl.value = el.content || '';
        inputEl.addEventListener('input', (ev) => updateElement(el.id, ev.target.value));
      } else if (el.type === 'header') {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = 'Enter header text';
        inputEl.value = el.content || '';
        inputEl.addEventListener('input', (ev) => updateElement(el.id, ev.target.value));
      } else if (el.type === 'image') {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-input-container';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.addEventListener('change', (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => updateElement(el.id, file.name, e.target.result);
          reader.readAsDataURL(file);
        });

        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.placeholder = 'Or enter image filename (e.g., photo.jpg)';
        pathInput.value = el.content || '';
        pathInput.addEventListener('input', (ev) => updateElement(el.id, ev.target.value, ''));

        if (el.imageData || el.content) {
          const preview = document.createElement('img');
          preview.src = el.imageData || (window.siteBaseUrl || '') + 'static/images/' + el.content;
          preview.alt = '';
          preview.className = 'image-preview';
          Object.assign(preview.style, el.styles);
          imageContainer.appendChild(preview);
        }

        imageContainer.appendChild(fileInput);
        imageContainer.appendChild(pathInput);
        inputEl = imageContainer;
      }

      wrapper.appendChild(inputEl);

      // Drag reorder
      wrapper.addEventListener('dragstart', (e) => {
        dragSrcIndex = index;
        wrapper.classList.add('dragging');
        try { e.dataTransfer.setData('text/plain', String(index)); } catch (_) {}
        e.dataTransfer.effectAllowed = 'move';
      });
      wrapper.addEventListener('dragend', () => {
        dragSrcIndex = null;
        wrapper.classList.remove('dragging');
        document.querySelectorAll('.element').forEach(n => n.classList.remove('drag-over'));
      });
      wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrcIndex !== null && dragSrcIndex !== index) wrapper.classList.add('drag-over');
      });
      wrapper.addEventListener('dragleave', () => wrapper.classList.remove('drag-over'));
      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('drag-over');
        const src = dragSrcIndex !== null ? dragSrcIndex : parseInt(e.dataTransfer.getData('text/plain') || '-1', 10);
        if (isFinite(src) && src >= 0 && src !== index) {
          const [moved] = elements.splice(src, 1);
          elements.splice(index, 0, moved);
          renderCanvas();
        }
        dragSrcIndex = null;
      });

      canvas.appendChild(wrapper);
    });
  }

  function updateElement(id, value, imageData = '') {
    const idx = elements.findIndex(e => e.id === id);
    if (idx < 0) return;
    elements[idx].content = value;
    if (imageData !== '') elements[idx].imageData = imageData;
    if (imageData) renderCanvas();
  }

  function removeElement(id) {
    elements = elements.filter(e => e.id !== id);
    renderCanvas();
  }

  function updateImageStyles(id, newStyles) {
    const idx = elements.findIndex(e => e.id === id);
    if (idx >= 0) {
      elements[idx].styles = { ...elements[idx].styles, ...newStyles };
      renderCanvas();
    }
  }

  // ─── Image style panel ────────────────────────────────────────────────────

  function openImageStylePanel(imageId) {
    const imgEl = elements.find(e => e.id === imageId);
    if (!imgEl) return;

    const panel = document.createElement('div');
    panel.className = 'style-panel-overlay';

    const panelContent = document.createElement('div');
    panelContent.className = 'style-panel';

    const panelTitle = document.createElement('h3');
    panelTitle.textContent = 'Image Styling';
    panelContent.appendChild(panelTitle);

    panelContent.appendChild(createStyleGroup('Width', 'width', imgEl.styles.width || '100%', null));
    panelContent.appendChild(createStyleGroup('Height', 'height', imgEl.styles.height || 'auto', null));
    panelContent.appendChild(createStyleGroup('Aspect Ratio', 'aspectRatio', imgEl.styles.aspectRatio || 'auto', ['auto', '16/9', '4/3', '1/1', '3/2']));
    panelContent.appendChild(createStyleGroup('Object Fit', 'objectFit', imgEl.styles.objectFit || 'cover', ['cover', 'contain', 'fill', 'scale-down']));
    panelContent.appendChild(createStyleGroup('Border Radius', 'borderRadius', imgEl.styles.borderRadius || '0px', null));
    panelContent.appendChild(createStyleGroup('Margin', 'margin', imgEl.styles.margin || '0px', null));
    panelContent.appendChild(createStyleGroup('Box Shadow', 'boxShadow', imgEl.styles.boxShadow || 'none', null));
    panelContent.appendChild(createStyleGroup('Opacity', 'opacity', imgEl.styles.opacity || '1', null, true));

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'style-panel-buttons';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'apply-btn';
    applyBtn.addEventListener('click', () => {
      const newStyles = {};
      panelContent.querySelectorAll('[data-style-key]').forEach(input => {
        const key = input.dataset.styleKey;
        const value = input.value.trim();
        if (value) newStyles[key] = value;
      });
      updateImageStyles(imageId, newStyles);
      panel.remove();
    });

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'reset-btn';
    resetBtn.addEventListener('click', () => {
      updateImageStyles(imageId, { width: '100%', height: 'auto', aspectRatio: 'auto', objectFit: 'cover', borderRadius: '0px', margin: '0px', boxShadow: 'none', opacity: '1' });
      panel.remove();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'cancel-btn';
    cancelBtn.addEventListener('click', () => panel.remove());

    buttonGroup.appendChild(applyBtn);
    buttonGroup.appendChild(resetBtn);
    buttonGroup.appendChild(cancelBtn);
    panelContent.appendChild(buttonGroup);
    panel.appendChild(panelContent);
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.remove(); });
    document.body.appendChild(panel);
  }

  function createStyleGroup(label, styleKey, currentValue, presets = null, isRange = false) {
    const group = document.createElement('div');
    group.className = 'style-group';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    group.appendChild(labelEl);

    if (presets) {
      const select = document.createElement('select');
      select.dataset.styleKey = styleKey;
      presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === currentValue) opt.selected = true;
        select.appendChild(opt);
      });
      group.appendChild(select);
    } else if (isRange) {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.1';
      input.value = currentValue;
      input.dataset.styleKey = styleKey;
      const display = document.createElement('span');
      display.className = 'range-display';
      display.textContent = currentValue;
      input.addEventListener('input', (e) => { display.textContent = e.target.value; });
      group.appendChild(input);
      group.appendChild(display);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
      input.placeholder = 'e.g., 100%, 300px, 20px';
      input.dataset.styleKey = styleKey;
      group.appendChild(input);
    }

    return group;
  }

  // ─── Markdown generation ──────────────────────────────────────────────────

  function generateMarkdown(fromModalExport = false) {
    const title = document.getElementById('postTitle').value || 'Untitled';
    const author = document.getElementById('postAuthor').value || 'Unknown';
    const date = document.getElementById('postDate').value;
    const uploadedFile = document.getElementById('featuredImageFile').files[0];
    const typedPath = document.getElementById('featuredImage')?.value || '';
    const featured = uploadedFile ? uploadedFile.name : (typedPath || 'default.png');

    let content = '';
    elements.forEach(el => {
      if (el.type === 'paragraph' && el.content.trim()) {
        content += `<p>${escHtml(el.content)}</p>\n\n`;
      } else if (el.type === 'header' && el.content.trim()) {
        content += `<h1>${escHtml(el.content)}</h1>\n\n`;
      } else if (el.type === 'image' && el.content.trim()) {
        const styleAttr = stylesToInline(el.styles);
        content += `<img src="{{ site.baseUrl }}static/images/${el.content}" style="${styleAttr}">\n\n`;
      }
    });

    const markdown = `---\ntitle: "${escQuotes(title)}"\nauthor: "${escQuotes(author)}"\ndatePosted: ${date}\nfeaturedImage: "../static/images/${escQuotes(featured)}"\nlayout: "layouts/post.njk"\ntags: post\n---\n\n${content}`;

    outputEl.textContent = markdown;
    outputEl.style.display = 'block';
    copyBtn.style.display = 'inline-block';

    if (fromModalExport) copyToClipboard(true);

    return markdown;
  }

  function stylesToInline(styles) {
    return Object.entries(styles)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
      .join('; ');
  }

  function copyToClipboard(suppressAlert) {
    const text = outputEl.textContent || '';
    if (!navigator.clipboard) {
      if (!suppressAlert) alert('Clipboard API not supported.');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => { if (!suppressAlert) alert('Copied to clipboard!'); },
      (err) => { if (!suppressAlert) alert('Could not copy: ' + err); }
    );
  }

  // ─── Preview modal ────────────────────────────────────────────────────────

  function openModalWithRenderedPreview() {
    if (!document.querySelector('link[href*="blog-style.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = (window.siteBaseUrl || '') + 'static/css/blog-style.css';
      document.head.appendChild(link);
      const override = document.createElement('style');
      override.id = 'tool-blog-override';
      override.textContent = 'body { display: block !important; background-color: #fff !important; align-items: initial !important; }';
      document.head.appendChild(override);
    }

    modalContent.innerHTML = '';

    const title = document.getElementById('postTitle').value || 'Untitled';
    const author = document.getElementById('postAuthor').value || 'Unknown';
    const date = document.getElementById('postDate').value || new Date().toISOString().split('T')[0];

    const article = document.createElement('article');
    article.className = 'post-container';

    const postHeader = document.createElement('header');
    postHeader.className = 'post-header';

    const backBtn = document.createElement('a');
    backBtn.href = '#';
    backBtn.className = 'back-button';
    backBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    backBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

    const titleEl = document.createElement('h1');
    titleEl.className = 'post-heading';
    titleEl.textContent = title;

    postHeader.appendChild(backBtn);
    postHeader.appendChild(titleEl);
    article.appendChild(postHeader);

    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';
    const authorEl = document.createElement('p');
    authorEl.className = 'post-author';
    authorEl.textContent = `by ${author} • ${date}`;
    postMeta.appendChild(authorEl);
    article.appendChild(postMeta);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'post-content';

    const textCol = document.createElement('div');
    textCol.className = 'post-text-col';
    const imageCol = document.createElement('div');
    imageCol.className = 'post-image-col';

    elements.forEach(el => {
      if (el.type === 'paragraph' && el.content.trim()) {
        const p = document.createElement('p');
        p.textContent = el.content;
        textCol.appendChild(p);
      } else if (el.type === 'header' && el.content.trim()) {
        const h1 = document.createElement('h1');
        h1.textContent = el.content;
        textCol.appendChild(h1);
      } else if (el.type === 'image' && (el.imageData || el.content.trim())) {
        const img = document.createElement('img');
        img.src = el.imageData || (window.siteBaseUrl || '') + 'static/images/' + el.content;
        img.alt = '';
        Object.assign(img.style, el.styles);
        imageCol.appendChild(img);
      }
    });

    contentDiv.appendChild(textCol);
    contentDiv.appendChild(imageCol);
    article.appendChild(contentDiv);
    modalContent.appendChild(article);
    modalOverlay.style.display = 'flex';
    modalContent.focus();
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function unescHtml(str) {
    return String(str || '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }

  function escQuotes(str) {
    return String(str || '').replace(/"/g, '\\"');
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  renderCanvas();
  init();

  window._bloggen = {
    getElements: () => elements,
    setElements: (arr) => { elements = arr; renderCanvas(); },
  };
})();
