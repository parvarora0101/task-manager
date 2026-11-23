const find = id => document.getElementById(id);
const auth = find('auth');
const workspace = find('workspace');
const credentials = find('credentials');
const editor = find('editor');
const taskForm = find('task-form');
const labels = { todo: 'To do', doing: 'In progress', done: 'Done' };
let registration = false;
let editing = null;
let page = 1;
let loadVersion = 0;

async function api(path, method = 'GET', data) {
  const response = await fetch('/api/' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined
  });
  const value = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && workspace.hidden === false) showAuth();
    throw new Error(value.error);
  }
  return value;
}

function showAuth() {
  loadVersion++;
  if (editor.open) editor.close();
  credentials.reset();
  workspace.hidden = true;
  find('logout').hidden = true;
  auth.hidden = false;
}

async function showWorkspace({ email }) {
  page = 1;
  find('account').textContent = email;
  credentials.reset();
  auth.hidden = true;
  workspace.hidden = false;
  find('logout').hidden = false;
  await refresh();
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

async function act(button, callback, errorId = 'notice') {
  button.disabled = true;
  find(errorId).textContent = '';
  try {
    await callback();
  } catch (error) {
    find(editor.open ? errorId : 'notice').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function cardFor(task) {
  const card = node('article', '', 'card');
  card.append(node('h3', task.title));
  if (task.notes) card.append(node('p', task.notes));
  if (task.due) card.append(node('p', 'Due ' + task.due, 'date'));
  const actions = node('div', '', 'actions');
  const edit = node('button', 'Edit', 'secondary');
  edit.onclick = () => openEditor(task);
  const remove = node('button', 'Delete', 'secondary');
  remove.onclick = () => {
    if (confirm('Delete this task?')) void act(remove, async () => {
      await api('tasks/' + task.id, 'DELETE');
      await refresh();
    });
  };
  actions.append(edit, remove);
  card.append(actions);
  return card;
}

async function refresh(target = page) {
  const version = ++loadVersion;
  const { tasks, hasMore } = await api('tasks?page=' + target);
  if (version !== loadVersion) return;
  if (!tasks.length && target > 1) return refresh(target - 1);
  page = target;
  const columns = Object.entries(labels).map(([status, label]) => {
    const column = node('section', '', 'column');
    column.dataset.status = status;
    column.append(node('h2', label));
    const cards = tasks.filter(task => task.status === status).map(cardFor);
    column.append(...(cards.length ? cards : [node('p', 'No tasks on this page.', 'empty')]));
    return column;
  });
  find('board').replaceChildren(...columns);
  find('page').textContent = 'Page ' + page;
  find('previous').disabled = page <= 1;
  find('next').disabled = !hasMore;
}

function openEditor(task = null) {
  editing = task;
  taskForm.reset();
  find('editor-error').textContent = '';
  find('editor-title').textContent = task ? 'Edit task' : 'New task';
  if (task) for (const field of ['title', 'notes', 'status', 'due']) taskForm.elements[field].value = task[field];
  editor.showModal();
}

find('toggle').onclick = () => {
  registration = !registration;
  find('auth-title').textContent = registration ? 'Create an account' : 'Sign in';
  find('auth-submit').textContent = registration ? 'Create account' : 'Sign in';
  find('toggle').textContent = registration ? 'Back to sign in' : 'Create an account';
  credentials.elements.password.autocomplete = registration ? 'new-password' : 'current-password';
};

credentials.onsubmit = event => {
  event.preventDefault();
  void act(event.submitter, async () => {
    await showWorkspace(await api(registration ? 'register' : 'login', 'POST', Object.fromEntries(new FormData(credentials))));
  });
};
find('logout').onclick = event => void act(event.currentTarget, async () => {
  await api('logout', 'POST');
  showAuth();
});
find('new').onclick = () => openEditor();
find('cancel').onclick = () => editor.close();
function changePage(target) {
  find('notice').textContent = '';
  refresh(target).catch(error => { find('notice').textContent = error.message; });
}
find('previous').onclick = () => changePage(page - 1);
find('next').onclick = () => changePage(page + 1);
taskForm.onsubmit = event => {
  event.preventDefault();
  void act(event.submitter, async () => {
    const data = Object.fromEntries(new FormData(taskForm));
    if (editing) {
      data.revision = editing.revision;
      await api('tasks/' + editing.id, 'PUT', data);
    } else {
      await api('tasks', 'POST', data);
    }
    editor.close();
    await refresh(1);
  }, 'editor-error');
};

api('me').then(showWorkspace).catch(() => showAuth());
