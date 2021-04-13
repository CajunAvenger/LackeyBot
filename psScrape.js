/* psScrape
 Handles the PS searches
*/
const htmlEle = require('he');
const fs = require('fs');
const rp = require("request-promise-native");
var psCache = {};
function discordMarkup(someText) {
	someText = someText.replace(/<\/?b>/g, "**");
	someText = someText.replace(/<\/?i>/g, "*");
	someText = someText.replace(/<\/?u>/g, "__");
	someText = someText.replace(/<\/?br>/g, "");
	someText = someText.replace(/\[/g, "{");
	someText = someText.replace(/\]/g, "}");
	return someText;
}
function indicatorBuilder(colors) {
	let easel = null;
	switch(colors) { //switch for the non WUBRG colors
		case "":
			return ""
		case "WR":
			return "{Red/White} ";
		case "WG":
			return "{Green/White} ";
		case "UG":
			return "{Green/Blue} ";
		case "WRG":
			return "{Red/Green/White} ";
		case "WUG":
			return "{Green/White/Blue} ";
		case "WUR":
			return "{Blue/Red/White} ";
		case "UBG":
			return "{Black/Green/Blue} ";
		case "WBR":
			return "{Red/White/Black} ";
		case "URG":
			return "{Green/Blue/Red} ";
		case "WBRG":
			return "{Black/Red/Green/White} ";
		case "WURG":
			return "{Red/Green/White/Blue} ";
		case "WUBG":
			return "{Green/White/Blue/Black} ";
	}
	if(easel !== null)
		return easel;
	easel = "{" + colors;
	easel = easel.replace("W", "White/");
	easel = easel.replace("B", "Black/");
	easel = easel.replace("U", "Blue/");
	easel = easel.replace("R", "Red/");
	easel = easel.replace("G", "Green/");
	easel = easel.replace(/\/$/, "} ");
	return easel;
}
function trimTypes(typeLine) {
	typeLine = typeLine.replace(/(Basic |Legendary |Snow |World )/g, "")
	typeLine = typeLine.replace(/ —[^\n]+/, "")
	return typeLine;
}
function convertRarity(rarity) {
	switch(rarity) {
		case "C":
			return "common";
		case "U":
			return "uncommon";
		case "R":
			return "rare";
		case "M":
			return "mythic rare";
		case "S":
			return "special";
		case "common":
			return "C";
		case "uncommon":
			return "U";
		case "rare":
			return "R";
		case "mythic rare":
			return "M";
		case "special":
			return "S";
	}
}
function convertShape(shape, pokeFlip) {
	if(pokeFlip)
		return "normal";
	switch(shape) {
		case "double":
			return "doubleface";
		case "flip":
			return "flip";
		case "split":
			return "split";
		case "vsplit":
			return "adventure";
		default:
			return "normal";
	}
}
async function pullPS(testurl) { //get scryfall data for a search
	let requestPromise;
	requestPromise = new Promise((resolve, reject) => {
		rp({url: testurl, json: true}).then(body => {
			resolve(body);
		}, () => {
			console.log('Could not reach PS server.');
		});
	});
	theData = await requestPromise;
	return theData;
}

