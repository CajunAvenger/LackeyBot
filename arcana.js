/* Arcana
 This builds the libraries for the different card databases

 library.cards for the cards object
 library.setData for the sets object
 library.legal for the legality object
 library.oracle for the rulings object
 library.nicks for the nickname object
 library.name for the name string, ie this is arcana[library.name]
 library.bigName for the formatted name string, ie Magic instead of magic
 library.writeCard() for the function to format card data
 library.printImage() for the function to format image links
 library.formatBribes() for the function to format "bribes", ie additional info like ban notices and $rulings

 writeCard is defined in mod_magic, can be overwritten here or in lackeybot.js
 formatBribes are defined in lackeybot.js because of the stats counters
*/
let mod_magic = require('./magic.js');
let nicks = require('./nicks.json')
let toolbox = require('./toolbox.js');

let msemCards = require('./msem/cards.json');
let msemSets = require('./msem/setData.json');
let msemBanned = require('./msem/legal.json');
let msemRules = require('./msem/oracle.json');

let csCards = require('./cstandard/cards.json');
let csSets = require('./cstandard/setData.json');
let csBanned = require('./cstandard/legal.json');
let csRules = require('./cstandard/oracle.json');

let magicCards = require('./canon/cards.json');
let magicSets = require('./canon/setData.json');
let magicBanned = require('./canon/legal.json');
let magicRules = require('./canon/oracle.json');

magicBanned.primordial = [
	"Ancient Den",
	"Great Furnace",
	"Seat of the Synod",
	"Tree of Tales",
	"Vault of Whispers",
	"Chaos Orb",
	"Contract from Below",
	"Crusade",
	"Darkpact",
	"Demonic Attorney",
	"Bronze Tablet",
	"Pradesh Gypsies",
	"Rebirth",
	"Tempest Efreet",
	"Jeweled Bird",
	"Jihad",
	"Shahrazad",
	"Stone-Throwing Devils",
	"Timmerian Fiends",
	"Amulet of Quoz",
	"Cleanse",
	"Falling Star",
	"Imprison",
	"Invoke Prejudice"	
]
let myriadCards = require('./myriad/cards.json');
let myriadSets = require('./myriad/setData.json');
let myriadPointed = require('./myriad/legal.json');
let myriadRules = {};//require('./myriad/oracle.json');

let refSheet = {
	encodedColors: {},
	searchTitles:{},
	swapCommands: {},
	searchRegex: null,
	anySwapRegex: null
}

function writeCard (thisCard, shortFlag){ //writes a card from this library with a name
	return mod_magic.writeCard(thisCard, this.cards, this.setData, shortFlag, "");
}
function writeDevCard (thisCard, shortFlag){
	return mod_magic.writeCard(thisCard, this.cards, this.setData, shortFlag, "   ***[Custom]***");
}
function buildReference(arcana){
	let titleString = "", anySwapString = "";
	for(let l in libs) {
		let thisLib = arcana[libs[l]];
		refSheet.encodedColors[thisLib.encodeColor] = thisLib.name;
		refSheet.searchTitles[thisLib.searchData.title] = thisLib.name;
		titleString += thisLib.searchData.title + "|"
		anySwapString += thisLib.swaps[0] + "|"
		let i = 0;
		if(thisLib.swaps.length > 1)
			i = 1;
		for(i; i<thisLib.swaps.length; i++)
			refSheet.swapCommands[thisLib.swaps[i]] = thisLib.name
	}
	titleString = "\\[(" + titleString.replace(/\|$/, "") + ") search\\]\\([^\n]+ '([^\n]+)'\\)";
	anySwapString = "(?:\\$|\\?|!)(" + anySwapString.replace(/\|$/, "") + ")";
	refSheet.searchRegex = new RegExp(titleString, 'i');
	refSheet.anySwapRegex = new RegExp(anySwapString, 'i');
}
function decodeColor (decimal) {		//converts decimal color value to database name
	let hex = toolbox.convertBases(decimal, 10, 16);
	hex = toolbox.fillLength(hex, 6, "0", "")
	if(refSheet.encodedColors[hex])
		return refSheet.encodedColors[hex];
	return null;
}
function decodeTitle (title) {		//converts title to database name
	if(refSheet.searchTitles[title])
		return refSheet.searchTitles[title];
	return null;
}
function msemLinker (thisCard) { //links from msem site
	thisCard = this.cards[thisCard];
	return "http://mse-modern.com/msem2/images/" + thisCard.setID + "/" + thisCard.cardID + ".jpg";
}
function generatePrints (library) {
	for(let card in library.cards) {
		delete library.cards[card].prints;
		delete library.cards[card].rarities;
	}
	for(let card in library.cards) {
		if(!library.cards[card].hasOwnProperty('prints')) {
			let valids = [];
			let sets = [];
			let rarities = [];
			for(let setCode in library.setData) {
				let testname = library.cards[card].fullName + "_" + setCode;
				if(library.cards.hasOwnProperty(testname)) {
					valids.push(testname);
					sets.push(setCode);
					rarities.push(library.cards[testname].rarity)
				}
				testname = library.cards[card].fullName + "_PRO" + setCode;
				if(library.cards.hasOwnProperty(testname)) {
					valids.push(testname);
					sets.push(setCode);
					rarities.push(library.cards[testname].rarity)
				}		
			}
			for(let cardname in valids) {
				library.cards[valids[cardname]].prints = sets;
				library.cards[valids[cardname]].rarities = rarities;
			}
		}
	}
	return library;
}
function scryfallLinker (thisCard, first) { //links from scryfall
	thisCard = this.cards[thisCard];
	let set_code = thisCard.setID;
	let card_No = thisCard.cardID;
	let showCard = "https://api.scryfall.com/cards/" + thisCard.scryID + "?format=image";
	if(first)
		return showCard;
	if(thisCard.shape == "doubleface") {
		showCard = `https://img.scryfall.com/cards/large/front/${thisCard.scryID.charAt(0)}/${thisCard.scryID.charAt(1)}/${thisCard.scryID}.jpg`;
		if(thisCard.notes.includes("meld")) {
			showCard += `\nhttps://img.scryfall.com/cards/large/front/${thisCard.scryID2.charAt(0)}/${thisCard.scryID2.charAt(1)}/${thisCard.scryID2}.jpg`;
			
		}else{
			showCard += `\nhttps://img.scryfall.com/cards/large/back/${thisCard.scryID.charAt(0)}/${thisCard.scryID.charAt(1)}/${thisCard.scryID}.jpg`;
		}
	}
	let hiddenCards = ["Invoke Prejudice", "Imprison"];
	if(hiddenCards.includes(thisCard.cardName))
		showCard = "||" + showCard + "||"; //put cards with 'banned art' in spoiler tags
	return showCard;
}
function myriadLinker(cardName) { //links for myriad
	let thisCard = this.cards[cardName];
	return `https://myriadmtg.000webhostapp.com/images/${thisCard.setID}/${toolbox.fillLength(thisCard.cardID, 3, "0", "")}.png`;
}
function revolutionLinker(cardName) { //links for myriad
	let thisCard = this.cards[cardName];
	return `https://liminalobserver.herokuapp.com/cards/${thisCard.setID}/${thisCard.cardID}.jpg`;
}

