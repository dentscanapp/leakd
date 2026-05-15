const fs = require('fs');
const path = require('path');

const i18nPath = path.join(process.cwd(), 'js', 'i18n.js');
let content = fs.readFileSync(i18nPath, 'utf8');

const PANIC_STRINGS = {
  en: { button: 'PANIC BUTTON', sub: 'Spending is high. Time to cut the leaks.', title: 'Panic Mode: Active', intro: 'These subscriptions are costing you the most for the least value. Cut them now to stop the leak.' },
  hu: { button: 'PÁNIKGOMB', sub: 'A költésed elszállt. Ideje elzárni a csapot.', title: 'Pánik mód: Aktív', intro: 'Ezek az előfizetések kerülnek a legtöbbe a legkevesebb érték mellett. Mondd le őket most!' },
  de: { button: 'PANIK-KNOPF', sub: 'Die Ausgaben sind hoch. Zeit, die Lecks zu stopfen.', title: 'Panikmodus: Aktiv', intro: 'Diese Abonnements kosten dich am meisten bei geringstem Nutzen. Kündige sie jetzt!' },
  es: { button: 'BOTÓN DE PÁNICO', sub: 'El gasto es alto. Es hora de cortar las fugas.', title: 'Modo Pánico: Activo', intro: 'Estas suscripciones te cuestan más por el menor valor. Córtalas ahora.' },
  fr: { button: 'BOUTON PANIQUE', sub: 'Les dépenses sont élevées. Il est temps de couper les fuites.', title: 'Mode Panique : Activé', intro: 'Ces abonnements vous coûtent le plus cher pour le moins de valeur. Coupez-les maintenant.' },
  it: { button: 'PULSANTE PANICO', sub: 'Le spese sono alte. È ora di tagliare le perdite.', title: 'Modalità Panico: Attiva', intro: 'Questi abbonamenti ti costano di più per il minor valore. Tagliali ora.' },
  pt: { button: 'BOTÃO DE PÂNICO', sub: 'Os gastos estão altos. É hora de cortar as fugas.', title: 'Modo Pânico: Ativo', intro: 'Estas assinaturas custam mais pelo menor valor. Corte-as agora.' },
  nl: { button: 'PANIEKKNOP', sub: 'De uitgaven zijn hoog. Tijd om de lekken te dichten.', title: 'Paniekmodus: Actief', intro: 'Deze abonnementen kosten u het meest voor de minste waarde. Stop ze nu.' },
  pl: { button: 'PRZYCISK PANIKI', sub: 'Wydatki są wysokie. Czas uszczelnić wycieki.', title: 'Tryb paniki: Aktywny', intro: 'Te subskrypcje kosztują Cię najwięcej przy najmniejszej wartości. Przerwij je teraz.' },
  sv: { button: 'PANIKKNAPP', sub: 'Utgifterna är höga. Dags att täppa till läckorna.', title: 'Panikläge: Aktivt', intro: 'Dessa prenumerationer kostar dig mest för minst värde. Stoppa läckan nu.' },
  cs: { button: 'PANICKÉ TLAČÍTKO', sub: 'Výdaje jsou vysoké. Je čas zastavit úniky.', title: 'Panický režim: Aktivní', intro: 'Tyto odběry vás stojí nejvíce za nejméně hodnoty. Zastavte únik hned teď.' },
  ja: { button: 'パニックボタン', sub: '支出が高すぎます。漏れを止める時です。', title: 'パニックモード：有効', intro: 'これらのサブスクリプションは、最小の価値に対して最大のコストをかけています。今すぐ停止しましょう。' },
  ko: { button: '패닉 버튼', sub: '지출이 너무 많습니다. 누수를 차단할 시간입니다.', title: '패닉 모드: 활성', intro: '이 구독들은 가치에 비해 가장 많은 비용이 들고 있습니다. 지금 바로 해지하세요.' },
  zh: { button: '恐慌按钮', sub: '支出过高。是时候堵住漏洞了繁。', title: '恐慌模式：激活', intro: '这些订阅在价值最低的情况下成本最高。现在就止损吧。' },
  ru: { button: 'КНОПКА ПАНИКИ', sub: 'Расходы высоки. Пора перекрыть утечки.', title: 'Режим паники: Активен', intro: 'Эти подписки стоят вам дороже всего при минимальной ценности. Отмените их сейчас.' },
  ro: { button: 'BUTON PANICĂ', sub: 'Cheltuielile sunt mari. E timpul să oprești scurgerile.', title: 'Mod Panică: Activ', intro: 'Aceste abonamente te costă cel mai mult pentru cea mai mică valoare. Oprește scurgerea acum.' },
  id: { button: 'TOMBOL PANIK', sub: 'Pengeluaran tinggi. Saatnya menghentikan kebocoran.', title: 'Mode Panik: Aktif', intro: 'Langganan ini memakan biaya paling besar dengan nilai terkecil. Hentikan kebocoran sekarang.' },
  vi: { button: 'NÚT HOẢNG LOẠN', sub: 'Chi tiêu đang cao. Đã đến lúc chặn rò rỉ.', title: 'Chế độ Hoảng loạn: Đang hoạt động', intro: 'Các đăng ký này đang tiêu tốn của bạn nhiều nhất cho giá trị ít nhất. Hãy chặn rò rỉ ngay.' },
  tr: { button: 'PANİK BUTONU', sub: 'Harcamalar yüksek. Sızıntıları kesme vakti.', title: 'Panik Modu: Aktif', intro: 'Bu abonelikler size en az değer için en çok maliyeti çıkarıyor. Sızıntıyı şimdi durdurun.' },
  el: { button: 'ΚΟΥΜΠΙ ΠΑΝΙΚΟΥ', sub: 'Τα έξοδα είναι πολλά. Ώρα να κλείσετε τις διαρροές.', title: 'Λειτουργία Πανικού: Ενεργή', intro: 'Αυτές οι συνδρομές σάς κοστίζουν τα περισσότερα για την ελάχιστη αξία. Κλείστε τις τώρα.' },
  hi: { button: 'पैनिक बटन', sub: 'खर्च बहुत ज्यादा है। लीकेज को रोकने का समय है।', title: 'पैनिक मोड: सक्रिय', intro: 'ये सब्सक्रिप्शन आपको सबसे कम मूल्य के लिए सबसे अधिक लागत दे रहे हैं। इन्हें अभी बंद करें।' },
  uk: { button: 'КНОПКА ПАНІКИ', sub: 'Витрати високі. Пора перекрити витоки.', title: 'Режим паніки: Активний', intro: 'Ці підписки коштують вам найбільше при найменшій цінності. Скасуйте їх зараз.' },
  hr: { button: 'GUMB ZA PANIKU', sub: 'Potrošnja je visoka. Vrijeme je da zaustavite curenje.', title: 'Panični način: Aktivan', intro: 'Ove pretplate vas koštaju najviše za najmanju vrijednost. Prekinite ih sada.' },
  bg: { button: 'ПАНИК БУТОН', sub: 'Разходите са високи. Време е да спрете течовете.', title: 'Паник режим: Активен', intro: 'Тези абонаменти ви струват най-много за най-малка стойност. Спрете теча сега.' },
  th: { button: 'ปุ่มตื่นตระหนก', sub: 'การใช้จ่ายสูงเกินไป ถึงเวลาหยุดการรั่วไหลแล้ว', title: 'โหมดตื่นตระหนก: เปิดใช้งาน', intro: 'การสมัครสมาชิกเหล่านี้ทำให้คุณเสียเงินมากที่สุดโดยได้รับคุณค่าน้อยที่สุด หยุดการรั่วไหลทันที' },
  fil: { button: 'TOMBOL NG PANIC', sub: 'Mataas ang gastos. Oras na para itigil ang mga tagas.', title: 'Panic Mode: Aktibo', intro: 'Ang mga subscription na ito ay nagkakahalaga sa iyo ng pinakamalaki para sa pinakamababang halaga.' },
  ca: { button: 'BOTÓ DE PÀNIC', sub: 'La despesa és alta. Hora de tallar les fugues.', title: 'Mode Pànic: Actiu', intro: 'Aquestes subscripcions et costen més pel menor valor. Talla-les ara.' },
  sk: { button: 'PANICKÉ TLAČIDLO', sub: 'Výdavky sú vysoké. Je čas zastaviť úniky.', title: 'Panický režim: Aktívny', intro: 'Tieto odbery vás stoja najviac za najmenej hodnoty. Zastavte únik hneď teraz.' }
};

