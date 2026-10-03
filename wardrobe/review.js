/* Browser-local personal notes only. No login, API, or shared approval state. */
(() => {
  'use strict';
  const PREFIX = 'ari789-wardrobe-local-note-v1:';
  const entries = new Map();
  const emptyNote = () => ({ comment: '', final: false });
  const keyFor = room => PREFIX + room;

  function status(entry, message, failed = false) {
    entry.status.textContent = message;
    entry.status.dataset.kind = failed ? 'error' : 'saved';
    entry.retry.hidden = !failed;
  }

  function parseNote(raw) {
    if (raw === null) return emptyNote();
    const note = JSON.parse(raw);
    if (!note || typeof note.comment !== 'string' || note.comment.length > 4000 ||
        typeof note.final !== 'boolean') throw new Error('Invalid local note');
    return note;
  }

  function load(entry) {
    // Never replace a draft that storage failed to save.
    if (entry.unsaved) return;
    try {
      const raw = localStorage.getItem(keyFor(entry.room));
      const note = parseNote(raw);
      entry.text.value = note.comment;
      entry.box.checked = note.final;
      entry.row.classList.toggle('room-is-final', note.final);
      status(entry, raw === null ? 'ยังไม่มีโน้ต' : 'บันทึกในเบราว์เซอร์นี้แล้ว');
    } catch {
      status(entry, 'อ่านโน้ตเดิมไม่ได้ · เบราว์เซอร์อาจปิดกั้นการเก็บข้อมูล', true);
    }
  }

  function save(entry) {
    const note = { comment: entry.text.value, final: entry.box.checked };
    entry.row.classList.toggle('room-is-final', note.final);
    entry.unsaved = true;
    try {
      const raw = JSON.stringify(note);
      localStorage.setItem(keyFor(entry.room), raw);
      if (localStorage.getItem(keyFor(entry.room)) !== raw) throw new Error('Save failed');
      entry.unsaved = false;
      status(entry, 'บันทึกในเบราว์เซอร์นี้แล้ว');
    } catch {
      status(entry, 'ยังไม่บันทึก · กรุณาคัดลอกโน้ตเก็บไว้ หรืออนุญาตให้เบราว์เซอร์เก็บข้อมูล', true);
    }
  }

  function mount() {
    const wrap = document.getElementById('roomTableWrap');
    const table = wrap?.querySelector('table');
    if (!table || table.dataset.reviewsMounted) return;
    table.dataset.reviewsMounted = '1';
    entries.clear();
    let bar = document.getElementById('localReviewToolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'localReviewToolbar';
      bar.className = 'review-toolbar';
      const description = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = 'โน้ตส่วนตัว / Final · ไม่ต้องล็อกอิน';
      const notice = document.createElement('p');
      notice.id = 'reviewNotice';
      notice.textContent = 'บันทึกอัตโนมัติในเบราว์เซอร์นี้เท่านั้น · ไม่ส่งขึ้นเว็บและไม่ซิงก์ข้ามเครื่อง';
      const warning = document.createElement('p');
      warning.textContent = 'ใช้เบราว์เซอร์เดิมเพื่อดูโน้ต · ล้างข้อมูลเว็บไซต์หรือปิดโหมดไม่ระบุตัวตนแล้วโน้ตอาจหาย';
      description.append(title, notice, warning);
      bar.append(description);
      wrap.before(bar);
    }
    for (const title of ['คอมเมนต์', 'Final']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = title;
      table.tHead.rows[0].append(th);
    }
    for (const row of table.tBodies[0].rows) {
      const room = row.dataset.reviewRoom;
      if (!room) continue;
      const comment = document.createElement('td');
      comment.className = 'review-comment';
      const final = document.createElement('td');
      final.className = 'review-final';
      const text = document.createElement('textarea');
      text.rows = 2;
      text.maxLength = 4000;
      text.placeholder = 'พิมพ์โน้ตของห้องนี้…';
      text.setAttribute('aria-label', 'คอมเมนต์ ' + room);
      const state = document.createElement('small');
      state.className = 'review-save-state';
      state.setAttribute('role', 'status');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'review-retry';
      retry.textContent = 'ลองบันทึกอีกครั้ง';
      retry.hidden = true;
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('aria-label', 'Final ' + room);
      const label = document.createElement('label');
      label.append(box, document.createTextNode(' Final'));
      comment.append(text, state, retry);
      final.append(label);
      row.append(comment, final);
      const entry = { room, row, text, box, status: state, retry, unsaved: false };
      entries.set(room, entry);
      text.addEventListener('input', () => save(entry));
      box.addEventListener('change', () => save(entry));
      retry.addEventListener('click', () => {
        if (entry.unsaved) save(entry);
        else load(entry);
      });
      load(entry);
    }
  }

  window.ARIReviews = { mount };
  window.addEventListener('storage', event => {
    if (event.key === null) entries.forEach(load);
    else if (event.key.startsWith(PREFIX)) {
      const entry = entries.get(event.key.slice(PREFIX.length));
      if (entry) load(entry);
    }
  });
  window.addEventListener('focus', () => entries.forEach(load));
  window.addEventListener('beforeunload', event => {
    if ([...entries.values()].some(entry => entry.unsaved)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  document.addEventListener('DOMContentLoaded', mount);
})();
