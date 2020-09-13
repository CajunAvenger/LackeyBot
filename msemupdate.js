/* MSEM Update
 Run this after stitch to add prints and rarities
 TODO incorporate this into stitch directly
*/
var cards = require('./msem/cards.json');
var cardsSets = require('./msem/setData.json');
var cardsSetNames = Object.keys(cardsSets);
var legal = require('./msem/legal.json');
var fs = require('fs')

for(let card in cards) {
	if(!cards[card].hasOwnProperty("rarities")) {
		let thisName = cards[card].fullName;
		let valids = [card];
		let rarities = [cards[card].rarity];
		let codes = [];
		for(let code in cardsSetNames) {
			let testName = thisName + "_" + cardsSetNames[code];
			if(cards.hasOwnProperty(testName)) {
				valids.push(testName)
				codes.push(cardsSetNames[code])
				if(!rarities.includes(cards[testName].rarity))
					rarities.push(cards[testName].rarity)
			}
		}
		for(let hit in valids) {
			cards[valids[hit]].prints = codes;
			cards[valids[hit]].rarities = rarities;
			cards[valids[hit]].formats = [];
			if(!legal.modernBan.includes(cards[valids[hit]].fullName))
				cards[valids[hit]].formats = ["msem"];
		}
	}
}
let words = JSON.stringify(cards).replace(/[}],"/g,"},\n	\"");
fs.writeFile('msem/cards.json', words, (err) => {
	if (err) throw err;
	console.log('msem/cards.json written');
});