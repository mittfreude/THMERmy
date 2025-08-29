const STORAGE_KEY = 'solo-thymer';
let data = loadData();
let currentPageId = null;

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { pages: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    // ensure new fields exist on older data
    parsed.pages.forEach(p => p.blocks.forEach(ensureBlockDefaults));
    return parsed;
  } catch (e) {
    console.error('Failed to parse data', e);
    return { pages: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function genId() {
  return Math.random().toString(36).slice(2);
}

function renderPages() {
  const list = document.getElementById('page-list');
  list.innerHTML = '';
  data.pages.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.title;
    li.dataset.id = p.id;
    li.addEventListener('click', () => openPage(p.id));
    li.addEventListener('dblclick', () => renamePage(p.id));
    list.appendChild(li);
  });
}

function createPage() {
  const title = prompt('Page title');
  if (!title) return;
  const page = { id: genId(), title, blocks: [emptyBlock()] };
  data.pages.push(page);
  saveData();
  renderPages();
  openPage(page.id);
}

function renamePage(id) {
  const page = data.pages.find(p => p.id === id);
  if (!page) return;
  const title = prompt('New title', page.title);
  if (!title) return;
  page.title = title;
  saveData();
  renderPages();
}

function openPage(id) {
  currentPageId = id;
  const page = data.pages.find(p => p.id === id);
  document.getElementById('editor').innerHTML = '';
  page.blocks.forEach((b, i) => {
    renderBlock(b, document.getElementById('editor'), 0, i);
  });
}

function emptyBlock() {
  return { id: genId(), text: '', children: [], collapsed: false, isTask: false, done: false, dueDate: null, priority: null, tags: [] };
}

function ensureBlockDefaults(block) {
  if (!('children' in block)) block.children = [];
  if (block.collapsed === undefined) block.collapsed = false;
  if (block.isTask === undefined) block.isTask = false;
  if (block.done === undefined) block.done = false;
  if (block.dueDate === undefined) block.dueDate = null;
  if (block.priority === undefined) block.priority = null;
  if (!block.tags) block.tags = [];
  block.children.forEach(ensureBlockDefaults);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseProps(block, content) {
  const tokens = content.split(/\s+/);
  let changed = false;
  const remaining = [];
  tokens.forEach(t => {
    if (t === 'today') {
      block.dueDate = formatDate(new Date());
      changed = true;
    } else if (t === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      block.dueDate = formatDate(d);
      changed = true;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      block.dueDate = t;
      changed = true;
    } else if (/^!p[1-5]$/.test(t)) {
      block.priority = parseInt(t.slice(2), 10);
      changed = true;
    } else if (/^#\w+/.test(t)) {
      block.tags.push(t.slice(1));
      changed = true;
    } else {
      remaining.push(t);
    }
  });
  if (changed) {
    block.text = remaining.join(' ');
  }
  return changed;
}

function createChip(label, cls, onClick) {
  const chip = document.createElement('span');
  chip.className = 'chip ' + cls;
  chip.textContent = label;
  chip.tabIndex = 0;
  chip.addEventListener('click', onClick);
  return chip;
}

function renderBlock(block, container, indent, index) {
  const div = document.createElement('div');
  div.className = 'block' + (block.done ? ' done' : '');
  div.style.setProperty('--indent', indent * 20 + 'px');
  div.dataset.id = block.id;

  const collapse = document.createElement('span');
  collapse.className = 'collapse';
  collapse.textContent = block.collapsed ? '▶' : '▼';
  collapse.addEventListener('click', () => {
    block.collapsed = !block.collapsed;
    saveData();
    openPage(currentPageId);
  });
  div.appendChild(collapse);

  const taskToggle = document.createElement('span');
  taskToggle.className = 'task-toggle' + (block.isTask ? ' hidden' : '');
  taskToggle.textContent = '[ ]';
  taskToggle.addEventListener('click', () => {
    block.isTask = true;
    parseProps(block, block.text);
    saveData();
    openPage(currentPageId);
  });
  div.appendChild(taskToggle);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox' + (block.isTask ? '' : ' hidden');
  checkbox.checked = block.done;
  checkbox.addEventListener('click', (e) => {
    if (block.isTask) {
      if (e.shiftKey) {
        block.isTask = false;
        block.done = false;
        block.dueDate = null;
        block.priority = null;
        block.tags = [];
      } else {
        block.done = checkbox.checked;
      }
      saveData();
      openPage(currentPageId);
    }
  });
  div.appendChild(checkbox);

  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = block.text;
  text.contentEditable = true;
  text.addEventListener('input', () => {
    const content = text.textContent;
    if (!block.isTask && content.startsWith('/todo')) {
      block.isTask = true;
      block.text = content.replace(/^\/todo\s*/, '');
      const changed = parseProps(block, block.text);
      saveData();
      openPage(currentPageId);
      focusBlock(block.id, changed ? block.text.length : 0);
    } else {
      block.text = content;
      let changed = false;
      if (block.isTask) {
        changed = parseProps(block, content);
      }
      saveData();
      if (changed) {
        openPage(currentPageId);
        focusBlock(block.id, block.text.length);
      }
    }
  });
  text.addEventListener('keydown', (e) => handleKey(e, block));
  div.appendChild(text);

  if (block.dueDate) {
    const chip = createChip(block.dueDate, 'due', () => {
      block.dueDate = null;
      saveData();
      openPage(currentPageId);
    });
    div.appendChild(chip);
  }
  if (block.priority) {
    const chip = createChip('P' + block.priority, 'priority', () => {
      block.priority = null;
      saveData();
      openPage(currentPageId);
    });
    div.appendChild(chip);
  }
  if (block.tags && block.tags.length) {
    block.tags.forEach(tag => {
      const chip = createChip('#' + tag, 'tag', () => {
        block.tags = block.tags.filter(t => t !== tag);
        saveData();
        openPage(currentPageId);
      });
      div.appendChild(chip);
    });
  }

  container.appendChild(div);

  if (block.children && block.children.length && !block.collapsed) {
    div.classList.add('has-children');
    block.children.forEach((child, i) => {
      renderBlock(child, container, indent + 1, i);
    });
  } else if (block.children && block.children.length) {
    div.classList.add('has-children');
  }
}

function handleKey(e, block) {
  const page = data.pages.find(p => p.id === currentPageId);
  const root = page.blocks;

  if (e.key === 'Enter') {
    e.preventDefault();
    const newBlock = emptyBlock();
    insertBlock(root, block.id, newBlock);
    saveData();
    openPage(currentPageId);
    focusBlock(newBlock.id);
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) outdentBlock(root, block.id); else indentBlock(root, block.id);
    saveData();
    openPage(currentPageId);
    focusBlock(block.id);
  } else if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    moveBlock(root, block.id, e.key === 'ArrowUp' ? -1 : 1);
    saveData();
    openPage(currentPageId);
    focusBlock(block.id);
  }
}

