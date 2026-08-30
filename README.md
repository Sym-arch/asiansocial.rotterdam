# Asian Social Rotterdam — 公式サイト

静的サイト（HTML / CSS / バニラJS）。ビルド不要・サーバー不要で動きます。
**デモデータは入っていません。**イベントもnote記事も、すべて Admin 画面から追加します。

ページは **3枚だけ** です。

| ページ | 役割 |
|---|---|
| `index.html` | トップ1枚もの（Home / About / Events / Note / For Partners / Admin） |
| `event.html?id=xxx` | イベント詳細ページ（写真・詳細・RSVPフォーム） |
| `booked.html?id=xxx` | 予約完了ページ（Googleカレンダー登録・.ics・リマインド導線） |

```
asian-socials-rotterdam/
├── index.html          … トップページ
├── event.html          … イベント詳細ページ
├── booked.html         … 予約完了ページ
├── styles.css          … 全ページ共通デザイン
├── core.js             … 設定・データ・画像アップロード・カレンダー連携・メール送信
├── app.js              … トップページ用（横スクロール、カレンダー、Admin）
├── event.js            … イベント詳細ページ用
├── booked.js           … 予約完了ページ用
├── email-templates/    … EmailJS に貼り付けるメール本文（HTML）
├── assets/
│   ├── logo.jpg        … ロゴ
│   ├── bg-*.jpg        … セクション背景写真（フリー素材）
│   └── CREDITS.json    … 背景写真の出典とライセンス
└── README.md
```

### 画面のつながり
```
index.html  ──イベントカード/カレンダーをクリック──▶  event.html?id=e1
                                                          │
                                                RSVPフォーム │
                                                          ▼
                                                  booked.html?id=…
                                        （Googleカレンダー / .ics / リマインド案内）
```

## 1. ローカルで開く

```bash
python -m http.server 3500 --directory "C:\Users\Tiida\Downloads\asian-socials-rotterdam"
```

→ http://localhost:3500

## 2. 最初にやること

### ① Admin パスコードを変更する
`core.js` 冒頭の `CONFIG.adminPasscode`（初期値 `asr-admin-2026`）を変更してください。

> ⚠️ フロントエンドだけの簡易ロックです。ソースを読めば分かるので「関係者以外にうっかり
> 触られない」レベルの保護です。本格的な認証は Supabase Auth に移行してください。

### ② Supabase で画像アップロードを有効にする（下記3章）
未設定でもアップロードは動きますが、**その端末のブラウザにしか保存されません**。

### ③ メール送信を設定する（下記4章）
未設定だと、予約・問い合わせが自動では届きません。

## 3. 画像アップロード（Supabase Storage）

画像はURL貼り付けではなく、Admin画面から**ファイルを選んでアップロード**します。
Supabaseを設定すると、そのままバケットに入り公開URLで配信されます。

### セットアップ
1. https://supabase.com でプロジェクトを作成
2. **Storage → New bucket** → 名前 `event-photos`、**Public bucket を ON**
3. 匿名キーで書き込めるようにポリシーを追加（SQL Editor で実行）

```sql
-- 誰でも読める（Public bucket なので実質これでOK）
create policy "public read event-photos"
  on storage.objects for select
  using ( bucket_id = 'event-photos' );

-- anon キーでアップロードできる
create policy "anon upload event-photos"
  on storage.objects for insert
  to anon
  with check ( bucket_id = 'event-photos' );
```

4. **Settings → API** から `Project URL` と `anon public` キーをコピー
5. `core.js` の `CONFIG.supabase` に貼り付け

```js
supabase: {
  url:     'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
  bucket:  'event-photos'
}
```

設定できていれば、Admin の Data タブに「Photos are uploaded to your Supabase bucket …」と表示されます。

> ⚠️ anonキーでのアップロードを許可すると、キーを知っている人は誰でもバケットに
> ファイルを置けます。運用が本格化したら Supabase Auth でログインしたユーザーだけに
> 絞る（ポリシーを `to authenticated` に変更する）ことをおすすめします。

### 未設定のときの動き
アップロードした画像は base64 でブラウザ内（localStorage）に保存されます。
テストには十分ですが、**他の人には見えません**。1.6MB を超えるファイルは弾かれます。

## 4. メール送信の設定（EmailJS 推奨）

バックエンド無しで「予約完了メールを本人に自動送信 ＋ 自分にも控えを送る」を実現できます。

1. https://www.emailjs.com/ で無料登録（月200通まで無料）
2. Gmail（info@sym-arch.com）を Email Service として接続 → `service_xxx` を取得
3. テンプレートを2つ作成（プリセットは Contact Us でOK。中身は全部書き換えます）
   - **予約確認**: To `{{attendee_email}}` / Bcc `info@sym-arch.com` / Reply-To `info@sym-arch.com`
     Subject `You're in — {{event_title}}`
     本文は Content の `</>`（code）を開いて **`email-templates/rsvp-confirmation.html`** を貼り付け
   - **パートナー問い合わせ**: To `info@sym-arch.com` / Reply-To `{{reply_to}}` / Subject `{{subject}}`
     本文は **`email-templates/partner-inquiry.html`** を貼り付け
4. Template ID は EmailJS が自動採番します。生成された ID をそのまま使ってください
5. Public Key を取得し、`core.js` の `CONFIG.emailjs` に貼り付け

```js
emailjs: {
  publicKey:         'あなたのPublic Key',
  serviceId:         'service_xxxxxxx',
  rsvpTemplateId:    'template_rsvp',
  contactTemplateId: 'template_contact'
}
```

