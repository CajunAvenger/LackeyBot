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
let extras = require('./msem/extras.json');
let mod_magic = require('./magic.js');
let fuzzy = require('./fuzzy.js');
let nicks = require('./nicks.json')
let toolbox = require('./toolbox.js');
var settings = require('./serverConfig.json');
var psScrape = require('./psScrape.js');
var rp = require('request-promise-native');
var download = require('download-file');
var mechanics = require("./msem/mechs.json");
var Discord = require('discord.js');
var eris = require('./eris.js');
var Client = eris.Client();
var config = require('./config/lackeyconfig.js').config;
var login = config.live;
var { //emote buffet
	yeet, boop, leftArrow, rightArrow,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');

let msemCards = require('./msem/cards.json');
let msemSets = require('./msem/setData.json');
let msemBanned = require('./msem/legal.json');
let msemRules = require('./msem/oracle.json');
let msemCR = require('./msem/cr.json');

let csCards = require('./cstandard/cards.json');
let csSets = require('./cstandard/setData.json');
let csBanned = require('./cstandard/legal.json');
let csRules = require('./cstandard/oracle.json');

let magicCards = require('./canon/cards.json');
let magicSets = require('./canon/setData.json');
let magicBanned = require('./canon/legal.json');
let magicRules = require('./canon/oracle.json');
var magicCR = require("./canon/cr.json");

let revCards = require('./revolution/cards.json');
let revSets = require('./revolution/setData.json');
let revBanned = require('./revolution/legal.json');
let revRules = {};//require('./revolution/oracle.json');
var revCR = require("./revolution/cr.json");
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

//Setup
let refSheet = {											//holds list of values from databases
	encodedColors: {},
	searchTitles:{},
	swapCommands: {},
	searchRegex: null,
	anySwapRegex: null
}
function buildReference(arcana){							//builds refSheet
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
	anySwapString = "(?:\\$|\\?|!)(" + anySwapString.replace(/\|$/, "") + ")\\b";
	refSheet.searchRegex = new RegExp(titleString, 'i');
	refSheet.anySwapRegex = new RegExp(anySwapString, 'i');
}
function configHelpMessage() {
	let helpout = "**LackeyBot Configuration Help**\n";
	return helpout;
}
function configureArcana(msg) {								//determine what databases this message wants
	//defaults for unconfigured servers
	let configured = {
		angle: {
			data: magicDatabase,
			prefix: "!",
			emote: excEmote,
		},
		square: {
			data: msemDatabase,
			prefix: "\\$",
			emote: dollarEmote,
		},
		curly: {
			data: devDexDatabase,
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
				order[b].data = links[settings[guildID].a[b]];
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
			let dataName = refSheet.swapCommands[swapSquares[1]];
			configured.square.data = links[dataName];
		}
	}
	return configured;
}
function generatePrints (library) {							//generate a card's prints array
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

//General
function convertCardTo(library, searchString, msg) { 		//convert databases, TODO using last string in channel
	let card_name = searchCards(library, searchString, msg)
	msg.edit(showCard);
}
function writeCard (thisCard, shortFlag){					//writes a card from this library with a name
	return mod_magic.writeCard(thisCard, this.cards, this.setData, shortFlag, "");
}
function writeDevCard (thisCard, shortFlag){				//shortcut to write devDex card
	return mod_magic.writeCard(thisCard, this.cards, this.setData, shortFlag, "   ***[Custom]***");
}
function anyRandom(randBase) {								//gets a random card from the given database
	let cardnames =  Object.keys(randBase.cards)
	let num = Math.floor(Math.random()*cardnames.length);
	let rando = cardnames[num];
	return rando;
}
function decodeColor (decimal) {							//converts decimal color value to database name
	let hex = toolbox.convertBases(decimal, 10, 16);
	hex = toolbox.fillLength(hex, 6, "0", "")
	if(refSheet.encodedColors[hex])
		return refSheet.encodedColors[hex];
	return null;
}
function decodeTitle (title) {								//converts title to database name
	if(refSheet.searchTitles[title])
		return refSheet.searchTitles[title];
	return null;
}
function libFromBig(bigName) {								//convert bigname to database
	for(let l in links){
		if(links[l].hasOwnProperty('bigname') && links[l].bigname == bigName)
			return links[l];
	}
}
//CR engine
function sendRuleData (testRul, crBase, inline) {						//generates data for a given CR entry
	testRul = testRul.replace(/\.([a-z])/, "$1");
	testRul = testRul.replace(/([a-z])\./, "$1");
	let rulMatch = testRul.match(/([A-Z]?[0-9]{3})\.?([0-9]*)(\.|[a-z])?/);
	let ruleData = {
		title: "",
		lines: [],
		nextRule: "",
		prevRule: "",
		ruleNames: []
	}
	let rulesList = Object.keys(crBase.rules);
	if(rulMatch && rulMatch[3] && crBase.rules.hasOwnProperty(testRul)) { //if a precise rule, send just that
		ruleData.title = testRul;
		ruleData.ruleNames.push(testRul);
		for(let r in crBase.rules[testRul])
			ruleData.lines.push(""+crBase.rules[testRul][r])
		let index = rulesList.indexOf(testRul);
		ruleData.nextRule = rulesList[(index+1)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
		ruleData.lines[0] = "**" + ruleData.title + "** " + ruleData.lines[0];
	}
	else if(rulMatch && rulMatch[2] && crBase.rules.hasOwnProperty(testRul)) { //if an XXX.YY, send that and as many subrules as you can
		ruleData.title = testRul;
		ruleData.ruleNames.push(testRul);
		for(let t in crBase.rules[testRul])
			ruleData.lines.push(""+crBase.rules[testRul][t])
		for(let rul in ruleData.lines) {
			if(crBase.rules.hasOwnProperty(ruleData.lines[rul])) {
				ruleData.ruleNames.push(ruleData.lines[rul]);
				ruleData.lines[rul] = "**" + ruleData.lines[rul] + "** " + crBase.rules[ruleData.lines[rul]]
			}
		}
		let index = rulesList.indexOf(testRul);
		ruleData.nextRule = rulesList[(index+ruleData.ruleNames.length)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
		ruleData.lines[0] = "**" + ruleData.title + "** " + ruleData.lines[0];
	}
	else if(rulMatch && rulMatch[1] && crBase.rules.hasOwnProperty(rulMatch[1])) { //if an XXX, send that and as many subrules as you can
		ruleData.title = rulMatch[1];
		ruleData.ruleNames.push(rulMatch[1]);
		for(let r in crBase.rules[rulMatch[1]])
			ruleData.lines.push(""+crBase.rules[rulMatch[1]][r])
		for(let rul in ruleData.lines) {
			if(crBase.rules.hasOwnProperty(ruleData.lines[rul])) {
				ruleData.ruleNames.push(ruleData.lines[rul]);
				ruleData.lines[rul] = "**" + ruleData.lines[rul] + "** " + crBase.rules[ruleData.lines[rul]]
			}
		}
		let index = rulesList.indexOf(rulMatch[1]);
		ruleData.nextRule = rulesList[(index+ruleData.ruleNames.length)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
		ruleData.lines[0] = "**" + ruleData.title + "** " + ruleData.lines[0];
	}
	else{
		let glos = false;
		if(!rulMatch){
			if(crBase.glossary.hasOwnProperty(testRul))
				glos = testRul;
			glos = fuzzy.searchArray(testRul, Object.keys(crBase.glossary).reverse(), {score:3})[0];
		}
		if(glos) {
			ruleData.title = glos;
			for(let r in crBase.glossary[glos])
				ruleData.lines.push(""+crBase.glossary[glos][r])
			let seeCheck = crBase.glossary[glos][0].match(/see (rules? )?([^,]+)/i);
			if(seeCheck) {
				if(seeCheck[1]) {
					let temp = sendRuleData(seeCheck[2], crBase);
					for(let lin in temp.lines)
						ruleData.lines.push(temp.lines[lin])
					ruleData.ruleNames = temp.ruleNames;
					ruleData.ruleNames.reverse()
					ruleData.ruleNames.push(glos)
					ruleData.ruleNames.reverse()
					ruleData.nextRule = temp.nextRule;
					ruleData.prevRule = temp.prevRule;
				}else if(crBase.glossary.hasOwnProperty(seeCheck[1])){
					ruleData.lines.push(seeCheck[1])
					ruleData.ruleNames = [glos, seeCheck[1]];
					ruleData.nextRule = null;
					ruleData.prevRule = null;
				}
			}
		}else{
			ruleData.title = "Comprehensive Rules";
			ruleData.ruleNames = ["000"];
			ruleData.lines = ["Rule not found."];
			ruleData.nextRule = rulesList[0];
			ruleData.prevRule = rulesList[rulesList.length-1];
		}
	}
	return ruleData;
}
function buildCREmbed(testrul, library, textFlag) {					//build !cr embeds
	let ruleData = sendRuleData(testrul, library.cr);
	let breakout = 0;
	let output = "";
	let max = 2046;
	let footer = "";
	if(textFlag) {
		output += "**" + ruleData.title + "**";
		max = 1998;
	}
	for(let line in ruleData.lines) {
		if(!breakout && output.length + ruleData.lines[line].length > max)
			breakout = line;
		if(!breakout)
			output += "\n" + ruleData.lines[line]
		if(breakout || line == ruleData.lines.length-1) {
			footer = `Previous ${ruleData.prevRule}\nNext `
			if(breakout) {
				footer += `${ruleData.ruleNames[breakout]}`;
			}else{
				footer += `${ruleData.nextRule}`;
			}
		}
	}
	footer += "\n" + library.bigname + " Comprehensive Rules";
	if(textFlag) {
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(ruleData.title)
			.setFooter(footer)
		return [output, nullEmbed];
	}else{ //embed
		let embedData = new Discord.MessageEmbed()
			.setTitle(ruleData.title)
			.setDescription(output)
			.setFooter(footer)
		return ["", embedData];
	}
}
//Scryfall
function scryCard(cardName) { 								//get scryfall data for a card
	let cardStuff = magicDatabase.cards[cardName];
	let testurl = "https://api.scryfall.com/cards/" + cardStuff.scryID;
	let requestPromise;
	requestPromise = new Promise((resolve, reject) => {
		rp({url: testurl, json: true}).then(body => {
			resolve(body);
		}, () => {
			console.log('Falling back to fuzzy search for '+cardName);
			rp({url: testurl, json: true})
				.then(response => resolve({data: [response]}), reject);
		});
	});
	return requestPromise;
}
async function priceCanon (name) {							//get the price data
	//name = "Fold into Aether_5DN";
	let priceStuff = '';
	let callback = function (data) {
		priceStuff = data.prices;
	}
	let beep = scryCard(name)
		.then(data => callback(data))
		.catch(e => console.log(e))
	let pricewait = await beep;
	return priceStuff;
}
async function asyncPriceData (cardName, page) {			//convert price to string
	if(fuzzy.embedCache.prices.hasOwnProperty(cardName)) {
		buildPriceEmbed(cardName, page)
	}else{
		let priceObj = await priceCanon(cardName); //"usd":"0.19","usd_foil":"1.12","eur":"0.05","tix":"0.03"
		let priceString = "";
		if(priceObj.usd != null) {
			priceString += "$" + priceObj.usd;
			if(priceObj.usd_foil != null)
				priceString += " ($" + priceObj.usd_foil + " Foil)"
			priceString += " | "
		}
		if(priceObj.eur != null)
			priceString += priceObj.eur + "€ | "
		if(priceObj.tix != null)
			priceString +=	priceObj.tix + " Tix";
		priceString = priceString.replace(" | | ", " | ")
		priceString = priceString.replace(/ \| $/, "")
		return priceString;
	}
}
//Image links
function msemLinker (thisCard) { 							//links from msem site
	thisCard = this.cards[thisCard];
	return "http://mse-modern.com/msem2/images/" + thisCard.setID + "/" + thisCard.cardID + ".jpg";
}
function scryfallLinker (thisCard, first) {					//links from scryfall
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
function myriadLinker(cardName) {							//links for myriad
	let thisCard = this.cards[cardName];
	return `https://myriadmtg.000webhostapp.com/images/${thisCard.setID}/${toolbox.fillLength(thisCard.cardID, 3, "0", "")}.png`;
}
function revolutionLinker(cardName) {						//links for revolution
	let thisCard = this.cards[cardName];
	return `https://revolution-manifesto.herokuapp.com/cards/${thisCard.setID}/${thisCard.cardID}.jpg`;
}

//Card formatting
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
		if(this.legal.cuts.sets.includes(thisCard.setID)) {
			cutCard = true;	//from a cut set
		}else if(thisCard.setID.match(/MS\d|LAIR|MPS_|CHAMPIONS|L$|L2|L3/) && this.legal.cuts.designer.includes(thisCard.designer)) {
			cutCard = true;	//reprints/bonus cards from cut designer
		}
		if(cutCard) {
			for(let p in thisCard.prints) {
				let setName = thisCard.prints[p];
				if(!this.legal.cuts.sets.includes(setName) && !thisCard.setID.match(/MS\d|LAIR|MPS_|CHAMPIONS|L$|L2|L3/))
					cutCard = false; //reprinted by someone else
			}
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
function bribeLackeyRev(cardName, msg) { 					//card-specific bribes for the cajun-standard database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		stats.upBribes(1);
	}
	if(this.legal.banned.includes(thisCard.fullName))
		fullCard += "\n__Banned (Revolution)__"
	fullCard = fullCard.replace(/\n\n__Banned/, "\n__Banned")
	return fullCard;
}
function csLinker(cardName) { 								//links from planesculptors/msem
	let thisCard = this.cards[cardName];
	if(thisCard.hasOwnProperty('prints') && thisCard.prints.includes("L"))
		return `http://mse-modern.com/msem2/images/L/${thisCard.cardID}.jpg`;
	return "http://www.planesculptors.net/upload/" + this.setData[thisCard.setID].psLink + "/" + encodeURIComponent(thisCard.cardName.replace(/[',!\?’“”]/g,"")) + this.setData[thisCard.setID].psSuffix;
}

//Message handlers
function blankMH() {										//blank message handler for databases without specialized commands
	return;
}
function magicMH(msg, perms) {								//message handler for Magic
	if(msg.content.match(/\$standard/i)) {
		stats.upBribes(1);
		let standardSets = [];
		for(let set in this.setData) {
			if(this.setData[set].standard)
				standardSets.push(set)
		}
		let output = "";
		let theDate = toolbox.arrayTheDate()
		let thisYear = theDate[0] + 2000;
		if(standardSets.length == 4) { //if a rotation just happened
			if(theDate[1] != "01") //and we're not in the gap before the Q1 set
				thisYear++; //they rotate next year
			output += "Rotates Q4 " + thisYear + "\n```";
			for(let set in standardSets)
				output += this.setData[standardSets[set]].longname + " | ";
			output = output.replace(/ \| $/, "```")
		}else{
			output += "Rotates Q4 " + thisYear + ":\n```";
			for(let i = 0; i<standardSets.length; i++) {
				output += this.setData[standardSets[i]].longname;
				if(i != 3 && i != standardSets.length-1)
					output += " | ";
				if(i == 3) {
					thisYear++
					output += "```\nRotates Q4 " + thisYear + ":\n```"
				}
			}
			output += "```";
		}
		msg.channel.send(output);
	}

	//cr and canon mechanic checks
	let crRegex = msg.content.match(/!cr ([^!\n]+)/);
	if(msg.guild && msg.guild.id == "205457071380889601") {
		let mechstrings = "";
		let mechKeys = Object.keys(magicCR.glossary)
		for(let i=mechKeys.length-1; i>=0; i--) {
			thisMech = mechKeys[i]
			if(!thisMech.match(/^(card|skip|play)/i)) //judgebot and rhythm overlaps
				mechstrings += thisMech + "|";
		}
		mechstrings = mechstrings.replace(/, /g, "|");
		mechstrings = mechstrings.replace(/\|$/,"");
		let mechCheck = new RegExp('(?:^!|[^@]!)(' + mechstrings + ')','i')
		crRegex = msg.content.match(mechCheck);
	}
	if(crRegex) {
		stats.upBribes(1);
		let embedData = buildCREmbed(crRegex[1], this);
		msg.channel.send(embedData[0], embedData[1])
			.then(mess => mess.react(leftArrow)
				.then(() => mess.react(rightArrow)
					.then(() => mess.react(plainText)
						.then(() => mess.react(xEmote)))))
			.catch(e => console.log(e))
	}

	let pricesCheck = msg.content.match(/\$price ([^\$\n]+)/i)
	if(pricesCheck){
		let testName = fuzzy.scryDatabase(magicDatabase, pricesCheck[1])[0][0];
		if(testName == undefined)
			testName = fuzzy.searchCards(magicDatabase, pricesCheck[1])
		if(testName == undefined) {
			msg.channel.send("LackeyBot was unable to find a card that matched that search.")
		}else{
			let pricestring = asyncPriceData(testName)
				.then(pricestring => msg.channel.send("```Prices for " + testName + "\n" + pricestring + "```"))
				.catch(e => console.log(e))
		}
	}	
	//banlists
	let banlistMatch = msg.content.match(/(?:!|\$)(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)? ?ban(?:ned|list)? *(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)?/)
	if(banlistMatch) {
		let bancheck;
		if(banlistMatch[1])
			bancheck = banlistMatch[1];
		if(banlistMatch[2])
			bancheck = banlistMatch[2];
		if(bancheck) {
			bancheck = bancheck.toLowerCase();
			if(bancheck == 'vintage')
				bancheck = 'vintageRest';
			let banlist = "";
			this.legal[bancheck].sort();
			for(var i = 0; i < this.legal[bancheck].length; i++) {
				banlist += "**" + this.legal[bancheck][i] + "**";
				if(this.legal[bancheck].length > 2 && i < this.legal[bancheck].length-1)
					banlist += ", ";
				if(this.legal[bancheck].length == 2)
					banlist += " ";
				if(i == this.legal[bancheck].length-2)
					banlist += "and ";
			}
			banlist += " are banned in " + toolbox.toTitleCase(bancheck) + ".";
			banlist = banlist.replace("banned in Vintagerest","restricted in Vintage");
			if(bancheck == "legacy" || bancheck == "commander")
				banlist = this.legal['conspiracy'].length + " conspiracy cards, " + banlist;
			if(bancheck == "vintageRest") {
				banlist += "\n" + this.legal['conspiracy'].length + " conspiracy cards, ";
				for(var i = 0; i < this.legal['vintage'].length; i++) {
					banlist += "**" + this.legal['vintage'][i] + "**";
					if(this.legal['vintage'].length > 2 && i < this.legal['vintage'].length-1)
						banlist += ", ";
					if(this.legal['vintage'].length == 2)
						banlist += " ";
					if(i == this.legal['vintage'].length-2)
						banlist += "and ";
				}
				banlist = 
				banlist += " are banned in Vintage.";
			}
			msg.channel.send(banlist);
		}
	}
}
function msemMH(msg, perms) {								//message handler for MSEM
	let banlistMatch = msg.content.match(/(?:!|\$)(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)? ?ban(?:ned|list)? *(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)?/)
	if(banlistMatch && !banlistMatch[1] && !banlistMatch[2]){ //banlist
		let banlist = "";
		for(var i = 0; i < this.legal.modernBan.length; i++) {
			banlist += "**" + this.legal.modernBan[i] + "**";
			if(this.legal.modernBan.length > 1)
				banlist += ", ";
		}
		banlist += "and 16 conspiracy cards are banned in MSEM.\r\n\r\n";
		for(var i = 0; i < this.legal.edhBan.length; i++) {
			banlist += "**" + this.legal.edhBan[i] + "**";
			if(this.legal.edhBan.length == 1 && i == 0)
				banlist += " and ";
			if(this.legal.edhBan.length > 1 && i < this.legal.edhBan.length-2)
				banlist += ", ";
			if(this.legal.edhBan.length > 1 && i == this.legal.edhBan.length-2)
				banlist += ", and ";
		}
		banlist += ", and 16 conspiracy cards are banned in MSEDH.";			
		msg.channel.send(banlist);
		stats.upBribes(1);
	}
	//mechanic rules
	let crRegex = msg.content.match(/\$cr ([^!\n]+)/);
	if(crRegex) {
		stats.upBribes(1);
		let embedData = buildCREmbed(crRegex[1], this);
		msg.channel.send(embedData[0], embedData[1])
			.then(mess => mess.react(leftArrow)
				.then(() => mess.react(rightArrow)
					.then(() => mess.react(plainText)
						.then(() => mess.react(xEmote)))))
			.catch(e => console.log(e))
	}
	let mechstrings = ""
	for(let thisMech in mechanics)
		mechstrings += thisMech + "|";
	let mechRegex = new RegExp('\\$(' + mechstrings.replace(/\|$/,"") + ')','i')
	mechcheck = msg.content.match(mechRegex);
	if(mechcheck !== null) {
		msg.channel.send(mechanics[mechcheck[1].toLowerCase()]);
		if(mechcheck[1].toLowerCase() == "archive")
			msg.channel.send(mechanics.additional);
		stats.upBribes(1);
	}
	if(msg.content.match(/\$submis/i)){
		let month = new Date().getMonth();
		let subDead = "January 31st", subRelease = "March 1st";
		if(month > 0 && month < 5)
			subDead = "May 31st";
		if(month >= 5 && month < 9)
			subDead = "September 30th";
		if(month > 1 && month < 6)
			subRelease = "July 1st";
		if(month >= 6 && month < 10)
			subRelease = "November 1st";
		let thisPost = "The next submission deadline is " + subDead + ", and the next set release is " + subRelease + ".\n";
		//thisPost += "The next wildcard update deadline is " + stats.wildDead + ", and the next wildcard release is " + stats.wildRelease + ".\n";
		thisPost += "To submit a set for MSEM, send it to any ModSquad or Top Brass member. For best results, check out the format so far, and please review the guidelines from the MSE post: <http://magicseteditor.boards.net/thread/281/mse-modern-july-update>";
		msg.channel.send(thisPost);
		stats.upBribes(1);
	}
	if(msg.content.match(/\$url/i)){
		msg.channel.send("The Lackey Auto-Update link is: http://mse-modern.com/msem2/updatelist.txt\nThe Cockatrice update links are:\n<http://mse-modern.com/msem2/notlackey/AllSets.json>\n<http://mse-modern.com/msem2/notlackey/tokens.xml>");
		stats.upBribes(1);
	}
	if(msg.content.match(/\$(cocka)?trice/)) {
		stats.upBribes(1);
		output = "Cockatrice Installation:\n";
		output += "For easiest updates, you'll want a separate version of Cockatrice for MSEM. This can be done selecting \"Portable version\" when downloading Cockatrice: <https://cockatrice.github.io/>\n";
		output += "• Open Cockatrice and run Oracle. This is usually labled \"Check for card updates\" under the Cockatrice or Help menu, depending on your version.\n";
		output += "• For Oracle's file sources, paste `http://mse-modern.com/msem2/notlackey/AllSets.json` in the first window, then `http://mse-modern.com/msem2/notlackey/tokens.xml` after that has downloaded.\n";
		output += "• On the top menu, navigate to Cockatrice -> Settings -> Card Sources on Windows or Cockatrice -> Preferences on Mac.\n";
		output += "• Add the two links from Image download paths below. Ensure they are the first links, are in the same order, and that \"Download images on the fly\" is checked.\n";
		output += "`http://mse-modern.com/msem2/images/!setcode!/!set:num!!set:rarity!.jpg`\n";
		output += "`http://mse-modern.com/msem2/images/!setcode!/!set:num!.jpg`\n";
		output += "• After patches, click the \"Delete all downloaded images\" button here to allow cards to update.";
		msg.channel.send(output);
	}
	if(msg.content.match(/\$inst/i)){
		msg.channel.send("For more in-depth searching options, check out Instigator!\n<https://msem-instigator.herokuapp.com/>");
		stats.upBribes(1);
	}
	let landMatch = msg.content.match(/\$([wubrg]{1,3}|bant|esper|grixis|jund|naya|abzan|jeskai|sultai|mardu|temur) ?(dual|land)/i); //msem $lands
	let landCycleMatch = msg.content.match(/\$(checkland|shockfetch|monofetch|scryland|desertshock|paindual|plagueland|plaguedual|mirrorland|handland|(investigate|clue)(land|dual)|drawdual|karoo|cycleland|tormentland|monofetch)/i); //msem $lands
	if(landMatch || landCycleMatch) {
		let searchQuery = "t:Land -t:Basic ";
		if(landMatch) {
			let factionArray = ["bant","esper","grixis","jund","naya","abzan","jeskai","sultai","mardu","temur"];
			let factionColorArray = ["GWU","WUB","UBR","BRG","RGW","WBG","URW","BGU","RWB","GUR"];
			let factionInvertArray = ["BR","RG","GW","WU","UB","UR","BG","RW","GU","WB"];
			searchQuery += "adds:"
			if(factionArray.includes(landMatch[1].toLowerCase())) {
				searchQuery += factionColorArray[factionArray.indexOf(landMatch[1].toLowerCase())]
				searchQuery += " -adds:" + factionInvertArray[factionArray.indexOf(landMatch[1].toLowerCase())]
			}else{
				searchQuery += landMatch[1].toUpperCase();
				searchQuery += " -adds:";
				let colors = ["W","U","B","R","G"];
				for(let c in colors) {
					if(!landMatch[1].toUpperCase().match(colors[c]))
						searchQuery += colors[c];
				}
			}
		}else if(landCycleMatch) {
			searchQuery += "is:" + landCycleMatch[1];
		}
		let embedInfo = buildSearchEmbed(searchQuery, this, -1)
		let messyCallback = function (mess) {
			if(embedInfo[1] != 0) {
				mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
					.then(() => mess.react(mag))
					.then(() => mess.react(xEmote))
					.then(() => mess.react(plainText))
			}
		}
		msg.channel.send(embedInfo[0])
			.then(mess => messyCallback(mess))
			.catch(console.log("An emote didn't spawn"))
	}
	//Suggestions
	if(msg.content.match(/\$suggest ?\n?/i)){
		let anonPost = msg.content.replace(/@/g, "@.");
		Client.channels.cache.get(config.mailChannel).send(anonPost);
		stats.upBribes(1);
	}
	/* wildcard voting, currently closed
	if(msg.content.match(/\$vote/)) {
		let voter = Client.guilds.cache.get("317373924096868353").roles.cache.get("747659270765543555").members.find(v => v.id == msg.author.id);
		if(voter) {
			wildcardVoter(msg.author.id, msg.content.replace(/\$vote ?/i, ""));
			msg.channel.send('Wildcard vote submitted.')
		}else{
			msg.channel.send('You do not have the VOTE! role, which is needed to vote in the wildcard.');
		}
	}
	if(perms.includes(5)) {
		let votepoke = msg.content.match(/!votepoke (\d+)/i);
		if(votepoke) {
			for(let u in scratchPad.wildcard) {
				if(scratchPad.wildcard[u] == votepoke[1]) {
					let content = msg.content.replace(votepoke[0], "");
					eris.pullPing(u).send(content);
					msg.channel.send("Voter poked");
					return;
				}
			}
			msg.channel.send("Voter not found.");
		}

	}*/
	if(msg.content.match(/\$plain/i)){
		let attachURL = msg.attachments.array()[0].url;
		let filename = msg.attachments.array()[0].name;
		msg.channel.send("LackeyBot is downloading your file, please wait a few moments.");
		download(attachURL, {filename:"extract.txt"}, function(err) {
			fs.readFile('./extract.txt', "utf8", function read(err, data) {
				if (err)
					throw err;
				let deckFile = extractPlain(data)
				fs.writeFile(filename, deckFile, (err) => {
					if (err) throw err;
					eris.pullPing(msg.author.id).send("Here is your extracted plain text.", {
						files:[{attachment:filename}]
					});
				});
				fixingList = null
				
			});
		}, 3000);
	}

}
function devDexMH(msg, perms) {								//message handler for MSEM
	
}
function myriadMH(msg, perms) {								//message handler for MSEM
	if(msg.content.match(/\$point/)){ //myriad points
		let output = "";
		for(let point in this.legal){
			output += "**" + point + ":** "
			for(let card in this.legal[point]) {
				output += this.legal[point][card] + ", ";
			}
			output = output.replace(/, $/, "\n");
		}
		msg.channel.send(output)
	}
}
function revMH(msg, perms) {								//message handler for MSEM
	let crRegex = msg.content.match(/\$cr ([^!\n]+)/);
	if(crRegex) {
		stats.upBribes(1);
		let embedData = buildCREmbed(crRegex[1], this);
		msg.channel.send(embedData[0], embedData[1])
			.then(mess => mess.react(leftArrow)
				.then(() => mess.react(rightArrow)
					.then(() => mess.react(plainText)
						.then(() => mess.react(xEmote)))))
			.catch(e => console.log(e))
	}
	if(msg.content.match(/\$(cocka)?trice/)) {
		stats.upBribes(1);
		output = "Cockatrice Installation:\n";
		output += "Revolution has a standalone Cockatrice Client that can be downloaded here: <https://www.dropbox.com/s/k43zn6lu20dflpy/Revolution%20Client.zip?dl=0>\n";
		output += "• After patches, open Cockatrice and run Oracle. This is usually labled \"Check for card updates\" under the Cockatrice or Help menu, depending on your version.\n";
		output += "• Once Oracle has run, open your Card Sources settings and click the \"Delete all downloaded images\" button to allow card images to update.\n";
		output += "• For manual setup, the Oracle links are\n";
		output += "> https://revolution-manifesto.herokuapp.com/setsdownload\n> https://revolution-manifesto.herokuapp.com/tokensdownload\n";
		output += "• And the Card Sources link is\n";
		output += "> https://revolution-manifesto.herokuapp.com/cards/!setcode!/!set:num!.jpg";
		msg.channel.send(output);
	}
}
function messageHandler(msg, perms) {
	let arcanaData = configureArcana(msg);
	if(perms.includes(0)) {
	let jsoncheck = msg.content.match(/!json ([A-Z0-9_]+)/i);
	if(jsoncheck && this.hasOwnProperty(jsoncheck[1])) {
		for(let thisSet in this[jsoncheck[1]].setData) //instigator file for each set
			mod_magic.wtfjsonBuilder(thisSet, msg.author, this[jsoncheck[1]]);
		mod_magic.mtgjsonSetsBuilder(msg.author, this[jsoncheck[1]])	//mtgv5 file for format
	}
		if(msg.content.match("!namebuild custom")) //builds a namelist for MSEM
			namelistBuilder(msemDatabase.cards, msg.author);
		if(msg.content.match("!namebuild canon")) //builds a namelist for MSE
			namelistBuilder(magicDatabase.cards, msg.author);

	}
	//General Commands
	//These are commands that work with any/most sets in Arcana
	let statFirst = msg.content.match(/(\$|!|\?)stats? [^\n]+/i);
	let scodeMatch = msg.content.match(/\B(\$|\?|!)(set|code)/i);
	let searchCheck = msg.content.match(/(\$|!|\?)(s?earch|li?mitfy|scryf?a?l?l?) ([^\n]+)/i);
	var fuzzyMatch = msg.content.match(/([^\$\n]*) (\$|!|\?)fuzzytest ([^\$\n]*)/i);
	if(statFirst) { 
		let setstrings = "", ministrings = "";
		let statBase = arcanaData.square.data;
		if(statFirst[1] == "!")
			statBase = arcanaData.angle.data;
		if(statFirst[1] == "?")
			statBase = arcanaData.curly.data;
		for(let thisSet in statBase.setData) {
			if(thisSet.length == 1) {
				ministrings += thisSet + "|";
			}else{
				setstrings += thisSet + "|";
			}
		}
		setstrings += ministrings;
		
		if(statBase.name == "msem") {
			setstrings += "MSEM";
		}else{
			setstrings = setstrings.replace(/\|$/, "");
		}
		let setRegex = new RegExp('s?tats? (' + setstrings + ')','i')
		statcheck = statFirst[0].toUpperCase().match(setRegex);
		if(statcheck) { //if set's in the base, send it
			stats.upBribes(1);
			msg.channel.send(generateStats(statBase, statcheck[1]));
		}else{ //else null statFirst for $stats
			statFirst = null;
		}
	}else if(msg.content.match(/\$s?tat/i)) { //lackey stats
		stats.upBribes(1);
		let statput = "LackeyBot has fetched $COUNT cards, accepted $BRIBE bribes, started $DRAFT drafts, cracked $PACK packs, set $REMIND reminders, completed $DONE reminders, and only exploded $EXPLODE times. LackeyBot has become a god among goblinkind.";
		let statSheet = stats.stats();
		statput = statput.replace("$COUNT",statSheet.cardCount);
		statput = statput.replace("$BRIBE",statSheet.bribes);
		statput = statput.replace("$EXPLODE",statSheet.explosions);
		statput = statput.replace("$DRAFT",statSheet.drafts);
		statput = statput.replace("$PACK",statSheet.packs);
		statput = statput.replace("$REMIND",statSheet.reminderSet);
		statput = statput.replace("$DONE",statSheet.reminderDone);
		msg.channel.send(statput);
	}
	if(scodeMatch){
		stats.upBribes(1);
		let library;
		if(scodeMatch[1] == "$")
			library = arcanaData.square.data;
		if(scodeMatch[1] == "!")
			library = arcanaData.angle.data;
		if(scodeMatch[1] == "?")
			library = arcanaData.curly.data;
		let embedded = buildSetsEmbed(library, 0)
		let messyCallback = function (mess) {
			mess.react(plainText)
				.then(function() {
					if(embedded[1] > 1) {
						mess.react(leftArrow)
							.then(() => mess.react(rightArrow))
							.catch(e => console.log(e))
					}
				})
				.catch(e => console.log(e))
		};
		msg.channel.send(embedded[0])
			.then(mess => messyCallback(mess))
			.catch(e => console.log(e))
	}
	if(searchCheck) {
		stats.upBribes(1);
		let library = arcanaData.square.data;
		if(searchCheck[1] == "?")
			library = arcanaData.curly.data;
		if(searchCheck[1] == "!")
			library = arcanaData.angle.data;
		if(searchCheck[2].match(/scryf?a?l?l?/))
			library = magicDatabase;
		//bank the cards
		let embedInfo = buildSearchEmbed(searchCheck[3], library, -1)
		let messyCallback = function (mess) {
			if(embedInfo[1] != 0) {
				mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
					.then(() => mess.react(mag))
					.then(() => mess.react(xEmote))
					.then(() => mess.react(plainText))
			}
		}
		msg.channel.send(embedInfo[0])
			.then(mess => messyCallback(mess))
			.catch(console.log("An emote didn't spawn"))
	}
	if(fuzzyMatch) {
		stats.upBribes(1)
		if(fuzzyMatch[2] == "$")
			msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.square.data));
		if(fuzzyMatch[2] == "!")
			msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.angle.data));
		if(fuzzyMatch[2] == "?")
			msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.curly.data));
	}	
	for(let shape in arcanaData) {
		if(arcanaData[shape].data && arcanaData[shape].data.messageHandler) {
			arcanaData[shape].data.messageHandler(msg, perms);
		}
	}
	
}
function helpMessage() {
	let helpout = "**Cards Help**\n";
	helpout += "LackeyBot supports up to three cards databases on each server.\n";
	//todo script this
	helpout += "Normally, canon Magic cards are called in <<Angle Brackets>> with !commands.\n";
	helpout += "MSEM cards are called in [[Square Brackets]] with $commands.\n";
	helpout += "Uploadable databse cards are called in {{Curly Brackets}} with ?commands.\n";
	helpout += "The square brackets can be changed with $database commands, such as `$myriad` or `$ps`.\n";
	helpout += "The following work for each database, using their prefixes in place of !\n";
	helpout += "`!search Scryfall query` for a Scryfall search link and embed preview.\n";
	helpout += "`!random` or `!random Scryfall query` for a random card that can match a Scryfall query.\n";
	helpout += "`!sets` for a list of set codes.\n";
	helpout += "`!stats SET` for some stats from that set.\n";
	helpout += "The following work for only the Magic database, using the prefixes shown.\n";
	helpout += "`!cr XX.XXXa` for CR citations.\n";
	helpout += "`$standard` for sets legal in standard.\n";
	helpout += "`$price CardName` for Scryfall prices for a card.\n";
	helpout += "`$ban format` for the banlist for that format.\n";
	return helpout;
}

//Embeds
function buildSetsEmbed (library, page, textFlag) {			//build $codes embed
	let helpout = "";
	let desc = library.bigname + " Set Codes";
	let setsDatabase = library.setData;
	let setCount = 0;
	for(let thisSet in setsDatabase) {
		helpout += "**" + thisSet + "**: " + setsDatabase[thisSet].longname + "\n";
		setCount++;
	}
	let lines = helpout.split('\n');
	if(textFlag) {
		let start = 0 + 20*page;
		let end = Math.min(lines.length, start+20);
		let pages = Math.ceil(lines.length / 20)
		let output = desc + ":";
		for(let i=start;i<end;i++) {
			output += "\n" + lines[i];
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setDescription('**' + desc + '**')
			.setFooter('Page ' + parseInt(page+1) + '/' + pages)
			return [[output, nullEmbed]];
	}
	let inlines = [[],[],[]]
	let thirds = Math.ceil(Math.min(60,lines.length) / 3);
	let start = 0 + 60*page;
	let end = start + thirds;
	let pages = Math.ceil(lines.length / 60)
	for(let i=start; i<end; i++) {
		let first = i;
		let second = i+thirds;
		let third = i+thirds+thirds;
		if(third >= lines.length)
			third = null;
		if(lines[first])
			inlines[0].push(lines[first])
		if(lines[second])
			inlines[1].push(lines[second])
		if(lines[third])
			inlines[2].push(lines[third])
	}
	end = Math.min(setCount, end);
	let embedded = new Discord.MessageEmbed()
		.setDescription('**' + desc + '**')
		.setFooter('Page ' + parseInt(page+1) + '/' + pages)
	if(inlines[0].length > 0 && inlines[0][0] != "")
		embedded.addField('Codes ' + parseInt(1+start) + '-' + end + ":", inlines[0], true)
	if(inlines[1].length > 0 && inlines[1][0] != "")
		embedded.addField('Codes ' + parseInt(start+thirds+1) + "-" + parseInt(start+2*thirds) + ":", inlines[1], true)
	if(inlines[2].length > 0 && inlines[2][0] != "")
		embedded.addField('Codes ' + parseInt(start+2*thirds+1) + "-" + parseInt(Math.min(start+3*thirds, lines.length)) + ":", inlines[2], true)
	let reportPages = Math.ceil(lines.length / 20); //set the arrows in case of plaintexting
	return [embedded, reportPages];
}
function generateStats(library, thisSet) { 					//generates $stats messages
	let setInfo;
	if(thisSet == "MSEM" && library.name == "msem") {
		setInfo = {longname: "MSE Modern", masterpiece: false, msem: true};
	}else{
		setInfo = library.setData[thisSet];
	}
	let statput = `${setInfo.longname} has $SETCARDS cards `
	let mastermatch = thisSet.match(/MPS_/);
	if(mastermatch == null) {
		statput += "($SETRARITY), "
	}else{
		statput += "and "
	}
	statput += "$SETTOKENS tokens, and $SETPROMOS."
	statput += `\nThe set's most common mana cost is $SETCOMMON.\n${setInfo.longname}'s converted mana cost is $SETMANA.\nIf ${setInfo.longname} was animated, it would be a $SETPT $SETTYPE.`
	if(setInfo.hasOwnProperty('Design') && setInfo.Design) {
		statput += `\nSet Design: ${setInfo.Design}`;
	}
	if(setInfo.hasOwnProperty('leadID') && setInfo.leadID) {
		statput += `\nSet Design: ${eris.pullUsername(setInfo.leadID)}`;
	}
	if(setInfo.hasOwnProperty('psSet') && setInfo.psSet) {
		statput += `\nPlanesculptors Page: http://www.planesculptors.net/set/${setInfo.psSet}`;
	}
	if(extras.hasOwnProperty(thisSet))
		statput = extras[thisSet]
	if(setInfo.hasOwnProperty("Link") && setInfo.Link)
		statput += `\nSet Download: <${setInfo.Link}>`;

	let setCardCount = 0;
	let setRareDist = {common:0, uncommon:0, rare:0, "mythic rare":0, bonus:0, "basic land":0, special:0, masterpiece:0, token:0};
	let setManaCost = {};
	let setCMC = 0;
	let setPower = 0;
	let setToughness = 0;
	let setType = {};
	let thisType = "";
	for(var thisCard in library.cards) {
		if(setInfo.hasOwnProperty('msem') || library.cards[thisCard].setID == thisSet || library.cards[thisCard].setID == setInfo.masterpiece || (library.cards[thisCard].setID == "tokens" && library.cards[thisCard].cardID.match(thisSet))) {
			setRareDist[library.cards[thisCard].rarity]++;
			if(library.cards[thisCard].rarity.match(/(common|uncommon|rare|mythic rare|basic land|bonus)/) || mastermatch) {
				setCardCount++;
				let testPow = parseInt(library.cards[thisCard].power);
				if(!isNaN(testPow))
					setPower += testPow;
				if(library.cards[thisCard].hasOwnProperty('power2')){
					testPow = parseInt(library.cards[thisCard].power2);
					if(!isNaN(testPow))
						setPower += testPow;
				}
				testPow = parseInt(library.cards[thisCard].toughness);
				if(!isNaN(testPow))
					setToughness += testPow;
				if(library.cards[thisCard].hasOwnProperty('toughness2')){
					testPow = parseInt(library.cards[thisCard].toughness2);
					if(!isNaN(testPow))
						setToughness += testPow;
				}

				if(library.cards[thisCard].cmc != "")
					setCMC += parseInt(library.cards[thisCard].cmc);
				if(library.cards[thisCard].hasOwnProperty('cmc2') && library.cards[thisCard].cmc2 != "")
					setCMC += parseInt(library.cards[thisCard].cmc2);
				if(library.cards[thisCard].cardType.match(/Creature/)) {
					let thisType = library.cards[thisCard].typeLine.split(" — ")[1];
					if(!setType.hasOwnProperty(thisType)) {
						setType[thisType] = {};
						setType[thisType].count = 0;
					}
					setType[thisType].count++;
				}
				if(library.cards[thisCard].hasOwnProperty('cardType2') && library.cards[thisCard].cardType.match(/Creature/)) {
					let thisType = library.cards[thisCard].typeLine2.split(" — ")[1];
					if(!setType.hasOwnProperty(thisType)) {
						setType[thisType] = {};
						setType[thisType].count = 0;
					}
					setType[thisType].count++;
				}
				if(library.cards[thisCard].manaCost != "") {
					let thisCost = library.cards[thisCard].manaCost;
					if(!setManaCost.hasOwnProperty(thisCost)) {
						setManaCost[thisCost] = {};
						setManaCost[thisCost].count = 0;
					}
					setManaCost[thisCost].count++;
				}
			}
		}
	}
	let bestType = ["",0];
	let bestCost = ["",0];
	for(let type in setType) {
		if(setType[type].count > bestType[1])
			bestType = [type,setType[type].count];
	}
	for(let cost in setManaCost) {
		if(setManaCost[cost].count > bestCost[1])
			bestCost = [cost,setManaCost[cost].count];
	}
	let RarityDist = "";
	if(setRareDist.common > 0)
		RarityDist += setRareDist.common + "C, ";
	if(setRareDist.uncommon > 0)
		RarityDist += setRareDist.uncommon + "U, ";
	if(setRareDist.rare > 0)
		RarityDist += setRareDist.rare + "R";
	if(setRareDist["mythic rare"] > 0)
		RarityDist += ", " + setRareDist["mythic rare"] + "M";
	if(setRareDist["basic land"] > 0)
		RarityDist += ", " + setRareDist["basic land"] + "L";
	if(setRareDist.bonus > 0)
		RarityDist += ", " + setRareDist.bonus + "B";
	let setPromos = setRareDist.special +" promos";
	if(setRareDist.special == 1)
		setPromos = "1 promo";
	if(setRareDist.special == 0)
		setPromos = "no promos";
	let setPT = setPower + "/" + setToughness;
	statput = statput.replace("$SETCARDS",setCardCount);
	statput = statput.replace("$SETRARITY", RarityDist);
	statput = statput.replace("$SETTOKENS", setRareDist.token);
	statput = statput.replace("$SETPROMOS", setPromos);
	statput = statput.replace("$SETCOMMON", bestCost[0]);
	statput = statput.replace("$SETMANA", setCMC);
	statput = statput.replace("$SETPT", setPT);
	statput = statput.replace("$SETTYPE", bestType[0].replace(/ $/,""));
	statput = statput.replace("$SETMASTER", setRareDist.masterpiece);
	statput = statput.replace(", and no promos", "");
	statput = statput.replace(" and 0 tokens", "");
	statput = statput.replace(", 0 tokens", "");
	
	return statput;
}
function buildSearchLink(library, searchString) { 			//generates search link from proper site
	let output = "";
	if(library.searchData.site) {
		output += "<" + library.searchData.site;
		//generate the link
		output += encodeURIComponent(searchString);
		output += library.searchData.end + ">";
		output = output.replace(/ /g, "+");
		output = output.replace(/["“”]/g, "%22");
	}
	return output;
}
function buildSearchEmbed(searchString, library, page, imgFlag, textFlag) {//builds $search embeds
	searchString = fuzzy.formatScryfallKeys(searchString);
	let searchLink = buildSearchLink(library, searchString);
	let site = library.searchData.title + " search";
	let database = library.cards;
	let valids = fuzzy.scryDatabase(library, searchString);
	if(valids[1] && library.searchData.title == "Scryfall")
		searchLink = searchLink.replace(">","&unique=prints>");
	let bumpedPage = parseInt(page+1);
	let hits = valids[0].length;
	let count = '1 hit found:';
	if(hits == 0) {
		let nohits = ['LackeyBot detected 0 hits.','This may be because you used a key LackeyBot doesn\'t support or a difference in databases. If this is an error, please tell Cajun.'];
		if(valids[2] == true)
			nohits = ['LackeyBot timed out.','Your search terms were too much for the little guy. Please use the Scryfall link instead.'];
		var embedded = new Discord.MessageEmbed()
			.setDescription("["+site+"]("+searchLink+" '"+searchString+"')")
			.addField(nohits[0], nohits[1])
		return [embedded, hits];
	}
	if(hits > 1)
		count = hits + ' hits found, showing the '+toolbox.ordinalize(bumpedPage)+':'
	if(page == -1) {
		count = count.replace(/found[^\n]+/i, "found. Check the link, or react to preview.")
	}
	if(valids[2] == true)
		count = 'LackeyBot timed out, only partial results will be shown: ' + count;
	if(textFlag) {
		let embedText = "";
		if(valids[2] == true)
			embedText += 'LackeyBot timed out, only partial results will be shown: ';
		embedText += hits + " hits found: " + searchLink;
		if(page != -1)
			embedText += "\n" + library.writeCard(valids[0][page], true);
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('Page ' + bumpedPage + '/' + hits + ". 🔍 for image, ❌ to collapse, 💬 for plaintext.")
			.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')")
		return [[embedText, nullEmbed]]
	}
	//build the embed
	var embedded = new Discord.MessageEmbed()
		.setFooter('Page ' + bumpedPage + '/' + hits + ". 🔍 for image, ❌ to collapse, 💬 for plaintext.")
	if(page != -1) {
		if(imgFlag) {
			embedded.addField(count, database[valids[0][page]].fullName)
			embedded.setImage(printImages([valids[0][page]], library, true))
		}else{
			embedded.addField(count, library.writeCard(valids[0][page], true))
			embedded.setThumbnail(printImages([valids[0][page]], library, true))
		}
		embedded.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')")
	}else{
		embedded.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')\n"+count)
	}
	return [embedded, hits];
}
function printImages(card_array, library, first) { 			//generates link from proper site
	if(card_array == [])
		return;
	let printString = "";
	for(let thisCard in card_array) {
		printString += library.printImage(card_array[thisCard], first) + "\n";
	}
	return printString.replace(/\n$/,"");
}

//Misc
function namelistBuilder(database, user) {					//creates a list of names for the Name Exporter
	let namelistArray = [];
	let nameString = "";
	for(let thisCard in database) {
		if(namelistArray.includes(database[thisCard].cardName) || database[thisCard].rarity == "basic land" || database[thisCard].setID == "CMB1" || database[thisCard].setID == "tokens" || database[thisCard].shape == "command"){
			//console.log(database[thisCard].cardName.replace(/\*/g,""))
		}else{
			namelistArray.push(database[thisCard].cardName);
			if(database[thisCard].cardName2 !== undefined)
				namelistArray.push(database[thisCard].cardName2);
		}
	}
	for(var i=0; i<namelistArray.length; i++) {
		nameString += namelistArray[i];
		if(i !== namelistArray.length-1)
			nameString += "|";
	}
	let nearnameString = nameString.replace(/(and|or|in|into|to|upon|the|of|from|at|through|with) /ig, "");
	nameString = "	#The name list\n	name_list := { \"(" + nameString + ")\"}\n\n";
	nameString += "	near_name_list := { \"(" + nearnameString + ")\"}\n";
	fs.writeFile('namelist.txt', nameString, (err) => {
		if (err) throw err;
		});
	user.send({
		files: [{attachment:"./namelist.txt", name:"namelist.txt"}]
		});
}
function wildcardVoter(user, content) {						//post and anonymize wildcard voters
	let wildcardChannel = Client.channels.cache.get('777455867725479966')
	if(!scratchPad.wildcard[user]) {
		wildcardChannel.send(content)
			.then(function(mess) {
				scratchPad.wildcard[userID] = messID;
				version.logScratchpad();
			})
			.catch(e => console.log(e))
	}else{
		let theirPost = wildcardChannel.messages.fetch(scratchPad.wildcard[user])
			.then(mess => mess.edit(content))
			.catch(e => console.log(e))
	}
}
function deckCheckCheck(msg) {
	let formats = '(Team Unified Constructed|Constructed|EDH|Primordial|MSEM|Revolution|Pauper)'
	let rString = 'deckCheck: ?(' + libs.join("|") + ')[, :-—(]*' + formats;
	return msg.content.match(new RegExp(rString, 'i'));
}

let libs = ["magic", "msem", "devDex", "myriad", "cajun_standard", "revolution"];
let magicDatabase = {
	cards:magicCards,
	setData:magicSets,
	legal:magicBanned,
	cr: magicCR,
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
	formatBribes: bribeLackeyCanon,
	messageHandler: magicMH
};
let msemDatabase = {
	cards:msemCards,
	setData:msemSets,
	legal:msemBanned,
	cr: msemCR,
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
	formatBribes: bribeLackeyBot,
	messageHandler: msemMH
};
let devDexDatabase = {
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
	formatBribes: bribeLackeyDev,
	messageHandler: devDexMH
};
let myriadDatabase = {
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
	formatBribes: bribeLackeyMyriad,
	messageHandler: myriadMH
};
let cajun_standardDatabase = {
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
	formatBribes: bribeLackeyCS,
	messageHandler: blankMH
}
let revolutionDatabase = {
	cards:revCards,
	setData:revSets,
	legal:revBanned,
	cr: revCR,
	name:"revolution",
	bigname:"Revolution",
	nicks:nicks.revolution,
	oracle:revRules,
	writeCard:writeCard,
	printImage:revolutionLinker,
	encodeColor: "05aaaa",
	functions: ['img'],
	swaps: ["rev"],
	searchData: {title: "Revolution Manifesto", site:"https://revolution-manifesto.herokuapp.com/card?q=", end:""},
	formatBribes: bribeLackeyRev,
	messageHandler: revMH
};
let links = {
	"magic": magicDatabase,
	"msem": msemDatabase,
	"devDex": devDexDatabase,
	"myriad": myriadDatabase,
	"cajun_standard": cajun_standardDatabase,
	"revolution": revolutionDatabase,
}
exports.libraries = libs;
exports.magic = magicDatabase;
exports.msem = msemDatabase;
exports.devDex = devDexDatabase;
exports.myriad = myriadDatabase;
exports.cajun_standard = cajun_standardDatabase;
exports.revolution = revolutionDatabase;

exports.printImages = printImages;
exports.generatePrints = generatePrints;
exports.buildReference = buildReference;
exports.decodeColor = decodeColor;
exports.decodeTitle = decodeTitle;
exports.refSheet = refSheet;
exports.helpMessage = helpMessage;
exports.configureArcana = configureArcana;
exports.anyRandom = anyRandom;
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.buildSetsEmbed = buildSetsEmbed;
exports.buildSearchEmbed = buildSearchEmbed;
exports.buildCREmbed = buildCREmbed;
exports.deckCheckCheck = deckCheckCheck;

exports.libFromBig = libFromBig