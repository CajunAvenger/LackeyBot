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
let stats = require('./stats.js');
let mod_magic = require('./magic.js');
let nicks = require('./nicks.json')
let toolbox = require('./toolbox.js');
var settings = require('./serverConfig.json');
var psScrape = require('./psScrape.js');
var rp = require('request-promise-native');
var {excEmote, quesEmote, dollarEmote} = require('./emoteBuffet.js');

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
function helpMessage() {
	let helpout = "**LackeyBot Configuration Help**\n";
	return helpout;
}
function configureArcana(msg) {
	//defaults for unconfigured servers
	let configured = {
		angle: {
			data: this.magic,
			prefix: "!",
			emote: excEmote,
		},
		square: {
			data: this.msem,
			prefix: "\\$",
			emote: dollarEmote,
		},
		curly: {
			data: this.devDex,
			prefix: "\\?",
			emote: quesEmote,
		}
	}
	let order = [configured.angle, configured.square, configured.curly];
	//swap out databases for configured servers
	let guildID = 0;
	if(msg.guild)
		guildID = msg.guild.id;
	if(settings.hasOwnProperty(guildID)) {
		for(let b in settings[guildID].a) {
			if(settings[guildID].a[b] == "ps") {
				order[b].data = {cards:psScrape.psCache, name:"ps", bigname:"Planesculptors"};
			}else if(settings[guildID].a[b] == ""){
				order[b].data = null;
			}else{
				order[b].data = this[settings[guildID].a[b]];
			}
		}
	}
	//and apply swapSquares
	var psActive = msg.content.match(/\$pl?a?n?e?sc?u?l?p?t?o?r?/i);
	var swapSquares = msg.content.match(refSheet.anySwapRegex);
	if(swapSquares || psActive) {
		if(psActive) {
			configured.square.data = {cards:psScrape.psCache, name:"ps", bigname:"Planesculptors"}
		}else{
			let dataName = this.refSheet.swapCommands[swapSquares[1]];
			configured.square.data = this[dataName];
		}
	}
	return configured;
}
function convertCardTo(library, searchString, msg) { 		//convert databases, TODO using last string in channel
	let card_name = searchCards(library, searchString, msg)
	msg.edit(showCard);
}
function writeCard (thisCard, shortFlag){ //writes a card from this library with a name
	return mod_magic.writeCard(thisCard, this.cards, this.setData, shortFlag, "");
}
function writeDevCard (thisCard, shortFlag){
	return mod_magic.writeCard(thisCard, this.cards, this.setData, shortFlag, "   ***[Custom]***");
}
function anyRandom(randBase) {								//gets a random card from the given database
	let cardnames =  Object.keys(randBase.cards)
	let num = Math.floor(Math.random()*cardnames.length);
	let rando = cardnames[num];
	return rando;
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

function bribeLackeyBot(cardName,msg){ 						//card-specific bribes for the custom database
	stats.upCards(1);
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i) && thisCard.setID != "BOT") {
		fullCard = cardLink; //replaces the text with a link
		stats.upBribes(1);
	}
	//append ban notices when applicable
	if(this.legal.preview.includes(thisCard.setID))
		fullCard += "\n*(" + thisCard.fullName + " is not yet in MSEModern and may change before release.)*\n";
	let bans = [{list:this.legal.modernBan, name:"MSEM"}, {list:this.legal.edhBan, name:"MSEDH"}];
	let banMessage = "";
	for(let list in bans) {
		if(bans[list].list.includes(thisCard.fullName) || thisCard.typeLine.match(/Conspiracy/))
			banMessage += bans[list].name + ", ";
	}
	if(banMessage != "") {
		banMessage = banMessage.replace(/, $/, ")__");
		banMessage = "__Banned (" + banMessage;
		if(!fullCard.match(/\n$/))
			fullCard += "\n";
		fullCard += banMessage;
	}
	if(this.legal.masterpiece.includes(thisCard.fullName))
		fullCard += "\n*" + thisCard.fullName + " is Masterpiece only and not legal in MSEModern.*\n";
	if(this.legal.cuts.live) { //cards being removed from msem
		let cutCard = false;
		if(this.legal.cuts.sets.includes(thisCard.setID) && !this.legal.cuts.exempts.includes(thisCard.cardName)) {
			cutCard = true;	//from a cut set and not reprinted elsewhere
		}else if(thisCard.setID.match(/MS\d|LAIR|MPS_MSE|CHAMPIONS/) && this.legal.cuts.designer.includes(thisCard.designer)) {
			cutCard = true;	//reprints/bonus cards from cut designer
		}
		if(cutCard)
			fullCard = fullCard.replace(/\n$/, "") + "\n*" + thisCard.fullName + " will be removed from MSEM in " + this.legal.cuts.out + " by designer request.*\n";
	}
	//append rulings when applicable
	if(msg.content.match(/(\$|ϕ)rul/i) && thisCard.setID != "BOT"){
		let ruling = "Can't find anything on that one, boss.\n";
		if(this.oracle.hasOwnProperty(thisCard.fullName)){
			ruling = this.oracle[thisCard.fullName];
		}
		stats.upBribes(1);
		fullCard += "\n• ";
		fullCard += ruling.replace(/_/g, "•");
	}
	return fullCard;
};
function bribeLackeyCanon(cardName,msg){ 					//card-specific bribes for the canon database
	stats.upCards(1);
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(!|ϕ)ima?ge?/i) || (msg.content.match(/\$canon/i) && msg.content.match(/\$ima?ge?/i))) {
		fullCard = cardLink; //replaces the text with a link
		stats.upBribes(1);
	}
	let banArray = [];
	let banMessage = "";
	for(let format in this.legal) {
		if(this.legal[format].includes(thisCard.fullName)) {
			if(format == "conspiracy") {
				banArray.push("commander")
				banArray.push("legacy")
				banArray.push("vintage")
			}else if(format != "vintageRest") {
				banArray.push(format);
			}else{
				banMessage += "Restricted (Vintage)";
				if(banArray != "")
					banMessage += ", ";
			}
		}
	}
	if(banArray.length > 0)
		banMessage += "Banned (";
	for(var i = 0; i<banArray.length; i++) {
		banMessage += toolbox.toTitleCase(banArray[i]);
		if(i != banArray.length-1)
			banMessage += ", ";
		if(i == banArray.length-1)
			banMessage += ")";
	}
	if(banMessage != "") {
		if(fullCard == cardLink)
			fullCard += "\n"
		fullCard += "__" + banMessage + "__";
	}
	if(msg.content.match(/(!|ϕ)rul/i)){
		let ruling = "Can't find anything on that one, boss.\n";
		if(this.oracle.hasOwnProperty(thisCard.fullName)){
			ruling = this.oracle[thisCard.fullName];
		}
		stats.upBribes(1);
		fullCard += "\n• ";
		fullCard += ruling.replace(/_/g, "•");
	}
	return fullCard;
};
function bribeLackeyDev(cardName, msg) { 					//card-specific bribes for the project database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\?|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		stats.upBribes(1);
	}
	return fullCard;
}
function psLinker(cardName) { 								//links from planesculptors
	let thisCard = this.cards[cardName];
	return "http://www.planesculptors.net/upload/" + this.setData[thisCard.setID].psLink + "/" + encodeURIComponent(thisCard.cardName.replace(/[',!\?’“”]/g,"")) + this.setData[thisCard.setID].psSuffix;
}
function bribeLackeyMyriad(cardName, msg) { 				//card-specific bribes for the project database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		stats.upBribes(1);
	}
	for(let points in this.legal) {
		if(this.legal[points].includes(thisCard.fullName))
			fullCard += "\n__" + thisCard.fullName + " is **" + points + "**.__";
	}
	fullCard = fullCard.replace("\n\n__", "\n__");
	return fullCard;
}
function bribeLackeyCS(cardName, msg) { 					//card-specific bribes for the cajun-standard database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		stats.upBribes(1);
	}
	return fullCard;
}
function csLinker(cardName) { 								//links from planesculptors/msem
	let thisCard = this.cards[cardName];
	if(thisCard.hasOwnProperty('prints') && thisCard.prints.includes("L"))
		return `http://mse-modern.com/msem2/images/L/${thisCard.cardID}.jpg`;
	return "http://www.planesculptors.net/upload/" + this.setData[thisCard.setID].psLink + "/" + encodeURIComponent(thisCard.cardName.replace(/[',!\?’“”]/g,"")) + this.setData[thisCard.setID].psSuffix;
}

let libs = ["magic", "msem", "devDex", "myriad", "cajun_standard"];

exports.libraries = libs;
exports.generatePrints = generatePrints;
exports.buildReference = buildReference;
exports.decodeColor = decodeColor;
exports.decodeTitle = decodeTitle;
exports.refSheet = refSheet;
exports.helpMessage = helpMessage;
exports.configureArcana = configureArcana;
exports.anyRandom = anyRandom;

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
	formatBribes: bribeLackeyCanon
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
	formatBribes: bribeLackeyBot
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
	printImage:psLinker,
	encodeColor: "02aaaa",
	functions: ['img'],
	swaps: ["(dev|custom|project)","dev","custom","project"],
	searchData: {title: "Custom Projects", site:"http://www.planesculptors.net/explore?query=", end:"#cards"},
	formatBribes: bribeLackeyDev
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
	formatBribes: bribeLackeyMyriad
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
	printImage:csLinker,
	encodeColor: "04aaaa",
	functions: ['img', 'rul', 'legal'],
	swaps: ["cajun"],
	searchData: {title: "Cajun Standard", site:"", end:""},
	formatBribes: bribeLackeyCS
}
exports.libFromBig = function(bigName) {
	for(let library in this){
		if(this[library].hasOwnProperty('bigname') && this[library].bigname == bigName)
			return this[library];
	}
}