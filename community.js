/* =========================================================
   参加者の写真とレビュー（community.js）
   core.js が必要です。19-community-posts.sql が前提です。

   使う場所:
   - event.html … 終わった回のページに、写真・レビューの一覧と投稿欄
   - index.html … Past Events に、回ごとの写真とレビューの数
   - admin.html … Community タブで、投稿を消す

   決めごと（本人と相談済み）:
   - 投稿できるのは、その回に参加した人だけ（DB の attended_event で判定）
   - 投稿はすぐ公開、問題があれば管理画面で消す
   - 表に出すのはイニシャルと国旗だけ
   SQL を流す前はテーブルが無いので、読み込みに失敗したら黙って何も出しません。
   ========================================================= */

const CM_BUCKET = 'community-photos';
/* 国旗は画像で出します。Windows は国旗の絵文字を描けず「JP」の文字になるためです。
   版を固定した CDN から読みます（2週間以上前に出た版）。 */
const FLAG_BASE = 'https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/';
const CM_PHOTO_MAX = 1600;     // 長い辺の最大ピクセル。保存容量（無料枠 1GB）を守るため縮めます
const CM_PHOTO_QUALITY = 0.82;

/* 参加者のアイコン：イニシャルの丸と、右下に国旗 */
function avatarHTML(initials, nat) {
  const code = /^[A-Z]{2}$/.test(nat || '') ? nat : '';
  return `<span class="cm-av" aria-hidden="true">
    <span class="cm-av__i">${esc(initials || '?')}</span>
    ${code ? `<img class="cm-av__flag" src="${FLAG_BASE + code.toLowerCase()}.svg" alt="" loading="lazy">` : ''}
  </span>`;
}

const cmCols = {
  reviews: 'select=id,event_id,initials,nationality,body,created_at',
  photos:  'select=id,event_id,initials,nationality,path,url,created_at'
};

async function loadReviews(eventId, limit) {
  return sbSelect('event_reviews', cmCols.reviews +
    (eventId ? '&event_id=eq.' + encodeURIComponent(eventId) : '') +
    '&order=created_at.desc' + (limit ? '&limit=' + limit : ''));
}

async function loadPhotos(eventId, limit) {
  return sbSelect('event_photos', cmCols.photos +
    (eventId ? '&event_id=eq.' + encodeURIComponent(eventId) : '') +
    '&order=created_at.desc' + (limit ? '&limit=' + limit : ''));
}

/** 投稿できるか（参加した本人で、回が終わっているか）。サーバで判定します */
async function canPostTo(eventId) {
  if (!isSignedIn()) return false;
  try { return (await callRpc('attended_event', { p_event: eventId })) === true; }
  catch { return false; }
}

/** 自分の投稿の id。「消す」ボタンを自分の投稿にだけ出すために使います */
async function myPostIds(eventId) {
  if (!isSignedIn()) return { reviews: [], photos: [] };
  try { return (await callRpc('my_community_posts', { p_event: eventId })) || { reviews: [], photos: [] }; }
  catch { return { reviews: [], photos: [] }; }
}

async function postReview(eventId, body) {
  await ensureSession();
  try {
    await sbInsert('event_reviews', { event_id: eventId, body: String(body || '').trim() });
  } catch (err) {
    if (/duplicate|unique|23505/i.test(err.message)) throw new Error(t('cm.err.oneReview'));
    throw new Error(t('cm.err.post'));
  }
}

/* 写真は送る前に縮めます。スマホの写真は 1枚 3〜6MB あり、
   そのまま置くと保存容量も表示の速さも持ちません */
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, CM_PHOTO_MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error(t('cm.err.photo')))), 'image/jpeg', CM_PHOTO_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('cm.err.photo'))); };
    img.src = url;
  });
}