// Global cleanup of existing panic keys
content = content.replace(/\s+'panic\.(button|sub|title|intro)': .+,/g, '');

for (const [lang, s] of Object.entries(PANIC_STRINGS)) {
  const blockHeader = `${lang}: {`;
  const headerIndex = content.indexOf(blockHeader, content.indexOf('STRINGS = {'));
  if (headerIndex === -1) {
    console.error(`Could not find block for ${lang}`);
    continue;
  }

  const anchor = "'insights.generate':";
  let insertIndex = content.indexOf(anchor, headerIndex);
  if (insertIndex !== -1) {
    insertIndex = content.indexOf('\n', insertIndex) + 1;
  } else {
    insertIndex = content.indexOf('\n', headerIndex) + 1;
  }

  const injection = [
    `      'panic.button': '${s.button.replace(/'/g, "\\'")}',`,
    `      'panic.sub': '${s.sub.replace(/'/g, "\\'")}',`,
    `      'panic.title': '${s.title.replace(/'/g, "\\'")}',`,
    `      'panic.intro': '${s.intro.replace(/'/g, "\\'")}',`
  ].join('\n') + '\n';
  
  content = content.slice(0, insertIndex) + injection + content.slice(insertIndex);
}

fs.writeFileSync(i18nPath, content);
console.log('Successfully injected panic strings into all supported locales.');
