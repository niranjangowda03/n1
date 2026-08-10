import { el } from '../utils.js';
import * as store from '../store.js';
import { navigate } from '../router.js';

let filterQuery = '';
let filterCategory = 'all';

export function renderNotes(root) {
  document.removeEventListener('dayflow:new-note', handleNewNoteEvent);
  document.addEventListener('dayflow:new-note', handleNewNoteEvent);

  root.appendChild(el('div', { class: 'between mt-8' }, [
    el('h2', {}, 'Notes'),
    el('button', { class: 'btn btn-primary', onclick: openNoteEditor }, '+ New note'),
  ]));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'search-bar' }, [
      '🔎',
      el('input', { type: 'text', placeholder: 'Search notes…', value: filterQuery, oninput: (e) => { filterQuery = e.target.value; navigate('notes'); } }),
    ]),
    el('div', { class: 'pill-group mt-16' }, [
      el('button', { class: `pill${filterCategory === 'all' ? ' selected' : ''}`, onclick: () => { filterCategory = 'all'; navigate('notes'); } }, 'All'),
      ...store.getCategories().map((c) => el('button', { class: `pill${filterCategory === c.id ? ' selected' : ''}`, onclick: () => { filterCategory = c.id; navigate('notes'); } }, `${c.icon} ${c.name}`)),
    ]),
  ]));

  let notes = store.getAllNotes();
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    notes = notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }
  if (filterCategory !== 'all') notes = notes.filter((n) => n.category === filterCategory);
  notes = [...notes].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updatedAt) - new Date(a.updatedAt)));

  if (!notes.length) {
    root.appendChild(el('div', { class: 'card mt-16' }, [
      el('div', { class: 'empty-state' }, [el('span', { class: 'emoji' }, '🗒️'), el('div', {}, 'No notes yet — jot something down before you forget it.')]),
    ]));
    return;
  }

  const grid = el('div', { class: 'notes-grid mt-16' });
  notes.forEach((note) => grid.appendChild(noteCard(note)));
  root.appendChild(grid);
}

function handleNewNoteEvent() { openNoteEditor(); }

function noteCard(note) {
  const cat = store.getCategory(note.category);
  return el('div', { class: 'note-card', onclick: () => openNoteEditor(note) }, [
    el('div', { class: 'note-title' }, [
      el('span', {}, `${note.pinned ? '📌 ' : ''}${note.title}`),
      el('span', {}, note.favorite ? '⭐' : ''),
    ]),
    el('div', { class: 'note-content' }, note.content.slice(0, 140) + (note.content.length > 140 ? '…' : '')),
    el('div', { class: 'note-meta' }, [
      el('span', { class: 'cat-badge', style: `background:${cat.color}22;color:${cat.color}` }, `${cat.icon} ${cat.name}`),
      el('span', {}, new Date(note.updatedAt).toLocaleDateString()),
    ]),
  ]);
}

function openNoteEditor(note = null) {
  const isEdit = !!note;
  const state = { title: note?.title || '', content: note?.content || '', category: note?.category || store.getCategories()[0].id, pinned: !!note?.pinned, favorite: !!note?.favorite };

  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  const modal = el('div', { class: 'modal' });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  function close() { backdrop.remove(); }

  function paint() {
    modal.innerHTML = '';
    modal.append(
      el('div', { class: 'modal-header' }, [
        el('h3', { class: 'modal-title' }, isEdit ? 'Edit note' : 'New note'),
        el('button', { class: 'btn-icon', onclick: close }, '✕'),
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Title'), el('input', { type: 'text', value: state.title, oninput: (e) => (state.title = e.target.value) })]),
      el('div', { class: 'field' }, [el('label', {}, 'Content'), el('textarea', { style: 'min-height:140px', oninput: (e) => (state.content = e.target.value) }, state.content)]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Category'),
        el('div', { class: 'pill-group' }, store.getCategories().map((c) => el('button', {
          class: `pill${state.category === c.id ? ' selected' : ''}`,
          onclick: () => { state.category = c.id; paint(); },
        }, `${c.icon} ${c.name}`))),
      ]),
      el('div', { class: 'row', style: 'gap:18px' }, [
        el('label', { class: 'row', style: 'cursor:pointer' }, [el('input', { type: 'checkbox', checked: state.pinned, onchange: (e) => (state.pinned = e.target.checked) }), ' Pin to top']),
        el('label', { class: 'row', style: 'cursor:pointer' }, [el('input', { type: 'checkbox', checked: state.favorite, onchange: (e) => (state.favorite = e.target.checked) }), ' Favorite']),
      ]),
      el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:20px;gap:10px' }, [
        isEdit ? el('button', { class: 'btn btn-danger', onclick: () => { store.deleteNote(note.id); close(); navigate('notes'); } }, 'Delete') : null,
        el('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          if (!state.title.trim() && !state.content.trim()) { close(); return; }
          if (isEdit) store.updateNote(note.id, state); else store.createNote(state);
          close();
          navigate('notes');
        } }, isEdit ? 'Save changes' : 'Save note'),
      ])
    );
  }
  paint();
}
