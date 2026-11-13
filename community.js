/* =========================================================
   参加者の写真とレビュー（community.js）
   core.js が必要です。19-community-posts.sql が前提です。

   使う場所:
   - event.html … 終わった回のページに、写真（見る・ダウンロード）と感想の一覧・投稿欄
   - index.html … Past Events に、回ごとの写真と感想の数
   - admin.html … Community タブで、写真を追加し、投稿を消す

   決めごと（本人と相談済み）:
   - 写真を追加できるのは管理者だけ。参加者は見てダウンロードできる
   - 感想を書けるのは、その回に参加した人だけ（DB の attended_event で判定）
   - 投稿はすぐ公開、問題があれば管理画面で消す
   - 感想に出すのはイニシャルと国旗だけ
   SQL を流す前はテーブルが無いので、読み込みに失敗したら黙って何も出しません。
   ========================================================= */

const CM_BUCKET = 'community-photos';
/* 国旗は画像で出します。Windows は国旗の絵文字を描けず「JP」の文字になるためです。
   版を固定した CDN から読みます（2週間以上前に出た版）。 */
const FLAG_BASE = 'https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/';
/* 写真の圧縮は「見て分からない」範囲にとどめます（ダウンロードして使う人がいるため）。
   - 長い辺は 3000px まで。スマホの原寸（4032px）から少し縮めるだけで、
     画面でも L 判の印刷でも差は出ません。ファイルは半分ほどになります
   - JPEG の品質は 0.92。0.9 を超えると目で見て元との差はほぼ分かりません
   - 縮める必要がなく、元から JPEG なら作り直さずにそのまま置きます
     （作り直すたびに少しずつ劣化するため）。作り直したほうが大きくなるときも元を使います
   1枚 1MB 前後なので、Supabase の無料枠 1GB で 1000 枚ほど置けます */
const CM_PHOTO_MAX = 3000;
const CM_PHOTO_QUALITY = 0.92;

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

/* 写真は送る前に整えます（上の決めごとのとおり）。 */
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('cm.err.photo'))); };
    img.src = url;
  });
}

const canvasToJpeg = (c, q) => new Promise((resolve, reject) =>
  c.toBlob(b => (b ? resolve(b) : reject(new Error(t('cm.err.photo')))), 'image/jpeg', q));

async function shrinkImage(file) {
  const img = await loadImageFile(file);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const scale = Math.min(1, CM_PHOTO_MAX / Math.max(w0, h0));
  const isJpeg = /^image\/jpe?g$/i.test(file.type);

  /* 縮めなくてよい JPEG は、そのまま使います */
  if (scale === 1 && isJpeg) return file;

  /* 一気に縮めるとギザギザやモアレが出るので、半分ずつ段階的に縮めます */
  let src = img, w = w0, h = h0;
  const tw = Math.round(w0 * scale), th = Math.round(h0 * scale);
  while (w / 2 > tw) {
    const step = document.createElement('canvas');
    step.width = Math.round(w / 2); step.height = Math.round(h / 2);
    const sx = step.getContext('2d');
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
    sx.drawImage(src, 0, 0, step.width, step.height);
    src = step; w = step.width; h = step.height;
  }
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  /* PNG の透明部分が JPEG で黒くならないよう、白を敷いてから描きます */
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, tw, th);
  const out = await canvasToJpeg(c, CM_PHOTO_QUALITY);

  /* 作り直したほうが大きいなら、元の JPEG を使います */
  return (isJpeg && out.size >= file.size) ? file : out;
}

async function uploadCommunityPhoto(eventId, file) {
  if (!/^image\//.test(file.type)) throw new Error(t('cm.err.photo'));
  await ensureSession();
  const blob = await shrinkImage(file);
  /* 置けるのは管理者だけです（Storage 側で絞ってあります）。回ごとのフォルダに置きます */
  const path = eventId + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.jpg';
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

/** 写真を消す（行と、置き場所のファイルの両方）。管理者だけが通ります */
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

/* ダウンロードのマーク（下向きの矢印と受け皿）。文字の代わりに出します */
const DL_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
  'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';

/* ダウンロード用の URL。Supabase Storage は ?download を付けると
   「保存する」形で返します（別ドメインなので <a download> だけでは保存になりません） */
function photoDownloadUrl(p, ev, i) {
  const slug = String((ev && ev.title) || 'asian-socials').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'asian-socials';
  return p.url + '?download=' + encodeURIComponent(slug + '-' + (i + 1) + '.jpg');
}

function photoHTML(p, ev, i) {
  return `<figure class="cm-photo">
    <a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy"></a>
    <figcaption><a class="cm-photo__dl" href="${esc(photoDownloadUrl(p, ev, i))}" download
      aria-label="${esc(t('cm.download'))}" title="${esc(t('cm.download'))}">${DL_ICON}</a></figcaption>
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
      <div class="cm-head">
        <h2>${esc(t('cm.title'))}</h2>
        <p>${esc(t(can ? 'cm.leadCan' : (isSignedIn() ? 'cm.leadNotAttended' : 'cm.leadSignIn')))}
          ${!isSignedIn() ? `<button type="button" class="linkish" data-member>${esc(t('account.signin'))}</button>` : ''}</p>
      </div>

      ${photos.length ? `<div class="cm-photos">${photos.map((p, i) => photoHTML(p, ev, i)).join('')}</div>` : ''}

      ${can && !myReview ? `
      <div class="cm-post">
        <form class="cm-post__review" id="cmReviewForm">
          <label for="cmReview" class="sr-only">${esc(t('cm.writeReview'))}</label>
          <textarea id="cmReview" rows="3" maxlength="1000" placeholder="${esc(t('cm.reviewPh'))}"></textarea>
          <button class="btn btn--brand btn--sm" type="submit">${esc(t('cm.postReview'))}</button>
        </form>
      </div>` : ''}

      ${reviews.length
        ? `<ul class="cm-reviews">${reviews.map(r => reviewHTML(r, (mine.reviews || []).includes(r.id))).join('')}</ul>`
        : (photos.length ? '' : `<p class="cm-empty">${esc(t('cm.empty'))}</p>`)}`;
  box.hidden = false;
  initMemberLinks();

  const again = () => renderEventCommunity(ev, box);

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
}
