const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'js', 'i18n.js');
let content = fs.readFileSync(filePath, 'utf8');

const translations = {
  it: "      'menu.activity': 'Registro attività',\\n" +
      "      'menu.activitySub': 'Vedi ogni modifica che hai apportato',\\n" +
      "      'activity.title': 'Registro attività',\\n" +
      "      'activity.empty': 'Ancora nessuna attività. Aggiungi un abbonamento per iniziare.',\\n" +
      "      'activity.added': 'Aggiunto {name}',\\n" +
      "      'activity.edited': 'Modificato {name}',\\n" +
      "      'activity.cancelled': 'Annullato {name}',\\n" +
      "      'activity.paused': 'In pausa {name}',\\n" +
      "      'activity.resumed': 'Ripreso {name}',\\n" +
      "      'activity.restored': 'Ripristinato {name}',\\n" +
      "      'activity.deleted': 'Eliminato {name}',\\n" +
      "      'activity.imported': 'Importati {n} abbonamenti',\\n" +
      "      'personality.title': 'La tua personalità di abbonamento',\\n" +
      "      'personality.quietCutter': 'Il cancellatore silenzioso',\\n" +
      "      'personality.quietCutterTag': 'Hai eliminato diversi abbonamenti quest\\'anno — una vittoria silenziosa',\\n" +
      "      'personality.bundleMaster': 'Maestro dei pacchetti',\\n" +
      "      'personality.bundleMasterTag': 'Sai come accumulare i risparmi',\\n" +
      "      'personality.streamingJunkie': 'Dipendente dallo streaming',\\n" +
      "      'personality.streamingJunkieTag': 'Tre o più abbonamenti di intrattenimento — ami le tue serie',\\n" +
      "      'personality.aiHoarder': 'Accumulatore di IA',\\n" +
      "      'personality.aiHoarderTag': 'Collezioni strumenti di IA più velocemente di quanto rilascino aggiornamenti',\\n" +
      "      'personality.productivityStack': 'Il professionista della produttività',\\n" +
      "      'personality.productivityStackTag': 'Cinque o più strumenti di lavoro — energia da power user',\\n" +
      "      'personality.musicSnob': 'Snob della musica',\\n" +
      "      'personality.musicSnobTag': 'Più servizi musicali — orecchio esigente',\\n" +
      "      'personality.spiraler': 'Spirale di abbonamenti',\\n" +
      "      'personality.spiralerTag': 'Dieci o più abbonamenti attivi. Forse è ora di un controllo?',\\n" +
      "      'personality.minimalist': 'Il minimalista salutare',\\n" +
      "      'personality.minimalistTag': 'Pochi abbonamenti, tutti con valutazioni alte. Un\\'ispirazione.',\\n" +
      "      'personality.forgotten': 'Il dimenticato',\\n" +
      "      'personality.forgottenTag': 'Hai abbonamenti più vecchi di un anno che não valuti mai',\\n" +
      "      'personality.starting': 'Hai appena iniziato',\\n" +
      "      'personality.startingTag': 'Benvenuto — ogni perdita inizia con una goccia',\\n" +
      "      'bench.title': 'Come ti confronti',\\n" +
      "      'bench.expected': 'Media per {count} abbonamenti: {expected}',\\n" +
      "      'bench.percentile': 'Top {pct}% dei tracciatori',\\n" +
      "      'bench.lower': 'sotto la media',\\n" +
      "      'bench.average': 'nella media',\\n" +
      "      'bench.higher': 'sopra la media',\\n" +
      "      'bench.muchHigher': 'molto al di sopra',\\n" +
      "      'menu.whatif': 'Calcolatore \"Cosa succederebbe se\"',\\n" +
      "      'menu.whatifSub': 'Scegli gli abbonamenti da annullare — vedi i risparmi in tempo reale',\\n" +
      "      'whatif.title': 'Calcolatore \"Cosa succederebbe se\"',\\n" +
      "      'whatif.blurb': 'Tocca gli abbonamenti per contrassegnarli come annullati in questo scenario. Ti mostriamo cosa risparmieresti senza modificare i tuoi dati reali.',\\n" +
      "      'whatif.empty': 'Nessun abbonamento attivo da simulare.',\\n" +
      "      'whatif.suggestBtn': 'Suggerisci le scelte migliori',\\n" +
      "      'whatif.clearBtn': 'Cancella tutto',\\n" +
      "      'whatif.summarySelected': '{n} selezionati',\\n" +
      "      'whatif.summarySavings': '{monthly}/mese · {yearly}/anno',\\n" +
      "      'whatif.investedNote': 'Investiti al 7%: {y5} in 5 anni, {y10} in 10',\\n" +
      "      'home.notesLabel': 'Note',\\n" +
      "      'streak.days': 'giorni di fila',\\n" +
      "      'streak.msg': 'Hai resistito a un nuovo abbonamento oggi?',\\n" +
      "      'streak.btn': 'Sono rimasto pulito!',\\n" +
      "      'streak.done': 'Rimasto pulito oggi! ✨',\\n" +
      "      'streak.msgDone': 'Ottimo lavoro! Ci vediamo domani per mantenere la schermata pulita.',\\n" +
      "      'toast.streakUpdated': 'Serie aggiornata! 🔥',",

  pt: "      'menu.activity': 'Registro de atividade',\\n" +
      "      'menu.activitySub': 'Veja cada alteração que fez',\\n" +
      "      'activity.title': 'Registro de atividade',\\n" +
      "      'activity.empty': 'Ainda sem atividade. Adicione uma assinatura para começar.',\\n" +
      "      'activity.added': 'Adicionado {name}',\\n" +
      "      'activity.edited': 'Editado {name}',\\n" +
      "      'activity.cancelled': 'Cancelado {name}',\\n" +
      "      'activity.paused': 'Pausado {name}',\\n" +
      "      'activity.resumed': 'Retomado {name}',\\n" +
      "      'activity.restored': 'Restaurado {name}',\\n" +
      "      'activity.deleted': 'Excluído {name}',\\n" +
      "      'activity.imported': 'Importadas {n} assinaturas',\\n" +
      "      'personality.title': 'Sua personalidade de assinatura',\\n" +
      "      'personality.quietCutter': 'O cancelador silencioso',\\n" +
      "      'personality.quietCutterTag': 'Cancelou várias assinaturas este ano — vencendo em silêncio',\\n" +
      "      'personality.bundleMaster': 'Mestre dos pacotes',\\n" +
      "      'personality.bundleMasterTag': 'Sabe como acumular poupança',\\n" +
      "      'personality.streamingJunkie': 'Viciado em streaming',\\n" +
      "      'personality.streamingJunkieTag': 'Três ou mais assinaturas de entretenimento — adora as suas séries',\\n" +
      "      'personality.aiHoarder': 'Acumulador de IA',\\n" +
      "      'personality.aiHoarderTag': 'Coleciona ferramentas de IA mais rápido do que lançam atualizações',\\n" +
      "      'personality.productivityStack': 'O profissional da produttività',\\n" +
      "      'personality.productivityStackTag': 'Cinco ou mais ferramentas de trabalho — energia de utilizador avançado',\\n" +
      "      'personality.musicSnob': 'Esnobe da música',\\n" +
      "      'personality.musicSnobTag': 'Vários serviços de música — ouvido exigente',\\n" +
      "      'personality.spiraler': 'Espiral de assinaturas',\\n" +
      "      'personality.spiralerTag': 'Dez ou mais assinaturas relativas. Talvez seja hora de uma auditoria?',\\n" +
      "      'personality.minimalist': 'O minimalista saudável',\\n" +
      "      'personality.minimalistTag': 'Poucas assinaturas, todas bem avaliadas. Uma inspiração.',\\n" +
      "      'personality.forgotten': 'O esquecido',\\n" +
      "      'personality.forgottenTag': 'Tem assinaturas com mais de um ano que nunca avalia',\\n" +
      "      'personality.starting': 'Apenas a começar',\\n" +
      "      'personality.startingTag': 'Bem-vindo — cada fuga começa with uma gota',\\n" +
      "      'bench.title': 'Como se compara',\\n" +
      "      'bench.expected': 'Média para {count} assinaturas: {expected}',\\n" +
      "      'bench.percentile': 'Top {pct}% dos utilizadores',\\n" +
      "      'bench.lower': 'abaixo da média',\\n" +
      "      'bench.average': 'na média',\\n" +
      "      'bench.higher': 'acima da média',\\n" +
      "      'bench.muchHigher': 'muito acima',\\n" +
      "      'menu.whatif': 'Calculadora hipotética',\\n" +
      "      'menu.whatifSub': 'Escolha assinaturas para cancelar — veja a poupança ao vivo',\\n" +
      "      'whatif.title': 'Calculadora hipotética',\\n" +
      "      'whatif.blurb': 'Toque nas assinaturas para marcá-las como canceladas neste cenário. Mostramos o que pouparia sem alterar os seus dados reais.',\\n" +
      "      'whatif.empty': 'Nenhuma assinatura ativa para simular.',\\n" +
      "      'whatif.suggestBtn': 'Sugerir melhores opções',\\n" +
      "      'whatif.clearBtn': 'Limpar tudo',\\n" +
      "      'whatif.summarySelected': '{n} selecionado(s)',\\n" +
      "      'whatif.summarySavings': '{monthly}/mês · {yearly}/ano',\\n" +
      "      'whatif.investedNote': 'Investido a 7%: {y5} em 5 anos, {y10} em 10',\\n" +
      "      'home.notesLabel': 'Notas',\\n" +
      "      'streak.days': 'dias seguidos',\\n" +
      "      'streak.msg': 'Resistiu a uma nova assinatura hoje?',\\n" +
      "      'streak.btn': 'Fiquei limpo!',\\n" +
      "      'streak.done': 'Limpo hoje! ✨',\\n" +
      "      'streak.msgDone': 'Bom trabalho! Vemo-nos amanhã para manter o ecrã limpo.',\\n" +
      "      'toast.streakUpdated': 'Série atualizada! 🔥',",

  nl: "      'menu.activity': 'Activiteitenlog',\\n" +
      "      'menu.activitySub': 'Bekijk elke wijziging die je hebt gemaakt',\\n" +
      "      'activity.title': 'Activiteitenlog',\\n" +
      "      'activity.empty': 'Nog geen activiteit. Voeg een abonnement toe om te beginnen.',\\n" +
      "      'activity.added': '{name} toegevoegd',\\n" +
      "      'activity.edited': '{name} bewerkt',\\n" +
      "      'activity.cancelled': '{name} opgezegd',\\n" +
      "      'activity.paused': '{name} gepauzeerd',\\n" +
      "      'activity.resumed': '{name} hervat',\\n" +
      "      'activity.restored': '{name} hersteld',\\n" +
      "      'activity.deleted': '{name} verwijderd',\\n" +
      "      'activity.imported': '{n} abonnementen geïmporteerd',\\n" +
      "      'personality.title': 'Jouw abonnementspersoonlijkheid',\\n" +
      "      'personality.quietCutter': 'De stille opzegger',\\n" +
      "      'personality.quietCutterTag': 'Je hebt dit jaar meerdere abos opgezegd — stilletjes aan het winnen',\\n" +
      "      'personality.bundleMaster': 'Bundelmeester',\\n" +
      "      'personality.bundleMasterTag': 'Je weet hoe je kortingen moet stapelen',\\n" +
      "      'personality.streamingJunkie': 'Streamingjunkie',\\n" +
      "      'personality.streamingJunkieTag': 'Drie of meer entertainment-abos — je houdt van je series',\\n" +
      "      'personality.aiHoarder': 'AI-verzamelaar',\\n" +
      "      'personality.aiHoarderTag': 'Je verzamelt AI-tools sneller dan ze updates uitbrengen',\\n" +
      "      'personality.productivityStack': 'De productiviteitsstack',\\n" +
      "      'personality.productivityStackTag': 'Vijf of meer werktools — power-user energie',\\n" +
      "      'personality.musicSnob': 'Muzieksnob',\\n" +
      "      'personality.musicSnobTag': 'Meerdere muziekdiensten — kritisch oor',\\n" +
      "      'personality.spiraler': 'Abonnementsspiraal',\\n" +
      "      'personality.spiralerTag': 'Tien of meer actieve abos. Misschien tijd voor een controle?',\\n" +
      "      'personality.minimalist': 'De gezonde minimalist',\\n" +
      "      'personality.minimalistTag': 'Weinig abos, allemaal hoog beoordeeld. Een inspiratie.',\\n" +
      "      'personality.forgotten': 'De vergeter',\\n" +
      "      'personality.forgottenTag': 'Je hebt abos die ouder zijn dan een jaar die je nooit beoordeelt',\\n" +
      "      'personality.starting': 'Net begonnen',\\n" +
      "      'personality.startingTag': 'Welkom — elk lek begint met één druppel',\\n" +
      "      'bench.title': 'Hoe je presteert vergeleken met anderen',\\n" +
      "      'bench.expected': 'Gemiddelde voor {count} abos: {expected}',\\n" +
      "      'bench.percentile': 'Top {pct}% van gebruikers',\\n" +
      "      'bench.lower': 'onder het gemiddelde',\\n" +
      "      'bench.average': 'gemiddeld',\\n" +
      "      'bench.higher': 'boven het gemiddelde',\\n" +
      "      'bench.muchHigher': 'ruim daarboven',\\n" +
      "      'menu.whatif': 'Wat-als-calculator',\\n" +
      "      'menu.whatifSub': 'Kies abos om op te zeggen — zie direct je besparing',\\n" +
      "      'whatif.title': 'Wat-als-calculator',\\n" +
      "      'whatif.blurb': 'Tik op abonnementen om ze in dit scenario als opgezegd te markeren. We tonen wat je zou besparen zonder je echte gegevens te wijzigen.',\\n" +
      "      'whatif.empty': 'Geen actieve abonnementen om te simuleren.',\\n" +
      "      'whatif.suggestBtn': 'Stel beste keuzes voor',\\n" +
      "      'whatif.clearBtn': 'Alles wissen',\\n" +
      "      'whatif.summarySelected': '{n} geselecteerd',\\n" +
      "      'whatif.summarySavings': '{monthly}/md · {yearly}/jr',\\n" +
      "      'whatif.investedNote': 'Geïnvesteerd tegen 7%: {y5} in 5 jaar, {y10} in 10 jaar',\\n" +
      "      'home.notesLabel': 'Notities',\\n" +
      "      'streak.days': 'dagen streak',\\n" +
      "      'streak.msg': 'Heb je vandaag een nieuw abonnement weerstaan?',\\n" +
      "      'streak.btn': 'Ik ben clean gebleven!',\\n" +
      "      'streak.done': 'Vandaag clean gebleven! ✨',\\n" +
      "      'streak.msgDone': 'Goed gedaan! Tot morgen om het scherm clean te houden.',\\n" +
      "      'toast.streakUpdated': 'Streak bijgewerkt! 🔥',",

  pl: "      'menu.activity': 'Dziennik aktywności',\\n" +
      "      'menu.activitySub': 'Zobacz każdą wprowadzoną zmianę',\\n" +
      "      'activity.title': 'Dziennik aktywności',\\n" +
      "      'activity.empty': 'Brak aktywności. Dodaj subskrypcję, aby rozpocząć.',\\n" +
      "      'activity.added': 'Dodano {name}',\\n" +
      "      'activity.edited': 'Edytowano {name}',\\n" +
      "      'activity.cancelled': 'Anulowano {name}',\\n" +
      "      'activity.paused': 'Wstrzymano {name}',\\n" +
      "      'activity.resumed': 'Wznowiono {name}',\\n" +
      "      'activity.restored': 'Przywrócono {name}',\\n" +
      "      'activity.deleted': 'Usunięto {name}',\\n" +
      "      'activity.imported': 'Zaimportowano {n} subskrypcji',\\n" +
      "      'personality.title': 'Twoja subskrypcyjna osobowość',\\n" +
      "      'personality.quietCutter': 'Cichy likwidator',\\n" +
      "      'personality.quietCutterTag': 'Anulowałeś kilka subskrypcji w tym roku — ciche zwycięstwo',\\n" +
      "      'personality.bundleMaster': 'Mistrz pakietów',\\n" +
      "      'personality.bundleMasterTag': 'Wiesz, jak kumulować oszczędności',\\n" +
      "      'personality.streamingJunkie': 'Maniak streamingu',\\n" +
      "      'personality.streamingJunkieTag': 'Trzy lub więcej subskrypcji rozrywkowych — uwielbiasz swoje seriale',\\n" +
      "      'personality.aiHoarder': 'Chomik AI',\\n" +
      "      'personality.aiHoarderTag': 'Zbierasz narzędzia AI szybciej, niż oni wydają aktualizacje',\\n" +
      "      'personality.productivityStack': 'Filar produktywności',\\n" +
      "      'personality.productivityStackTag': 'Pięć lub więcej narzędzi do pracy — energia power usera',\\n" +
      "      'personality.musicSnob': 'Muzyczny snob',\\n" +
      "      'personality.musicSnobTag': 'Wiele usług muzycznych — wymagające ucho',\\n" +
      "      'personality.spiraler': 'Spirala subskrypcji',\\n" +
      "      'personality.spiralerTag': 'Dziesięć lub więcej aktywnych subskrypcji. Może czas na audyt?',\\n" +
      "      'personality.minimalist': 'Zdrowy minimalista',\\n" +
      "      'personality.minimalistTag': 'Mało subskrypcji, wszystkie wysoko oceniane. Inspiracja.',\\n" +
      "      'personality.forgotten': 'Zapominalski',\\n" +
      "      'personality.forgottenTag': 'Masz subskrypcje starsze niż rok, których nigdy nie oceniasz',\\n" +
      "      'personality.starting': 'Dopiero zaczynasz',\\n" +
      "      'personality.startingTag': 'Witamy — każdy wyciek zaczyna się od jednej kropli',\\n" +
      "      'bench.title': 'Jak wypadasz na tle innych',\\n" +
      "      'bench.expected': 'Średnia dla {count} subskrypcji: {expected}',\\n" +
      "      'bench.percentile': 'Top {pct}% użytkowników',\\n" +
      "      'bench.lower': 'poniżej średniej',\\n" +
      "      'bench.average': 'w średniej',\\n" +
      "      'bench.higher': 'powyżej średniej',\\n" +
      "      'bench.muchHigher': 'znacznie powyżej',\\n" +
      "      'menu.whatif': 'Kalkulator \"co jeśli\"',\\n" +
      "      'menu.whatifSub': 'Wybierz subskrypcje do anulowania — zobacz oszczędności na żywo',\\n" +
      "      'whatif.title': 'Kalkulator \"co jeśli\"',\\n" +
      "      'whatif.blurb': 'Stuknij subskrypcje, aby oznaczyć je jako anulowane w tym scenariuszu. Pokażemy Ci, ile byś zaoszczędził, bez zmiany prawdziwych danych.',\\n" +
      "      'whatif.empty': 'Brak aktywnych subskrypcji do symulacji.',\\n" +
      "      'whatif.suggestBtn': 'Sugeruj najlepsze opcje',\\n" +
      "      'whatif.clearBtn': 'Wyczyść wszystko',\\n" +
      "      'whatif.summarySelected': 'Wybrano: {n}',\\n" +
      "      'whatif.summarySavings': '{monthly}/mies. · {yearly}/rok',\\n" +
      "      'whatif.investedNote': 'Zainwestowane na 7%: {y5} za 5 lat, {y10} za 10 lat',\\n" +
      "      'home.notesLabel': 'Notatki',\\n" +
      "      'streak.days': 'dni z rzędu',\\n" +
      "      'streak.msg': 'Czy oparłeś się dzisiaj nowej subskrypcji?',\\n" +
      "      'streak.btn': 'Udało się!',\\n" +
      "      'streak.done': 'Czysto dzisiaj! ✨',\\n" +
      "      'streak.msgDone': 'Dobra robota! Do zobaczenia jutro, aby utrzymać czysty ekran.',\\n" +
      "      'toast.streakUpdated': 'Seria zaktualizowana! 🔥',",

  sv: "      'menu.activity': 'Aktivitetslogg',\\n" +
      "      'menu.activitySub': 'Se varje ändring du har gjort',\\n" +
      "      'activity.title': 'Aktivitetslogg',\\n" +
      "      'activity.empty': 'Ingen aktivitet än. Lägg till ett abonnemang för att börja.',\\n" +
      "      'activity.added': 'Lade till {name}',\\n" +
      "      'activity.edited': 'Redigerade {name}',\\n" +
      "      'activity.cancelled': 'Avslutade {name}',\\n" +
      "      'activity.paused': 'Pausade {name}',\\n" +
      "      'activity.resumed': 'Återupptog {name}',\\n" +
      "      'activity.restored': 'Återställde {name}',\\n" +
      "      'activity.deleted': 'Tog bort {name}',\\n" +
      "      'activity.imported': 'Importerade {n} abonnemang',\\n" +
      "      'personality.title': 'Din abonnemangspersonlighet',\\n" +
      "      'personality.quietCutter': 'Den tysta avslutaren',\\n" +
      "      'personality.quietCutterTag': 'Du har avslutat flera abonnemang i år — en tyst vinst',\\n" +
      "      'personality.bundleMaster': 'Paketmästare',\\n" +
      "      'personality.bundleMasterTag': 'Du vet hoe man staplar besparingar',\\n" +
      "      'personality.streamingJunkie': 'Streamingjunkie',\\n" +
      "      'personality.streamingJunkieTag': 'Tre eller fler underhållningsabonnemang — du älskar dina serier',\\n" +
      "      'personality.aiHoarder': 'AI-samlare',\\n" +
      "      'personality.aiHoarderTag': 'Samlar AI-verktyg snabbare än de skickar uppdateringar',\\n" +
      "      'personality.productivityStack': 'Produktivitetsstacken',\\n" +
      "      'personality.productivityStackTag': 'Fem eller fler arbetsverktyg — power user-energi',\\n" +
      "      'personality.musicSnob': 'Musiksnobb',\\n" +
      "      'personality.musicSnobTag': 'Flera musiktjänster — kräset öra',\\n" +
      "      'personality.spiraler': 'Abonnemangsspiral',\\n" +
      "      'personality.spiralerTag': 'Tio eller fler aktiva abonnemang. Kanske dags för en granskning?',\\n" +
      "      'personality.minimalist': 'Den hälsosamma minimalisten',\\n" +
      "      'personality.minimalistTag': 'Få abonnemang, alla högt betygsatta. En inspiration.',\\n" +
      "      'personality.forgotten': 'Den glömska',\\n" +
      "      'personality.forgottenTag': 'Du har abonnemang äldre än ett år som du aldrig betygsätter',\\n" +
      "      'personality.starting': 'Just börjat',\\n" +
      "      'personality.startingTag': 'Välkommen — varje läcka börjar med en droppe',\\n" +
      "      'bench.title': 'Hur du ligger till',\\n" +
      "      'bench.expected': 'Genomsnitt för {count} abonnemang: {expected}',\\n" +
      "      'bench.percentile': 'Topp {pct}% av användarna',\\n" +
      "      'bench.lower': 'under genomsnittet',\\n" +
      "      'bench.average': 'i genomsnitt',\\n" +
      "      'bench.higher': 'över genomsnittet',\\n" +
      "      'bench.muchHigher': 'långt över',\\n" +
      "      'menu.whatif': 'Tänk-om-kalkylator',\\n" +
      "      'menu.whatifSub': 'Välj abonnemang att avsluta — se besparingar live',\\n" +
      "      'whatif.title': 'Tänk-om-kalkylator',\\n" +
      "      'whatif.blurb': 'Klicka på abonnemang för att markera dem som avslutade i detta scenario. Vi visar vad du skulle spara utan att ändra dina riktiga data.',\\n" +
      "      'whatif.empty': 'Inga aktiva abonnemang att simulera.',\\n" +
      "      'whatif.suggestBtn': 'Föreslå bästa val',\\n" +
      "      'whatif.clearBtn': 'Rensa allt',\\n" +
      "      'whatif.summarySelected': '{n} valda',\\n" +
      "      'whatif.summarySavings': '{monthly}/mån · {yearly}/år',\\n" +
      "      'whatif.investedNote': 'Investerat till 7%: {y5} om 5 år, {y10} om 10 år',\\n" +
      "      'home.notesLabel': 'Anteckningar',\\n" +
      "      'streak.days': 'dagars svit',\\n" +
      "      'streak.msg': 'Stod du emot ett nytt abonnemang idag?',\\n" +
      "      'streak.btn': 'Jag höll mig ren!',\\n" +
      "      'streak.done': 'Höll mig ren idag! ✨',\\n" +
      "      'streak.msgDone': 'Bra jobbat! Ses imorgon för att hålla skärmen ren.',\\n" +
      "      'toast.streakUpdated': 'Svit uppdaterad! 🔥',",

  cs: "      'menu.activity': 'Historie aktivit',\\n" +
      "      'menu.activitySub': 'Zobrazit každou provedenou změnu',\\n" +
      "      'activity.title': 'Historie aktivit',\\n" +
      "      'activity.empty': 'Zatím žádná aktivita. Přidejte předplatné a začněte.',\\n" +
      "      'activity.added': 'Přidáno {name}',\\n" +
      "      'activity.edited': 'Upraveno {name}',\\n" +
      "      'activity.cancelled': 'Zrušeno {name}',\\n" +
      "      'activity.paused': 'Pozastaveno {name}',\\n" +
      "      'activity.resumed': 'Obnoveno {name}',\\n" +
      "      'activity.restored': 'Obnoveno {name}',\\n" +
      "      'activity.deleted': 'Smazáno {name}',\\n" +
      "      'activity.imported': 'Importováno {n} předplatných',\\n" +
      "      'personality.title': 'Vaše předplatitelská osobnost',\\n" +
      "      'personality.quietCutter': 'Tichý likvidátor',\\n" +
      "      'personality.quietCutterTag': 'Letos jste zrušili několik předplatných — tichá výhra',\\n" +
      "      'personality.bundleMaster': 'Mistr balíčků',\\n" +
      "      'personality.bundleMasterTag': 'Víte, jak vrstvit úspory',\\n" +
      "      'personality.streamingJunkie': 'Závislák na streamování',\\n" +
      "      'personality.streamingJunkieTag': 'Tři nebo více zábavních předplatných — milujete své seriály',\\n" +
      "      'personality.aiHoarder': 'Sběratel AI',\\n" +
      "      'personality.aiHoarderTag': 'Sbíráte AI nástroje rychleji, než stíhají vydávat aktualizace',\\n" +
      "      'personality.productivityStack': 'Produktivní stack',\\n" +
      "      'personality.productivityStackTag': 'Pět nebo více pracovních nástrojů — energie power usera',\\n" +
      "      'personality.musicSnob': 'Hudební snob',\\n" +
      "      'personality.musicSnobTag': 'Více hudebních služeb — náročné ucho',\\n" +
      "      'personality.spiraler': 'Předplatitelská spirála',\\n" +
      "      'personality.spiralerTag': 'Deset nebo víc aktivních předplatných. Možná je čas na audit?',\\n" +
      "      'personality.minimalist': 'Zdravý minimalista',\\n" +
      "      'personality.minimalistTag': 'Málu předplatných, všechny vysoko hodnocené. Inspirace.',\\n" +
      "      'personality.forgotten': 'Zapomnětlivý',\\n" +
      "      'personality.forgottenTag': 'Máte předplatná starší než rok, která nikdy nehodnotíte',\\n" +
      "      'personality.starting': 'Teprve začínáte',\\n" +
      "      'personality.startingTag': 'Vítejte — každý únik začíná jednou kapkou',\\n" +
      "      'bench.title': 'Jak jste na tom ve srovnání',\\n" +
      "      'bench.expected': 'Průměr pro {count} předplatných: {expected}',\\n" +
      "      'bench.percentile': 'Top {pct}% uživatelů',\\n" +
      "      'bench.lower': 'pod průměrem',\\n" +
      "      'bench.average': 'v průměru',\\n" +
      "      'bench.higher': 'nad průměrem',\\n" +
      "      'bench.muchHigher': 'vysoko nad průměrem',\\n" +
      "      'menu.whatif': 'Kalkulačka \"co když\"',\\n" +
      "      'menu.whatifSub': 'Vyberte předplatná ke zrušení — sledujte úspory živě',\\n" +
      "      'whatif.title': 'Kalkulačka \"co když\"',\\n" +
      "      'whatif.blurb': 'Klepnutím na předplatné je v tomto scénáři označíte jako zrušené. Ukážeme vám, kolik byste ušetřili, aniž by se změnila vaše skutečná data.',\\n" +
      "      'whatif.empty': 'Žádná aktivní předplatná k simulaci.',\\n" +
      "      'whatif.suggestBtn': 'Navrhnout nejlepší tipy',\\n" +
      "      'whatif.clearBtn': 'Vymazat vše',\\n" +
      "      'whatif.summarySelected': 'Vybráno: {n}',\\n" +
      "      'whatif.summarySavings': '{monthly}/měs · {yearly}/rok',\\n" +
      "      'whatif.investedNote': 'Investováno při 7%: {y5} za 5 let, {y10} za 10 let',\\n" +
      "      'home.notesLabel': 'Poznámky',\\n" +
      "      'streak.days': 'dní v řadě',\\n" +
      "      'streak.msg': 'Odolali jste dnes novému předplatnému?',\\n" +
      "      'streak.btn': 'Zůstal jsem čistý!',\\n" +
      "      'streak.done': 'Dnes čistý! ✨',\\n" +
      "      'streak.msgDone': 'Skvělá práce! Uvidíme se zítra, abychom udrželi čistou obrazovku.',\\n" +
      "      'toast.streakUpdated': 'Série aktualizována! 🔥',",

  ja: "      'menu.activity': 'アクティビティログ',\\n" +
      "      'menu.activitySub': '行ったすべての変更を表示',\\n" +
      "      'activity.title': 'アクティビティログ',\\n" +
      "      'activity.empty': 'アクティビティはまだありません。サブスクを追加して始めましょう。',\\n" +
      "      'activity.added': '{name} を追加しました',\\n" +
      "      'activity.edited': '{name} を編集しました',\\n" +
      "      'activity.cancelled': '{name} を解約しました',\\n" +
      "      'activity.paused': '{name} を一時停止しました',\\n" +
      "      'activity.resumed': '{name} を再開しました',\\n" +
      "      'activity.restored': '{name} を復元しました',\\n" +
      "      'activity.deleted': '{name} を削除しました',\\n" +
      "      'activity.imported': '{n} 個のサブスクをインポートしました',\\n" +
      "      'personality.title': 'あなたのサブスクタイプ',\\n" +
      "      'personality.quietCutter': '静かなる解約者',\\n" +
      "      'personality.quietCutterTag': '今年、複数のサブスクを解約しました — 静かに勝利中',\\n" +
      "      'personality.bundleMaster': 'バンドルマスター',\\n" +
      "      'personality.bundleMasterTag': 'お得なまとめ方を知っています',\\n" +
      "      'personality.streamingJunkie': '配信マニア',\\n" +
      "      'personality.streamingJunkieTag': 'エンタメ系サブスクが3つ以上 — ドラマや映画が大好き',\\n" +
      "      'personality.aiHoarder': 'AIコレクター',\\n" +
      "      'personality.aiHoarderTag': 'アップデートよりも早くAIツールを集めています',\\n" +
      "      'personality.productivityStack': '効率化プロ',\\n" +
      "      'personality.productivityStackTag': '仕事用ツールが5つ以上 — パワーユーザーの風格',\\n" +
      "      'personality.musicSnob': '音のこだわり派',\\n" +
      "      'personality.musicSnobTag': '複数の音楽サービスを契約中 — 肥えた耳の持ち主',\\n" +
      "      'personality.spiraler': 'サブスクスパイラル',\\n" +
      "      'personality.spiralerTag': 'アクティブなサブスクが10個以上。一度見直してみませんか？',\\n" +
      "      'personality.minimalist': '健康的なミニマリスト',\\n" +
      "      'personality.minimalistTag': 'サブスクは少数で、すべて高評価。素晴らしい見本です。',\\n" +
      "      'personality.forgotten': '忘れがちな人',\\n" +
      "      'personality.forgottenTag': '1年以上評価していない古いサブスクがあります',\\n" +
      "      'personality.starting': '始めたばかり',\\n" +
      "      'personality.startingTag': 'ようこそ — すべての無駄遣いは1つの滴から始まります',\\n" +
      "      'bench.title': '平均との比較',\\n" +
      "      'bench.expected': 'サブスク{count}個の平均：{expected}',\\n" +
      "      'bench.percentile': '上位 {pct}% のユーザー',\\n" +
      "      'bench.lower': '平均以下',\\n" +
      "      'bench.average': '平均的',\\n" +
      "      'bench.higher': '平均以上',\\n" +
      "      'bench.muchHigher': '平均を大きく超過',\\n" +
      "      'menu.whatif': 'シミュレーション電卓',\\n" +
      "      'menu.whatifSub': '解約するサブスクを選んで、節約額をリアルタイム確認',\\n" +
      "      'whatif.title': 'シミュレーション電卓',\\n" +
      "      'whatif.blurb': 'このシナリオで解約したいサブスクをタップしてください。実際のデータを変更することなく、どれだけ節約できるかを表示します。',\\n" +
      "      'whatif.empty': 'シミュレーションできるアクティブなサブスクがありません。',\\n" +
      "      'whatif.suggestBtn': 'おすすめの解約候補',\\n" +
      "      'whatif.clearBtn': 'すべてクリア',\\n" +
      "      'whatif.summarySelected': '{n} 個選択中',\\n" +
      "      'whatif.summarySavings': '{monthly}/月 · {yearly}/年',\\n" +
      "      'whatif.investedNote': '7%で投資した場合：5年で {y5}、10年で {y10}',\\n" +
      "      'home.notesLabel': 'メモ',\\n" +
      "      'streak.days': '日連続',\\n" +
      "      'streak.msg': '今日、新しいサブスクの誘惑に耐えましたか？',\\n" +
      "      'streak.btn': '耐え抜いた！',\\n" +
      "      'streak.done': '今日も耐え抜きました！ ✨',\\n" +
      "      'streak.msgDone': '素晴らしい！明日もこの調子で画面をクリーンに保ちましょう。',\\n" +
      "      'toast.streakUpdated': 'ストリークが更新されました！ 🔥',",

  ko: "      'menu.activity': '활동 로그',\\n" +
      "      'menu.activitySub': '내가 변경한 모든 내역 보기',\\n" +
      "      'activity.title': '활동 로그',\\n" +
      "      'activity.empty': '아직 활동이 없습니다. 구독을 추가하여 시작해보세요.',\\n" +
      "      'activity.added': '{name} 추가됨',\\n" +
      "      'activity.edited': '{name} 수정됨',\\n" +
      "      'activity.cancelled': '{name} 해지됨',\\n" +
      "      'activity.paused': '{name} 일시정지됨',\\n" +
      "      'activity.resumed': '{name} 재개됨',\\n" +
      "      'activity.restored': '{name} 복원됨',\\n" +
      "      'activity.deleted': '{name} 삭제됨',\\n" +
      "      'activity.imported': '구독 {n}개 가져옴',\\n" +
      "      'personality.title': '나의 구독 성향',\\n" +
      "      'personality.quietCutter': '조용한 저격수',\\n" +
      "      'personality.quietCutterTag': '올해 여러 구독을 해지했습니다 — 조용한 승리 중',\\n" +
      "      'personality.bundleMaster': '묶음 결제의 달인',\\n" +
      "      'personality.bundleMasterTag': '할인 혜택을 똑똑하게 챙길 줄 아는 사람',\\n" +
      "      'personality.streamingJunkie': '스트리밍 중독',\\n" +
      "      'personality.streamingJunkieTag': '엔터테인먼트 구독 3개 이상 — 작품 정주행을 사랑함',\\n" +
      "      'personality.aiHoarder': 'AI 수집가',\\n" +
      "      'personality.aiHoarderTag': '업데이트 속도보다 빠르게 AI 툴을 모으고 있습니다',\\n" +
      "      'personality.productivityStack': '생산성 마스터',\\n" +
      "      'personality.productivityStackTag': '업무용 툴 5개 이상 — 파워 유저의 기운',\\n" +
      "      'personality.musicSnob': '음악 애호가',\\n" +
      "      'personality.musicSnobTag': '여러 음악 서비스 이용 중 — 까다로운 귀의 소유자',\\n" +
      "      'personality.spiraler': '구독 소용돌이',\\n" +
      "      'personality.spiralerTag': '활성 구독 10개 이상. 이제 정리가 필요할 때일지도?',\\n" +
      "      'personality.minimalist': '건강한 미니멀리스트',\\n" +
      "      'personality.minimalistTag': '구독은 적게, 평점은 높게. 이상적인 표본입니다.',\\n" +
      "      'personality.forgotten': '망각의 늪',\\n" +
      "      'personality.forgottenTag': '평점을 한 번도 매기지 않은 1년 넘은 구독이 있습니다',\\n" +
      "      'personality.starting': '이제 막 시작함',\\n" +
      "      'personality.startingTag': '환영합니다 — 모든 지출의 낭비는 한 방울부터 시작됩니다',\\n" +
      "      'bench.title': '평균과의 비교',\\n" +
      "      'bench.expected': '구독 {count}개 평균: {expected}',\\n" +
      "      'bench.percentile': '상위 {pct}% 사용자',\\n" +
      "      'bench.lower': '평균 이하',\\n" +
      "      'bench.average': '평균 수준',\\n" +
      "      'bench.higher': '평균 이상',\\n" +
      "      'bench.muchHigher': '평균 크게 초과',\\n" +
      "      'menu.whatif': '가상 해지 계산기',\\n" +
      "      'menu.whatifSub': '해지할 구독을 선택하고 실시간 절약액 확인',\\n" +
      "      'whatif.title': '가상 해지 계산기',\\n" +
      "      'whatif.blurb': '가상 시나리오에서 해지하고 싶은 구독을 탭하세요. 실제 데이터는 변경되지 않으며, 절약할 수 있는 금액을 보여줍니다.',\\n" +
      "      'whatif.empty': '시뮬레이션할 활성 구독이 없습니다.',\\n" +
      "      'whatif.suggestBtn': '추천 해지 후보',\\n" +
      "      'whatif.clearBtn': '모두 지우기',\\n" +
      "      'whatif.summarySelected': '{n}개 선택됨',\\n" +
      "      'whatif.summarySavings': '{monthly}/월 · {yearly}/년',\\n" +
      "      'whatif.investedNote': '7% 수익률로 투자 시: 5년 후 {y5}, 10년 후 {y10}',\\n" +
      "      'home.notesLabel': '메모',\\n" +
      "      'streak.days': '일 연속',\\n" +
      "      'streak.msg': '오늘 새로운 구독의 유혹을 참아내셨나요?',\\n" +
      "      'streak.btn': '참아냈다!',\\n" +
      "      'streak.done': '오늘도 유혹을 참았습니다! ✨',\\n" +
      "      'streak.msgDone': '잘하셨습니다! 내일도 깨끗한 화면을 유지하러 오세요.',\\n" +
      "      'toast.streakUpdated': '스트릭 업데이트! 🔥',",
};

