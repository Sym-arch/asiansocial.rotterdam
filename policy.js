/* =========================================================
   Asian Social Rotterdam — イベントポリシーとプライバシー（policy.html）
   core.js が必要です。

   本文は i18n.js に入れず、ここに3言語まとめて持ちます。
   段落が長く、言語ごとに見比べながら直すことが多いためです。
   文言を変えたら UPDATED の日付も変えてください（本文で「上の日付が
   最新版」と約束しています）。
   ========================================================= */

const POLICY_UPDATED = '2026-09-11';
const MAIL = '<a href="mailto:info@sym-arch.com">info@sym-arch.com</a>';

const POLICY = {
  en: {
    label: 'Policy',
    title: 'Event policy and privacy',
    updated: 'Last updated',
    sections: [
      { id: 'who', h: 'Who we are',
        p: `Asian Social Rotterdam is run by Asian Social, a community organisation (not a company).
            Representative: Taiyo Iino. Contact: ${MAIL}` },
      { id: 'tickets', h: 'Tickets & entry', items: [
        `We check tickets at the entrance. Each ticket can be used once — if the same ticket is shown twice, only the first person gets in.`,
        `You must be 18 or older. We may ask for ID.`
      ] },
      { id: 'cancellations', h: 'Cancellations & refunds', items: [
        `Tickets are non-refundable. This includes not being able to come, changing your mind, arriving late or not showing up.`,
        `<b>Transfer:</b> Can't make it? Send your ticket screenshot to a friend.`,
        `<b>Move to another event:</b> Email ${MAIL} at least 48 hours before the event starts. We'll keep your booking as credit for 2 months — tell us which event you'd like when one opens. Credit can't be exchanged for cash.`
      ] },
      { id: 'changes', h: 'If we cancel or change an event', items: [
        `Some events need a minimum number of participants. If an event doesn't reach it, we'll cancel it and let you know by email — usually 5 days before, but sometimes closer to the date.`,
        `We may also cancel or change an event because of weather, venue problems, safety or other circumstances beyond our control.`,
        `If we cancel, or change the date, time or venue and you can't make it, you can choose a <b>full refund</b> to the card you paid with, or <b>credit for another event</b> (valid for 2 months). Email ${MAIL} to tell us which you'd prefer.`
      ] },
      { id: 'conduct', h: 'At the event', items: [
        `Everyone is welcome, whatever their nationality, background, gender, sexuality, religion, age or language level.`,
        `Harassment, discrimination, unwanted advances or aggressive behaviour are not tolerated. We'll ask you to leave, with no refund, and you won't be able to join future events.`,
        `No selling, promoting or recruiting — including business pitches, network marketing, and religious or political recruitment — without our permission.`,
        `Please follow the venue's rules and our staff's directions. We may refuse entry or ask anyone to leave who doesn't.`,
        `Drink responsibly.`,
        `Look after your belongings. We're not responsible for anything lost, stolen or damaged.`,
        `If you have food allergies, tell us before the event. We can't guarantee food is free of allergens.`
      ] },
      { id: 'privacy', h: 'Privacy', items: [
        `Asian Social is responsible for your data. We keep your name, email address, member number and bookings, to run bookings, send tickets and tell you about changes to events.`,
        `We email members when a new event is announced. Every email has an unsubscribe link, and you can turn these emails off in your profile.`,
        `We use Supabase (database), Stripe (payments), Resend (email) and Vercel (hosting) to run this service.`,
        `We may update this policy. The date at the top shows the latest version.`,
        `You can ask us to see, correct or delete your data at any time: ${MAIL}`
      ] }
    ]
  },

  ja: {
    label: 'ポリシー',
    title: 'イベントポリシーと|プライバシー',
    updated: '最終更新',
    sections: [
      { id: 'who', h: '運営者について',
        p: `Asian Social Rotterdam は、団体「Asian Social」が運営しています（法人ではありません）。
            代表：飯野太陽。お問い合わせ：${MAIL}` },
      { id: 'tickets', h: 'チケットと入場', items: [
        `入口でチケットを確認します。チケットは1回だけ使えます。同じチケットが2回提示された場合、入場できるのは先に提示した方だけです。`,
        `参加は18歳以上に限ります。身分証明書の提示をお願いすることがあります。`
      ] },
      { id: 'cancellations', h: 'キャンセルと返金', items: [
        `チケットの返金はできません。参加できなくなった場合、気が変わった場合、遅刻・無断欠席の場合も含みます。`,
        `<b>譲渡：</b>参加できなくなったら、チケットのスクリーンショットをご友人に送ってください。`,
        `<b>別のイベントへの振替：</b>イベント開始の48時間前までに ${MAIL} へメールしてください。予約をクレジットとして2か月間お預かりします。参加したいイベントが公開されたら、どのイベントにするかお知らせください。クレジットは現金に換えられません。`
      ] },
      { id: 'changes', h: 'イベントの中止・変更', items: [
        `イベントによっては最低参加人数があります。人数に達しなかった場合はイベントを中止し、メールでお知らせします。通常は5日前ですが、それより直前になることもあります。`,
        `天候、会場の都合、安全上の理由、その他やむを得ない事情により、イベントを中止・変更することがあります。`,
        `中止になった場合、または日時・会場が変わって参加できなくなった場合は、お支払いに使ったカードへの<b>全額返金</b>か、<b>別のイベントへの振替</b>（有効期限2か月）を選べます。ご希望を ${MAIL} までメールでお知らせください。`
      ] },
      { id: 'conduct', h: 'イベントでのお願い', items: [
        `国籍、背景、性別、セクシュアリティ、宗教、年齢、語学力にかかわらず、どなたでも歓迎します。`,
        `ハラスメント、差別、望まない誘い、攻撃的な言動は許されません。その場で退場をお願いし（返金なし）、今後のイベントにも参加できなくなります。`,
        `許可なく販売・宣伝・勧誘を行うことは禁止です（ビジネスの売り込み、ネットワークビジネス、宗教・政治の勧誘を含みます）。`,
        `会場のルールとスタッフの指示に従ってください。従っていただけない場合、入場をお断りしたり、退場をお願いしたりすることがあります。`,
        `お酒はほどほどに楽しんでください。`,
        `持ち物はご自身で管理してください。紛失・盗難・破損について、責任を負いかねます。`,
        `食物アレルギーがある方は、イベント前にお知らせください。アレルゲンを含まない料理であることは保証できません。`
      ] },
      { id: 'privacy', h: 'プライバシー', items: [
        `個人データの管理者は Asian Social です。予約の管理、チケットの送付、イベントの変更のお知らせのために、お名前、メールアドレス、会員番号、予約履歴を保管します。`,
        `新しいイベントが公開されたときに、会員の方へお知らせのメールを送ります。どのメールにも配信停止のリンクがあり、プロフィールからも停止できます。`,
        `このサービスの運営に、Supabase（データベース）、Stripe（決済）、Resend（メール）、Vercel（ホスティング）を利用しています。`,
        `このポリシーは更新することがあります。最新の版は、ページ上部の日付で確認できます。`,
        `ご自身のデータの確認・訂正・削除は、いつでも ${MAIL} までご依頼いただけます。`
      ] }
    ]
  },

  nl: {
    label: 'Beleid',
    title: 'Evenementbeleid en privacy',
    updated: 'Laatst bijgewerkt',
    sections: [
      { id: 'who', h: 'Wie we zijn',
        p: `Asian Social Rotterdam wordt georganiseerd door Asian Social, een communityorganisatie (geen bedrijf).
            Vertegenwoordiger: Taiyo Iino. Contact: ${MAIL}` },
      { id: 'tickets', h: 'Tickets en toegang', items: [
        `We controleren tickets bij de ingang. Elk ticket kan één keer worden gebruikt — wordt hetzelfde ticket twee keer getoond, dan komt alleen de eerste persoon binnen.`,
        `Je moet 18 jaar of ouder zijn. We kunnen om een identiteitsbewijs vragen.`
      ] },
      { id: 'cancellations', h: 'Annuleren en terugbetalen', items: [
        `Tickets worden niet terugbetaald. Ook niet als je niet kunt komen, van gedachten verandert, te laat komt of niet verschijnt.`,
        `<b>Overdragen:</b> Kun je niet? Stuur de screenshot van je ticket naar een vriend of vriendin.`,
        `<b>Omzetten naar een ander evenement:</b> Mail ${MAIL} uiterlijk 48 uur voor de start van het evenement. We bewaren je boeking 2 maanden als tegoed — laat ons weten welk evenement je wilt zodra er een openstaat. Tegoed kan niet worden omgezet in geld.`
      ] },
      { id: 'changes', h: 'Als wij een evenement annuleren of wijzigen', items: [
        `Sommige evenementen hebben een minimum aantal deelnemers. Wordt dat niet gehaald, dan annuleren we het evenement en laten we het je per e-mail weten — meestal 5 dagen van tevoren, soms later.`,
        `We kunnen een evenement ook annuleren of wijzigen door het weer, problemen met de locatie, veiligheid of andere omstandigheden buiten onze macht.`,
        `Annuleren wij, of veranderen de datum, tijd of locatie en kun je niet komen, dan kun je kiezen voor een <b>volledige terugbetaling</b> op de kaart waarmee je betaalde, of <b>tegoed voor een ander evenement</b> (2 maanden geldig). Mail ${MAIL} wat je wilt.`
      ] },
      { id: 'conduct', h: 'Tijdens het evenement', items: [
        `Iedereen is welkom, ongeacht nationaliteit, achtergrond, gender, seksualiteit, religie, leeftijd of taalniveau.`,
        `Intimidatie, discriminatie, ongewenste avances of agressief gedrag worden niet getolereerd. We vragen je te vertrekken, zonder terugbetaling, en je kunt niet meer meedoen aan toekomstige evenementen.`,
        `Geen verkoop, promotie of werving — ook geen zakelijke pitches, netwerkmarketing of religieuze of politieke werving — zonder onze toestemming.`,
        `Volg de regels van de locatie en de aanwijzingen van ons team. Wie dat niet doet, kunnen we de toegang weigeren of vragen te vertrekken.`,
        `Drink met mate.`,
        `Let op je spullen. We zijn niet verantwoordelijk voor verlies, diefstal of schade.`,
        `Heb je een voedselallergie? Laat het ons voor het evenement weten. We kunnen niet garanderen dat eten vrij is van allergenen.`
      ] },
      { id: 'privacy', h: 'Privacy', items: [
        `Asian Social is verantwoordelijk voor je gegevens. We bewaren je naam, e-mailadres, lidnummer en boekingen om boekingen te regelen, tickets te sturen en je te informeren over wijzigingen.`,
        `We mailen leden wanneer er een nieuw evenement is. Elke e-mail heeft een afmeldlink, en je kunt deze e-mails uitzetten in je profiel.`,
        `We gebruiken Supabase (database), Stripe (betalingen), Resend (e-mail) en Vercel (hosting) voor deze dienst.`,
        `We kunnen dit beleid bijwerken. De datum bovenaan toont de nieuwste versie.`,
        `Je kunt ons altijd vragen je gegevens in te zien, te corrigeren of te verwijderen: ${MAIL}`
      ] }
    ]
  }
};

function policyHTML(p) {
  const date = new Date(POLICY_UPDATED + 'T12:00:00')
    .toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
  /* 本文はこのファイルに書いた固定の文言だけなので、HTML のまま差し込みます。
     見出しの「|」は折り返してよい位置です（日本語が語の途中で割れないように） */
  return `
    <p class="label label--brand">${esc(p.label)}</p>
    <h1 class="policy__h1">${esc(p.title).split('|').join('<wbr>')}</h1>
    <p class="policy__date">${esc(p.updated)}: ${esc(date)}</p>
    ${p.sections.map(s => `
    <section class="policy__sec" id="${s.id}">
      <h2>${esc(s.h)}</h2>
      ${s.p ? `<p>${s.p}</p>` : ''}
      ${s.items ? `<ul>${s.items.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
    </section>`).join('')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  $('#policyMain').innerHTML = policyHTML(POLICY[currentLang()] || POLICY.en);
  initShell();

  /* 本文はあとから入るので、#privacy などへのリンクはここで改めて飛ばします */
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
});
