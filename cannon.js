/* Cannon
 Builds the canon database using mtgjson files
*/

var fs = require('fs');
var toolbox = require('./toolbox.js');
var dateToNumber = toolbox.dateToNumber;
var packgen = require('./packgen.js').assignCanonPack;
var normalFiles = [];
var promoFiles = [];
var normalArray = [];
var junkFiles = ["CST","OC13","OC14","OC15","OC16","OC17","OC18","OC19","OCM1","OCMD","P10E","PAER","PAKH","PAVR","PBBD","PBFZ","PBNG","PCMD","PDGM","PDKA","PDOM","PDTK","PELD","PEMN","PFRF","PGRN","PGTC","PHEL","PHOU","PISD","PJOU","PKLD","PKTK","PM10","PM11","PM12","PM13","PM14","PM15","PM19","PM20","PMBS","PMH1","PNPH","POGW","PORI","PPC1","PPOD","PPP1","PRIX","PRNA","PROE","PRTR","PRW2","PRWK","PSS1","PSS2","PSS3","PTHS","PTKDF","PUST","PWAR","PWWK","PXLN","PXTC","PZEN"];
var newcards = {};
var canonDatabase = {};
var setData = {};
var pullSets = [];
var legalObject = {};
var rulObject = {};
var expacArray = [];
var blockArrays = {};
var sortedSetData = {};
var notes = require('./canon/notes.json');
var standardStart = (1998 + toolbox.arrayTheDate()[0]) * 10000; //minimum standard year
var targets = [];

