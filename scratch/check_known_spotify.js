// Check the KNOWN catalogue in import.js for Spotify's price
const fs = require('fs');
const imp = fs.readFileSync('js/import.js', 'utf8');

// Find Spotify entry in KNOWN
const spotifyIdx = imp.search(/spotify/i);
if (spotifyIdx === -1) {
  console.log('Spotify not found in import.js KNOWN');
} else {
  console.log('Spotify in import.js at char', spotifyIdx);
  console.log(imp.substring(spotifyIdx - 20, spotifyIdx + 200));
}

// Also check what parseLine does with 'matched' flag
// Find the matched property usage
const matchedIdx = imp.indexOf('matched');
console.log('\n"matched" usage:');
console.log(imp.substring(matchedIdx - 50, matchedIdx + 300));