async function uploadCommunityPhoto(eventId, file) {
  if (!/^image\//.test(file.type)) throw new Error(t('cm.err.photo'));
  await ensureSession();
  const uid = await ensureUserId();
  const blob = await shrinkImage(file);
  /* 自分のフォルダ（user_id/…）にだけ置けるよう、Storage 側で絞ってあります */
  const path = uid + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.jpg';
  const base = CONFIG.supabase.url.replace(/\/+$/, '');
  const res = await fetch(`${base}/storage/v1/object/${CM_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: CONFIG.supabase.anonKey,
      Authorization: 'Bearer ' + sbToken(),
      'Content-Type': 'image/jpeg',
      'cache-control': '31536000'
    },
    body: blob
  });
  if (!res.ok) throw new Error(t('cm.err.photo'));
  const url = `${base}/storage/v1/object/public/${CM_BUCKET}/${path}`;
  try {
    await sbInsert('event_photos', { event_id: eventId, path, url });
  } catch (err) {
    /* 行が作れなかった写真は、置き場所からも消しておきます（どこからも見えないゴミになるため） */
    removeStoredPhoto(path).catch(() => {});
    if (/photo_limit/.test(err.message)) throw new Error(t('cm.err.limit'));
    throw new Error(t('cm.err.post'));
  }
}

async function removeStoredPhoto(path) {
  const base = CONFIG.supabase.url.replace(/\/+$/, '');
  await fetch(`${base}/storage/v1/object/${CM_BUCKET}/${path}`, {
    method: 'DELETE',
    headers: { apikey: CONFIG.supabase.anonKey, Authorization: 'Bearer ' + sbToken() }
  });
}

/** 写真を消す（行と、置き場所のファイルの両方）。本人か管理者だけが通ります */
async function deleteCommunityPhoto(photo) {
  await ensureSession();
  await sbDelete('event_photos', photo.id);
  await removeStoredPhoto(photo.path).catch(() => {});
}

async function deleteCommunityReview(id) {
  await ensureSession();
  await sbDelete('event_reviews', id);
}

const cmDate = iso => new Date(iso).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'short', day: 'numeric' });

function reviewHTML(r, mine) {
  return `<li class="cm-review">
    ${avatarHTML(r.initials, r.nationality)}
    <div class="cm-review__body">
      <p>${esc(r.body)}</p>
      <span class="cm-review__meta">${esc(cmDate(r.created_at))}
        ${mine ? ` · <button type="button" class="linkish" data-cm-del-review="${esc(r.id)}">${esc(t('cm.delete'))}</button>` : ''}</span>
    </div>
  </li>`;
}

function photoHTML(p, mine) {
  return `<figure class="cm-photo">
    <a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy"></a>
    <figcaption>${avatarHTML(p.initials, p.nationality)}
      ${mine ? `<button type="button" class="linkish" data-cm-del-photo="${esc(p.id)}">${esc(t('cm.delete'))}</button>` : ''}</figcaption>
  </figure>`;
}

/* =========================================================
   イベントページ（終わった回）の写真とレビュー
   ========================================================= */
async function renderEventCommunity(ev, box) {
  if (!box) return;
  let reviews, photos;
  try {
    [reviews, photos] = await Promise.all([loadReviews(ev.id), loadPhotos(ev.id)]);
  } catch (err) {
    console.info('community not shown:', err.message);   /* 19 の SQL がまだのとき */
    box.hidden = true;
    return;
  }
  const [can, mine] = await Promise.all([canPostTo(ev.id), myPostIds(ev.id)]);
  const myReview = (mine.reviews || []).length > 0;

  box.innerHTML = `
    <div class="wrap">
      <div class="cm-head">
        <h2>${esc(t('cm.title'))}</h2>
        <p>${esc(t(can ? 'cm.leadCan' : (isSignedIn() ? 'cm.leadNotAttended' : 'cm.leadSignIn')))}
          ${!isSignedIn() ? `<button type="button" class="linkish" data-member>${esc(t('account.signin'))}</button>` : ''}</p>
      </div>

      ${can ? `
      <div class="cm-post">
        <label class="btn btn--line btn--sm cm-post__photo">
          <input type="file" accept="image/*" multiple id="cmFile" hidden>
          <span id="cmFileLabel">${esc(t('cm.addPhotos'))}</span>
        </label>
        ${myReview ? '' : `
        <form class="cm-post__review" id="cmReviewForm">
          <label for="cmReview" class="sr-only">${esc(t('cm.writeReview'))}</label>
          <textarea id="cmReview" rows="3" maxlength="1000" placeholder="${esc(t('cm.reviewPh'))}"></textarea>
          <button class="btn btn--brand btn--sm" type="submit">${esc(t('cm.postReview'))}</button>
        </form>`}
      </div>` : ''}

      ${photos.length ? `<div class="cm-photos">${photos.map(p => photoHTML(p, (mine.photos || []).includes(p.id))).join('')}</div>` : ''}

      ${reviews.length
        ? `<ul class="cm-reviews">${reviews.map(r => reviewHTML(r, (mine.reviews || []).includes(r.id))).join('')}</ul>`
        : (photos.length ? '' : `<p class="cm-empty">${esc(t('cm.empty'))}</p>`)}
    </div>`;
  box.hidden = false;
  initMemberLinks();

  const again = () => renderEventCommunity(ev, box);

  const file = box.querySelector('#cmFile');
  if (file) file.addEventListener('change', async () => {
    const files = [...file.files].slice(0, 12);
    if (!files.length) return;
    const label = file.closest('label');
    label.classList.add('is-busy');
    let done = 0;
    for (const f of files) {
      box.querySelector('#cmFileLabel').textContent = t('cm.uploading', { n: done + 1, total: files.length });
      try { await uploadCommunityPhoto(ev.id, f); done++; }
      catch (err) { toast(err.message, true); break; }
    }
    if (done) toast(t('cm.photosAdded', { n: done }));
    again();
  });

  const form = box.querySelector('#cmReviewForm');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = box.querySelector('#cmReview').value.trim();
    if (text.length < 2) return toast(t('cm.err.short'), true);
    const btn = form.querySelector('button');
    btn.disabled = true;
    try { await postReview(ev.id, text); toast(t('cm.reviewPosted')); again(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  });

  box.querySelectorAll('[data-cm-del-review]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(t('cm.confirmDelete'))) return;
    try { await deleteCommunityReview(b.dataset.cmDelReview); again(); }
    catch (err) { toast(err.message, true); }
  }));
  box.querySelectorAll('[data-cm-del-photo]').forEach(b => b.addEventListener('click', async () => {
    const p = photos.find(x => x.id === b.dataset.cmDelPhoto);
    if (!p || !confirm(t('cm.confirmDelete'))) return;
    try { await deleteCommunityPhoto(p); again(); }
    catch (err) { toast(err.message, true); }
  }));
}