### テンプレートで使える変数

| RSVP | パートナー問い合わせ |
|---|---|
| `{{name}}` `{{email}}` `{{guests}}` | `{{name}}` `{{email}}` `{{company}}` |
| `{{event_title}}` `{{event_date}}` `{{event_time}}` | `{{topic}}` `{{website}}` |
| `{{event_venue}}` `{{event_price}}` `{{calendar_link}}` | `{{message}}` |
| `{{first_name}}` `{{event_url}}` `{{event_image}}` | `{{subject}}` `{{to_email}}` `{{reply_to}}` |
| `{{logo_url}}` `{{site_url}}` `{{attendee_email}}` | |

> 予約フォームは **氏名・メール・人数・同意** の4項目だけです（導線を短くするため）。
> 出身地や自由記述は取っていないので、テンプレートでも参照しないでください。

代替：`CONFIG.formspreeEndpoint` に Formspree のURLを入れるだけでも転送できます（本人への自動返信は無し）。

## 5. Googleカレンダー & リマインドメール

### 参加者側（予約完了ページ）
- **Add to Google Calendar** — 登録画面が開く（日時・場所・詳細入り、`Europe/Amsterdam`）
- **Email me the details** — 参加者自身に詳細メールを送る下書きを開く

参加者へのリマインドは「Googleカレンダーに入れてもらう」＋「主催者からのリマインドメール」の2本立てです。

### 主催者側（Admin → RSVPs タブ）
- イベントを選んで **Send reminder via Gmail** → 予約者全員が **BCC** に入った Gmail 作成画面が開きます
- **Copy emails** … アドレスをまとめてコピー
- **Export CSV** … RSVP / 問い合わせをCSV出力

> 「◯日前に自動でリマインドが飛ぶ」完全自動化にはサーバー（cron）が必要です。
> 現状は「参加者のGoogleカレンダー」＋「Gmail下書きワンクリック」の構成です。

## 6. Admin ダッシュボード

ヘッダー右上の **Admin** → パスコード入力。

| タブ | できること |
|---|---|
| Events | イベントの追加 / 編集 / 複製 / 削除。日時・場所・料金・**写真アップロード**・詳細 |
| Note articles | note記事の追加 / 編集 / 削除。URL・タイトル・**サムネイルアップロード**・概要・タグ |
| RSVPs & messages | 予約一覧、パートナー問い合わせ一覧、リマインド送信、CSV出力 |
| Data | 全データのJSONエクスポート / インポート / 全削除 |

イベントのカテゴリは、カレンダーとカードの色に対応します：
赤＝Meetup / 紫＝Culture / オレンジ＝Food。

## 7. データの保存場所と制限（重要）

| データ | 現在の保存先 | 公開サイトとして使うには |
|---|---|---|
| 画像 | Supabase Storage（未設定ならブラウザ） | 3章の設定で解決 |
| イベント / note記事 | **そのブラウザの localStorage** | `core.js` の `SEED_EVENTS`/`SEED_NOTES` に書き出すか、Supabase のテーブル化 |
| RSVP / 問い合わせ | **訪問者のブラウザ** ＋ メール送信 | 4章の設定が必須 |

### 当面の運用
1. Supabase（画像）と EmailJS（メール）を設定する
2. イベントは Admin で作成 → **Data → Download JSON** → 中身を `core.js` の `SEED_EVENTS` に貼って再デプロイ
3. 更新頻度が上がったら、下記のテーブル化へ

### 次の一手：イベント本体も Supabase に載せる
`core.js` のデータ層（`DB` / `EVENTS` / `NOTES` / `RSVPS` / `MSGS`）を差し替えるだけで移行できます。

```sql
create table events (
  id text primary key, title text not null, date date not null,
  start_time text, end_time text, category text, venue text, address text,
  price text, image text, description text,
  created_at timestamptz default now()
);
create table notes (
  id text primary key, title text not null, url text not null,
  date date, tag text, image text, description text
);
create table rsvps (
  id text primary key, event_id text, name text, email text, guests int,
  origin text, message text, created_at timestamptz default now()
);
```
読み取りは anon で公開、書き込み（Admin）は Supabase Auth + RLS で保護してください。
こうすると「全訪問者が同じイベントを見る」「予約がDBに溜まる」「cronで自動リマインド」が可能になります。

## 8. デプロイ

- **Vercel** … このフォルダをドラッグ&ドロップ、または `vercel` コマンド
- **Netlify** … フォルダをドロップするだけ
- **GitHub Pages** … リポジトリにpush → Settings → Pages

デプロイ後、`core.js` の `CONFIG.siteUrl` を実際のドメインに変更してください。

## 9. 変更しやすい場所

| やりたいこと | 場所 |
|---|---|
| キャッチコピー・ミッション文言 | `index.html`（`#home` / `#about`） |
| セクション背景写真 | `assets/bg-*.jpg` を差し替え（`index.html` の `band__bg`） |
| SNS / Meetup のリンク | `index.html` のフッター（現在はプレースホルダ） |
| 色・フォント | `styles.css` 冒頭の `:root` |
| 連絡先メール・パスコード・Supabase設定 | `core.js` の `CONFIG` |

## 10. 写真のライセンス

`assets/CREDITS.json` に出典を記録しています。
背景写真はすべてフリー素材（CC0 / パブリックドメイン）ですが、**昼の写真（`bg-day.jpg`）だけ
CC BY 2.0** でクレジット表記が必要なため、フッターに `Daylight photo: Weldon Ken, CC BY 2.0`
を入れています。差し替える場合はこの表記も外してください。
