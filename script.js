const canvas = document.querySelector('#canvas');
const world = document.querySelector('#world');
const colors = ['coral', 'yellow', 'blue', 'mint', 'lilac', 'peach'];
const infoButton = document.querySelector('#infoButton');
const infoPanel = document.querySelector('#infoPanel');
const clearButton = document.querySelector('#clearButton');
const clearDialog = document.querySelector('#clearDialog');
let zoom = 1;
let panX = 0;
let panY = 0;
let pointerStart = null;
let moved = false;
let draggingNote = null;
let dragOffset = { x: 0, y: 0 };
let dragStart = null;
let dragMoved = false;
let suppressNextClick = false;
let selectedColor = colors[Math.floor(Math.random() * colors.length)];
const undoStack = [];
const redoStack = [];
const connections = [];
let connectMode = false;
let firstConnectionNote = null;
let groupMode = false;
const selectedNotes = new Set();

document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.classList.toggle('active', swatch.dataset.color === selectedColor);
});

infoButton.addEventListener('click', event => {
  event.stopPropagation();
  infoPanel.hidden = !infoPanel.hidden;
});

function closeClearDialog() { clearDialog.hidden = true; }
clearButton.addEventListener('click', () => { clearDialog.hidden = false; });
document.querySelector('#cancelClear').addEventListener('click', closeClearDialog);
clearDialog.addEventListener('click', event => { if (event.target === clearDialog) closeClearDialog(); });
document.querySelector('#confirmClear').addEventListener('click', () => {
  const notes = [...world.querySelectorAll('.sticky-note')];
  if (notes.length) {
    undoStack.push({ type: 'clear', notes, savedConnections: connections.map(connection => [...connection]) });
    redoStack.length = 0;
    notes.forEach(note => note.remove());
    connections.length = 0;
    drawConnections();
  }
  closeClearDialog();
});

function updateZoomLabel() {
  document.querySelector('#zoomLevel').textContent = `${Math.round(zoom * 100)}%`;
}

function setZoom(nextZoom, centerX = window.innerWidth / 2, centerY = window.innerHeight / 2) {
  const worldPoint = screenToWorld(centerX, centerY);
  zoom = Math.min(3, Math.max(0.25, nextZoom));
  panX = centerX - worldPoint.x * zoom;
  panY = centerY - worldPoint.y * zoom;
  applyView();
  updateZoomLabel();
}

function recordNewNote(note) {
  undoStack.push({ type: 'add', note });
  redoStack.length = 0;
}