const lines = content.split('\\n');
let newLines = [...lines];

for (const lang in translations) {
  let startIdx = -1;
  // Use a simple string search for the block start
  const blockStart = \"    \" + lang + \": {\";
  
  for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].startsWith(blockStart)) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    // Try with different indentation or without spaces
    const blockStartAlt = lang + \": {\";
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i].trim().startsWith(blockStartAlt)) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) {
    console.error('Could not find block for ' + lang);
    continue;
  }

  // Find 'menu.activity' within this block
  let menuActivityIdx = -1;
  for (let i = startIdx + 1; i < newLines.length; i++) {
    if (newLines[i].includes(\"'menu.activity':\")) {
      menuActivityIdx = i;
      break;
    }
    // If we reach the next language block or end of object, stop
    if (newLines[i].trim() === \"},\" || i > startIdx + 500) break;
  }

  if (menuActivityIdx === -1) {
    console.error('Could not find menu.activity in ' + lang);
    continue;
  }

  // Find the end of the block (the closing brace for this language)
  let endIdx = -1;
  for (let i = menuActivityIdx + 1; i < newLines.length; i++) {
    if (newLines[i].trim() === \"},\" || newLines[i].trim() === \"}\") {
      endIdx = i - 1;
      break;
    }
    if (i > menuActivityIdx + 200) break; // Safety break
  }

  if (endIdx === -1) {
    console.error('Could not find end of block for ' + lang);
    continue;
  }

  // Replace lines from menuActivityIdx to endIdx
  const newContentLines = translations[lang].split('\\n');
  if (newContentLines[newContentLines.length - 1] === '') newContentLines.pop();
  
  newLines.splice(menuActivityIdx, endIdx - menuActivityIdx + 1, ...newContentLines);
}

fs.writeFileSync(filePath, newLines.join('\\n'), 'utf8');
console.log('Successfully updated translations.');
