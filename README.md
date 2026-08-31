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
├── supabase/schema.sql … events / notes テーブルの作成SQL
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

### ① Supabase に管理者アカウントを作る
Admin のログインは **Supabase Auth（メール＋パスワード）** です。

1. Supabase → **Authentication → Users → Add user → Create new user**
   メールとパスワードを設定し、**Auto Confirm User を ON**
2. **Authentication → Providers → Email** で **Enable Sign Ups を OFF**
   （他人が勝手にアカウントを作れないように）
3. サイトの Admin からそのメール・パスワードでサインイン

### ② Supabase で画像アップロードを有効にする（下記3章）
未設定でもアップロードは動きますが、**その端末のブラウザにしか保存されません**。

### ③ メール送信（設定済み）
EmailJS 連携済みです。予約すると参加者に確認メールが届き、`info@sym-arch.com` にも
Bcc で控えが入ります。パートナー問い合わせも同アドレスに届きます。
テンプレート本文は `email-templates/` の HTML です。

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

> 予約フォームは **氏名・メール・人数** の3項目だけです（導線を短くするため）。

代替：`CONFIG.formspreeEndpoint` に Formspree のURLを入れるだけでも転送できます（本人への自動返信は無し）。

## 5. Googleカレンダー & リマインドメール

### 参加者側（予約完了ページ）
- **Add to Google Calendar** — 登録画面が開く（日時・場所・詳細入り、`Europe/Amsterdam`）
参加者へのリマインドは「Googleカレンダーに入れてもらう」＋「主催者からのリマインドメール」の2本立てです。

### 主催者側（Admin → RSVPs タブ）
- イベントを選んで **Send reminder via Gmail** → 予約者全員が **BCC** に入った Gmail 作成画面が開きます
- **Copy emails** … アドレスをまとめてコピー
- **Export CSV** … RSVP / 問い合わせをCSV出力

> 「◯日前に自動でリマインドが飛ぶ」完全自動化にはサーバー（cron）が必要です。
> 現状は「参加者のGoogleカレンダー」＋「Gmail下書きワンクリック」の構成です。

## 6. 多言語表示

ヘッダーの言語ボタン（ハンバーガーの左）から8言語に切り替わります。

English（既定）/ Nederlands / 日本語 / 简体中文 / 繁體中文（台灣）/ 한국어 / ไทย / Bahasa Indonesia

### 仕組み
英語がサイト本体で、他の7言語は **Google 翻訳のプロキシ**（`*.translate.goog`）経由で
同じページを表示します。この方式にした理由は2つあります。

- **イベントページの本文も翻訳される。** Admin で書いたイベントの説明文は毎回内容が違うので、
  固定の翻訳ファイルでは対応できません。プロキシならページ全体が対象になります
- **言語を増やしても管理コストがゼロ。** `core.js` の `LANGS` に1行足すだけです

### 制限
- **公開ドメインでのみ動作します。**localhost では翻訳先に到達できないため、
  クリックすると「本番ドメインでのみ動作します」と表示されます
- 機械翻訳なので訳文の品質は保証されません。重要な告知は英語も併記するのが安全です
- より高品質にしたい場合は、後から翻訳ファイル方式（各言語の文言を人力で用意）に
  差し替えられます。その場合もこのボタンの位置と選択肢はそのまま使えます

## 7. Admin ダッシュボード

**Admin ボタンは既定で非表示**です。過去にそのブラウザでサインインした端末でだけ表示されます。
新しいブラウザから入るときは `https://ドメイン/#admin` を開くとログイン画面が出ます。

| タブ | できること |
|---|---|
| Events | イベントの追加 / 編集 / 複製 / 削除。日時・場所・料金・**写真アップロード**・詳細 |
| Note articles | note記事の追加 / 編集 / 削除。URL・タイトル・**サムネイルアップロード**・概要・タグ |
| RSVPs & messages | **全端末の予約一覧**（サインイン時のみ）、問い合わせ、リマインド送信、CSV出力 |

イベントとnote記事は保存と同時に Supabase のテーブルへ書き込まれます。
テーブルを作る前にブラウザ内だけに作られたものがあれば、管理端末で開いたときに
自動で引き上げます（Events タブの「Upload local content to Supabase」で手動実行も可）。

## 8. データの保存場所

| データ | 保存先 |
|---|---|
| イベント / note記事 | **Supabase のテーブル**（`events` / `notes`）。localStorage はキャッシュ |
| 画像 | **Supabase Storage**（`event-photos` バケット） |
| 予約（RSVP） | **Supabase の `rsvps` テーブル** ＋ 確認メール |
| パートナー問い合わせ | EmailJS でメール送信 |

### テーブルの作成（初回のみ）
`supabase/schema.sql` の中身を Supabase の **SQL Editor** に貼り付けて実行してください。
これをやるまでイベントは「投稿した人のブラウザ」にしか残らず、他の訪問者には見えません。

> ⚠️ anon キーで書き込めるポリシーになっています。キーはブラウザのソースに含まれるので、
> 理屈のうえでは第三者もイベントを追加・削除できます。本格運用の前に Supabase Auth を入れて
> 書き込みを `to authenticated` に絞ることをおすすめします（SQL はファイル末尾にコメントで記載）。

### RSVP をテーブルに載せる場合（任意）

```sql
create table rsvps (
  id text primary key, event_id text, name text, email text, guests int,
  created_at timestamptz default now()
);
```
いまは予約がメールでしか残りませんが、テーブルに載せると一覧がどの端末からも見られ、
cron で自動リマインドを送ることもできるようになります。

## 9. デプロイ

- **Vercel** … このフォルダをドラッグ&ドロップ、または `vercel` コマンド
- **Netlify** … フォルダをドロップするだけ
- **GitHub Pages** … リポジトリにpush → Settings → Pages

デプロイ後、`core.js` の `CONFIG.siteUrl` を実際のドメインに変更してください。

## 10. 変更しやすい場所

| やりたいこと | 場所 |
|---|---|
| キャッチコピー・ミッション文言 | `index.html`（`#home` / `#about`） |
| セクション背景写真 | `assets/bg-*.jpg` を差し替え（`index.html` の `band__bg`） |
| SNS / Meetup のリンク | 各HTMLのフッター（index / event / booked の3ファイル） |
| 色・フォント | `styles.css` 冒頭の `:root` |
| 連絡先メール・パスコード・Supabase設定 | `core.js` の `CONFIG` |

## 11. 写真のライセンス

`assets/CREDITS.json` に出典を記録しています。
背景写真はすべてフリー素材（CC0 / パブリックドメイン）ですが、**昼の写真（`bg-day.jpg`）だけ
CC BY 2.0** でクレジット表記が必要なため、フッターに `Daylight photo: Weldon Ken, CC BY 2.0`
を入れています。差し替える場合はこの表記も外してください。

## 12. 予約データとプライバシー

予約には参加者の氏名とメールアドレスが入ります。anon キーはページのソースに
含まれているため、**`rsvps` の読み取りは anon に許可していません**。

| 操作 | 許可 |
|---|---|
| INSERT（訪問者が予約する） | anon / authenticated |
| SELECT・DELETE（一覧・削除） | **authenticated のみ** |

そのため Admin の予約一覧は **Supabase Auth でサインインしているときだけ**表示されます。
サインアウトすると一覧は空になります（データが消えるわけではありません）。

セッションはブラウザに保存され、有効期限が近づくと自動で更新されます。
