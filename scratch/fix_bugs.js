const fs = require('fs');
const path = 'c:/Users/local_user/Documents/leakd/leakd/js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

console.log('Starting bug fixes...');

// 1. Clean up English block (it might have multiple copies of other languages)
// We already did some cleanup, but let's be thorough.
// The user said "the compiler or a script accidentally copied all supported languages' goal.* keys"
// I'll look for the EN block and remove any goal.nameLabel etc. that are not English.
const enStart = content.indexOf('en: {');
const enEnd = content.indexOf('},    hu:', enStart);
if (enStart !== -1 && enEnd !== -1) {
    let enBlock = content.substring(enStart, enEnd);
    // Remove duplicates keeping the last one (which is usually the correct English one if they were appended)
    // Actually, let's just remove everything between the first 'goal.nameLabel' and the last 'goal.progressShort'
    // and replace with the correct English ones.
    const firstGoal = enBlock.indexOf("'goal.nameLabel':");
    const lastGoalProgress = enBlock.lastIndexOf("'goal.progressShort':");
    if (firstGoal !== -1 && lastGoalProgress !== -1) {
        const endOfLastGoal = enBlock.indexOf('\n', lastGoalProgress);
        const newGoalSection = `      'goal.nameLabel': 'What are you saving for?',
      'goal.estimate': 'Cancel {count} low-rated subs to save <strong>{savings}/mo</strong> and hit your goal in <strong>{months} months</strong>!',
      'goal.progressShort': 'Goal progress: {saved} ({pct}%)'`;
        enBlock = enBlock.substring(0, firstGoal) + newGoalSection + enBlock.substring(endOfLastGoal);
        content = content.substring(0, enStart) + enBlock + content.substring(enEnd);
    }
}

// 3. Indonesian fix ("và" -> "dan")
content = content.replace(/và/g, (match, offset) => {
    // Only replace if within the Indonesian block (approximate range for now, or just check surrounding words)
    // Actually, "và" is Vietnamese for "and". Indonesian "and" is "dan".
    // I'll check if the surrounding text looks Indonesian.
    const context = content.substring(offset - 20, offset + 20);
    if (context.includes('layanan') || context.includes('tujuan') || context.includes('bulan')) {
        return 'dan';
    }
    return match;
});

// 4. French fix (missing apostrophe)
content = content.replace(/'Conditions d utilisation'/g, "'Conditions d\\'utilisation'");

// 5. Hungarian fixes
// Duplicated badge.zombie
content = content.replace(/'badge\.zombie': 'Zombi',\s*'badge\.zombie': 'Zombi',/g, "'badge.zombie': 'Zombi',");

// Phrasing fixes
content = content.replace(/'Az előfizetések nagy részt esznek a jövedelmedből\. Töröld a gyengén értékelteket\.'/g, "'Az előfizetések jelentős részt tesznek ki a jövedelmedből. Érdemes lehet lemondani az alacsonyra értékelt szolgáltatásokat.'");
content = content.replace(/'10\+ aktív sub\. Lehet hogy ideje audit\?'/g, "'10+ aktív előfizetés. Ideje lenne egy felülvizsgálatnak.'");
content = content.replace(/'\{year\}-es összegzésed'/g, "'{year}. évi összefoglalód'");
content = content.replace(/subot/g, 'előfizetést');
content = content.replace(/sub-lemondással/g, 'előfizetés-lemondással');
content = content.replace(/subokat/g, 'előfizetéseket');
content = content.replace(/sub/g, (match, offset) => {
    const context = content.substring(offset - 10, offset + 10);
    if (context.includes('aktív') || context.includes('3+')) return 'előfizetés';
    return match;
});
content = content.replace(/streak/g, 'sorozat');
content = content.replace(/bundle/g, 'csomag');

fs.writeFileSync(path, content, 'utf8');
console.log('Bug fixes completed!');