function findParentAndIndex(arr, id, parent = null) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === id) return { parent, arr, index: i };
    const res = findParentAndIndex(arr[i].children, id, arr[i]);
    if (res) return res;
  }
  return null;
}

function insertBlock(root, afterId, newBlock) {
  const info = findParentAndIndex(root, afterId);
  if (!info) return;
  info.arr.splice(info.index + 1, 0, newBlock);
}

function indentBlock(root, id) {
  const info = findParentAndIndex(root, id);
  if (!info) return;
  if (info.index === 0) return; // no previous sibling
  const prev = info.arr[info.index - 1];
  prev.children.push(info.arr.splice(info.index, 1)[0]);
}

function outdentBlock(root, id) {
  const info = findParentAndIndex(root, id);
  if (!info || !info.parent) return;
  const parentInfo = findParentAndIndex(root, info.parent.id);
  const idx = parentInfo.arr.indexOf(info.parent);
  parentInfo.arr.splice(idx + 1, 0, info.arr.splice(info.index, 1)[0]);
}

function moveBlock(root, id, delta) {
  const info = findParentAndIndex(root, id);
  if (!info) return;
  const newIndex = info.index + delta;
  if (newIndex < 0 || newIndex >= info.arr.length) return;
  const [blk] = info.arr.splice(info.index, 1);
  info.arr.splice(newIndex, 0, blk);
}

function focusBlock(id, pos = null) {
  const el = document.querySelector(`.block[data-id="${id}"] .text`);
  if (el) {
    el.focus();
    const offset = pos === null ? el.textContent.length : pos;
    document.getSelection().collapse(el, offset);
  }
}

document.getElementById('new-page').addEventListener('click', createPage);
renderPages();
if (data.pages[0]) {
  openPage(data.pages[0].id);
}
