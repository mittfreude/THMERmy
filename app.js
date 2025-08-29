const STORAGE_KEY = 'solo-thymer';
let data = loadData();
let currentPageId = null;

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { pages: [] };
  }
  try {
    return JSON.parse(raw);
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
  return { id: genId(), text: '', children: [], collapsed: false, isTask: false, done: false };
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
      saveData();
      openPage(currentPageId);
      focusBlock(block.id, 0);
    } else {
      block.text = content;
      saveData();
    }
  });
  text.addEventListener('keydown', (e) => handleKey(e, block));
  div.appendChild(text);

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