let libs = ["magic", "msem", "devDex", "myriad", "cajun_standard", "revolution"];

exports.libraries = libs;
exports.generatePrints = generatePrints;
exports.buildReference = buildReference;
exports.decodeColor = decodeColor;
exports.decodeTitle = decodeTitle;
exports.refSheet = refSheet;
exports.magic = {
	cards:magicCards,
	setData:magicSets,
	legal:magicBanned,
	name:"magic",
	bigname:"Magic",
	nicks:nicks.magic,
	oracle:magicRules,
	writeCard:writeCard,
	printImage:scryfallLinker,
	encodeColor: "00aaaa",
	functions: ['img', 'rul', 'legal'],
	swaps: ["(magic|canon)","magic","canon"],
	searchData: {title: "Scryfall", site:"https://scryfall.com/search?q=", end:""},
	formatBribes:null //setup in lackeybot.js
};
exports.msem = {
	cards:msemCards,
	setData:msemSets,
	legal:msemBanned,
	name:"msem",
	bigname:"MSEM",
	nicks:nicks.msem,
	oracle:msemRules,
	writeCard:writeCard,
	printImage:msemLinker,
	encodeColor: "01aaaa",
	functions: ['img', 'rul', 'legal'],
	swaps: ["msem"],
	searchData: {title: "Instigator", site:"http://msem-instigator.herokuapp.com/card?q=", end:""},
	formatBribes:null //setup in lackeybot.js
};
exports.devDex = {
	cards:{},
	setData:{},
	devDex:{},
	legal:{},
	name:"devDex",
	bigname: "devDex",
	nicks:{},
	oracle:{},
	writeCard:writeDevCard,
	printImage:null,
	encodeColor: "02aaaa",
	functions: ['img'],
	swaps: ["(dev|custom|project)","dev","custom","project"],
	searchData: {title: "Custom Projects", site:"http://www.planesculptors.net/explore?query=", end:"#cards"},
	formatBribes:null //setup in lackeybot.js
};
exports.myriad = {
	cards:myriadCards,
	setData:myriadSets,
	legal:myriadPointed,
	name:"myriad",
	bigname:"Myriad",
	nicks:{},
	oracle:myriadRules,
	writeCard:writeCard,
	printImage:myriadLinker,
	encodeColor: "03aaaa",
	functions: ['img'],
	swaps: ["myriad"],
	searchData: {title: "Hub of Innovation", site:"http://msem-instigator.herokuapp.com/card?q=", end:""},
	formatBribes:null //setup in lackeybot.js
};
exports.cajun_standard = {
	cards:csCards,
	setData:csSets,
	legal:csBanned,
	name:"cajun_standard",
	bigname:"CajunStandard",
	nicks:nicks.cajun,
	oracle:csRules,
	writeCard:writeCard,
	printImage:scryfallLinker,
	encodeColor: "04aaaa",
	functions: ['img', 'rul', 'legal'],
	swaps: ["cajun"],
	searchData: {title: "Cajun Standard", site:"", end:""},
	formatBribes:null //setup in lackeybot.js
}
exports.libFromBig = function(bigName) {
	for(let library in this){
		if(this[library].hasOwnProperty('bigname') && this[library].bigname == bigName)
			return this[library];
	}
}