// tool-script.js
// Put this file at: static/js/tool-script.js (or change the path in the HTML)
// Vanilla JS only. No inline JS required in the HTML other than <script src="...">

(() => {
  // State
  let elements = []; // { id: number, type: 'paragraph'|'header'|'image', content: '', imageData: '', styles: {} }
  let dragSrcIndex = null;

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

  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  const modalClose = document.getElementById('modalClose');
  const exportMdFromModal = document.getElementById('exportMdFromModal');

  // Set default date to today
  postDateEl.valueAsDate = new Date();

  // Event listeners for adding elements (click-to-add)
  addParagraphBtn.addEventListener('click', () => addElement('paragraph'));
  addHeaderBtn.addEventListener('click', () => addElement('header'));
  addImageBtn.addEventListener('click', () => addElement('image'));

  // Generate / Copy
  generateMarkdownBtn.addEventListener('click', generateMarkdown);
  copyBtn.addEventListener('click', copyToClipboard);

  // Modal preview
  previewPageBtn.addEventListener('click', () => {
    openModalWithRenderedPreview();
  });
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  exportMdFromModal.addEventListener('click', () => { generateMarkdown(true); });

  // Add element to the end
  function addElement(type) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    elements.push({ 
      id, 
      type, 
      content: '', 
      imageData: '',
      styles: type === 'image' ? { width: '100%', aspectRatio: 'auto' } : {}
    });
    renderCanvas();
  }

  // Render the canvas with editable controls + drag reorder
  function renderCanvas() {
    canvas.innerHTML = '';

    elements.forEach((el, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'element';
      wrapper.draggable = true;
      wrapper.dataset.index = index;

      // Header row
      const header = document.createElement('div');
      header.className = 'element-header';

      const typeSpan = document.createElement('span');
      typeSpan.className = 'element-type';
      typeSpan.textContent = el.type;

      const rightControls = document.createElement('div');

      const removeBtn = document.createElement('button');
      removeBtn.className = 'element-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        removeElement(el.id);
      });

      rightControls.appendChild(removeBtn);
      
      // Add style button for images
      if (el.type === 'image') {
        const styleBtn = document.createElement('button');
        styleBtn.className = 'element-style';
        styleBtn.textContent = 'Styles';
        styleBtn.addEventListener('click', () => {
          openImageStylePanel(el.id);
        });
        rightControls.insertBefore(styleBtn, removeBtn);
      }

      header.appendChild(typeSpan);
      header.appendChild(rightControls);

      wrapper.appendChild(header);

      // Input area
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
        // Create a container for image upload
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-input-container';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.placeholder = 'Choose an image';
        fileInput.addEventListener('change', (ev) => {
          const file = ev.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              updateElement(el.id, file.name, e.target.result);
            };
            reader.readAsDataURL(file);
          }
        });

        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.placeholder = 'Or enter image path (e.g., ../static/images/pic.jpg)';
        pathInput.value = el.content || '';
        pathInput.addEventListener('input', (ev) => updateElement(el.id, ev.target.value, ''));

        // Show uploaded image preview if available
        if (el.imageData) {
          const preview = document.createElement('img');
          preview.src = el.imageData;
          preview.alt = 'Image preview';
          preview.className = 'image-preview';
          Object.assign(preview.style, el.styles);
          imageContainer.appendChild(preview);
        }

        imageContainer.appendChild(fileInput);
        imageContainer.appendChild(pathInput);
        inputEl = imageContainer;
      }

      wrapper.appendChild(inputEl);

      // Drag events for reorder
      wrapper.addEventListener('dragstart', (e) => {
        dragSrcIndex = index;
        wrapper.classList.add('dragging');
        try { e.dataTransfer.setData('text/plain', String(index)); } catch (err) {}
        e.dataTransfer.effectAllowed = 'move';
      });
      wrapper.addEventListener('dragend', () => {
        dragSrcIndex = null;
        wrapper.classList.remove('dragging');
        document.querySelectorAll('.element').forEach(node => node.classList.remove('drag-over'));
      });

      wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrcIndex !== null && dragSrcIndex !== index) {
          wrapper.classList.add('drag-over');
        }
      });

      wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('drag-over');
      });

      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('drag-over');
        const srcIndex = dragSrcIndex !== null ? dragSrcIndex : parseInt(e.dataTransfer.getData('text/plain') || -1, 10);
        const destIndex = index;
        if (isFinite(srcIndex) && srcIndex >= 0 && srcIndex !== destIndex) {
          const [moved] = elements.splice(srcIndex, 1);
          elements.splice(destIndex, 0, moved);
          renderCanvas();
        }
        dragSrcIndex = null;
      });

      canvas.appendChild(wrapper);
    });
  }

  function updateElement(id, value, imageData = '') {
    const idx = elements.findIndex(e => e.id === id);
    if (idx >= 0) {
      elements[idx].content = value;
      if (imageData) {
        elements[idx].imageData = imageData;
      }
    }
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

  // Image style panel modal
  function openImageStylePanel(imageId) {
    const imgEl = elements.find(e => e.id === imageId);
    if (!imgEl) return;

    const panel = document.createElement('div');
    panel.className = 'style-panel-overlay';
    
    const panelContent = document.createElement('div');
    panelContent.className = 'style-panel';

    const panelTitle = document.createElement('h3');
    panelTitle.textContent = 'Image Styling Options';
    panelContent.appendChild(panelTitle);

    // Width
    const widthGroup = createStyleGroup('Width', 'width', imgEl.styles.width || '100%', 'width-input');
    panelContent.appendChild(widthGroup);

    // Height
    const heightGroup = createStyleGroup('Height', 'height', imgEl.styles.height || 'auto', 'height-input');
    panelContent.appendChild(heightGroup);

    // Aspect Ratio
    const aspectRatioGroup = createStyleGroup('Aspect Ratio', 'aspectRatio', imgEl.styles.aspectRatio || 'auto', 'aspect-input', ['auto', '16/9', '4/3', '1/1', '3/2']);
    panelContent.appendChild(aspectRatioGroup);

    // Object Fit
    const objectFitGroup = createStyleGroup('Object Fit', 'objectFit', imgEl.styles.objectFit || 'cover', 'objectfit-input', ['cover', 'contain', 'fill', 'scale-down']);
    panelContent.appendChild(objectFitGroup);

    // Border Radius
    const borderRadiusGroup = createStyleGroup('Border Radius', 'borderRadius', imgEl.styles.borderRadius || '0px', 'radius-input');
    panelContent.appendChild(borderRadiusGroup);

    // Margin
    const marginGroup = createStyleGroup('Margin', 'margin', imgEl.styles.margin || '0px', 'margin-input');
    panelContent.appendChild(marginGroup);

    // Box Shadow
    const shadowGroup = createStyleGroup('Box Shadow', 'boxShadow', imgEl.styles.boxShadow || 'none', 'shadow-input');
    panelContent.appendChild(shadowGroup);

    // Opacity
    const opacityGroup = createStyleGroup('Opacity', 'opacity', imgEl.styles.opacity || '1', 'opacity-input', null, true);
    panelContent.appendChild(opacityGroup);

    // Button group
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'style-panel-buttons';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'apply-btn';
    applyBtn.addEventListener('click', () => {
      const newStyles = {};
      document.querySelectorAll('[data-style-key]').forEach(input => {
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
    cancelBtn.addEventListener('click', () => {
      panel.remove();
    });

    buttonGroup.appendChild(applyBtn);
    buttonGroup.appendChild(resetBtn);
    buttonGroup.appendChild(cancelBtn);
    panelContent.appendChild(buttonGroup);

    panel.appendChild(panelContent);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) panel.remove();
    });

    document.body.appendChild(panel);
  }

  function createStyleGroup(label, styleKey, currentValue, inputClass, presets = null, isRange = false) {
    const group = document.createElement('div');
    group.className = 'style-group';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    group.appendChild(labelEl);

    if (presets) {
      const select = document.createElement('select');
      select.className = inputClass;
      select.dataset.styleKey = styleKey;
      
      presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset;
        option.textContent = preset;
        if (preset === currentValue) option.selected = true;
        select.appendChild(option);
      });

      group.appendChild(select);
    } else if (isRange) {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.1';
      input.value = currentValue;
      input.className = inputClass;
      input.dataset.styleKey = styleKey;
      
      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'range-display';
      valueDisplay.textContent = currentValue;
      
      input.addEventListener('input', (e) => {
        valueDisplay.textContent = e.target.value;
      });

      group.appendChild(input);
      group.appendChild(valueDisplay);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
      input.placeholder = `e.g., 100%, 300px, 20px`;
      input.className = inputClass;
      input.dataset.styleKey = styleKey;
      group.appendChild(input);
    }

    return group;
  }

  // MARKDOWN generation and preview rendering (modal)
  function generateMarkdown(fromModalExport = false) {
    const title = document.getElementById('postTitle').value || 'Untitled';
    const author = document.getElementById('postAuthor').value || 'Unknown';
    const date = document.getElementById('postDate').value;
    let featured = 'default.png';
    const uploadedFile = document.getElementById('featuredImageFile').files[0];
    const typedPath = document.getElementById('featuredImage')?.value || '';

    if (uploadedFile) {
      featured = uploadedFile.name;
    } else if (typedPath) {
      featured = typedPath;
    }

    let content = '';
    elements.forEach(el => {
      if (el.type === 'paragraph' && el.content.trim()) {
        content += `<p>${escapeHtml(el.content)}</p>\n\n`;
      } else if (el.type === 'header' && el.content.trim()) {
        content += `<h1>${escapeHtml(el.content)}</h1>\n\n`;
      } else if (el.type === 'image' && el.content.trim()) {
        const styleAttr = stylesToInlineString(el.styles);
        content += `<img src="{{ site.baseUrl }}static/images/${el.content}" style="${styleAttr}">\n\n`;
      }
    });

    const markdown = `---\ntitle: "${escapeQuotes(title)}"\nauthor: "${escapeQuotes(author)}"\ndatePosted: ${date}\nfeaturedImage: "../static/images/${escapeQuotes(featured)}"\nlayout: "layouts/post.njk"\ntags: post\n---\n\n${content}`;

    outputEl.textContent = markdown;
    outputEl.style.display = 'block';
    copyBtn.style.display = 'inline-block';

    if (fromModalExport) {
      copyToClipboard(true);
    }

    return markdown;
  }

  function stylesToInlineString(styles) {
    return Object.entries(styles)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      })
      .join('; ');
  }

  function copyToClipboard(suppressAlert) {
    const text = outputEl.textContent || '';
    if (!navigator.clipboard) {
      if (!suppressAlert) alert('Clipboard API not supported in this browser.');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      if (!suppressAlert) alert('Copied to clipboard!');
    }, (err) => {
      if (!suppressAlert) alert('Could not copy: ' + err);
    });
  }

  // Modal preview rendering (visual HTML) - matches post.njk styling
  function openModalWithRenderedPreview() {
    // Load blog-style.css if not already loaded
    if (!document.querySelector('link[href*="blog-style.css"]')) {
      const blogStyleLink = document.createElement('link');
      blogStyleLink.rel = 'stylesheet';
      blogStyleLink.href = (window.siteBaseUrl || '') + 'static/css/blog-style.css';
      document.head.appendChild(blogStyleLink);
    }

    modalContent.innerHTML = '';
    
    const styleWrapper = document.createElement('div');
    styleWrapper.className = 'blog-style-scope';

    const title = document.getElementById('postTitle').value || 'Untitled';
    const author = document.getElementById('postAuthor').value || 'Unknown';
    const date = document.getElementById('postDate').value || (new Date().toISOString().split('T')[0]);

    // Create article container matching post.njk structure
    const article = document.createElement('article');
    article.className = 'post-container';

    // Post header
    const postHeader = document.createElement('header');
    postHeader.className = 'post-header';

    const backBtn = document.createElement('a');
    backBtn.href = '#';
    backBtn.className = 'back-button';
    backBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });

    const titleEl = document.createElement('h1');
    titleEl.className = 'post-heading';
    titleEl.textContent = title;

    postHeader.appendChild(backBtn);
    postHeader.appendChild(titleEl);
    article.appendChild(postHeader);

    // Post meta (with date)
    const postMeta = document.createElement('div');
    postMeta.className = 'post-meta';

    const authorEl = document.createElement('p');
    authorEl.className = 'post-author';
    authorEl.textContent = `by ${author} • ${date}`;

    postMeta.appendChild(authorEl);
    article.appendChild(postMeta);

    // Post content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'post-content';

    elements.forEach(el => {
      if (el.type === 'paragraph' && el.content.trim()) {
        const p = document.createElement('p');
        p.textContent = el.content;
        contentDiv.appendChild(p);
      } else if (el.type === 'header' && el.content.trim()) {
        const h1 = document.createElement('h1');
        h1.style.fontSize = '1.5rem';
        h1.style.fontWeight = '300';
        h1.style.marginBottom = '20px';
        h1.textContent = el.content;
        contentDiv.appendChild(h1);
      } else if (el.type === 'image' && (el.imageData || el.content.trim())) {
        const img = document.createElement('img');
        img.src = el.imageData || el.content;
        img.alt = '';
        Object.assign(img.style, el.styles);
        contentDiv.appendChild(img);
      }
    });

    article.appendChild(contentDiv);
    modalContent.appendChild(article);

    // show modal
    modalOverlay.style.display = 'flex';
    modalContent.focus();
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
  }

  // Small helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
  function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replaceAll('"', '\\"');
  }

  // initial render
  renderCanvas();

  // expose functions for debugging if needed (optional)
  window._bloggen = {
    getElements: () => elements,
    setElements: (arr) => { elements = arr; renderCanvas(); },
  };

})();