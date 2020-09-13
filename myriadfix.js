/* MyriadFix
 Fixes various wibbles with the myriad database.
*/

var fs = require('fs')
let i = 0
var myrCards = require('./myriad/cards.json');
var myrLegal = require('./myriad/legal.json');
var blanks = [];

function manaFix(string) {
	string = string.replace(/\{H\}/g, "{P}");
	string = string.replace(/\{\|([WUBRG])\}/g, "{H$1}");
	return string;
}
function fixJSONS(thisSet, fileName) {
	for(let card in thisSet.cards)
		thisSet.cards[card].legalities = [{format: "Myriad", legality: "Legal"}]
	fs.writeFile('./jsons/' + fileName, JSON.stringify(thisSet), (err) => {
		if(err) throw err;
		console.log(fileName + ' written')
	})
}
function fixCards() {
	for(let card in myrCards) {
		thisCard = myrCards[card];
		if(thisCard.manaCost)
			thisCard.manaCost = manaFix(thisCard.manaCost);
		if(thisCard.text)
			thisCard.text = manaFix(thisCard.text);
		if(!thisCard.hasOwnProperty('multiverseid')){
			blanks.push(card);
		}else{
			i = Math.max(i, thisCard.multiverseid);
		}
	}
	for(let name in blanks){
		i++;
		myrCards[blanks[name]].multiverseid = i;
	}
	fs.writeFile('./myriad/cards.json', JSON.stringify(myrCards).replace(/[}],"/g,"},\n	\""), (err) => {
		if(err) throw err;
		console.log('myriad/cards written')
	})
}
function pointCards() {
	for(let card in myrCards) {
	myrCards[card].notes = [];
		for(let point in myrLegal) {
			if(myrLegal[point].includes(myrCards[card].fullName)) {
				console.log(card);
				myrCards[card].notes.push('pointed');
				let trimmed = point.replace(' ', "");
				myrCards[card].notes.push(trimmed);
				let trimmed2 = trimmed.replace(/s$/, "");
				if(trimmed != trimmed2)
					myrCards[card].notes.push(trimmed2);				
			}
		}
	}
	fs.writeFile('./myriad/cards.json', JSON.stringify(myrCards).replace(/[}],"/g,"},\n	\""), (err) => {
		if(err) throw err;
		console.log('myriad/cards written')
	})

}
function doJsonStuff () {
	fs.readdir("jsons",function(err, array) {
		for(let j=0; j<array.length; j++) {
			let thisSet = require('./jsons/' + array[i]);
			fixJSONS(thisSet, array[i]);
		}
	});
}
if(process.argv[2] != undefined) {
	if(process.argv[2].match(/json/i))
		doJsonStuff();
	if(process.argv[2].match(/cards/i))
		fixCards();
	if(process.argv[2].match(/point/i))
		pointCards();
}
 exports.fixCards = fixCards;
 exports.pointCards = pointCards;
 exports.fixJSONS = fixJSONS