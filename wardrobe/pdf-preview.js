/* Preview the published PDF page images before offering the real PDF download. */
(() => {
  'use strict';
  const files = new Map();
  let dialog, title, pages, count, download, notice;
  const absolute = path => new URL(path, document.baseURI).href;
  function register(path, label, images, draft = false) {
    if (!path) return;
    const url = new URL(path, document.baseURI);
    if (url.origin !== location.origin || !url.pathname.toLowerCase().endsWith('.pdf')) return;
    files.set(url.href, {label, images: images || [], draft});
  }
  function configure(data) {
    files.clear();
    for (const room of data.rooms || []) {
      const detail = data.room_details?.[room.room]; if (!detail) continue;
      const price = detail.price?.images || [];
      register(room.download_price, room.room + ' · ราคา', price, room.workflow_status === 'draft');
      register(room.download_set, room.room + ' · ชุดเอกสาร', [...(detail.photos || []), ...(detail.drawings || []), ...price], room.workflow_status === 'draft');
    }
    for (const unit of data.units || []) {
      const prices = [], combined = [];
      for (const section of unit.sections || []) {
        const price = section.price?.images || [];
        if (section.documents?.price) prices.push(...price);
        if (section.documents?.all) combined.push(...(section.photos || []), ...(section.drawings || []), ...price);
        else combined.push(...(section.photos || []));
        register(section.documents?.price, section.id + ' · ราคา', price, section.workflow_status === 'draft');
        register(section.documents?.all, section.id + ' · ชุดเอกสาร', [...(section.photos || []), ...(section.drawings || []), ...price], section.workflow_status === 'draft');
      }
      register(unit.documents?.price, unit.id + ' · ราคาที่เผยแพร่', prices);
      register(unit.documents?.all, unit.id + ' · ชุดเอกสาร', combined, (unit.sections || []).some(s => s.workflow_status === 'draft'));
    }
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.id = 'pdfPreviewModal'; dialog.className = 'pdf-preview-modal'; dialog.setAttribute('aria-labelledby', 'pdfPreviewTitle');
    const bar = document.createElement('div'); bar.className = 'pdf-preview-bar';
    const heading = document.createElement('div'); title = document.createElement('h2'); title.id = 'pdfPreviewTitle';
    count = document.createElement('small'); count.id = 'pdfPreviewCount'; heading.append(title, count);
    const actions = document.createElement('div'); actions.className = 'pdf-preview-actions';
    download = document.createElement('a'); download.id = 'pdfPreviewDownload'; download.className = 'dl-btn'; download.dataset.skipPdfPreview = '1'; download.textContent = 'ดาวน์โหลด PDF';
    const close = document.createElement('button'); close.id = 'closePdfPreview'; close.type = 'button'; close.className = 'dl-btn'; close.setAttribute('aria-label', 'ปิดพรีวิว PDF'); close.textContent = 'ปิด ×'; close.addEventListener('click', () => dialog.close());
    actions.append(download, close); bar.append(heading, actions);
    notice = document.createElement('p'); notice.id = 'pdfPreviewNotice'; notice.className = 'pdf-preview-notice';
    pages = document.createElement('div'); pages.id = 'pdfPreviewPages'; pages.className = 'pdf-preview-pages';
    dialog.append(bar, notice, pages); document.body.append(dialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { pages.replaceChildren(); });
  }
  function open(url, entry) {
    ensureDialog(); title.textContent = entry.label;
    count.textContent = 'พรีวิว PDF · ' + entry.images.length + ' หน้า';
    download.href = url; download.download = decodeURIComponent(new URL(url).pathname.split('/').pop());
    notice.textContent = entry.draft ? 'มีแบบฉบับตรวจแก้ — ยังไม่ Final · ตรวจเอกสารก่อนนำไปใช้งาน' : 'ตรวจเอกสารด้านล่างก่อน แล้วกด “ดาวน์โหลด PDF” เมื่อต้องการเก็บไฟล์';
    pages.replaceChildren();
    entry.images.forEach((item, index) => {
      const figure = document.createElement('figure'); figure.className = 'pdf-preview-page';
      const caption = document.createElement('figcaption'); caption.textContent = 'หน้า ' + (index + 1) + ' / ' + entry.images.length + ' · ' + (item.title || 'เอกสาร');
      const image = document.createElement('img'); image.alt = caption.textContent; image.loading = index === 0 ? 'eager' : 'lazy'; image.decoding = 'sync'; image.src = absolute(item.src);
      image.addEventListener('error', () => { caption.textContent += ' — โหลดภาพไม่ได้ กรุณาลองใหม่หรือดาวน์โหลด PDF'; }, {once: true});
      figure.append(caption, image); pages.append(figure);
    });
    if (!entry.images.length) { const message = document.createElement('p'); message.textContent = 'ยังไม่มีภาพพรีวิวของไฟล์นี้ สามารถดาวน์โหลด PDF ได้จากปุ่มด้านบน'; pages.append(message); }
    if (!dialog.open) dialog.showModal(); pages.scrollTop = 0; dialog.scrollTop = 0;
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || link.dataset.skipPdfPreview || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const entry = files.get(link.href); if (!entry) return;
    event.preventDefault(); open(link.href, entry);
  });
  window.ARIPdfPreview = {configure};
})();
