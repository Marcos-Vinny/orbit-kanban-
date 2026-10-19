const STORAGE_KEY = "kanban-data";
const THEME_KEY = "kanban-theme";

const PRIORITIES = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta"
};

const defaultState = () => ({
  columns: [
    { id: "todo", title: "A fazer", cards: [] },
    { id: "doing", title: "Em andamento", cards: [] },
    { id: "done", title: "Concluído", cards: [] }
  ]
});

const board = document.getElementById("board");
const searchInput = document.getElementById("search");
const addColumnBtn = document.getElementById("add-column");
const themeBtn = document.getElementById("theme");

let state = loadState();
let draggedId = null;
let query = "";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.columns)) return saved;
  } catch {}
  return seedState();
}

function seedState() {
  const s = defaultState();
  s.columns[0].cards.push(
    { id: uid(), text: "Arraste este card para outra coluna", priority: "media" },
    { id: uid(), text: "Clique em ✏️ para editar o texto", priority: "baixa" }
  );
  s.columns[1].cards.push({ id: uid(), text: "Crie seus próprios cards", priority: "alta" });
  return s;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function findCard(cardId) {
  for (let c = 0; c < state.columns.length; c++) {
    const i = state.columns[c].cards.findIndex((card) => card.id === cardId);
    if (i !== -1) return { colIndex: c, cardIndex: i, card: state.columns[c].cards[i] };
  }
  return null;
}

function moveCard(cardId, targetColId, beforeId) {
  const found = findCard(cardId);
  const target = state.columns.find((col) => col.id === targetColId);
  if (!found || !target) return;
  const [card] = state.columns[found.colIndex].cards.splice(found.cardIndex, 1);
  let index = target.cards.length;
  if (beforeId) {
    const i = target.cards.findIndex((c) => c.id === beforeId);
    if (i !== -1) index = i;
  }
  target.cards.splice(index, 0, card);
  saveState();
  render();
}

function shiftCard(cardId, direction) {
  const found = findCard(cardId);
  if (!found) return;
  const next = state.columns[found.colIndex + direction];
  if (!next) return;
  moveCard(cardId, next.id, null);
}

function addCard(colId, text, priority) {
  const col = state.columns.find((c) => c.id === colId);
  if (!col || !text.trim()) return;
  col.cards.push({ id: uid(), text: text.trim(), priority });
  saveState();
  render();
}

function deleteCard(cardId) {
  const found = findCard(cardId);
  if (!found) return;
  state.columns[found.colIndex].cards.splice(found.cardIndex, 1);
  saveState();
  render();
}

function updateCardText(cardId, text) {
  const found = findCard(cardId);
  if (!found) return;
  const clean = text.trim();
  if (clean) found.card.text = clean;
  saveState();
  render();
}

function addColumn() {
  const title = prompt("Nome da nova coluna:");
  if (!title || !title.trim()) return;
  state.columns.push({ id: uid(), title: title.trim(), cards: [] });
  saveState();
  render();
}

function renameColumn(colId, title) {
  const col = state.columns.find((c) => c.id === colId);
  if (!col) return;
  const clean = title.trim();
  if (clean) col.title = clean;
  saveState();
  render();
}

function deleteColumn(colId) {
  const col = state.columns.find((c) => c.id === colId);
  if (!col) return;
  if (!confirm(`Excluir a coluna "${col.title}" e todos os seus cards?`)) return;
  state.columns = state.columns.filter((c) => c.id !== colId);
  saveState();
  render();
}

function getCardAfter(list, y) {
  const cards = [...list.querySelectorAll(".card:not(.dragging)")];
  return cards.find((card) => {
    const box = card.getBoundingClientRect();
    return y < box.top + box.height / 2;
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(label, title, handler) {
  const btn = el("button", "icon-btn", label);
  btn.type = "button";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.addEventListener("click", handler);
  return btn;
}

function buildCard(card, colIndex) {
  const node = el("article", "card");
  node.draggable = true;
  node.dataset.id = card.id;
  node.dataset.priority = card.priority;

  if (query && !card.text.toLowerCase().includes(query)) node.classList.add("hidden");

  const text = el("p", "card-text", card.text);

  const footer = el("div", "card-footer");
  footer.append(el("span", "", "Prioridade: " + PRIORITIES[card.priority]));

  const actions = el("div", "card-actions");

  if (colIndex > 0) actions.append(iconButton("◀", "Mover para a esquerda", () => shiftCard(card.id, -1)));
  if (colIndex < state.columns.length - 1) actions.append(iconButton("▶", "Mover para a direita", () => shiftCard(card.id, 1)));

  const editBtn = iconButton("✏️", "Editar", () => {
    text.contentEditable = "true";
    node.draggable = false;
    text.focus();
    const range = document.createRange();
    range.selectNodeContents(text);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  actions.append(editBtn, iconButton("🗑️", "Excluir", () => deleteCard(card.id)));

  text.addEventListener("blur", () => {
    if (text.isContentEditable) updateCardText(card.id, text.textContent);
  });
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      text.blur();
    }
    if (e.key === "Escape") {
      text.textContent = card.text;
      text.blur();
    }
  });

  footer.append(actions);
  node.append(text, footer);

  node.addEventListener("dragstart", (e) => {
    draggedId = card.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    requestAnimationFrame(() => node.classList.add("dragging"));
  });

  node.addEventListener("dragend", () => {
    draggedId = null;
    node.classList.remove("dragging");
    document.querySelectorAll(".cards.over").forEach((l) => l.classList.remove("over"));
  });

  return node;
}

function buildColumn(col, colIndex) {
  const column = el("section", "column");
  column.dataset.id = col.id;

  const header = el("div", "column-header");
  const title = el("h2", "column-title", col.title);
  title.title = "Clique duas vezes para renomear";
  title.addEventListener("dblclick", () => {
    const name = prompt("Novo nome da coluna:", col.title);
    if (name !== null) renameColumn(col.id, name);
  });
  const count = el("span", "count", String(col.cards.length));
  header.append(title, count, iconButton("✕", "Excluir coluna", () => deleteColumn(col.id)));

  const list = el("div", "cards");

  if (col.cards.length === 0) list.append(el("div", "empty", "Nenhum card"));
  col.cards.forEach((card) => list.append(buildCard(card, colIndex)));

  list.addEventListener("dragover", (e) => {
    if (!draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    list.classList.add("over");
  });

  list.addEventListener("dragleave", (e) => {
    if (!list.contains(e.relatedTarget)) list.classList.remove("over");
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    list.classList.remove("over");
    if (!draggedId) return;
    const after = getCardAfter(list, e.clientY);
    moveCard(draggedId, col.id, after ? after.dataset.id : null);
  });

  const form = el("form", "add-form");
  const input = el("input");
  input.type = "text";
  input.placeholder = "Novo card...";
  input.maxLength = 120;
  input.setAttribute("aria-label", "Texto do novo card");

  const select = el("select");
  select.setAttribute("aria-label", "Prioridade");
  Object.entries(PRIORITIES).forEach(([value, label]) => {
    const option = el("option", "", label);
    option.value = value;
    select.append(option);
  });

  const submit = el("button", "btn", "Adicionar");
  submit.type = "submit";

  form.append(input, select, submit);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addCard(col.id, input.value, select.value);
  });

  column.append(header, list, form);
  return column;
}

function render() {
  board.replaceChildren(...state.columns.map(buildColumn));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

function initTheme() {
  let theme = null;
  try {
    theme = localStorage.getItem(THEME_KEY);
  } catch {}
  if (!theme) theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(theme);
}

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim().toLowerCase();
  render();
});

addColumnBtn.addEventListener("click", addColumn);

themeBtn.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

initTheme();
render();