legalObject['commander'] = [];
legalObject['legacy'] = [];
legalObject['modern'] = [];
legalObject['vintage'] = [];
legalObject['vintageRest'] = [];
legalObject['standard'] = [];
legalObject['brawl'] = [];
legalObject['pauper'] = [];
legalObject['pioneer'] = [];
legalObject['historic'] = [];
legalObject['conspiracy'] = [];
var forceArray = ["OHOP","OARC","OPCA","OPC2","OE01","PARC","PVAN","TSB","CMB1"];
var fixArray = ["HOP","ARC","PCA","PC2","E01","PRO_ARC","VAN","TSB","MB1"];
let aliases = {
	"Zilortha, Strength Incarnate": "Godzilla, King of the Monsters",
	"Huntmaster Liger": "King Caesar, Ancient Guardian",
	"Luminous Broodmoth": "Mothra, Supersonic Queen",
	"Pollywog Symbiote": "Babygodzilla, Ruin Reborn",
	"Void Beckoner": "Spacegodzilla, Void Invader",
	"Everquill Phoenix": "Destoroyah, Perfect Lifeform",
	"Yidaro, Wandering Monster": "Godzilla, Doom Inevitable",
	"Gemrazer": "Anguirus, Armored Killer",
	"Titanoth Rex": "Godzilla, Primeval Champion",
	"Brokkos, Apex of Forever": "Bio-Quartz Spacegodzilla",
	"Illuna, Apex of Wishes": "Ghidorah, King of the Cosmos",
	"Nethroi, Apex of Death": "Biollante, Plant Beast Form",
	"Snapdax, Apex of the Hunt": "King Caesar, Awoken Titan",
	"Sprite Dragon": "Dorat, the Perfect Pet",
	"Vadrok, Apex of Thunder": "Rodan, Titan of Winged Fury",
	"Gyruda, Doom of Depths": "Gigan, Cyberclaw Terror",
	"Mysterious Egg": "Mothra's Great Cocoon",
	"Dirge Bat": "Battra, Dark Destroyer",
	"Crystalline Giant": "Mechagodzilla, the Weapon"
}
function writeArray(thisFile) {
	let thisSet = require('./canon/setbank/' + thisFile);
	if(junkFiles.includes(thisSet.code)) {
		return;
	}
	if(thisSet.type == "promo" || thisSet.type == "vanguard") {
		promoFiles.push(thisFile);
		return;
	}
	normalFiles.push(thisFile);
}
function aposCorrect (thisName, action) {
	let tempName = thisName;
	if(action == "remove") {
		tempName = tempName.replace(/'/g, "ZZAPOS");
		tempName = tempName.replace(/,/g, "AACOM");
	}
	if(action == "revert") {
		tempName = tempName.replace(/ZZAPOS/g, "'");
		tempName = tempName.replace(/AACOM/g, ",");
	}
	return tempName;
}
function flavorFix (flavor, scryID) {
	flavor = flavor.replace(/ \*/g,"MOVELEFT");
	flavor = flavor.replace(/\* /g,"MOVERIGHT");
	flavor = flavor.replace(/MOVELEFT/g,"* ");
	flavor = flavor.replace(/MOVERIGHT/g," *");
	let breakMatch = flavor.match(/([^\n])( |["\/] ?)— ?([A-Z"])/)
	if(breakMatch) {
		flavor = flavor.replace(breakMatch[0], breakMatch[1] + breakMatch[2].replace(" ","") + "\n—" + breakMatch[3]);
		//targets.push(scryID)
	}
	return flavor;
}
function colorArranger (theseColors) {
	let newArray = [];
	let colorWords ="";
	if(theseColors.includes("W"))
		newArray.push("White");
	if(theseColors.includes("U"))
		newArray.push("Blue");
	if(theseColors.includes("B"))
		newArray.push("Black");
	if(theseColors.includes("R"))
		newArray.push("Red");
	if(theseColors.includes("G"))
		newArray.push("Green");
	if(newArray.length < 1)
		return "";
	colorWords = "{"
	for(var i=0; i<newArray.length; i++) {
		colorWords += newArray[i];
		if(i != newArray.length-1)
			colorWords += "/";
	}
	colorWords += "} ";
	return colorWords;
}
function trimZeroes (number) {
	let thisNumber = number;
	if(parseInt(thisNumber) == thisNumber)
		return parseInt(thisNumber);
	return thisNumber;
}
function applyIKOAlias(set) {
	for(let card in set.cards) {
		let thisCard = set.cards[card]
		if(parseInt(thisCard.number) > set.baseSetSize) { //overcount promos
			thisCard.rarity = "Special";
			if(parseInt(thisCard.number) == set.baseSetSize+1) //Buy A Box is Bonus instead
				thisCard.rarity = "Bonus";
			if(aliases.hasOwnProperty(thisCard.name) && (!thisCard.hasOwnProperty('frameEffects') || (thisCard.frameEffects.length == 1 && thisCard.frameEffects[0] == "legendary"))) {
				thisCard.alias = aliases[thisCard.name];
			}else if(aliases.hasOwnProperty(thisCard.name)){
				thisCard.name += " (showcase)";
			}
		}
	}
}
function doStuff () {
	fs.readdir("canon/setbank",function(err, array) {
		for(let j=0; j<array.length+1; j++) {
			if(j == array.length) {
				blockBuilder(normalFiles);
				//blockBuilder(junkFiles);
				blockBuilder(promoFiles);
				thenFix();
			}else{
				writeArray(array[j]);
			}
		}
	});
}

function blockBuilder(fileType) {
	for(let fileName in fileType) {
		console.log("Converting " + fileType[fileName]);
		let thisSet = require('./canon/setbank/' + fileType[fileName]);
		let set_code = thisSet.code;
		if(set_code == "IKO")
			applyIKOAlias(thisSet);
		if(forceArray.includes(set_code))
			set_code = fixArray[forceArray.indexOf(set_code)];
		let set_info = "";
		if(fileType == junkFiles) {
			//set_code == thisSet.parentCode;
			set_info = "_PRO";
		}else{
			setData[set_code] = {};
			setData[set_code].longname = thisSet.name;
			setData[set_code].masterpiece = false;
			if(set_code == "BFZ" || set_code == "OGW")
				setData[set_code].masterpiece = "EXP"
			if(set_code == "KLD" || set_code == "AER")
				setData[set_code].masterpiece = "MPS"
			if(set_code == "AKH" || set_code == "HOU")
				setData[set_code].masterpiece = "MP2"
			let releaseNo = dateToNumber(thisSet.releaseDate);
			setData[set_code].release = releaseNo;
			setData[set_code].standard = false;
			setData[set_code].size = thisSet.baseSetSize;
			setData[set_code].type = thisSet.type;			
			setData[set_code].packSlots = packgen(set_code, releaseNo, setData[set_code].masterpiece, setData[set_code].type);
		}
		for(var i = 0; i < thisSet.cards.length; i++) {
			let nextCard = "";
			let thisCard = "";
			let clearedFor = "yes";
			if(thisSet.cards[i].layout == "meld")
				clearedFor = null;
			if(thisSet.cards[i].hasOwnProperty('names') && thisSet.cards[i].names.includes("Who"))
				clearedFor = null;
			if(set_info == "_PRO" && !thisSet.cards[i].number.match(/★/))
				clearedFor = null;
			
			if(clearedFor !== null) {
				if(thisSet.cards[i].side !== undefined){
					nextCard = thisSet.cards[i];
					i += 1;
				}
				thisCard = thisSet.cards[i];
				let databaseName = thisCard.name;
				if(thisCard.names !== undefined && thisSet.cards[i].side !== undefined && nextCard == "") {
					databaseName += "//" + thisCard.names[1];
				}else{
					if(thisCard.names !== undefined && thisSet.cards[i].side !== undefined && nextCard != "")
						databaseName += "//" + nextCard.name;
				}
				if(thisCard.type.match("Vanguard"))
					databaseName += " Avatar";
				let cardFormats = [];
				for(var thisFormat in thisCard.legalities) {
					let thisLegal = thisCard.legalities[thisFormat];
					if(thisCard.type.match("Conspiracy"))
						thisFormat = "conspiracy";
					if(legalObject.hasOwnProperty(thisFormat) && thisLegal != "Legal"){
						if(thisFormat !== "vintage" && !legalObject[thisFormat].includes(databaseName)) {
							legalObject[thisFormat].push(databaseName);
						}
						if(thisFormat == "vintage") {
							if(thisLegal == "Banned") {
								if(!legalObject[thisFormat].includes(databaseName))
									legalObject[thisFormat].push(databaseName);
							}else{
								if(!legalObject['vintageRest'].includes(databaseName))
									legalObject['vintageRest'].push(databaseName);
							}
						}
					}
					if(legalObject.hasOwnProperty(thisFormat) && thisLegal == "Legal")
						cardFormats.push(thisFormat)
				}
				if(thisCard.rulings != "" && !rulObject.hasOwnProperty(databaseName)) {
					let theseMessages = "";
					for(var thisRuling in thisCard.rulings) {
						theseMessages += thisCard.rulings[thisRuling].text + "\n_ ";
					}
					theseMessages = theseMessages.replace(/\\n_ $/, "");
					rulObject[databaseName] = theseMessages;
				}
				let thisEntry = {};
				thisEntry.fullName = databaseName;
				thisEntry.cardName = thisCard.name;
				if(thisCard.type.match("Vanguard"))
					thisEntry.cardName += " Avatar";
				if(thisCard.manaCost === undefined) {
					thisEntry.manaCost = "";
				}else{
					thisEntry.manaCost = thisCard.manaCost;
				}
				thisEntry.typeLine = thisCard.type;
				let cardRarity = thisCard.rarity.replace("timeshifted ", "")[0].toUpperCase();
				if(thisCard.type.match(/Basic Land/i))
					cardRarity = "L";
				if(thisCard.layout == "token")
					cardRarity = "Token";
				if(set_code == (/(MPS|EXP|MPS_AKH)/))
					cardRarity = "Masterpiece";
				if(setData[set_code] !== undefined && setData[set_code].size !== 0 && setData[set_code].size < parseInt(thisCard.number))
					cardRarity = "Bonus"
				if(thisCard.rarity == "Special" || (thisCard.hasOwnProperty("frameEffects") && thisCard.frameEffects.includes("extendedart")))
					cardRarity = "Promo";
				if(thisCard.printings.includes("CMB1"))
					cardRarity = "Playtest";
				if(fileType == junkFiles){
					thisEntry.rarityLine = "*" + set_code.replace(/^P/, "") + " " + cardRarity + "*";
				}else{
					thisEntry.rarityLine = "*" + set_code + " " + cardRarity + "*";
				}
				if(thisCard.text === undefined) {
					thisEntry.rulesText = "";
				}else{
					let cardText = thisCard.text.replace(/\(/g,"*(");
					cardText = cardText.replace(/\)/g,")*");
					thisEntry.rulesText = cardText + "\n";
				}
				if(thisCard.flavorText === undefined) {
					thisEntry.flavorText = "";
				}else{
					thisEntry.flavorText = "*" + thisCard.flavorText + "*\n";
				}
				thisEntry.flavorText = flavorFix(thisEntry.flavorText, thisCard.scryfallId);
				if(thisCard.power === undefined) {
					thisEntry.power = "";
				}else{
					thisEntry.power = parseInt(thisCard.power);
					if(thisCard.power.match(/(\*|\+|∞|\?)/))
						thisEntry.power = thisCard.power.replace("*","★");
					if(thisCard.power == ".5")
						thisEntry.power = 0.5;
				}
				if(thisCard.toughness === undefined) {
					thisEntry.toughness = "";
				}else{
					thisEntry.toughness = parseInt(thisCard.toughness);
					if(thisCard.toughness.match(/(\*|\+|∞|\?)/))
						thisEntry.toughness = thisCard.toughness.replace("*","★");
					if(thisCard.toughness == ".5")
						thisEntry.toughness = 0.5;
				}
				if(thisCard.loyalty === undefined) {
					thisEntry.loyalty = "";
				}else{
					thisEntry.loyalty = parseInt(thisCard.loyalty);
					if(thisEntry.loyalty === null)
						thisEntry.loyalty = "X";
				}
				thisEntry.color = colorArranger(thisCard.colors);
				thisEntry.cmc = trimZeroes(thisCard.convertedManaCost);
				cardTypes = "";
				if(thisCard.types !== undefined) {
					for(let thisType in thisCard.types) {
						cardTypes += thisCard.types[thisType] + " ";
					}
				}
				if(thisCard.types === undefined)
					cardTypes = "";
				thisEntry.cardType = cardTypes;
				thisEntry.scryID = thisCard.scryfallId;
				if(thisCard.layout == "split" || thisCard.layout == "flip" || thisCard.layout == "double-faced" || thisCard.layout == "aftermath" || thisCard.layout === "transform" || thisCard.layout == "adventure") {
					if(nextCard == "") {
						i += 1;
						nextCard = thisSet.cards[i];
					}
					thisEntry.cardName2 = nextCard.name;
					if(nextCard.manaCost === undefined) {
						thisEntry.manaCost2 = "";
					}else{
						thisEntry.manaCost2 = nextCard.manaCost;
					}
					thisEntry.typeLine2 = nextCard.type;
					let cardRarity = nextCard.rarity.replace("timeshifted ", "")[0].toUpperCase();
					if(nextCard.type.match(/Basic Land/i))
						cardRarity = "L";
					if(nextCard.layout == "token")
						cardRarity = "Token";
					if(set_code.match("MPS_"))
						cardRarity = "Masterpiece";
					if(setData[set_code] !== undefined && setData[set_code].size !== 0 && setData[set_code].size < parseInt(thisCard.number))
						cardRarity = "Bonus";
					if(nextCard.rarity == "Special" || (nextCard.hasOwnProperty("frameEffects") && nextCard.frameEffects.includes("extendedart")))
						cardRarity = "Promo";
					thisEntry.rarityLine2 = "*" + set_code + " " + cardRarity + "*";
					if(nextCard.text === undefined) {
						thisEntry.rulesText2 = "";
					}else{
						cardText = nextCard.text.replace(/\(/g,"*(");
						cardText = cardText.replace(/\)/g,")*");
						thisEntry.rulesText2 = cardText + "\n";
					}
					if(nextCard.flavorText === undefined || nextCard.layout == "adventure") {
						thisEntry.flavorText2 = "";
					}else{
						thisEntry.flavorText2 = "*" + nextCard.flavorText +"*\n";
					}
					thisEntry.flavorText2 = flavorFix(thisEntry.flavorText2);
					if(nextCard.power === undefined) {
						thisEntry.power2 = "";
					}else{
						thisEntry.power2 = parseInt(nextCard.power);
					if(nextCard.power.match(/(\*|\+)/))
						thisEntry.power2 = nextCard.power.replace("*","★");
					}
					if(nextCard.toughness === undefined) {
						thisEntry.toughness2 = "";
					}else{
						thisEntry.toughness2 = parseInt(nextCard.toughness);
					if(nextCard.toughness.match(/(\*|\+)/))
						thisEntry.toughness2 = nextCard.toughness.replace("*","★");
					}
					if(nextCard.loyalty === undefined) {
						thisEntry.loyalty2 = "";
					}else{
						thisEntry.loyalty2 = parseInt(nextCard.loyalty);
						if(nextCard.loyalty == "X")
							thisEntry.loyalty2 = nextCard.loyalty;
					}
					thisEntry.colors2 = colorArranger(nextCard.colors);
					thisEntry.cmc2 = trimZeroes(nextCard.convertedManaCost);
					if(nextCard.types !== undefined) {
						for(let thisType in nextCard.types) {
							cardTypes += nextCard.types[thisType] + " ";
						}
					}
					if(nextCard.types === undefined)
						cardTypes = "";
					thisEntry.cardType2 = cardTypes;
				thisEntry.scryID2 = nextCard.scryfallId;
				}
				cardRarity = thisCard.rarity.replace("timeshifted ", "");
				if(thisCard.type.match(/Basic Land/i))
					cardRarity = "basic land";
				if(thisCard.layout == "token")
					cardRarity = "token";
				if(set_code.match("MPS_"))
					cardRarity = "masterpiece";
				if(setData[set_code] !== undefined && setData[set_code].size !== 0 && setData[set_code].size < parseInt(thisCard.number))
					cardRarity = "bonus"
				if(thisCard.rarity == "Special" || (thisCard.hasOwnProperty("frameEffects") && thisCard.frameEffects.includes("extendedart")))
					cardRarity = "promo";
				if(cardRarity.match(/mythic/i))
					cardRarity = "mythic rare";
				thisEntry.rarity = cardRarity.toLowerCase();
				thisEntry.artist = thisCard.artist;
				thisEntry.shape = "normal";
				if(thisCard.layout === "split" || thisCard.layout === "aftermath" || thisCard.layout === "flip" || thisCard.layout == "adventure")
					thisEntry.shape = "split";
				if(thisCard.layout === "leveler")
					thisEntry.shape = "leveler";
				if(thisCard.layout === "double-faced" || thisCard.layout === "meld" ||thisCard.layout === "transform")
					thisEntry.shape = "doubleface";
				thisEntry.notes = notify(thisEntry, thisCard);
				thisEntry.setID = set_code;
				thisEntry.cardID = thisCard.number;
				if(thisCard.hasOwnProperty('alias'))
					thisEntry.alias = thisCard.alias;
				thisEntry.formats = cardFormats;
				if(thisSet.cards[i].number.match(/★/)) {
					thisEntry.rarity = "promo";
					thisEntry.rarityLine = "*" + set_code + " Promo*";
				}
				if(thisEntry.rarity == "promo" || (thisCard.hasOwnProperty('frameEffects') && thisCard.frameEffects.includes('showcase'))) {
					databaseName += "_PRO_" + set_code;
				}else if(!canonDatabase.hasOwnProperty(databaseName + "_" + set_code)){
					databaseName += "_" + set_code;
				}else if(thisEntry.rarity == "bonus") {
					databaseName += "_PRO_" + set_code;
				}else if(canonDatabase[databaseName + "_" + set_code].rarity == "bonus") {
					var obj = {temp: ""};
					obj.temp = canonDatabase[databaseName + "_" + set_code];
					canonDatabase[databaseName + "_" + set_code] = thisEntry;
					thisEntry = obj.temp;
					databaseName += "_PRO_" + set_code;
				}else{
					let n = 0;
					let alphaarray = ["a","b","c","d","e","f","g","h","i","j","k","l","m"];
					let temp = databaseName + " (" + alphaarray[n] + ")_" + set_code;
					while(canonDatabase.hasOwnProperty(temp) && alphaarray[n] !== undefined) {
						n+=1;
						temp = databaseName + " (" + alphaarray[n] + ")_" + set_code;
					}
					databaseName = temp;
				}
				if(!fileType == junkFiles) {
					if(!pullSets.includes(set_code))
						pullSets.push(set_code)
				}
				canonDatabase[databaseName] = thisEntry;

			}
		}
	}
}
function notify(thisEntry, thisCard) {
	let noteArray = [];
	for(let name in notes) {
		if(notes[name].includes(thisEntry.cardName))
			noteArray.push(name);
	}
	if(thisCard.hasOwnProperty("frameEffect") && thisCard.frameEffect == "colorshifted") {
		noteArray.push("shifted")
	}else if(thisCard.hasOwnProperty("isTimeshifted") && thisCard.isTimeshifted) {
		noteArray.push("shifted");
	}
	if(thisEntry.shape == "doubleface") {
		noteArray.push("transform");
		if(thisEntry.rulesText.match(/meld/i))
			noteArray.push("meld")
	}
	return noteArray;
}
function standardize() {
	let setsArray = [];
	for(let set in sortedSetData) //add block data
		setsArray.push(set);
	setsArray = setsArray.reverse();
	let standardSets = [];
	for(let set in setsArray) { //calculate standard sets
		if(!junkFiles.includes(setsArray[set]) && sortedSetData[setsArray[set]].release > standardStart) {
			if(sortedSetData[setsArray[set]].type == "core" || sortedSetData[setsArray[set]].type == "expansion") {
				console.log(setsArray[set] + " grabbed as standard set with date " + sortedSetData[setsArray[set]].release + " > " + standardStart)
				standardSets.push(setsArray[set]);
				sortedSetData[setsArray[set]].standard = true;
			}
			if(standardSets.length >= 4) { //always at least 4
				let checkMonth = String(sortedSetData[standardSets[standardSets.length-1]].release).charAt(5);
				if(checkMonth == '9' || checkMonth == '0') //September or October release
					return; //source of last rotation
			}
		}
	}
}
function thenFix () {
	let meld_entries = require("./canon/meld.json");
	for(let meld in meld_entries) { //meld because they're weird and also LackeyBot's default no entry
		canonDatabase[meld] = meld_entries[meld];
	}
	console.log("Meld complete");
	var sortedSets = require('./canon/cardsSetsArray');
	for(let set in sortedSets) {
		if(setData.hasOwnProperty(set) || set == "BOT")
			sortedSetData[set] = setData[set];
	}

	standardize();
	canonObject = {};
	for(var that_set_name in pullSets) {
		if(!sortedSetData.hasOwnProperty(pullSets[that_set_name]))
			console.log("WARNING: Missing Set: " + pullSets[that_set_name]);
	}
	console.log("Missing set check complete");
	var firstListOfCardNames = [];
	var listOfCardNames = [];
	for(let card_name in canonDatabase)
		firstListOfCardNames.push(aposCorrect(card_name, "remove"));
	firstListOfCardNames.sort();
	for(let card_name in firstListOfCardNames)
		listOfCardNames.push(aposCorrect(firstListOfCardNames[card_name], "revert"));
	let promoTemp = {};
	for(var this_set_name in sortedSetData){
		let setcode = this_set_name;
		for(let card_name in listOfCardNames) {
			let thisCard = canonDatabase[listOfCardNames[card_name]];
			if(thisCard.setID == setcode) {
				if(!thisCard.rarity.match(/(bonus|promo|special)/)) {
					canonObject[listOfCardNames[card_name]] = canonDatabase[listOfCardNames[card_name]];
				}else{
					promoTemp[listOfCardNames[card_name]] = canonDatabase[listOfCardNames[card_name]];
				}
			}
		}
	}
	for(var card in promoTemp)
		canonObject[card] = promoTemp[card];
	console.log("Sort complete");
	let canonSetNames = Object.keys(sortedSetData);
	for(let card in canonObject) {
		if(canonObject[card].shape == 'split' && canonObject[card].hasOwnProperty('scryID2'))
			delete canonObject[card].scryID2;
		if(!canonObject[card].hasOwnProperty("rarities")) {
			let thisName = canonObject[card].fullName;
			let valids = [card];
			let rarities = [canonObject[card].rarity];
			let codes = [];
			for(let code in canonSetNames) {
				let testName = thisName + "_" + canonSetNames[code];
				if(canonObject.hasOwnProperty(testName)) {
					valids.push(testName)
					codes.push(canonSetNames[code])
					if(!rarities.includes(canonObject[testName].rarity))
						rarities.push(canonObject[testName].rarity)
				}
			}
			for(let hit in valids) {
				canonObject[valids[hit]].prints = codes;
				canonObject[valids[hit]].rarities = rarities;
			}
		}
	}
	
	console.log("Prints data complete");
	canonDatabase = canonObject;
	canonObject = null;
    console.log("Saving files...");
	fs.writeFile("./canon/setData.json",JSON.stringify(sortedSetData).replace(/}]},/g, "}]},\n"), (err) => {
		if (err) throw err;
		console.log('setData saved.')
	});

	let rulWords = JSON.stringify(rulObject)
	rulWords = rulWords.replace(/\\n_ "/g, "\"");
	let legalWords = JSON.stringify(legalObject).replace(/\\\\undefined/g, "");
	fs.writeFile("./canon/oracle.json",rulWords.replace(/","/g, "\",\r\n\""), (err) => {
		if (err) throw err;
		console.log('oracle saved.')
	});
	fs.writeFile("./canon/legal.json",legalWords.replace(/","/g, "\",\r\n\"").replace("{","{\r\n").replace(/\],/g,"],\r\n"), (err) => {
		if (err) throw err;
		console.log('legal saved.')
	});
	let words = JSON.stringify(canonDatabase);
	words = words.replace(/},\"/g, "},\r\n	\"");
	fs.writeFile("./canon/cards.json",words, (err) => {
		if (err) throw err;
		console.log('canon saved.')
	});
	let targetcsv = "";
	for(let hit in targets)
		targetcsv += targets[hit] + ",";
	fs.writeFile('./canon/targets.csv', targetcsv, (err) => {
		if(err) throw err;
	})

}

doStuff();