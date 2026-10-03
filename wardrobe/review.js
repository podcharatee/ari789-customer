/* Shared ARI789 notes: public read/edit by explicit owner choice; no login. */
(() => {
  'use strict';
  const API = 'https://aiproxy.asymmadv.com/ari789-api/shared-reviews';
  const LEGACY = 'ari789-wardrobe-local-note-v1:';
  const CACHE = 'ari789-shared-note-v1:';
  const entries = new Map();
  let refreshing = null;
  const value = e => ({comment: e.text.value, final: e.box.checked});
  const same = (a, b) => Boolean(a && b && a.comment === b.comment && a.final === b.final);
  const valid = v => v && typeof v.comment === 'string' && v.comment.length <= 4000 && typeof v.final === 'boolean';
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function cache(e) {
    try {
      localStorage.setItem(CACHE + e.room, JSON.stringify({value: value(e), draft: e.dirty,
        revision: e.current?.revision ?? e.baseRevision ?? null, imported: e.imported}));
      e.cacheFailed = false;
    } catch { e.cacheFailed = true; }
  }
  function show(e, text, kind = 'saved') {
    e.state.textContent = text;
    e.state.dataset.kind = kind;
    e.retry.hidden = !(e.dirty && !e.saving);
    e.latest.hidden = !e.conflict;
    e.importButton.hidden = !e.legacy;
    e.row.classList.toggle('room-is-final', e.box.checked);
  }
  function put(e, record) {
    e.text.value = record.comment; e.box.checked = record.final;
    e.row.classList.toggle('room-is-final', record.final);
  }
  function notice(text) { const el = document.getElementById('reviewConnection'); if (el) el.textContent = text; }
  async function request(url, options = {}) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {...options, credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: {'Content-Type': 'application/json', ...(options.headers || {})}});
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'network_error'); error.status = response.status; error.data = data; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }
  function accept(e, record) {
    if (!valid(record) || !Number.isInteger(record.revision)) return;
    if (e.current && record.revision < e.current.revision) return; // Ignore an older in-flight poll.
    if (e.saving) return;
    const base = e.current?.revision ?? e.baseRevision;
    e.current = record;
    if (e.dirty) {
      if (same(value(e), record)) { e.dirty = false; e.conflict = false; e.imported = true; e.legacy = null; cache(e); show(e, 'บันทึกบนเซิร์ฟเวอร์แล้ว'); }
      else if ((base === null || base === undefined) ? record.revision > 0 : record.revision !== base) {
        e.conflict = true; cache(e); show(e, 'มีคนแก้ไขห้องนี้แล้ว · ฉบับร่างของคุณยังอยู่ กรุณาเลือกข้อมูลที่จะใช้', 'error');
      } else { cache(e); show(e, 'มีฉบับร่างรอบันทึก · กดบันทึกอีกครั้ง', 'error'); }
      return;
    }
    if (e.legacy && !e.imported) {
      if (same(e.legacy, record)) { e.legacy = null; e.imported = true; put(e, record); cache(e); show(e, 'ข้อมูลล่าสุดจากเซิร์ฟเวอร์'); }
      else {
        if (record.revision === 0) put(e, e.legacy); else put(e, record);
        show(e, 'มีโน้ตเดิมเฉพาะเครื่องนี้ · ยังไม่ได้ส่งขึ้นออนไลน์', 'saving');
      }
    } else { put(e, record); cache(e); show(e, record.revision ? 'ข้อมูลล่าสุดจากเซิร์ฟเวอร์' : 'ยังไม่มีโน้ต'); }
  }
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const data = await request(API);
        if (data.mode !== 'shared' || !data.reviews) throw new Error('Invalid shared response');
        for (const e of entries.values()) if (data.reviews[e.room]) accept(e, data.reviews[e.room]);
        notice('เชื่อมต่อเซิร์ฟเวอร์แล้ว · อัปเดตข้ามเครื่องอัตโนมัติ');
        return true;
      } catch {
        notice('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ · ข้อมูลบนหน้าจออาจยังไม่ใช่ข้อมูลล่าสุด');
        for (const e of entries.values()) if (!e.saving && !e.conflict) show(e,
          e.dirty ? (e.cacheFailed ? 'ยังไม่บันทึกออนไลน์และเก็บฉบับร่างไม่ได้ · อย่าปิดหน้านี้' : 'ยังไม่บันทึกออนไลน์ · เก็บฉบับร่างในเครื่องไว้แล้ว') : 'ออฟไลน์ · ยังยืนยันข้อมูลล่าสุดไม่ได้', 'error');
        return false;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }
  function queue(e, delay = 650) { clearTimeout(e.timer); e.timer = setTimeout(() => save(e), delay); }
  function edit(e, delay) {
    e.dirty = true; e.legacy = null; cache(e);
    if (e.conflict) show(e, 'มีข้อมูลใหม่จากอีกเครื่อง · ฉบับร่างของคุณยังอยู่', 'error');
    else { show(e, 'กำลังบันทึก…', 'saving'); queue(e, delay); }
  }
  async function save(e) {
    clearTimeout(e.timer);
    if (!e.dirty || e.saving || e.conflict) return;
    if (!e.current) { const ok = await refresh(); if (!ok || !e.current || e.conflict) return; }
    const snapshot = value(e); e.saving = true; show(e, 'กำลังบันทึก…', 'saving');
    try {
      const record = await request(API + '/' + encodeURIComponent(e.room), {method: 'PATCH',
        body: JSON.stringify({...snapshot, expected_revision: e.current.revision})});
      if (!valid(record) || !Number.isInteger(record.revision)) throw new Error('Invalid save response');
      e.current = record; e.baseRevision = record.revision; e.saving = false;
      e.imported = true; e.legacy = null; e.conflict = false;
      if (same(value(e), snapshot)) { e.dirty = false; cache(e); show(e, 'บันทึกบนเซิร์ฟเวอร์แล้ว'); }
      else { cache(e); show(e, 'กำลังบันทึกการแก้ไขล่าสุด…', 'saving'); queue(e, 50); }
      notice('เชื่อมต่อเซิร์ฟเวอร์แล้ว · ทุกคนที่มีลิงก์เห็นข้อมูลที่บันทึกนี้');
    } catch (error) {
      e.saving = false;
      if (error.status === 409 && valid(error.data?.current)) {
        e.current = error.data.current; e.conflict = true; cache(e);
        show(e, 'มีคนแก้ไขห้องนี้แล้ว · ฉบับร่างของคุณยังอยู่ กรุณาเลือกข้อมูลที่จะใช้', 'error');
      } else {
        cache(e); show(e, e.cacheFailed ? 'ยังไม่บันทึกออนไลน์และเก็บฉบับร่างไม่ได้ · อย่าปิดหน้านี้' :
          error.status === 429 ? 'บันทึกถี่เกินไป · ฉบับร่างยังอยู่ กรุณารอสักครู่แล้วลองใหม่' : 'ยังไม่บันทึกออนไลน์ · เก็บฉบับร่างในเครื่องไว้แล้ว', 'error');
      }
    }
  }
  async function retry(e) {
    const draft = value(e);
    await refresh();
    if (e.conflict) {
      if (!confirm('มีข้อมูลจากคนอื่นบนเซิร์ฟเวอร์ ต้องการใช้ฉบับร่างของคุณแทนข้อมูลล่าสุดของห้องนี้หรือไม่?')) return;
      put(e, draft); e.conflict = false; e.dirty = true;
    }
    await save(e);
  }
  async function importOld(e, confirmed = false) {
    if (!e.legacy) return;
    if (!confirmed && !confirm('ส่งคอมเมนต์และ Final เดิมของห้องนี้ให้ทุกคนที่มีลิงก์เห็น และใช้แทนข้อมูลปัจจุบันบนเซิร์ฟเวอร์ใช่ไหม?')) return;
    const old = {...e.legacy};
    if (!(await refresh()) || !e.current) return;
    put(e, old); e.legacy = null; e.conflict = false; e.dirty = true; cache(e); await save(e);
  }
  function button(text, className) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.className = className; return b; }
  function mount() {
    const wrap = document.getElementById('roomTableWrap'); const table = wrap?.querySelector('table');
    if (!table || table.dataset.reviewsMounted) return;
    table.dataset.reviewsMounted = '1'; entries.clear();
    const bar = document.createElement('div'); bar.id = 'sharedReviewToolbar'; bar.className = 'review-toolbar';
    const description = document.createElement('div'); const title = document.createElement('strong');
    title.textContent = 'คอมเมนต์ / Final · บันทึกร่วมบนเซิร์ฟเวอร์';
    const note = document.createElement('p'); note.id = 'reviewNotice';
    note.textContent = 'ทุกคนที่มีลิงก์เห็นและแก้ไขได้ · ไม่ต้องล็อกอิน · กรุณาอย่าใส่ข้อมูลลับ';
    const connection = document.createElement('p'); connection.id = 'reviewConnection'; connection.textContent = 'กำลังเชื่อมต่อเซิร์ฟเวอร์…';
    const actions = document.createElement('div'); const reload = button('โหลดข้อมูลล่าสุด', 'review-refresh'); reload.id = 'reviewRefresh'; reload.addEventListener('click', refresh);
    const importAll = button('นำโน้ตเดิมในเครื่องขึ้นออนไลน์', 'review-import-all'); importAll.id = 'reviewImportAll';
    importAll.addEventListener('click', async () => {
      const candidates = [...entries.values()].filter(e => e.legacy);
      if (!candidates.length) { notice('ไม่มีโน้ตเดิมที่ต้องนำเข้า'); return; }
      if (!confirm('นำคอมเมนต์และ Final เดิมในเครื่องขึ้นเซิร์ฟเวอร์ให้ทุกคนเห็น โดยแทนที่ข้อมูลปัจจุบันของห้องที่มีโน้ตเดิม ต้องการทำต่อหรือไม่?')) return;
      importAll.disabled = true;
      try { for (const e of candidates) await importOld(e, true); } finally { importAll.disabled = false; }
    });
    description.append(title, note, connection); actions.append(reload, importAll); bar.append(description, actions); wrap.before(bar);
    for (const text of ['คอมเมนต์', 'Final']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; table.tHead.rows[0].append(th); }
    for (const row of table.tBodies[0].rows) {
      const room = row.dataset.reviewRoom; if (!room) continue;
      const comment = document.createElement('td'); comment.className = 'review-comment';
      const final = document.createElement('td'); final.className = 'review-final';
      const text = document.createElement('textarea'); text.rows = 2; text.maxLength = 4000;
      text.placeholder = 'พิมพ์คอมเมนต์ของห้องนี้…'; text.setAttribute('aria-label', 'คอมเมนต์ ' + room);
      const box = document.createElement('input'); box.type = 'checkbox'; box.setAttribute('aria-label', 'Final ' + room);
      const label = document.createElement('label'); label.append(box, document.createTextNode(' Final'));
      const state = document.createElement('small'); state.className = 'review-save-state'; state.setAttribute('role', 'status');
      const again = button('บันทึกอีกครั้ง', 'review-retry'); again.hidden = true;
      const latest = button('ใช้ข้อมูลจากเซิร์ฟเวอร์', 'review-retry'); latest.hidden = true;
      const importButton = button('นำโน้ตเดิมขึ้นออนไลน์', 'review-retry'); importButton.hidden = true;
      comment.append(text, state, again, latest, importButton); final.append(label); row.append(comment, final);
      const e = {room, row, text, box, state, retry: again, latest, importButton, dirty: false, saving: false,
        current: null, baseRevision: null, conflict: false, legacy: null, imported: false, cacheFailed: false};
      const saved = read(CACHE + room); const old = read(LEGACY + room);
      if (saved && valid(saved.value)) {
        put(e, saved.value); e.imported = saved.imported === true;
        if (saved.draft) { e.dirty = true; e.baseRevision = Number.isInteger(saved.revision) ? saved.revision : null; }
      }
      if (!e.dirty && !e.imported && valid(old) && (old.comment || old.final)) { e.legacy = old; put(e, old); }
      text.addEventListener('input', () => edit(e, 650)); box.addEventListener('change', () => edit(e, 0));
      again.addEventListener('click', () => retry(e)); importButton.addEventListener('click', () => importOld(e));
      latest.addEventListener('click', () => {
        if (!e.current || !confirm('ละทิ้งฉบับร่างบนหน้านี้ แล้วใช้ข้อมูลล่าสุดจากเซิร์ฟเวอร์หรือไม่?')) return;
        e.dirty = false; e.conflict = false; e.imported = true; e.legacy = null; put(e, e.current); cache(e); show(e, 'ใช้ข้อมูลล่าสุดจากเซิร์ฟเวอร์แล้ว');
      });
      entries.set(room, e); show(e, 'กำลังโหลดข้อมูลออนไลน์…', 'saving');
    }
    refresh();
  }
  window.ARIReviews = {mount};
  window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
  window.addEventListener('storage', event => { if (event.key?.startsWith(CACHE)) refresh(); });
  window.addEventListener('beforeunload', event => { if ([...entries.values()].some(e => e.dirty || e.saving)) { event.preventDefault(); event.returnValue = ''; } });
  setInterval(() => { if (!document.hidden && entries.size) refresh(); }, 15000);
  document.addEventListener('DOMContentLoaded', mount);
})();