/*
function htmlToLB (data) {	//convert PS HTML file into LackeyBot readable file
	data = data.replace(/^\r?\n1.0\r?\n\r?\n/, "")
	let blocks = data.split(/===========/);
	let cards = {};
	for(let card in blocks) {
		let lines = blocks[card].split(/\n/);
		let shape = lines[0];
		let cardID = lines[1];
		let cmc = lines[2];
		let rarity = lines[3];
		let name1 = lines[4];
		let longColor1 = lines[5];
		let htmlManaCost1 = lines[6];
		let type1 = lines[7];
		let power1 = lines[8];
		let toughness1 = lines[9];
		let htmlRules1 = lines[10];
		let htmlFlavor1 = lines[11];
		let htmlArtist1 = lines[12];
		let name2 = lines[13];
		let longColor2 = lines[14];
		let htmlManaCost2 = lines[15];
		let type2 = lines[16];
		let power2 = lines[17];
		let toughness2 = lines[18];
		let htmlRules2 = lines[19];
		let htmlFlavor2 = lines[20];
		let htmlArtist2 = lines[21];
		
		let card = {};
		card.fullName = name1;
		if(name2)
			card.fullName += " // " + name2;
		card.cardName = name1;
		let cleanMC1 = htmlManaCost1.replace(/<img src='magic-mana-small-/g, "{")
		cleanMC1 = cleanMC1.replace(/\.png' alt='[^']*'>?/g, "}")
		cleanMC1 = cleanMC1.replace(/{([2WUBRGPH])([WUBRGPH])}/g, "$1/$2");
		card.manaCost = cleanMC1;
		card.typeLine = type1;
		card.rarityLine = "*TEST " + convertRarity(rarity) + "*";
	}
}
*/
async function translatePS(testurl) {
	let nameArray = [];
	let foundCards = await pullPS(testurl);
	if(typeof foundCards == 'string') //error message, return blank
		return nameArray;
	for(let card in foundCards) {
		let pokeFlip = false;
		thisCard = foundCards[card];
		let database_name = thisCard.name;
		if(thisCard.name2)
			database_name += "//" + thisCard.name2;
		let full_name = "" + database_name;
		database_name += "_" + thisCard.setName;
		//first check if we've cached it already
		nameArray.push(database_name);
		if(psCache[database_name] && (psCache[database_name].setVersion == thisCard.setVersionName))
			continue; //if we have, can skip
		psCache[database_name] = {};
		psCache[database_name].fullName = full_name;
		psCache[database_name].cardName = thisCard.name;
		psCache[database_name].manaCost = "";
		if(thisCard.hasOwnProperty('manaCost'))
			psCache[database_name].manaCost = thisCard.manaCost.replace(/<img src='magic-mana-small-H.png' alt='H'>?/g, "[H]").replace(/\[/g, "{").replace(/]/g, "}");
		psCache[database_name].typeLine = htmlEle.decode(thisCard.types)
		psCache[database_name].rulesText = discordMarkup(htmlEle.decode(thisCard.rulesText.replace(/<img src='magic-mana-small-H.png' alt='H' width='16' height='16'>/g, "[H]"))) + "\n";
		psCache[database_name].flavorText = discordMarkup(htmlEle.decode(thisCard.flavorText))
		if(psCache[database_name].flavorText)
			psCache[database_name].flavorText = psCache[database_name].flavorText + "\n"
		psCache[database_name].power = thisCard.power;
		if(psCache[database_name].power === null)
			psCache[database_name].power = "";
		psCache[database_name].toughness = thisCard.toughness;
		if(psCache[database_name].toughness === null)
			psCache[database_name].toughness = "";
		psCache[database_name].loyalty = "";
		if(thisCard.hasOwnProperty('loyalty'))
			psCache[database_name].loyalty = thisCard.loyalty;
		psCache[database_name].color = indicatorBuilder(thisCard.colors);
		psCache[database_name].cmc = thisCard.cmc;
		psCache[database_name].cardType = trimTypes(psCache[database_name].typeLine);
		psCache[database_name].rarityLine = "*" + thisCard.setName + " " + thisCard.rarity + "*";

		if(thisCard.name2) {
			if(thisCard.rulesText2 || thisCard.types2) { //if actual double card
				psCache[database_name].cardName2 = thisCard.name2;
				psCache[database_name].manaCost2 = thisCard.manaCost2.replace(/\[/g, "{").replace(/]/g, "}");
				psCache[database_name].typeLine2 = htmlEle.decode(thisCard.types2)
				psCache[database_name].rulesText2 = discordMarkup(htmlEle.decode(thisCard.rulesText2)) + "\n";
				psCache[database_name].flavorText2 = discordMarkup(htmlEle.decode(thisCard.flavorText2))
				if(psCache[database_name].flavorText2)
					psCache[database_name].flavorText2 = psCache[database_name].flavorText2 + "\n"
				psCache[database_name].power2 = thisCard.power2;
				if(psCache[database_name].power2 === null)
					psCache[database_name].power2 = "";
				psCache[database_name].toughness2 = thisCard.toughness2;
				if(psCache[database_name].toughness2 === null)
					psCache[database_name].toughness2 = "";
				psCache[database_name].loyalty2 = "";
				if(thisCard.hasOwnProperty('loyalty2'))
					psCache[database_name].loyalty2 = thisCard.loyalty2;
				psCache[database_name].color2 = indicatorBuilder(thisCard.colors2);
				psCache[database_name].cmc2 = "";
				if(thisCard.hasOwnProperty('cmc2') && thisCard.cmc2 !== null)
					psCache[database_name].cmc2 = thisCard.cmc2
				psCache[database_name].cardType2 = trimTypes(psCache[database_name].typeLine2);
				psCache[database_name].rarityLine2 = "*" + thisCard.setName + " " + thisCard.rarity + "*";
			}else{
				pokeFlip = true;
			}
		}

		psCache[database_name].rarity = convertRarity(thisCard.rarity);		
		psCache[database_name].shape = convertShape(thisCard.shape, pokeFlip);
		psCache[database_name].setVersion = thisCard.setVersionName;
		psCache[database_name].artist = thisCard.illustrator;
		psCache[database_name].cardID = thisCard.cardNumber;
		psCache[database_name].setID = thisCard.setName;
		psCache[database_name].url = thisCard.artUrl;
		psCache[database_name].notes = [];
	}
	return nameArray;
}
async function test() {
	let yeet = await translatePS("http://www.planesculptors.net/autocard?context=&card=Budding Comp&json");
	translatePS("http://www.planesculptors.net/autocard?context=&card=Budding Comp&json");
}
 
 exports.psCache = psCache;
 exports.translatePS = translatePS