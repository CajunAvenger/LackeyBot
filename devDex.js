var config = require('./config/lackeyconfig.js').config;
var admin = config.dev;
var botname = config.botname;
var offline = config.offline;
var arcana = require('./arcana.js');
var eris = require('./eris.js');
var packgen = require('./packgen.js');
var Client = eris.Client;
var dbx = require('./boxofmud.js');
var fuzzy = require('./fuzzy.js');
var mod_magic = require('./magic.js');
var Discord = require('discord.js');
var psScrape = require('./psScrape.js');
var draftDexScripts = require('./draftDexScripts.js');
var fs = require('fs');
var version = require('./version.js');
var stats = require('./stats.js');
var toolbox = require('./toolbox.js');
var devDex = {};
var download = require('download-file');
var { //emote buffet
	yeet, boop, leftArrow, rightArrow, plainText,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');
function dl() {
	dbx.dropboxDownload('dev/devDex.json','/lackeybot stuff/devDex.json',reloadDevDex, true);
}
function reloadDevDex() {									//loads matchdex after downloading
	console.log('Reloading devDex');
	try{
		let test = require("./dev/devDex.json");		
		if(test.version < version.versionCheck.devDex)
		console.log("Version error in devDex.");
		devDex = test;
		arcana.devDex.cards = devDex.cards;
		arcana.devDex.devData = devDex.devData;
		arcana.devDex.setData = devDex.setData;
		arcana.devDex.version = devDex.version;
		devDex = arcana.devDex;
	}catch(e){ //firing before it's supposed to? 
		console.log(e)
		if(botname == "TestBot" || offline)
			return;
		version.downloadLoop.devDex++
		console.log("devDex download failed, reattempt " + version.downloadLoop.devDex);
		if(botname != "TestBot" && !offline && version.downloadLoop.devDex < 5){
			//https://www.dropbox.com/s/hzcb14qeovfin3e/devDex.json?dl=0
			dbx.dropboxDownload('dev/devDex.json','/lackeybot stuff/devDex.json',reloadDevDex, true)
		}else{
			eris.pullPing(admin).send("devDex failed to reload.");
			try{
				let test = require("./devDex.json");		
				if(test.version < versionCheck.devDex)
				console.log("Version error in devDex.");
				devDex = test;
				arcana.devDex.cards = devDex.cards;
				arcana.devDex.devData = devDex.devData;
				arcana.devDex.setData = devDex.setData;
				arcana.devDex.formatBribes = bribeLackeyDev;
				arcana.devDex.printImage = psLinker;
				arcana.devDex.version = devDex.version;
				devDex = arcana.devDex;
			}catch(e){}
		}
	}
}
//Project channels
function helpMessage() {									//devDex help message
	let output = "**devDex Help**\n"
	output += "LackeyBot can now support fetching for custom sets!\n";
	output += "To begin, use the following command in a DM with LackeyBot with one or more of the fields filled out with your channel's data:\n";
	output += "```?fetch setup\n";
	output += "code: BOT\n";
	output += "longname: Bot Party\n";
	output += "design: Cajun\n";
	output += "psLink: http://www.planesculptors.net/upload/835/4069/AnyCardFromYourCurrentPSVersion.jpg\n"
	output += "psSet: http://www.planesculptors.net/set/LinkToYourPSPage\n"
	output += "packSlots: use the ?packSlots command to learn how to set up custom pack distributions.";
	output += "```\n";
	output += "Once LackeyBot has confirmed your data, you will be able to use the LackeyBot exporter to generate a database of your cards -> https://www.dropbox.com/s/k6ersx937d3cz7a/magic-lackeybot.mse-export-template.zip?dl=0\n";
	output += "Then upload that exported file to LackeyBot's DM with the `?fetch upload` command and LackeyBot will attempt to add it to the database. To fetch, use {{Card Name}} and ?img.";
	return output;
}
function sanitizeCardData(designer,channel,file,set_code){	//download devDex patches and verify there's nothing amiss
	let holdingCell = {};
	try{
		holdingCell = require("./dev/" + file + "devtest.json");
	}catch(e){
		console.log(e);
		console.log("Failed attempt to update project database by " + eris.pullUsername(designer));
		channel.stopTyping(100);
		version.doneWriting("dev");
		return ["LackeyBot was unable to read your file."];
	}
	let psWarn = "";
	let psArray = [];
	let safeArray = ["fullName","cardName","manaCost","typeLine","rarityLine","rulesText","flavorText","power","toughness","loyalty","color","cmc","cardType","cardName2","manaCost2","typeLine2","rarityLine2","rulesText2","flavorText2","power2","toughness2","loyalty2","color2","cmc2","cardType2","rarity","shape","cardID","designer","script","notes","artist","artist2","instigatorID"];
	let safeSet = {};
	for(let thisCard in holdingCell) {
		if(holdingCell[thisCard].fullName != "") {
			let card_name = holdingCell[thisCard].fullName;
			if(psArray.includes(card_name)) {
				psWarn += card_name + ", ";
			}else{
				psArray.push(card_name);
			}
			if(holdingCell.rarity == "special"){
				card_name += "_PRO";
			}else if(holdingCell.rarity == "token"){
				card_name += "_TKN";
			}
			card_name += "_" + set_code;
			safeSet[card_name] = {};
			safeSet[card_name].rarity = "common"; //some input cards were missing rarity and breaking things?
			for(let thisField in safeArray) {
				if(holdingCell[thisCard][safeArray[thisField]] !== undefined)
					safeSet[card_name][safeArray[thisField]] = holdingCell[thisCard][safeArray[thisField]];
			}
			safeSet[card_name].setID = set_code;
		}
	}
	let errors = [];
	errorList = "Errors were encountered on the following cards: ";
	for(let thisCard in safeSet) {
		try{
			mod_magic.writeCard(safeSet[thisCard],safeSet);
		}catch(e){
			console.log(e)
			errors.push(thisCard);
		}
	}
	if(errors.length > 10) {
		channel.stopTyping(100);
		version.doneWriting("dev");
		console.log("Failed attempt to update project database by " + eris.pullUsername(designer));
		return ["There are numerous errors in your set. Please re-export and try to upload again. If this continues, ping Cajun."];
	}
	if(toolbox.hasValue(errors)) {
		for(let thisCard in errors)
			errorList += errors[thisCard] + ", "
		errorList.replace(/, $/, "");
		channel.stopTyping(100);
		version.doneWriting("dev");
		console.log("Failed attempt to update project database by " + eris.pullUsername(designer));
		return [errorList];
	}
	if(psWarn != "")
		psWarn = "\nDuplicate card names were detected. LackeyBot can support a normal card, promo card, and token card with the same name, but others will be overwritten. Attempting to upload to Planesculptors will cause errors. " + psWarn;
	psWarn = psWarn.replace(/, $/, "");
	return ["Cards database downloaded successfully."+psWarn, safeSet];
}
function addNewDevCards(designer, channel, file) {			//add sanitized card data into devDex
	if(!devDex.devData) {
		channel.stopTyping(100);
		return "devDex data is still loading, please try again in a minute. Sorry for the inconvenience!";
	}
	let set_code = devDex.devData[designer].setCode;
	let sani = sanitizeCardData(designer, channel, file, set_code);
	if(sani[1]) {
		let safeSet = sani[1];
		for(let thisCard in devDex.cards) {
			if(devDex.cards[thisCard].setID == set_code)
				delete devDex.cards[thisCard]
		}
		for(let thisCard in safeSet) {
			devDex.cards[thisCard] = safeSet[thisCard]
		}
		let card_list = Object.keys(devDex.cards);
		card_list.sort(function(a, b) {
			return setSort(a, b, devDex.cards, devDex.setData);
		});
		let tempcards = {};
		for(let thisCard in card_list)
			tempcards[card_list[thisCard]] = devDex.cards[card_list[thisCard]];
		
		devDex.cards = tempcards;
		arcana.devDex = devDex;
		version.logDev(arcana.devDex, designer);
		channel.stopTyping(100);
		version.doneWriting("dev");
		return sani[0];
	}else{
		return sani[0];
	}
}
function reassignDevCode(currentCode, newCode, id) {		//changes the set code for a project
	try{
		let tempObj = {};
		for(let thisCard in devDex.cards) {
			if(pullTokenSet(devDex.cards[thisCard], devDex.setData) == currentCode) {
				tempObj[devDex.cards[thisCard].fullName + "_" + newCode] = devDex.cards[thisCard];
				tempObj[devDex.cards[thisCard].fullName + "_" + newCode].setID = newCode
				tempObj[devDex.cards[thisCard].fullName + "_" + newCode].rarityLine = devDex.cards[thisCard].rarityLine.replace(currentCode, newCode);
				delete devDex.cards[thisCard];
			}
		}
		for(let thisCard in tempObj) {
			devDex.cards[thisCard] = tempObj[thisCard];
		}
		let card_list = Object.keys(devDex.cards);
		card_list.sort(function(a, b) {
			return setSort(a, b, devDex.cards, devDex.setData);
		});
		let tempcards = {};
		for(let thisCard in card_list)
			tempcards[card_list[thisCard]] = devDex.cards[card_list[thisCard]];
		
		devDex.cards = tempcards;
		devDex.devData[id].setCode = newCode;
		devDex.setData[newCode] = devDex.setData[currentCode]
		delete devDex.setData[currentCode]
		devDex.setData = toolbox.objSort(devDex.setData)
		version.logDev(arcana.devDex, id);
		return "Set code changed from " + currentCode + " to " + newCode + " succesfully!";
	}catch(e){
		console.log(e);
		return "There was an error in changing set codes.";
	}
}
function setSort (a, b, database, setDatabase) {			//sorts the sets
	let rarityArray = ["special","token"];
	let result = rarityArray.indexOf(database[a].rarity) - rarityArray.indexOf(database[b].rarity);
	if(result == 0){
		let sortedSetArray = Object.keys(setDatabase);
		result = sortedSetArray.indexOf(pullTokenSet(database[a], setDatabase)) - sortedSetArray.indexOf(pullTokenSet(database[b], setDatabase))
	}
	if(result == 0) {
		let alphaArray = [a,b];
		alphaArray.sort();
		result = alphaArray.indexOf(a) - alphaArray.indexOf(b);
	}
	return result
}
function commonSorter(packArray, library) {					//sorts the commons in a pack array
	let newArray = [];
	let sorted = false;
	for(let card in packArray) {
		let cardName = packArray[card];
		let cardData = library.cards[cardName];
		if(cardData.rarity == "common" && !sorted) {
			newArray.push(cardName);					//add initial commons
		}else if(!sorted){								//on first noncommon, sort commons
			newArray.sort(function(a, b) {
				return library.cards[newArray[a]].cardID - library.cards[newArray[b]].cardID;
			})
		}else{
			newArray.push(cardName);
		}
	}
	return newArray;
}
function doesPackContain(packArray, library, cb) {
	for(let c in packArray) {
		let name = unFoil(packArray[c]);
		let card = library.cards[name];
		let bool = cb(card);
		if(bool) {
			return true;
		}
	}
	return false;
}
function commCLRatio(library) {
	let colors = {
		"{White} ": 0,
		"{Blue} ": 0,
		"{Black} ": 0,
		"{Red} ": 0,
		"{Green} ": 0,
		"not mono": 0,
	}
	for(let card in library.cards) {
		let thisCard = library.cards[card];
		if(thisCard.rarity == "common") {
			let ent = "not mono";
			if(colors.hasOwnProperty(thisCard.color))
				ent = thisCard.color;
			colors[ent]++;
		}
	}
	let avg = (colors["{White} "] + colors["{Blue} "] + colors["{Black} "] + colors["{Red} "] + colors["{Green} "]) / 5;
	if(avg <= 0)
		return 0;
	return Math.pow(colors["not mono"] / avg, 2);
}
function generalCollater (library, set_code, count, user, style){	//print out pre-generated packs for Planesculptors
	let packs = [];
	let output = "";
	let rolling = 0;
	let thisSetData = library.setData[set_code];
	if(!style)
		style == "sheet";
	style = style.toLowerCase();
	if(style != "random") {
		let slotInfo = {};	//object of the different slots and their indexes
		let gcs;			//greatest common slot
		for(let i = thisSetData.packSlots.length-1; i>=0; i--) {
			let name = packgen.stringifyPackSlot(thisSetData.packSlots[i]);
			if(!slotInfo[name])
				slotInfo[name] = [];
			slotInfo[name].push(i);
			gcs = name;
		}
		for(let s in slotInfo) {
			if(slotInfo[s].length > slotInfo[gcs]) {
				gcs = s;
			}else{
				if(slotInfo[s].length == slotInfo[gcs] && thisSetData.packSlots[slotInfo[s][0]].filters[0].match(/r=c/)) {//if equal, prefer the common
					gcs = s;
				}
			}
		}
		let gcfilter = thisSetData.packSlots[slotInfo[gcs][0]].filters[0];
		if(style == "modified") {
			let ratio = commCLRatio(library);			//ratio for making non-mono colors more common to offset making monos more common
			let addCounter = 5+Math.ceil(ratio);		//how many guaranteed slots added
			if(slotInfo[gcs].length >= addCounter) {
				let cArray = ["c=w", "c=u", "c=b", "c=r", "c=g", "-c=1"];
				let cnArray = ["White", "Blue", "Black", "Red", "Green"];
				for(let i = 0; i<addCounter; i++) {
					if(i < 5) {
						thisSetData.packSlots[i+slotInfo[gcs].length-addCounter].conditionalScript = {
							filters: [`${JSON.parse(JSON.stringify(cArray[i]))} `+gcfilter, gcfilter],
							chances: [1, 1],
							condition: function(pack, library) {
								return !doesPackContain(pack, library, function(card) {return card.color == `{${JSON.parse(JSON.stringify(cnArray[i]))} `})
							}
						}
					}
					else{
						thisSetData.packSlots[i+slotInfo[gcs].length-addCounter].conditionalScript = {
							filters: [`${cArray[5]} `+gcfilter, gcfilter],
							chances: [Math.min(ratio, 1), 1],
							condition: function(pack, library) {
								return true;
							}
						}
						ratio--;
					}
				}
			}
		}
		else{ //herzi sheet method
			let r1 = determineRarityInSet(set_code, library);
			let r2 = determineRarityAverages(library.setData[set_code].packSlots);
			let r = {};
			for(let r3 in r1)
				r[r3] = Math.floor(count * r2[r3] / r1[r3]);
			let counts = {};
			for(let card in library.cards) {
				if(library.cards[card].setID == set_code) {
					counts[card] = r[library.cards[card].rarity]
				}
			}
			/*{
				someCommon_SET: 99,
				someUncommon_SET: 38,
			}*/
			let cArray = ["c=w", "c=u", "c=b", "c=r", "c=g"];
			//let cArray = ["c=g", "c=r", "c=b", "c=u", "c=w"];
			//for(let i = 0; i<=cArray.length-1; i++) {
			let gciArray = slotInfo[gcs].reverse();
			for(let s in cArray) {
				let thisSlot = thisSetData.packSlots[gciArray[s]];
				thisSlot.filters.push(""+thisSlot.filters[0]);
				thisSlot.chances.push(1.0)
				thisSlot.filters[0] += " " + cArray[s];
			}
			/* using this later but it uses that ^ so here for ease
			if(gciArray.includes(parseInt(filtersToRun.replace)) && gciArray.indexOf(parseInt(filtersToRun.replace)) < 5) { //if this wants to replace a slot we've force rolled
				filtersToRun.replace = gciArray[cArray.length]; //move it to the first one we didn't use
			}
			*/
			//yeet(slotInfo[gcs]);
			//yeet(thisSetData.packSlots);
			for(let i=0; i<count; i++)
				packs.push([]);
			let i = 0;
			let filterArrays = {};
			
			for(let slot in thisSetData.packSlots) {
				let thisSlot = thisSetData.packSlots[slot];
				for(let p in packs) {
					let thisPack = packs[p];
					let prob = 0; //counts up probabilities
					let rando = Math.random(); //probability roll for this slot
					let foilFlag = false;
					let skip = false;
					let replaceFail = true;
					let hasntRemoved = true;
					let filtersToRun = thisSlot;
					if(thisSlot.hasOwnProperty("conditionalScript") && thisSlot.conditionalScript.condition(thisPack, library)) {
						filtersToRun = thisSlot.conditionalScript;
					}
					for(let filter in filtersToRun.filters) {
						if(!skip) {
							let thisFilter = filtersToRun.filters[filter];
							if(filtersToRun.hasOwnProperty("replace")) { //replace check
								if(gciArray.includes(parseInt(filtersToRun.replace)) && gciArray.indexOf(parseInt(filtersToRun.replace)) < 5) { //if this wants to replace a slot we've force rolled
									filtersToRun.replace = gciArray[cArray.length]; //move it to the first one we didn't use
								}
								let rand2 = Math.random();
								if(replaceFail && rand2 > filtersToRun.replaceChance) {
									skip = true;
									continue; //failed the replaceChance
								}else{
									replaceFail = false;
									if(filtersToRun.hasOwnProperty("foil") && filtersToRun.foil)
										foilFlag = true;
								}
							}
							if(!thisFilter.match(/e:/))
								thisFilter += " e:" + set_code //add set filter if it doesn't have a filter
							if(!filterArrays.hasOwnProperty(thisFilter) || filterArrays[thisFilter].length == 0) {//add new filters to the object
								filterArrays[thisFilter] = JSON.parse(JSON.stringify(toolbox.shuffleArray(fuzzy.scryDatabase(library, thisFilter)[0])));
							}
							if(thisSlot.hasOwnProperty('chanceFunction') && thisSlot.chanceFunction != "else") {
								rando = Math.random() //roll each time for and and independent
								prob = filtersToRun.chances[filter];
							}else{ //add up each chance
								prob += filtersToRun.chances[filter];
							}
							if(rando <= prob) { //successful roll
								if(filterArrays[thisFilter].length == 0) { 
									//yeet("burnout")
									continue; //if nothing matches, skip, may be a secondary filter
								}
								//remove the replaced cards
								if(filtersToRun.hasOwnProperty("replace") && hasntRemoved) {
									if(typeof filtersToRun.replace == "number") {
										counts[unFoil(thisPack[filtersToRun.replace])]++; //put that card back
										thisPack.splice(filtersToRun.replace, 1) //replace the other card
									}else if(filtersToRun.replace == "all"){ //replace all the cards
										thisPack = [];
									}
									hasntRemoved = false;
								}
								//add the card
								let noRepeat = true, loops = 0, foil_name;
								while(noRepeat) {
									foil_name = filterArrays[thisFilter][i%filterArrays[thisFilter].length];
									//if(foil_name == undefined)
									//	yeet(filterArrays[thisFilter])
									if(foilFlag)
										foil_name = makeFoil(foil_name);
									noRepeat = thisPack.includes(foil_name);
									
									if(counts[unFoil(foil_name)] == 1) {
										for(let c in filterArrays[thisFilter]) {
											if(counts[filterArrays[thisFilter][c]] > 1 && !thisPack.includes(filterArrays[thisFilter][c])) {
												foil_name = filterArrays[thisFilter][c];
												if(foilFlag)
													foil_name = makeFoil(foil_name);
												noRepeat = false;
												break;
											}
										}
									}
									else if(counts[unFoil(foil_name)] < 1) {
										filterArrays[thisFilter].splice(filterArrays[thisFilter].indexOf(unFoil(foil_name)), 1);
										if(filterArrays[thisFilter].length == 0) {//add new filters to the object
											filterArrays[thisFilter] = JSON.parse(JSON.stringify(toolbox.shuffleArray(fuzzy.scryDatabase(library, thisFilter)[0])));
										}
									}
									
									i++;
									loops++;
									if(loops > 20)
										noRepeat = false;
								}
								//if(foil_name == undefined)
								//	yeet("brr")
								thisPack.push(foil_name);
								counts[unFoil(foil_name)]--;
								if(counts[unFoil(foil_name)] < 1) {
									filterArrays[thisFilter].splice(filterArrays[thisFilter].indexOf(unFoil(foil_name)), 1);
									if(filterArrays[thisFilter].length == 0) {//add new filters to the object
										filterArrays[thisFilter] = JSON.parse(JSON.stringify(toolbox.shuffleArray(fuzzy.scryDatabase(library, thisFilter)[0])));
									}
								}
								if(!filtersToRun.hasOwnProperty('chanceFunction') || filtersToRun.chanceFunction != "and")
									skip = true; //move to next slot
							}
						}
					}
				}
			}
		}
	}
	let packCount = 15;
	for(let i=0; i<count; i++) {
		if(style == "sheet") {
			if(packs[i].length < packCount) {
				packCount = packs[i].length;
			}
		}else{
			let thisPack = draftDexScripts.generatePack(set_code, library);
			if(thisPack.length < packCount)
				packCount = thisPack.length;
			packs.push(thisPack);
		}
	}
	for(let thisPack in packs) {
		packs[thisPack] = psPackSorter(packs[thisPack], library);
		for(let i=0; i<packCount;i++) {
			if(!packs[thisPack][i]) {
				console.log(thisPack)
				console.log(packs[thisPack])
			}
			else if(isFoil(packs[thisPack][i])) {
				//output += "FOIL "
			}
			output += library.cards[unFoil(packs[thisPack][i])].cardName + "\n";
		}
		output += "===========\n";
	}
	output = output.replace(/\n$/, "")
	fs.writeFile(`packs_${user.id}.txt`, output, function(err){
		if(err) throw err;
		user.send("Collated packs for Planesculptors:", {
			files: [{attachment:`packs_${user.id}.txt`}]
		})
	})
}

function determineRarityInSet(set_code, library) {			//number of cards of each rarity in a set
	let rarities = {
		"basic land": 0,
		"common": 0,
		"uncommon": 0,
		"rare": 0,
		"mythic rare": 0,
		"bonus": 0,
		"special": 0,
		"masterpiece": 0
	}
	for(let card in library.cards) {
		if(library.cards[card].setID == set_code)
			rarities[library.cards[card].rarity]++;
	}
	return rarities;
}
function determineRarityAverages(slots) {					//average cards of each rarity in a pack
	let rarities = {
		"basic land": 0,
		"common": 0,
		"uncommon": 0,
		"rare": 0,
		"mythic rare": 0,
		"bonus": 0,
		"special": 0,
		"masterpiece": 0
	}
	let slotInfo = {};
	/*
	{
		"r=c": {
			1.0: 9,
			0.625: 1
		}
	}
	*/
	for(let s in slots) {
		let thisSlot = slots[s];
		for(let f in thisSlot.filters) {
			let thisFilter = thisSlot.filters[f];
			let thisChance = thisSlot.chances[f];
			if(thisSlot.hasOwnProperty('replace'))
				thisChance *= thisSlot.replaceChance;
			if(!slotInfo[thisFilter])
				slotInfo[thisFilter] = {}
			if(!slotInfo[thisFilter][thisChance])
				slotInfo[thisFilter][thisChance] = 0;
			slotInfo[thisFilter][thisChance]++;
		}
		if(thisSlot.hasOwnProperty('replace')) {
			let replaceSlot = slots[thisSlot.replace];
			for(let f in replaceSlot.filters) {
				let thisFilter = replaceSlot.filters[f];
				let thisChance = -1*thisSlot.replaceChance;
				if(!slotInfo[thisFilter])
					slotInfo[thisFilter] = {}
				if(!slotInfo[thisFilter][thisChance])
					slotInfo[thisFilter][thisChance] = 0;
				slotInfo[thisFilter][thisChance]++;
			}
		}
	}
	for(let thisFilter in slotInfo) {
		let thisSlot = slotInfo[thisFilter];
		let rs = [];
		let rcheck = thisFilter.match(/\br([<>=]*)([curmbs])/i) //check for rare filter
		if(!rcheck) {
			rs = ["common", "uncommon", "rare", "mythic rare", "bonus", "special"]
		}
		else{
			let e = (rcheck[1] == "=" || rcheck[1] == ">=" || rcheck[1] == "=>" || rcheck[1] == "<=" || rcheck[1] == "=<");
			let g = (rcheck[1] == ">");
			let l = (rcheck[1] == "<");
			if((rcheck[2] == "c" && e) || (rcheck[2].match(/[urmbs]/i) && l))
				rs.push("common");
			if((rcheck[2] == "u" && e) || (rcheck[2].match(/[rmbs]/i) && l) || (rcheck[2].match(/[c]/i) && g))
				rs.push("uncommon");
			if((rcheck[2] == "r" && e) || (rcheck[2].match(/[mbs]/i) && l) || (rcheck[2].match(/[cu]/i) && g))
				rs.push("rare");
			if((rcheck[2] == "m" && e) || (rcheck[2].match(/[bs]/i) && l) || (rcheck[2].match(/[cur]/i) && g))
				rs.push("mythic rare");
			if((rcheck[2] == "b" && e) || (rcheck[2].match(/[s]/i) && l) || (rcheck[2].match(/[curm]/i) && g))
				rs.push("bonus");
			if((rcheck[2] == "s" && e) || (rcheck[2].match(/[curmb]/i) && g))
				rs.push("special");
		}
		for(let c in thisSlot) {
			 let multi = c * thisSlot[c];
			 for(let r in rs)
				 rarities[rs[r]] += multi;
		}
	}
	return rarities;
}
function makeFoil(string){									//adds ★ to a card name
	return "★ " + string;
}
function unFoil(string){									//removes ★ from a card name
	if(string == undefined)
		return "";
	return string.replace("★ ", "");
}
function isFoil(string){									//checks if card name has a ★ 
	if(string == undefined)
		return false;
	return string.match("★ ");
}
function psPackSorter (packArray, library) {				//sorts packs ps-style
	rarityArray = ["basic land", "common", "uncommon", "special", "bonus", "rare", "mythic rare", "masterpiece"];
	packArray.sort(function(a, b) {
		let result = (isFoil(a) == null) - (isFoil(b) == null);
		if(result)	//sort by foil
			return result;
		result = rarityArray.indexOf(library.cards[unFoil(b)].rarity) - rarityArray.indexOf(library.cards[unFoil(a)].rarity);
		if(result) //then by rarity
			return result;
		result = library.cards[unFoil(a)].cardID - library.cards[unFoil(b)].cardID;
		return result; //then by color
	})
	return packArray;
}
function buildPackDocs(page, textFlag) {					//build $packdocs embed
	let docs = packgen.docs[0];
	if(textFlag) {
		docs = packgen.docs[1];
		let fixedText = docs[page].page;
		let header = docs[page].header;
		output = "__" + header + "__\n" + fixedText;
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("packSlots Documentation")
			.setFooter("Page " + parseInt(page+1) + "/" + docs.length)
			return [[output, nullEmbed]];
	}
	var embedInfo  = new Discord.MessageEmbed()
		.setTitle("packSlots Documentation")
		.addField(docs[page].header, docs[page].page)
		.setFooter("Page " + parseInt(page+1) + "/" + docs.length)
	if(docs[page].hasOwnProperty('header2'))
		embedInfo.addField(docs[page].header2, docs[page].page2)
	if(docs[page].hasOwnProperty('header3'))
		embedInfo.addField(docs[page].header3, docs[page].page3)
	return [embedInfo, docs.length];
}
function pullTokenSet(card, setbase) {						//determines what set a token belongs to
	for(let set in setbase) {
		if(card.cardID.match(set))
			return set;
		if(card.setID.match(set))
			return set;
		
	}
	return "MSEMAR";
}
function messageHandler(msg, perms) {
	if(perms.includes(0) || perms.includes(3)) {
		//project channel dev boost
		var devChanMatch = msg.content.match(/!devchan <?@?!?([0-9]+)>? <?#?([0-9]+)>?/);
		if(devChanMatch) {
			devDex.devData[devChanMatch[1]].channel = devChanMatch[2];
			devDex.setData[devDex.devData[devChanMatch[1]].setCode].channel = devChanMatch[2];
			msg.channel.send(eris.pullUsername(devChanMatch[1]) + " set as owner of <#" + devChanMatch[2] + ">")
			version.logDev(arcana.devDex, msg.author.id);
		}
	}
	if(msg.content.match(/!gentest/)) {
		msg.channel.messages.fetch("844832123180417044")
			.then(mess => messageHandler(mess, perms))
			.catch(e => console.log(e))
	}
	if(msg.content.match(/(\$|\?)fetch ?help/i)) {
		stats.upBribes(1);
		msg.channel.send(helpMessage());
	}
	if(msg.content.match(/(\?|\$)pack(doc|slot)/i)) {
		stats.upBribes(1);
		let embedded = buildPackDocs(0)[0];
		msg.channel.send(embedded)
			.then(mess => mess.react(leftArrow)
			.then(() => mess.react(rightArrow))
			.then(() => mess.react(plainText)))
			.catch(e => console.log(e))
	}
	if(msg.content.match(/(\?|\$)pack(gen|print)/)) { //planesculptors pack generator
		let count = 1000;
		let countCheck = msg.content.match(/(\?|\$)pack(gen|print) (\d+)/);
		if(countCheck && parseInt(countCheck[3]) < 1000)
			count = parseInt(countCheck[3]);
		let attached = msg.attachments.array();
		let packSlotsMatch = msg.content.match(/packSlots: ?([\s\S]+)/i);
		if(attached[0] && packSlotsMatch) { //separate file
			let attachURL = attached[0].url;
			let filename = attached[0].name;
			let newName = new Date().getTime()
			download(attachURL, {directory:"./dev/", filename: newName + "devtest.json"}, function(err) {
				if(err) throw err;
				msg.channel.startTyping(100);
				setTimeout(function() {
					var collatorCallback = function(sani) {
						if(sani.length > 1) {
							msg.channel.send(sani[0] + " Attempting to generate packs...");
							let safeLib = {cards:sani[1], setData:{"NEW":{packSlots:[]}}, name:"temp"};
							let packSlotData = packSlotsMatch[1];
							let testPacks = packgen.buildPackSlotsFrom(packSlotData);
							if(!Array.isArray(testPacks) || testPacks.length == 0) {
								msg.channel.send("Something went wrong with the packSlot builder. This is likely a problem with LackeyBot rather than your code, so please alert Cajun for debugging.");
								msg.channel.stopTyping(100);
							}else if(testPacks[0] && typeof testPacks[0] == 'string' && testPacks[0].match(/Invalid packSlot structure/)) {
								msg.channel.send(testPacks[0]);
								msg.channel.stopTyping(100);
							}else{
								safeLib.setData["NEW"].packSlots = testPacks;
								let testFilters = packgen.testPackFilters(testPacks, safeLib, "NEW");
								if(testFilters)
									msg.channel.send(testFilters)
								let style = "modified";
								let styleMatch = msg.content.match(/style: ?(random|default|ps|sheet)/i);
								if(styleMatch)
									style = styleMatch[1];
								generalCollater(safeLib, "NEW", count, msg.author, style);
								msg.channel.stopTyping(100);
							}
						}else{
							msg.channel.send(sani[0]);
							msg.channel.stopTyping(100);
						}
					}
					try {
						fs.readFile(`dev/${newName}devtest.json`, 'utf8', function(err, data) {
							if(err) throw err;
							if(!data.match(/^[^\r\n]*\r?\n1.0/)) {
								collatorCallback(sanitizeCardData(msg.author.id, msg.channel, newName, "NEW"));
							}
							else{
								collatorCallback(["", psScrape.htmlToLB(data)]);
							}
						})
					}catch(e) {
						
					}
				}, 2000);
				setTimeout(function() {
					fs.unlink("./dev/" + newName + "devtest.json", (err) => {if (err) throw err;});
				}, 20000);
			});
		}else if(attached[0]){
			msg.channel.send("Please include a packSlots code with your file to collate with. Send `?packdocs` for information for how to construct a packSlots code.")
		}else{ //help
			let helpout = "**Packgen Help**";
			helpout += "\nLackeyBot can generate custom collations for Planesculptors for fine-tuned control over pack distributions.";
			helpout += "\nThis uses the packSlots system, use `$packdocs` for specifics on how to set up slots.";
			helpout += "\nUpload your txt file from the Planesculptors export with the `$packgen` command and the packSlots code.";
			helpout += "\nCollation uses a system to guarantee each pack has a common of each color. You can disable this by adding `Style: Random` as part of the message.";
			helpout += "\n```";
			helpout += "\n$packgen";
			helpout += "\npackSlots: Custom";
			helpout += "\n15x Uncommon```";
			helpout += "\nLackeyBot will send you a file. Save this as \"packs.txt\" and upload it alongside the rest of your Planesculptors files.";
			msg.channel.send(helpout)
		}
	}
	if(msg.content.match(/\$stoptyping/i))
		msg.channel.stopTyping(100);
	if(msg.channel.type == 'dm') { //DevDex Management
		let devUpMatch = msg.content.match(/(\$|\?)fetch ?setup/i);
		if(devUpMatch) {
			version.startWriting("dev");
			let user = msg.author.id, spoof = false;
			if(user == admin && msg.content.match(/spoof:/)) {
				user = msg.content.match(/spoof: ?(\d+)/i)[1];
				spoof = true;
			}
			let longNameMatch = msg.content.match(/longname: ?([^\n]*)/i);
			let setCodeMatch = msg.content.match(/code: ?([^\n]{0,100})/i);
			let designMatch = msg.content.match(/design: ?([^\n]*)/i);
			let psLinkMatch = msg.content.match(/psLink: ?https?:\/\/www.planesculptors.net\/upload\/([0-9]+\/[0-9]+)[^.]*(.[^\n]*)/i);
			let psSetMatch = msg.content.match(/psSet: ?https?:\/\/www.planesculptors.net\/set\/([^\n]+)/i);
			let packSlotsMatch = msg.content.match(/packSlots: ?([\s\S]+)/i);
			let changes = 0;
			if(!setCodeMatch && !longNameMatch && !designMatch && !psLinkMatch && !psSetMatch && !packSlotsMatch) {
				//if they have a set and make no changes, tell them the current stuff
				if(devDex.devData.hasOwnProperty(user)) {
					let thisSet = devDex.devData[user];
					let output = "Your setcode is currently " + thisSet.setCode + "\n";
					output += "Your longname is currently " + thisSet.longname + "\n";
					output += "Your lead design is currently " + thisSet.design + "\n";
					output += "Your planesculptor's ids are currently `" + thisSet.psLink + "` and `" + thisSet.psSuffix + "`\n";
					output += "Your planesculptor's page is currently https://www.planesculptors.net/set/" + thisSet.psSet + "`\n";
					output += "To change any of those, use the following command in your set channel with one or more of the fields filled out with your channel's data:\n";
					output += "```?fetch setup\n";
					output += "code: BOT\n";
					output += "longname: Bot Party\n";
					output += "design: Cajun\n";
					output += "psLink: http://www.planesculptors.net/upload/835/4069/AnyCardFromYourCurrentPSVersion.jpg\n"
					output += "psSet: http://www.planesculptors.net/set/LinkToYourPSPage\n"
					output += "packSlots: use the ?packSlots command to learn how to set up custom pack distributions.";
					output += "```\n";
					msg.channel.send(output);
				}else{ //if they don't have a set and make no changes, give the help menu
					msg.channel.send(helpMessage());
				}
				version.doneWriting("dev");
			}else{ //if they make changes...
				if(!devDex.devData.hasOwnProperty(user)) { //and don't have a set, make it
					devDex.devData[user] = {};
					devDex.devData[user].channel = "";
					devDex.devData[user].ownerID = user;
					devDex.devData[user].setCode = "";
					devDex.devData[user].username = msg.author.username;
					if(spoof)
						devDex.devData[user].username = eris.pullPing(user).username;
					devDex.devData[user].longname = "";
					devDex.devData[user].design = "";
					devDex.devData[user].psLink = "";
					devDex.devData[user].psSuffix = "";
					devDex.devData[user].psSet = "";
				}
				//then start applying the changes
				if(setCodeMatch) {
					if(devDex.setData.hasOwnProperty(setCodeMatch[1]) && devDex.setData[setCodeMatch[1]].channelID != msg.channel.id) {
						msg.channel.send("The set code " + setCodeMatch[1] + " is already in use, please select a different one. You can use `?codes` to see all set codes in use.");
					}else if(setCodeMatch && devDex.devData[user].setCode == "") {
						if(!devDex.setData.hasOwnProperty(setCodeMatch[1])) {
							devDex.setData[setCodeMatch[1]] = {};
							devDex.setData[setCodeMatch[1]].channel = "";
							devDex.setData[setCodeMatch[1]].leadID = user;
							devDex.setData[setCodeMatch[1]].longname = "";
							devDex.setData[setCodeMatch[1]].packSlots = require('./standardDist.json');
							devDex.devData[user].setCode = setCodeMatch[1];
							changes++;
						}
						devDex.setData = toolbox.objSort(devDex.setData);
					}else if(setCodeMatch && devDex.devData[user].setCode != "") {
						msg.channel.send(reassignDevCode(devDex.devData[user].setCode, setCodeMatch[1], user));
					}
				}
				if(longNameMatch) {
					devDex.devData[user].longname = longNameMatch[1];
					changes++;
				}
				if(designMatch) {
					devDex.devData[user].design = designMatch[1];
					changes++;
				}
				if(psLinkMatch) {
					devDex.devData[user].psLink = psLinkMatch[1];
					devDex.devData[user].psSuffix = psLinkMatch[2];
					if(devDex.devData.setCode != "" && devDex.setData.hasOwnProperty(devDex.devData[user].setCode)) {
						devDex.setData[devDex.devData[user].setCode].psLink = psLinkMatch[1];
						devDex.setData[devDex.devData[user].setCode].psSuffix = psLinkMatch[2];
					}
					changes++;
				}
				if(psSetMatch) {
					devDex.devData[user].psSet = psSetMatch[1];
					devDex.setData[devDex.devData[user].setCode].psSet = psSetMatch[1];
					changes++;
				}
				if(packSlotsMatch) {
					let unmatch = packSlotsMatch[1].match(/\n(longname|code|design|psLink|psSet):[\s\S]/);
					let packSlotData = packSlotsMatch[1];
					if(unmatch)
						packSlotData = packSlotData.replace(unmatch[0], "");
					let testPacks = packgen.buildPackSlotsFrom(packSlotData);
					if(!Array.isArray(testPacks) || testPacks.length == 0) {
						msg.channel.send("Something went wrong with the packSlot builder. This is likely a problem with LackeyBot rather than your code, so please alert Cajun for debugging.");
					}else if(testPacks[0] && typeof testPacks[0] == 'string' && testPacks[0].match(/Invalid packSlot structure/)) {
						msg.channel.send(testPacks[0]);
					}else{
						devDex.setData[devDex.devData[user].setCode].packSlots = testPacks;
						changes++;
						let testFilters = packgen.testPackFilters(testPacks, arcana.devDex, devDex.devData[user].setCode);
						if(testFilters)
							msg.channel.send(testFilters)
					}
				}
				if(changes)
					msg.channel.send("Changes made!");
				if(devDex.devData[user].setCode == "") {
					msg.channel.send("Remember to set up a Set Code before uploading your file.");
				}else{
					devDex.setData[devDex.devData[user].setCode].longname = devDex.devData[user].longname;
				}
			}
			version.logDev(arcana.devDex, msg.author.id); // and then save it
			version.doneWriting("dev");
		}
		let devLoadMatch = msg.content.match(/(\$|\?)fetch ?upload/i);
		if(devLoadMatch) {
			version.startWriting("dev");
			let user = msg.author.id, spoof = false;
			if(user == admin && msg.content.match(/spoof:/)) {
				user = msg.content.match(/spoof: ?(\d+)/i)[1];
				spoof = true;
			}
			let attachURL = msg.attachments.array()[0].url;
			let filename = msg.attachments.array()[0].name;
			let newName = new Date().getTime()
			download(attachURL, {directory:"./dev/", filename: newName + "devtest.json"}, function(err) {
				if(err) throw err;
				msg.channel.startTyping(100);
				setTimeout(function() {
					msg.channel.send(addNewDevCards(user, msg.channel, newName));
				}, 2000);
				setTimeout(function() {
					fs.unlink("./dev/" + newName + "devtest.json", (err) => {if (err) throw err;});
				}, 20000);
			});
		}
	}

}
exports.dl = dl;
exports.buildPackDocs = buildPackDocs;
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.sendDex = function() {
	return devDex;
}