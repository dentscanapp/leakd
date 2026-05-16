import re
import os

path = r'c:\Users\local_user\Documents\leakd\leakd\js\i18n.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

translations = {
    'en': ("What are you saving for?", "Cancel {count} low-rated subs to save <strong>{savings}/mo</strong> and hit your goal in <strong>{months} months</strong>!", "Goal progress: {saved} ({pct}%)"),
    'hu': ("Mire gyűjtesz?", "Mondj le {count} alacsonyra értékelt előfizetést, spórolj <strong>{savings}/hó</strong> összeget, és <strong>{months} hónap</strong> alatt eléred a célod!", "Cél állása: {saved} ({pct}%)"),
    'de': ("Wofür sparst du?", "Kündige {count} niedrig bewertete Abos, spare <strong>{savings}/Monat</strong> und erreiche dein Ziel in <strong>{months} Monaten</strong>!", "Fortschritt: {saved} ({pct}%)"),
    'es': ("¿Para qué estás ahorrando?", "¡Cancela {count} suscripciones de baja calificación para ahorrar <strong>{savings}/mes</strong> y alcanzar tu meta en <strong>{months} meses</strong>!", "Progreso: {saved} ({pct}%)"),
    'fr': ("Pour quoi économisez-vous ?", "Annulez {count} abonnements mal notés pour économiser <strong>{savings}/mois</strong> et atteindre votre objectif en <strong>{months} mois</strong> !", "Progression : {saved} ({pct}%)"),
    'it': ("Per cosa stai risparmiando?", "Cancella {count} abbonamenti con valutazione bassa per risparmiare <strong>{savings}/mese</strong> e raggiungere il tuo obiettivo in <strong>{months} mesi</strong>!", "Progresso: {saved} ({pct}%)"),
    'pt': ("Para que está a poupar?", "Cancele {count} subscrições com baixa avaliação para poupar <strong>{savings}/mês</strong> e atingir o seu objetivo em <strong>{months} meses</strong>!", "Progresso: {saved} ({pct}%)"),
    'nl': ("Waar spaar je voor?", "Zeg {count} laag gewaardeerde abonnementen op om <strong>{savings}/maand</strong> te besparen en je doel in <strong>{months} maanden</strong> te bereiken!", "Voortgang: {saved} ({pct}%)"),
    'pl': ("Na co oszczędzasz?", "Anuluj {count} nisko ocenianych subskrypcji, aby zaoszczędzić <strong>{savings}/mies.</strong> i osiągnąć cel w <strong>{months} mies.</strong>!", "Postęp: {saved} ({pct}%)"),
    'sv': ("Vad sparar du till?", "Avsluta {count} lågt värderade prenumerationer för att spara <strong>{savings}/mån</strong> och nå ditt mål om <strong>{months} månader</strong>!", "Framsteg: {saved} ({pct}%)"),
    'cs': ("Na co šetříte?", "Zrušte {count} nízko hodnocených předplatných, ušetřete <strong>{savings}/měsíc</strong> a dosáhněte svého cíle za <strong>{months} měsíců</strong>!", "Průběh: {saved} ({pct}%)"),
    'ja': ("何のために貯金していますか？", "評価の低いサブスクを{count}個解約して、月間<strong>{savings}</strong>節約し、<strong>{months}ヶ月</strong>で目標を達成しましょう！", "進捗: {saved} ({pct}%)"),
    'ko': ("무엇을 위해 저축하시나요?", "평점이 낮은 구독 {count}개를 취소하여 매월 <strong>{savings}</strong>을 절약하고 <strong>{months}개월</strong> 만에 목표를 달성하세요!", "진행 상황: {saved} ({pct}%)"),
    'zh': ("你在为什么攒钱？", "取消 {count} 个低评分订阅，每月节省 <strong>{savings}</strong>，并在 <strong>{months} 个月</strong>内实现你的目标！", "进度：{saved} ({pct}%)"),
    'ru': ("На что вы копите?", "Отмените {count} подписок с низким рейтингом, чтобы экономить <strong>{savings}/мес.</strong> и достичь цели через <strong>{months} мес.</strong>!", "Прогресс: {saved} ({pct}%)"),
    'ro': ("Pentru ce economisești?", "Anulează {count} abonamente cu rating mic pentru a economisi <strong>{savings}/lună</strong> și a-ți atinge scopul în <strong>{months} luni</strong>!", "Progres: {saved} ({pct}%)"),
    'id': ("Untuk apa Anda menabung?", "Batalkan {count} langganan berperingkat rendah untuk menghemat <strong>{savings}/bulan</strong> dan capai target Anda dalam <strong>{months} bulan</strong>!", "Kemajuan: {saved} ({pct}%)"),
    'vi': ("Bạn đang tiết kiệm để làm gì?", "Hủy {count} đăng ký bị đánh giá thấp để tiết kiệm <strong>{savings}/tháng</strong> và đạt được mục tiêu trong <strong>{months} tháng</strong>!", "Tiến độ: {saved} ({pct}%)"),
    'tr': ("Ne için biriktiriyorsun?", "Düşük puanlı {count} aboneliği iptal ederek ayda <strong>{savings}</strong> tasarruf edin ve hedefinize <strong>{months} ayda</strong> ulaşın!", "İlerleme: {saved} ({pct}%)"),
    'el': ("Για τι αποταμιεύετε;", "Ακυρώστε {count} συνδρομές με χαμηλή βαθμολογία για να εξοικονομήσετε <strong>{savings}/μήνα</strong> και να πετύχετε τον στόχο σας σε <strong>{months} μήνες</strong>!", "Πρόοδος: {saved} ({pct}%)"),
    'hi': ("आप किसके लिए बचत कर रहे हैं?", "<strong>{savings}/माह</strong> बचाने के लिए {count} कम रेटिंग वाले सब्सक्रिप्शन रद्द करें और <strong>{months} महीनों</strong> में अपना लक्ष्य प्राप्त करें!", "प्रगति: {saved} ({pct}%)"),
    'uk': ("На що ви збираєте гроші?", "Скасуйте {count} підписок з низьким рейтингом, щоб заощаджувати <strong>{savings}/міс.</strong> і досягти мети за <strong>{months} міс.</strong>!", "Прогрес: {saved} ({pct}%)"),
    'hr': ("Za što štedite?", "Otkažite {count} pretplata s niskom ocjenom kako biste uštedjeli <strong>{savings}/mjesečno</strong> i postigli svoj cilj za <strong>{months} mjeseci</strong>!", "Napredak: {saved} ({pct}%)"),
    'bg': ("За какво спестявате?", "Откажете {count} ниско оценени абонамента, за да спестявате по <strong>{savings}/месец</strong> и да постигнете целта си след <strong>{months} месеца</strong>!", "Прогрес: {saved} ({pct}%)"),
    'th': ("คุณกำลังออมเงินเพื่ออะไร?", "ยกเลิกการสมัครสมาชิกที่ได้รับคะแนนต่ำ {count} รายการเพื่อประหยัด <strong>{savings}/เดือน</strong> และบรรลุเป้าหมายของคุณใน <strong>{months} เดือน</strong>!", "ความคืบหน้า: {saved} ({pct}%)"),
    'fil': ("Para saan ka nag-iipon?", "I-cancel ang {count} low-rated na subscription para makatipid ng <strong>{savings}/buwan</strong> at maabot ang iyong goal sa loob ng <strong>{months} buwan</strong>!", "Progress: {saved} ({pct}%)"),
    'ca': ("Per a què estàs estalviant?", "Cancel·la {count} subscripcions amb baixa qualificació per estalviar <strong>{savings}/mes</strong> i assolir la teva meta en <strong>{months} mesos</strong>!", "Progrés: {saved} ({pct}%)"),
    'sk': ("Na čo šetríte?", "Zrušte {count} nízko hodnotených predplatných, ušetrite <strong>{savings}/mesiac</strong> a dosiahnite svoj cieľ za <strong>{months} mesiacov</strong>!", "Priebeh: {saved} ({pct}%)"),
}

def replacer(match):
    lang_code = match.group(1)
    existing = match.group(0)
    if lang_code in translations:
        name_label, estimate, progress_short = translations[lang_code]
        new_lines = f"\n      'goal.nameLabel': '{name_label}',\n      'goal.estimate': '{estimate}',\n      'goal.progressShort': '{progress_short}',"
        return existing + new_lines
    return existing

# Match the start of a language block up to 'goal.title'
pattern = r"(\w+): \{\n      // [^\n]*\n(?:[^\}]*?)      'goal\.title': '[^']*',"
new_content = re.sub(pattern, replacer, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