function drawConnections() {
  const svg = document.querySelector('#connections');
  svg.querySelectorAll('path').forEach(path => path.remove());
  connections.forEach(([firstId, secondId]) => {
    const first = world.querySelector(`[data-id="${firstId}"]`);
    const second = world.querySelector(`[data-id="${secondId}"]`);
    if (!first || !second) return;
    const x1 = parseFloat(first.style.left) + 95;
    const y1 = parseFloat(first.style.top) + 85;
    const x2 = parseFloat(second.style.left) + 95;
    const y2 = parseFloat(second.style.top) + 85;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`);
    svg.appendChild(path);
  });
}

function removeNote(note) {
  selectedNotes.delete(note);
  for (let index = connections.length - 1; index >= 0; index--) {
    if (connections[index].includes(note.dataset.id)) connections.splice(index, 1);
  }
  note.remove();
  drawConnections();
}

function applyView() {
  world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function screenToWorld(x, y) {
  return { x: (x - panX) / zoom, y: (y - panY) / zoom };
}

function addStickyNote(x, y) {
  const note = document.createElement('div');
  note.className = 'sticky-note';
  note.dataset.id = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  note.dataset.color = selectedColor;
  note.style.setProperty('--tilt', `${(Math.random() * 5 - 2.5).toFixed(1)}deg`);
  note.style.left = `${x - 95}px`;
  note.style.top = `${y - 85}px`;
  note.setAttribute('aria-label', 'Sticky note');
  note.innerHTML = '<button class="move-note" aria-label="Move note">⠿</button><button class="delete-note" aria-label="Delete note">×</button><span class="group-label"></span><div class="note-text" contenteditable="true" role="textbox" aria-label="Type your idea here"></div>';
  world.appendChild(note);
  recordNewNote(note);
  note.querySelector('.note-text').focus();
}

canvas.addEventListener('pointerdown', event => {
  if (event.button === 0 && event.target.closest('.sticky-note') && !connectMode && !groupMode && !event.target.closest('.delete-note')) {
    draggingNote = event.target.closest('.sticky-note');
    const point = screenToWorld(event.clientX, event.clientY);
    dragStart = { x: event.clientX, y: event.clientY };
    dragMoved = false;
    dragOffset = { x: point.x - parseFloat(draggingNote.style.left), y: point.y - parseFloat(draggingNote.style.top) };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (event.button !== 2) return;
  pointerStart = { x: event.clientX, y: event.clientY, panX, panY };
  moved = false;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (draggingNote) {
    const point = screenToWorld(event.clientX, event.clientY);
    if (Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y) > 5) dragMoved = true;
    if (dragMoved) {
      draggingNote.style.left = `${point.x - dragOffset.x}px`;
      draggingNote.style.top = `${point.y - dragOffset.y}px`;
      drawConnections();
    }
    return;
  }
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
  if (moved) {
    panX = pointerStart.panX + dx;
    panY = pointerStart.panY + dy;
    canvas.classList.add('is-panning');
    applyView();
  }
});

canvas.addEventListener('pointerup', event => {
  if (draggingNote) {
    if (dragMoved) suppressNextClick = true;
    draggingNote = null;
    dragStart = null;
    dragMoved = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  if (!pointerStart) return;
  pointerStart = null;
  canvas.classList.remove('is-panning');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  draggingNote = null;
  dragStart = null;
  dragMoved = false;
  pointerStart = null;
  canvas.classList.remove('is-panning');
});

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const oldZoom = zoom;
  const nextZoom = Math.min(3, Math.max(0.25, zoom * (event.deltaY < 0 ? 1.1 : 0.9)));
  const worldPoint = screenToWorld(event.clientX, event.clientY);
  zoom = nextZoom;
  panX = event.clientX - worldPoint.x * zoom;
  panY = event.clientY - worldPoint.y * zoom;
  if (oldZoom !== zoom) { applyView(); updateZoomLabel(); }
}, { passive: false });

canvas.addEventListener('click', event => {
  if (event.button !== 0) return;
  if (suppressNextClick) { suppressNextClick = false; return; }
  const note = event.target.closest('.sticky-note');
  if (note) {
    if (event.target.closest('.delete-note')) { removeNote(note); return; }
    if (groupMode) {
      if (selectedNotes.has(note)) { selectedNotes.delete(note); note.classList.remove('group-selected'); }
      else { selectedNotes.add(note); note.classList.add('group-selected'); }
      updateGroupButton();
      return;
    }
    if (connectMode) {
      if (!firstConnectionNote) {
        firstConnectionNote = note;
        note.classList.add('connect-first');
      } else if (firstConnectionNote !== note) {
        const pair = [firstConnectionNote.dataset.id, note.dataset.id];
        const duplicate = connections.some(connection => connection.includes(pair[0]) && connection.includes(pair[1]));
        if (!duplicate) connections.push(pair);
        firstConnectionNote.classList.remove('connect-first');
        firstConnectionNote = null;
        drawConnections();
      }
    }
    return;
  }
  const point = screenToWorld(event.clientX, event.clientY);
  addStickyNote(point.x, point.y);
});

canvas.addEventListener('contextmenu', event => event.preventDefault());

document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    selectedColor = swatch.dataset.color;
    document.querySelectorAll('.color-swatch').forEach(item => item.classList.toggle('active', item === swatch));
  });
});

document.querySelector('#zoomIn').addEventListener('click', () => setZoom(zoom * 1.2));
document.querySelector('#zoomOut').addEventListener('click', () => setZoom(zoom * 0.8));
document.querySelector('#resetZoom').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; applyView(); updateZoomLabel(); });

document.querySelector('#searchInput').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  world.querySelectorAll('.sticky-note').forEach(note => {
    note.style.opacity = !query || note.querySelector('.note-text').textContent.toLowerCase().includes(query) ? '1' : '.18';
  });
});

document.querySelector('#connectButton').addEventListener('click', () => {
  connectMode = !connectMode;
  document.querySelector('#connectButton').classList.toggle('active', connectMode);
  if (!connectMode && firstConnectionNote) { firstConnectionNote.classList.remove('connect-first'); firstConnectionNote = null; }
});

function updateGroupButton() {
  document.querySelector('#groupButton').textContent = selectedNotes.size ? `Group ${selectedNotes.size}` : 'Group';
}

document.querySelector('#groupButton').addEventListener('click', () => {
  if (!groupMode) {
    groupMode = true;
    document.querySelector('#groupButton').classList.add('active');
    updateGroupButton();
    return;
  }
  if (!selectedNotes.size) {
    groupMode = false;
    document.querySelector('#groupButton').classList.remove('active');
    updateGroupButton();
    return;
  }
  const name = window.prompt('Name this group:');
  if (name && name.trim()) selectedNotes.forEach(note => { note.dataset.group = name.trim(); note.querySelector('.group-label').textContent = name.trim(); note.classList.add('has-group'); });
  selectedNotes.forEach(note => note.classList.remove('group-selected'));
  selectedNotes.clear(); groupMode = false;
  document.querySelector('#groupButton').classList.remove('active'); updateGroupButton();
});

document.querySelector('#organizeButton').addEventListener('click', () => {
  const notes = [...world.querySelectorAll('.sticky-note')].sort((a, b) => (a.dataset.group || 'zzz').localeCompare(b.dataset.group || 'zzz'));
  notes.forEach((note, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    note.style.left = `${40 + column * 220}px`;
    note.style.top = `${40 + row * 200}px`;
    note.style.setProperty('--tilt', `${(index % 3 - 1) * .7}deg`);
  });
  drawConnections();
});

document.querySelector('#undoButton').addEventListener('click', () => {
  const action = undoStack.pop();
  if (!action) return;
  if (action.type === 'add') removeNote(action.note);
  if (action.type === 'clear') { action.notes.forEach(note => world.appendChild(note)); connections.push(...action.savedConnections.map(connection => [...connection])); drawConnections(); }
  redoStack.push(action);
});

document.querySelector('#redoButton').addEventListener('click', () => {
  const action = redoStack.pop();
  if (!action) return;
  if (action.type === 'add') { world.appendChild(action.note); drawConnections(); }
  if (action.type === 'clear') { action.notes.forEach(note => note.remove()); connections.length = 0; drawConnections(); }
  undoStack.push(action);
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.activeElement?.classList.contains('note-text')) document.activeElement.blur();
  if ((event.key === 'Delete' || event.key === 'Backspace') && document.activeElement?.classList.contains('note-text') && !document.activeElement.textContent.trim()) {
    removeNote(document.activeElement.closest('.sticky-note'));
  }
});

applyView();
updateZoomLabel();
