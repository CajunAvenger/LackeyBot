/* draftDexScripts
 scripts for draftDex
*/
var arcana = require('./arcana.js');
var dbx = require('./boxofmud.js');
var Discord = require('discord.js');
var eris = require('./eris.js');
var Client = eris.Client();
var draftBots = require('./draftBots.js');
var mod_magic = require('./magic.js');
var fuzzy = require('./fuzzy.js');
var version = require('./version.js');
var stats = require('./stats.js');
var toolbox = require('./toolbox.js');
var draftDex = {players:{}};
var packStash = {};
var {
	yeet, boop,
	azArray, azEmoteArray,
	blank, resetList, leftArrow, rightArrow,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');


function dl() {
	dbx.dropboxDownload('draft/draftDex.json','https://www.dropbox.com/s/pqjnjuwy2kdx372/draftDex.json?dl=0',reloadDraft);
}
function reloadDraft() {									//loads draft after downloading
	console.log('Reloading draft');
	let test = require('./draft/draftDex.json');
	if(test.version < version.versionCheck.draftDex)
		console.log("Version error in draft.");
	draftDex = test;
}
//embeds
function buildPackEmbed(library, packCards, expansion, user, page, textFlag) { 				//build $open embed
	let database = library.cards;
	let pages = packCards.length;
	let packObj = {};
	packObj.cards = packCards;
	packObj.set = expansion;
	packObj.database = library.name;
	let total_name = packCards[page];
	let card_name = unFoil(total_name);
	let foil_name = database[card_name].fullName;
	if(isFoil(total_name))
		foil_name = makeFoil(foil_name);
	let cardText = database[card_name].typeLine + "\n" + database[card_name].rulesText.replace(/\n$/,"");
	if(database[card_name].power)
		cardText += "\n" + database[card_name].power + "/" + database[card_name].toughness;
	if(textFlag) {
		let embedText = eris.pullUsername(user) + " opened a pack of " + expansion;
		for(let i=0; i<packCards.length; i++) {
			embedText += "\n";
			if(isFoil(packCards[i]))
				embedText += "★ ";
			embedText += database[unFoil(packCards[i])].fullName;
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(eris.pullUsername(user) + " opened a pack of " + expansion)
			.setFooter("Card " + parseInt(page+1) + "/" + pages)
		return [[embedText, nullEmbed], packObj];
	}
	var exampleEmbed = new Discord.MessageEmbed()
		.setColor('#00ff00')
		.setThumbnail(printImages([unFoil(packCards[(page+1)%pages])], library, true))
		.setTitle(eris.pullUsername(user) + " opened a pack of " + expansion)
		.setFooter("Card " + parseInt(page+1) + "/" + pages)
		.addField("**" + foil_name + "**", cardText)
		.setImage(printImages([unFoil(card_name)], library, true))
	return [exampleEmbed, packObj];
}
function buildDraftEmbed(library, packCards, expansion, user, page, textFlag, firstFlag) {	//build draft embed
	let database = library.cards;
	let packObj = {};
	packObj.cards = packCards;
	packObj.set = expansion;
	packObj.database = library.name;
	let cardText, cardTitle;
	let embedColor = library.encodeColor;
	let embedText = "";
	let draftPass = "was passed";
	let thisDraft = focusedDraft(user);
	let pxpy = `Pack ${thisDraft.roundArray[0]}, Pick ${thisDraft.players[user].pick}`
	if(firstFlag)
		draftPass = "drafted";
	var exampleEmbed = new Discord.MessageEmbed()
		.setTitle(`${eris.pullUsername(user)} ${draftPass} a pack of ${expansion}, ${pxpy}`)
		.setColor(embedColor)
		.setFooter(`${page+1}/${packObj.cards.length+1}, ${thisDraft.name}: ${generateDraftName(thisDraft)}. React with 💬 to change to plaintext mode.`)
	if(page == 0) {
		for(let i=0; i<packCards.length; i++) {
			let line = azEmoteArray[i] + ": ";
			if(isFoil(packCards[i]))
				line += "★ ";
			let zeName = unFoil(packCards[i])
			if(!database.hasOwnProperty(zeName)) {
				zeName = zeName + "_" + expansion;
				if(!database.hasOwnProperty(zeName)) {
					zeName = searchCards(library, zeName)
				}
			}
			line += database[zeName].fullName;
			embedText += line + "\n";
		}
	}else{
		let ind = page-1;
		let total_name = packCards[ind];
		let card_name = unFoil(total_name);
		let foil_name = database[card_name].fullName;
		if(isFoil(total_name))
			foil_name = makeFoil(foil_name);
		cardText = database[card_name].typeLine + "\n" + database[card_name].rulesText.replace(/\n$/,"");
		if(database[card_name].power)
			cardText += "\n" + database[card_name].power + "/" + database[card_name].toughness;
		cardTitle = "**" + foil_name + "**";
		cardTitle = azEmoteArray[ind] + ": " + cardTitle;
		exampleEmbed.setThumbnail(printImages([unFoil(packCards[(ind+1)%packCards.length])], library, true))
		exampleEmbed.addField(cardTitle, cardText)
		exampleEmbed.setImage(printImages([unFoil(card_name)], library, true));
	}
	embedText += `\nReact with 🇦 🇧 ... 🇿 to pick a card.\nReact with ${leftArrow}${rightArrow} to see card images or ${resetList} to return to the list.\nSend $viewpool to see your current pool.\nIf LackeyBot isn't responding, send $viewpack to refresh your pack.`;
	if(textFlag) {
		if(page != 0)
			embedText += "\n" + cardTitle + "\n" + cardText;
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(`${eris.pullUsername(user)} ${draftPass} a pack of ${expansion}, ${pxpy}`)
			.setColor(embedColor)
			.setFooter(`${page+1}/${packObj.cards.length+1}, ${thisDraft.name}: ${generateDraftName(thisDraft)}. React with 💬 to change to embed mode.`)
		return [[embedText, nullEmbed], packObj];
	}
	exampleEmbed.setDescription(embedText)
	return [exampleEmbed, packObj];
}
function buildPickEmbed(library, packCards, expansion, textFlag) {							//build $p1p1 embed
	let database = library.cards;
	let packObj = {};
	packObj.cards = packCards;
	packObj.set = expansion;
	packObj.database = library.name;
	let embedColor = library.encodeColor;
	let embedText = "";
	for(let i=0; i<packCards.length; i++) {
		embedText += "\n";
		if(isFoil(packCards[i]))
			embedText += "★ ";
		let zeName = unFoil(packCards[i])
		if(!database.hasOwnProperty(zeName)) {
			zeName = zeName + "_" + expansion;
			if(!database.hasOwnProperty(zeName)) {
				zeName = searchCards(library, zeName)
			}
		}
		embedText += database[zeName].fullName;
	}
	if(textFlag) {
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("Pack 1, Pick 1: " + expansion)
			.setColor(embedColor)
			.setFooter("1/1")
		return [[embedText, nullEmbed], packObj];
	}
	var exampleEmbed = new Discord.MessageEmbed()
		.setTitle("Pack 1, Pick 1: " + expansion)
		.setColor(embedColor)
		.setFooter("1/1")
		.setDescription(embedText)
	return [exampleEmbed, packObj];
}
function buildSupremeEmbed(library, packCards, expansion, pickData, page, textFlag) {		//build $supreme embed
	let database = library.cards;
	let packObj = {};
	packObj.cards = packCards;
	packObj.set = expansion;
	packObj.database = library.name;
	packObj.picks = [];
	let cardText, cardTitle;
	let embedColor = library.encodeColor;
	var exampleEmbed = new Discord.MessageEmbed()
		.setTitle(`Supreme Draft, Pack ${pickData.pack}, Pick ${pickData.pick}: ${expansion}`)
		.setColor(embedColor)
		.setFooter(`${page+1}/${packObj.cards.length+1} React with 💬 to change to plaintext mode.`)
	let embedText = "";
	if(page == 0) {
		for(let i=0; i<packCards.length; i++) {
			let line = azEmoteArray[i] + ": ";
			if(isFoil(packCards[i]))
				line += "★ ";
			let zeName = unFoil(packCards[i])
			if(!database.hasOwnProperty(zeName)) {
				zeName = zeName + "_" + expansion;
				if(!database.hasOwnProperty(zeName)) {
					zeName = searchCards(library, zeName)
				}
			}
			line += database[zeName].fullName;
			if(pickData.picks.includes(azEmoteArray[i]))
				line = "~~" + line + "~~";
			embedText += line + "\n";
		}
	}else{
		let ind = page-1;
		let total_name = packCards[ind];
		let card_name = unFoil(total_name);
		let foil_name = database[card_name].fullName;
		if(isFoil(total_name))
			foil_name = makeFoil(foil_name);
		cardText = database[card_name].typeLine + "\n" + database[card_name].rulesText.replace(/\n$/,"");
		if(database[card_name].power)
			cardText += "\n" + database[card_name].power + "/" + database[card_name].toughness;
		cardTitle = "**" + foil_name + "**";
		if(pickData.picks.includes(azEmoteArray[ind]))
			cardTitle = "~~" + cardTitle + "~~";
		cardTitle = azEmoteArray[ind] + ": " + cardTitle;
		exampleEmbed.setThumbnail(printImages([unFoil(packCards[(ind+1)%packCards.length])], library, true))
		exampleEmbed.addField(cardTitle, cardText)
		exampleEmbed.setImage(printImages([unFoil(card_name)], library, true));
	}
	embedText += `\nReact with 🇦 🇧 ... 🇿 to pick a card.\nReact with ${leftArrow}${rightArrow} to see card images or ${resetList} to return to the list.\nSend $poolsupreme to see your current pool.`;
	if(textFlag) {
		if(page != 0)
			embedText += cardTitle + "\n" + cardText;
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(`Supreme Draft, Pack ${pickData.pack}, Pick ${pickData.pick}: ${expansion}`)
			.setColor(embedColor)
			.setFooter(`${page+1}/${packObj.cards.length+1} React with 💬 to change to embed mode.`)
		return [[embedText, nullEmbed], packObj];
	}
	exampleEmbed.setDescription(embedText)
	return [exampleEmbed, packObj];
}
function supremePicker (user, picked) {														//checks supreme picks are legal
	let ind = azEmoteArray.indexOf(picked);
	if(ind == -1)
		return [0, "Not an alpha emote."];
	let stash = packStash[user];
	if(ind >= stash.cards.length)
		return [0, "Pick outside of range."];
	if(stash.picks.includes(picked))
		return [0, "That card has already been picked."];
	let spool = scratchPad.supreme[user].pool;
	let zeName = unFoil(stash.cards[ind])
	if(!spool.hasOwnProperty(zeName))
		spool[zeName] = 0;
	spool[zeName]++;
	stash.picks.push(picked)
	return [1, "Card added to pool"];
}

//Packs
function generatePack(set, library, extraFilter) {											//generates a pack given a set code
	let database = library.cards;
	let setDatabase = library.setData;
	var newPack = [];
	let packSlots = setDatabase[set].packSlots;
	let filterArrays = {}; //save these so we don't have to keep rolling them
	let i = 0;
	for(let slot in packSlots) {
		let prob = 0; //counts up probabilities
		let rando = Math.random(); //probability roll for this slot
		let foilFlag = false;
		let skip = false;
		let replaceFail = true;
		let hasntRemoved = true;
		for(let filter in packSlots[slot].filters) {
			if(!skip) {
				let thisFilter = packSlots[slot].filters[filter];
				if(packSlots[slot].hasOwnProperty("replace")) { //replace check
					let rand2 = Math.random();
					if(replaceFail && rand2 > packSlots[slot].replaceChance) {
						skip = true;
						continue; //failed the replaceChance
					}else{
						replaceFail = false;
						if(packSlots[slot].hasOwnProperty("foil") && packSlots[slot].foil)
							foilFlag = true;
					}
				}
				if(!thisFilter.match(/e:/))
					thisFilter += " e:" + set //add set filter if it doesn't have a filter
				if(extraFilter)
					thisFilter += extraFilter; //apply any additional filters called
				if(!filterArrays.hasOwnProperty(thisFilter)) //add new filters to the object
					filterArrays[thisFilter] = toolbox.shuffleArray(fuzzy.scryDatabase(library, thisFilter)[0]);
				if(packSlots.hasOwnProperty('chanceFunction') && packSlots.chanceFunction != "else") {
					rando = Math.random() //roll each time for and and independent
					prob = packSlots[slot].chances[filter];
				}else{ //add up each chance
					prob += packSlots[slot].chances[filter];
				}
				if(rando <= prob) { //successful roll
					if(filterArrays[thisFilter].length == 0) 
						continue; //if nothing matches, skip, may be a secondary filter
					//remove the replaced cards
					if(packSlots[slot].hasOwnProperty("replace") && hasntRemoved) {
						if(typeof packSlots[slot].replace == "number") {
							newPack.splice(packSlots[slot].replace, 1) //replace the other card
						}else if(packSlots[slot].replace == "all"){ //replace all the cards
							newPack = [];
						}
						hasntRemoved = false;
					}
					//add the card
					let foil_name = filterArrays[thisFilter][i%filterArrays[thisFilter].length];
					if(foilFlag)
						foil_name = makeFoil(foil_name);
					newPack.push(foil_name);
					i++;
					if(!packSlots[slot].hasOwnProperty('chanceFunction') || packSlots[slot].chanceFunction != "and")
						skip = true; //move to next slot
				}
			}
		}
	}
	return newPack;
}
function makeFoil(string){																	//adds ★ to a card name
	return "★ " + string;
}
function unFoil(string){																	//removes ★ from a card name
	return string.replace("★ ", "");
}
function isFoil(string){																	//checks if card name has a ★ 
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
}//Draft Engine
//setup
function initializeDraft(owner) {							//creates a new draft object
	draftDex.drafts[draftDex.ticker] = {
		owner: owner,
		name: draftDex.ticker,
		status: "creating",
		libraries: [""],
		roundArray: [0],
		playerIDs: [],
		players: {},
		botIDs: [],
		packs: [],
		empty: 0
	}
	let thatDraft = draftDex.drafts[draftDex.ticker];
	draftDex.ticker++;
	addDraftPlayer(thatDraft, owner)
	return "New draft started! Add Magic packs with `!addpack SET`, MSEM packs with `$addpack SET`, or Custom Database sets with `?addpack SET`.";
}
function addPack(draft, library, setcode, count) {			//adds a round of a given set
	if(!library.setData.hasOwnProperty(setcode))
		return "Set not found.";
	if(!library.setData[setcode].packSlots.length)
		return "Sorry, " + library.setData[setcode].longname + " packs don't exist or are not currently supported. If you think this is an error, contact Cajun.";
	let r = "a round";
	if(!count) {
		count = 1;
	}else{
		r = count + " rounds"
	}
	for(let i=0; i<count; i++) {
		draft.roundArray.push(setcode);
		draft.libraries.push(library.name);
	}
	version.logLater["draft"] = true;
	let draftname = generateDraftName(draft);
	return "You have added " + r + " of " + library.setData[setcode].longname + " to your draft.\nYour draft is now " + draftname;
}
function generateDraftName(draft) {							//uses roundArray to name the draft
	if(!draft || !draft.roundArray)
		return ""
	var draftname = "";
	for(var i = 1; i < draft.roundArray.length; i++) {
		draftname += draft.roundArray[i]
		if(i !== draft.roundArray.length -1)
			draftname += "/"
	}
	return draftname
}
function helpMessage(draft) {							//sends draft help and draft owner help
	let helpout = "**Drafting Help**\n"
	if(draft != undefined) {
		helpout += "Your current draft is " + generateDraftName(draft) + "\n";
		helpout += "`!addpack SET/$addpack SET/?addpack SET` to add a draft round of that set from the canon/MSEM/uploadable database.\n";
		helpout += "or `!add2packs` etc to add 2-9 packs of that set at once.\n";
		helpout += "`$resetdraft` to reset the chosen sets. Can only be used before opening the draft.\n";
		helpout += "`$deletedraft` to delete the draft. Can only be used before starting the draft.\n";
		helpout += "`$opendraft` to stop editing the draft and open registration.\n";
		helpout += "`$startdraft` to stop accepting players and begin drafting.\n";
		helpout += "`$addbot` to add a draftbot to the draft. Its pool will be sent to you after the draft.\n";
		helpout += "`$draftbot` for list of bots.\n";
		helpout += "`$draftplayers` to see a list of players and draftIDs.\n";
		helpout += "`$kickplayer draftID` to drop a player and their pool, but not their current pack, from the draft.\n";
		helpout += "`$viewpool draftID` to view the pool of that player.\n";
		helpout += "`$pickfor draftID` to pick a random card for that player.\n";
		helpout += "To transfer ownership or other changes, contact Cajun.";
	}else{
		helpout += "`newdraft` to start a new draft.\n";
		helpout = "`$drafting` for information about the current drafts.\n";
		helpout += "`$joindraft N` to join the selected draft.\n";
		helpout += "`$focusdraft N` to focus the selected draft. Draft commands only work on your focused draft. When you join a draft, or get passed a pack, that draft will automatically become your focused draft.\n";
		helpout += "`$drop` to drop from your focused draft.\n";
		helpout += "`$viewpack` to review your current pack.\n";
		helpout += "`$viewpool` to review your current pool.\n";
		helpout += "`$viewtable` to view the players and their packs.\n";
		helpout += "`$drafthelp` for this message.\n";
	}
	return helpout;
}
function writeDrafterIndexes(draft) {						//writes the player indexes for kicking players
	let output = "";
	for(let user in draft.players) {
		let username = eris.pullUsername(user);
		let thisPlayer = draft.players[user];
		if(draft.players[user].bot)
			username = "AI Player " + username;
		let sincePick = "";
		if(thisPlayer.pick > 0)
			sincePick = `, last picked ${toolbox.timeConversion(toolbox.timeSince(thisPlayer.lp), 1)} ago`;
		output += `${thisPlayer.dID} — ${username}, ${thisPlayer.numPacks} packs${sincePick}\n`;
	}
	output += "Send `$kickplayer 0` etc to kick player 0. Kicked players can't be added back to a draft in progress."
	return output;
}
//player management
function firstFreedID(draft) {
	for(let i=0; i<99; i++) {
		if(!draftPlayerByID(draft, i))
			return i;
	}
	return "A";
}
function addDraftPlayer(draft, user) {						//adds a player to a draft
	if(draft.players.hasOwnProperty(user))
		return "You are already in the draft. Would you like to `$drop`?";
	if(draft.status === "progress" || draft.status === "ending")
		return "Sorry, this draft is already in progress!";
	let dID = firstFreedID(draft);
	draft.playerIDs.push(user);
	draft.players[user] = {
		dID: dID,
		currentPack: null,
		numPacks: 0,
		pick: 0,
		pt: false,
		lp: 0,
		pool: {}
	}
	if(!draftDex.players.hasOwnProperty(user)) {
		draftDex.players[user] = {
			focus: draft.name,
			drafts: [draft.name]
		}
	}else{
		draftDex.players[user].focus = draft.name;
		if(!draftDex.players[user].drafts.includes(draft.name))
			draftDex.players[user].drafts.push(draft.name);
	}
	version.logLater["draft"] = true;
	return "You have been added to the draft.";
}
function dropDraftPlayer(draft, user, myself) {				//drops a player from the draft
	let f1 = function(){};
	let packNo = draft.players[user].currentPack;
	if(draft.players[user].currentPack != null && draft.packs[packNo].cards.length) {
		let nextUser = nextPlayer(draft, user);
		f1 = function() { //if the next player is open, give them this pack
			draft.players[nextUser].numPacks += 1;
			if(draft.players[nextUser].currentPack == null) {
				draft.players[nextUser].currentPack = packNo;
				draft.packs[packNo].user = nextUser;
				showPack(draft, nextUser);
			}
		};
	}
	let username = eris.pullUsername(user);
	if(draft.players[user].bot)
		username = "AI Player " + draft.botIDs.indexOf(user)
	delete draft.players[user];
	draft.playerIDs = toolbox.clearElements(draft.playerIDs, user);
	draft.botIDs = toolbox.clearElements(draft.botIDs, user);
	clearPlayerData(draft, user);
	f1();
	version.logLater["draft"] = true;
	if(myself)
		return "You have been dropped from the draft.";
	return username + " has been kicked from the draft.";
}	
function moveDraftPlayerFocus(draft, user) {				//changes a draft user's main draft
	if(user.match(/^AI\d+/))
		return;
	if(!draftDex.players[user])
		draftDex.players[user] = {focus:0, drafts:[]}
	draftDex.players[user].focus = draft.name;
	let output = "Draft " + draft.name + " has been made your focus draft.";
	if(!focusedDraft(user).playerIDs.includes(user))
		output += "\nNote that you are not in this draft. If you didn't change focus for editing purposes, check that you used the right number.";
	return output;
}
function draftPlayerByID(draft, ID) {						//gets drafter with specified dID
	for(let user in draft.players) {
		if(draft.players[user].dID == ID)
			return user;
	}
	return null;
}
function focusedDraft(user) {								//grabs the focused draft of a player
	if(!draftDex.players || !draftDex.players[user])
		return {owner: null, name: null, status:null, roundArray: [], empty: 0, players:{}, packs:{}, libraries:[], playerIDs:[], botIDs:[]};
	let uFocus = draftDex.players[user].focus;
	return draftDex.drafts[uFocus];
}
function pickForPlayer(draft, user) {						//picks the first card for the specified user
	let thisPack = draft.packs[draft.players[user].currentPack].cards;
	draftPick(draft, user, thisPack[0]);
	return "Picked for player.";
}
//round management
function startDraft(draft) {								//starts the draft
	stats.drafts++;
	draft.status = "running";
	draft.playerIDs = toolbox.shuffleArray(draft.playerIDs);
	pushDraftRound(draft);
	version.logLater["draft"] = true;
}
function pushDraftRound(draft) {							//adds new packs and advances round
	draft.roundArray[0]++;
	let expacName = draft.roundArray[draft.roundArray[0]];
	let library = arcana[draft.libraries[draft.roundArray[0]]];
	draft.packs = [];
	let now = new Date().getTime();
	for(let i=0; i<draft.playerIDs.length; i++) {
		if(expacName == "CHAOS") {
			let setsArray = [];
			for(let set in library.setData) {
				if(library.setData[set].packSlots.length > 0)
					setsArray.push(set);
			}
			let setCount = setsArray.length;
			let num = Math.floor(Math.random()*setCount);
			expacName = setsArray[num];
		}
		let genPack = psPackSorter(generatePack(expacName, library, " -is:bonus -r=l"), library);
		stats.packs++;
		let user = draft.playerIDs[i];
		draft.packs.push({cards:genPack, user:user});
		draft.players[user].currentPack = i;
		draft.players[user].numPacks = 1;
		draft.players[user].pick = 1;
		draft.players[user].lp = now;
	}
	draft.empty = 0;
	version.logLater["draft"] = true
	for(let user in draft.players) { //do this after so the bots don't pick while that's generating still
		showPack(draft, user, true);
	}
}
function passPack(draft, user) {							//sends new pack to players
	let packNo = 0 + draft.players[user].currentPack;
	let nextPackNo = nextPack(draft, packNo);
	//console.log(`${user} passing ${packNo} to ${nextPlayer(draft, user)}, checking ${nextPackNo}`);
	draft.players[user].currentPack = null;
	draft.players[user].numPacks -= 1;
	draft.packs[packNo].user = null;
	let f1 = function(){}
	let f2 = function(){}
	//see if the next pack is free and take it if so
	if(draft.packs[nextPackNo].user == null && draft.packs[nextPackNo].cards.length) {
		draft.packs[nextPackNo].user = user;
		draft.players[user].currentPack = nextPackNo;
		//console.log(`${user} picked up pack ${draft.players[user].currentPack}`)
		f1 = function(){showPack(draft, user)};
	}else if(!draft.packs[nextPackNo].cards.length && draft.roundArray[0] == draft.roundArray.length-1){ //last pick
		eris.pullPing(user).send("Thanks for drafting. Your pool is listed below:\n" + showPool(draft, user));
	}else{
		eris.pullPing(user).send("LackeyBot will DM you when you have a new pack.");
	}
	//then if the next player is open, give them the passed pack
	if(draft.packs[packNo].cards.length) {
		let nextUser = nextPlayer(draft, user);
		draft.players[nextUser].numPacks += 1;
		if(draft.players[nextUser].currentPack == null) {
			draft.players[nextUser].currentPack = packNo;
			draft.packs[packNo].user = nextUser;
			//console.log(`${nextUser} picked up pack ${draft.players[nextUser].currentPack}`)
			f2 = function(){showPack(draft, nextUser)};
		}
	}
	f1();
	f2();
	version.logLater["draft"] = true;
}
function endCheck(draft) {									//checks if round needs started
	if(draft.empty == draft.packs.length) {
		if(draft.roundArray[0] == draft.roundArray.length-1) {
			endDraft(draft);
		}else{
			pushDraftRound(draft);
		}
	}
}
function endDraft(draft) {									//final message
	for(var user in draft.botIDs) {
		eris.pullPing(draft.owner).send("The draft has ended. " + eris.pullUsername(draft.botIDs[user]) + "'s pool is listed below:\n" + showPool(draft, draft.botIDs[user]));
	}
	let name = "draft" + draft.name + ".json"
	let fulltext = JSON.stringify(draft)
	fulltext = fulltext.replace(/,"/g,",\n\"");
	dbx.dropboxUpload(`/drafts/${name}`, fulltext);
	delete draftDex.drafts[draft.name];
	clearPlayerData(draft);
	version.logLater["draft"] = true;
}
function clearPlayerData(draft, user) {						//clear player data after drafts
	let runs = draft.players;
	if(user) { //specific player, clear all player data otherwise
		runs = {user:draft.players[user]};
	}else if(!runs.hasOwnProperty(draft.owner)) { //if owner dropped before, clear their data out now
		if(draftDex.players[draft.owner]) {
			if(draftDex.players[draft.owner].drafts.length == 1 && draftDex.players[draft.owner].drafts[0] == draft.name) { //this is their only draft
				delete draftDex.players[draft.owner];
			}else{
				draftDex.players[draft.owner].drafts.splice(draftDex.players[draft.owner].drafts.indexOf(draft.name), 1);
			}
		}
	}
	for(let u in runs) {
		if(!draftDex.players[u])
			continue;
		if(draft.owner == user) {	//owner dropping from a running draft
			//leave their data
		}else if(draftDex.players[u].drafts.length == 1 && draftDex.players[u].drafts[0] == draft.name) { // this is their only draft
			delete draftDex.players[u];
		}else{
			draftDex.players[u].drafts.splice(draftDex.players[u].drafts.indexOf(draft.name), 1);
			if(draftDex.players[u].focus == draft.name)
				draftDex.players[u].focus = draftDex.players[u].drafts[0];
		}
	}
}
function nextPlayer(draft, user) {							//finds who is being passed to
	let tableID = draft.playerIDs.indexOf(user);
	let round = draft.roundArray[0];
	if(round%2) {
		return draft.playerIDs[(tableID+1)%(draft.playerIDs.length)];
	}else{
		if(tableID == 0)
			return draft.playerIDs[draft.playerIDs.length-1];
		return draft.playerIDs[tableID-1];
	}
}
function previousPlayer(draft, user) {						//finds who is being passed from
	let tableID = draft.playerIDs.indexOf(user);
	let round = draft.roundArray[0];
	if(round%2) {
		return draft.playerIDs[(tableID-1)%(draft.playerIDs.length)];
	}else{
		if(tableID == draft.playerIDs.length-1)
			return draft.playerIDs[0];
		return draft.playerIDs[tableID+1];
	}
}
function nextPack(draft, packNo) {							//finds index of next pack
	let np = (1 + packNo)%draft.packs.length;
	if(draft.roundArray[0]%2) {
		np = packNo-1;
		if(np == -1)
			np += draft.packs.length
	}
	return np
}
function previousPack(draft, packNo) {						//finds index of previous pack
	let pp = packNo-1;
	if(draft.roundArray[0]%2) {
		pp = (packNo+1)%draft.packs.length;
	}else if(pp == -1) {
		pp += draft.packs.length
	}
	return pp
}
function liveDraftLib(draft) {								//returns name of current library
	return draft.libraries[draft.roundArray[0]]
}
//drafting commands
function draftPick(draft, user, string, quiet, loop) {		//moves picked card from pack to pool
	let thisPlayer = draft.players[user];
	let thisPack = draft.packs[thisPlayer.currentPack].cards;
	if(!thisPack.length)
		return
	let thisCard = fuzzy.searchPack(thisPack, string);
	if(thisCard == "no" && !loop) {
		if(draft.players[user].bot) {
			draftPick(draft, user, thisPack[0], true, true);
		}else{
			eris.pullPing(user).send("Couldn't find a card with that name. Try copy-pasting the card's name, or if that fails, contact Cajun.");
		}
	}else{
		let thisLibrary = liveDraftLib(draft)
		if(!thisPlayer.pool.hasOwnProperty(thisLibrary))
			thisPlayer.pool[thisLibrary] = {};
		let thisPool = thisPlayer.pool[thisLibrary];
		let thisName = unFoil(thisCard);
		if(!thisPool.hasOwnProperty(thisName))
			thisPool[thisName] = 0;
		thisPool[thisName]++;
		thisPack.splice(thisPack.indexOf(thisCard), 1);
		thisPlayer.pick++;
		thisPlayer.lp = new Date().getTime();
		if(!quiet)
			eris.pullPing(user).send(thisCard.replace(/_[A-Z0-9_]+/, "") + " successfully added to your pool.")
		delete packStash[user];
		if(thisPack.length == 0) {
			draft.empty++;
			passPack(draft, user);
			endCheck(draft);
		}else{
			passPack(draft, user)
		}
	}
}
function showTable(draft, user) {							//sends list of players and packs they have
	let tableString = `You have ${draft.players[user].numPacks} packs and are passing to `;
	let nextUser = nextPlayer(draft, user);
	while(nextUser != user) {
		tableString += `${eris.pullUsername(nextUser)}, who has ${draft.players[nextUser].numPacks} packs and is passing to `
		nextUser = nextPlayer(draft, nextUser);
	}
	tableString += "you.";
	tableString = tableString.replace(/ 1 packs/g, " 1 pack");
    return tableString;
}
function showPack(draft, user, firstFlag) {					//shows current pack to given user
	if(draftDex.players[user])
		draftDex.players[user].focus = draft.name;
	if(draft.players[user].bot) {
		let hotCard = packScorer(draft, user);
		draftPick(draft, user, hotCard);
		return;
	}
	let discUser = eris.pullPing(user);
	let packNo = draft.players[user].currentPack;
	let packMessage = "";
	if(packNo == null) {
		discUser.send("There are no packs waiting for you yet.");
	}else if(draft.packs[packNo].cards.length == 1){ //autopick last card
		let embedded = buildDraftEmbed(arcana[draft.libraries[draft.roundArray[0]]], draft.packs[packNo].cards, draft.roundArray[draft.roundArray[0]], user, 1, draft.players[user].pt, firstFlag);
		if(Array.isArray(embedded[0])) {
			packMessage = embedded[0][0];
			embedded[0] = embedded[0][1];
		}
		embedded[0].setDescription(`You last picked ${draft.packs[packNo].cards[0].replace(/_[A-Z0-9_]+$/, "")}.`);
		draftPick(draft, user, draft.packs[packNo].cards[0], true); //pick the card an don't ping a second time.
		discUser.send(packMessage, embedded[0]);
	}else{
		let embedded = buildDraftEmbed(arcana[draft.libraries[draft.roundArray[0]]], draft.packs[packNo].cards, draft.roundArray[draft.roundArray[0]], user, 0, draft.players[user].pt, firstFlag);
		if(Array.isArray(embedded[0])) {
			packMessage = embedded[0][0];
			embedded[0] = embedded[0][1];
		}
		packStash[user] = embedded[1];
		discUser.send(packMessage, embedded[0])
			.then(function(mess){(packStash[user].msg = mess.id)
				mess.react(leftArrow)
				.then(() => mess.react(rightArrow))
				.then(() => mess.react(plainText))})
			.catch(function(e){console.log(e)})
	}
}
function showPool(draft, user) {							//shows current pool to given user
	let pool = draft.players[user].pool;
	let dist = tallyDraftStats(pool, false);
	let output = "You have drafted **"+dist.cards+"** cards.\n";
	output += `Colors ${dist.colors.W}W | ${dist.colors.U}U | ${dist.colors.B}B | ${dist.colors.R}R | ${dist.colors.G}G | ${dist.colors.M}M | ${dist.colors.L}L | ${dist.colors.C}C\n`;
	output += "CMC "
	for(let n in dist.cmcs) {
		let num = dist.cmcs[n];
		if(!num)
			num = 0;
		if(num > 0 || parseInt(n) < 8)
			output += `${n}:${num} | `;
	}
	output += "\n";
	for(let lib in pool) {
		for(let card in pool[lib])
			output += pool[lib][card] + " " + card.replace(/_[A-Z0-9_]+/, "") + "\n";
	}
	return output;
}
//Draft AI
function addBotDrafter(draft, name) {						//adds a draft bot
	let botuser = "LackeyBot"
	if(name && draftBots[name])
		botuser = name;
	let count = 1;
	let botname = botuser + "-1"
	while(draft.players.hasOwnProperty(botname)) {
		count++;
		botname = botuser + "-" + count;
	}
	let dID = firstFreedID(draft);
	draft.playerIDs.push(botname);
	draft.botIDs.push(botname);
	draft.players[botname] = {
		dID: dID,
		currentPack: null,
		numPacks: 0,
		pick: 0,
		lp: 0,
		bot: true,
		pool: {}
	}
	return "Added a draft bot: " + botname;
}
function tallyDraftStats(pool, partial) {					//tallies the color counts of a pool	
	let colors = {W:0, U:0, B:0, R:0, G:0, M:0, C:0, L:0};
	let cmcs = Array(20).fill(0)
	let total = 0;
	let bank = {};
	for(let lib in pool) {
		let thisPool = pool[lib];
		for(let card in thisPool) {
			total += thisPool[card];
			let cardName = unFoil(card);
			let thisCard = arcana[lib].cards[cardName];
			if(partial) {
				cmcs[Math.min(thisCard.cmc,7)] += thisPool[card];
			}else{
				cmcs[thisCard.cmc] += thisPool[card];
			}
			if(thisCard.typeLine.match(/Land/)) {
				colors.L += thisPool[card];
			}else{
				let pallete = mod_magic.flipColors(mod_magic.arrayifyColors(thisCard.color));
				if(partial) {
					pallete = mod_magic.flipColors(mod_magic.calculateColorIdentity(thisCard));
					bank[card] = pallete;
				}else{
					if(pallete.length > 1)
						pallete = ["M"];
				}
				if(pallete.length == 0) {
					colors.C += thisPool[card];
				}else{
					let multi = 1;
					if(partial)
						multi = 1 / pallete.length;
					for(let c in pallete)
						colors[pallete[c]] += multi*thisPool[card];
				}
			}
		}
	}
	return {colors:colors, cmcs:cmcs, cards:total, bank:bank};
}
function packToPool(pack) {									//convert pack to pool to simplify scripts
	let pool = {}
	for(let c in pack) {
		if(!pool.hasOwnProperty(pack[c]))
			pool[pack[c]] = 0;
		pool[pack[c]]++;
	}
	return pool;
}
function packScorePrep(draft, user, packNo) {				//preps data for pack scoring
	let poolDeets = tallyDraftStats(draft.players[user].pool, true);
	let colorOrder = ["W","U","B","R","G"];
	colorOrder.sort(function(a, b){
		return poolDeets.colors[b]-poolDeets.colors[a];
	});
	let packDeets = tallyDraftStats(packToPool(draft.packs[packNo].cards), true);
	let colorGlut = ["W","U","B","R","G"];
	if(packDeets.cards) {
		colorGlut.sort(function(a, b){
			return packDeets.colors[b]-packDeets.colors[a];
		});
	}
	return [poolDeets, packDeets, colorOrder, colorGlut]
}
function packScorer(draft, user) {							//scores a packs contents for the bot to pick
	//prioritize staying in colors
	//prioritize rarity
	//prioritize glut colors
	//slight uptick in gold in your lane
	//deprioritize cmcs you have a lot of [1, 4, 3, 2, 1, 1, 0] -> [3, 6, 5, 4, 2, 1, 1 ...]
	//prioritize 'destroy' 'deals N damage' and 'flying'
	let thisPack = draft.packs[draft.players[user].currentPack].cards;
	if(thisPack.length == 1)
		return thisPack[0]; //only one card;
	let botuser = eris.pullUsername(user).replace(/-\d+/, "");
	if(botuser == "PlayerUnknown")
		botuser = "LackeyBot";
	
	let bot = draftBots[botuser];
	let scores = [-1, ""];
	let prep = packScorePrep(draft, user, draft.players[user].currentPack);
	let poolDeets = prep[0];
	let packDeets = prep[1];
	let colorOrder = prep[2];
	let colorGlut = prep[3];
	let botData = {			//data to be given to bot functions
		round: draft.roundArray[0],
		colorOrder: colorOrder,
		colorGlut: colorGlut,
		poolDeets: poolDeets,
		packDeets: packDeets
	}
	if(bot.sendMe) {
		let reqs = bot.sendMe();
		if(reqs.includes("previousPlayer")) {
			let pprep = packScorePrep(draft, previousPlayer(draft, user), previousPack(draft, draft.players[user].currentPack))
			botData.previousPlayer = {			//data to be given to bot functions
				poolDeets: pprep[0],
				packDeets: pprep[1],
				colorOrder: pprep[2],
				colorGlut: pprep[3]
			}
		}
		if(reqs.includes("nextPlayer")) {
			let pprep = packScorePrep(draft, nextPlayer(draft, user), nextPack(draft, draft.players[user].currentPack))
			botData.previousPlayer = {			//data to be given to bot functions
				poolDeets: pprep[0],
				packDeets: pprep[1],
				colorOrder: pprep[2],
				colorGlut: pprep[3]
			}
		}
	}
	for(let card in thisPack) {
		let cardName = thisPack[card];
		let thisCard = arcana[draft.libraries[draft.roundArray[0]]].cards[unFoil(cardName)];
		botData.cardName = card;
		botData.thisCard = thisCard;
		let score = 5 + bot.variance(botData);
		if(poolDeets.cards >= bot.stayInYourLane(botData)) { //at p1p6+, stay in your lane
			//uptick fancy words
			if(thisCard.rulesText.match(bot.fancyWords(botData)))
				score += bot.fancyScore(botData);
			if(packDeets.bank[cardName]) {
				let colors = packDeets.bank[cardName];
				if(colors.includes(colorOrder[0]) && colors.includes(colorOrder[1])){
					score += bot.laneGolds(botData); //snap pick on color golds
				}else{
					let hotColor = 5;
					for(let c in colorOrder) {
						if(!colors.includes(colorOrder[c])) {
							hotColor--;
						}else{
							break;
						}
					}
					score += bot.hotMulti(botData) * hotColor / 3;
					//+1.6, +1.3, +1, +0.6, +0.3, +0
				}
				if(colors.includes(colorOrder[4]))
					score += bot.coldScore(botData);
			}
		}else{	//slight uptick for rarity in early picks
			if(thisCard.rarity == "mythic rare"){
				score += bot.mythicScore(botData);
			}else if(thisCard.rarity == "rare") {
				score += bot.rareScore(botData);
			}else if(thisCard.rarity == "uncommon"){
				score += bot.uncScore(botData);
			}
		}
		//uptick glut colors
		if(packDeets.cards <= bot.checkForPivot(botData) && packDeets.bank[cardName]) {
			let colors = packDeets.bank[cardName];
			if(colors.includes(colorGlut[0])) {
				score += bot.glutMulti(botData)*(packDeets[colorGlut[0]] - packDeets[colorGlut[1]]);
				//tick up 0.5 for each card in excess of the other cards, color is likely open
			}
		}
		//downtick cmcs
		{
			let cmc = Math.min(thisCard.cmc, 7);
			let cmcCount = poolDeets.cmcs[cmc];
			if(cmcCount >= bot.tooHighCMCs(botData)[cmc]) {
				score += bot.cmcScore(botData)[2];
			}else if(cmcCount >= bot.highCMCs(botData)[cmc]) {
				score += bot.cmcScore(botData)[1];
			}else if(cmcCount >= bot.lowCMCs()[cmc]) {
				score += bot.cmcScore(botData)[0];
			}
		}
		if(scores[0] == null) {
			scores = [score, cardName];
		}else if(scores[0] < score){
			scores = [score, cardName];
		}
	}
	return scores[1];
}

function messageHandler(msg, perms) {
	let arcanaData = arcana.configureArcana(msg);
	if(perms.includes(0)) {
		if(msg.content.match(/!closedraft/i)) { //delete the focused draft
			let thisDraft = focusedDraft(msg.author.id);
			let name = thisDraft.name;
			clearPlayerData(thisDraft);
			delete draftDex.drafts[name];
			msg.channel.send(`Draft ${name} is now closed.`);
			version.logLater["draft"] = true;
		}
		if(msg.content.match(/!logDraft/i))
			version.logDraft(draftDex);
		let transfermatch = msg.content.match(/!transfer draft (\d+) to (\d+)/)
		if(transfermatch) {
			let user = eris.pullPing(transfermatch[2]);
			draftDex.drafts[transfermatch[1]].owner = user.id;
			user.send(`You have been transfered ownership of Draft ${transfermatch[1]} (${generateDraftName(draftDex.drafts[transfermatch[1]])}). Be sure to use $focusdraft ${transfermatch[1]} before making any changes.`)
		}
	}
	//create a new draft
	if(msg.content.match(/\$newdraft/i)) {
		stats.upBribes(1);
		libMatch = {magic: arcana.magic, msem: arcana.msem, project: arcana.devDex}
		msg.channel.send(initializeDraft(msg.author.id))
	}
	//draft owner commands
	var editingDraft = focusedDraft(msg.author.id);
	if(draftDex.players && draftDex.players[msg.author.id] && editingDraft && (editingDraft.owner == msg.author.id || admincheck.includes(2))) {
		if(msg.content.match(/\$deletedraft/i)) { //delete draft
			stats.upBribes(1);
			if(editingDraft.status == "running") {
				msg.channel.send("You can't delete a draft in progress. If you need to for some reason, contact Cajun.");
			}else{
				clearPlayerData(editingDraft)
				delete draftDex.drafts[editingDraft.name];
				msg.channel.send("Draft deleted.");
				version.logLater["draft"] = true;
			}
		}
		//adding packs
		let packmatch = msg.content.match(/(\$|\?|!)add([1-9])?packs? ([A-Z0-9]+)/i)
		if(packmatch) {
			if(editingDraft.status != "creating") {
				eris.pullPing(editingDraft.owner).send("You can't add sets at this time.");
			}else{
				let mainName = "angle";
				if(packmatch[1] =="$")
					mainName = "square";
				if(packmatch[1] == "?")
					mainName = "curly";
				let library = arcanaData[mainName].data;
				let count = 1;
				if(packmatch[2])
					count = packmatch[2];
				msg.channel.send(addPack(editingDraft, library, packmatch[3], packmatch[2]))
			}
		}
		//reseting roundArray
		if(msg.content.match(/\$resetdraft/i)) {
			if(editingDraft.status == "creating") {
				editingDraft.roundArray = [0];
				eris.pullPing(msg.author.id).send("The draft rounds have been reset");
				version.logLater["draft"] = true;
			}else{
				eris.pullPing(msg.author.id).send("The draft rounds cannot be reset at this time.");
			}
		}
		let botdraftmatch = msg.content.match(/\$addbot ?([^\n]+)?/i)
		if(botdraftmatch)
			msg.channel.send(addBotDrafter(editingDraft, botdraftmatch[1]));
		if(msg.content.match(/\$draftplayers/i))
			msg.channel.send(writeDrafterIndexes(editingDraft));
		//removing players
		var kickmatch = msg.content.match(/\$kickplayer ([0-9]+)/i)
		if(kickmatch) {
			let kickID = draftPlayerByID(editingDraft, kickmatch[1]);
			if(kickID) {
				msg.channel.send(dropDraftPlayer(editingDraft, kickID));
			}else{
				msg.channel.send("Player not found.")
			}
		}
		var pickformatch = msg.content.match(/\$pickfor ([0-9]+)/i)
		if(pickformatch) {
			let pickID = draftPlayerByID(editingDraft, pickformatch[1]);
			if(pickID) {
				msg.channel.send(pickForPlayer(editingDraft, pickID));
			}else if(!editingDraft.players[pickID].currentPack){
				msg.channel.send("Player doesn't have a pack.");
			}else{
				msg.channel.send("Player not found.")
			}
		}
		//open the draft to other playing
		if(msg.content.match(/\$opendraft/i) && editingDraft.status === "creating") {
			if(!editingDraft.roundArray[1]) {
				msg.channel.send("Add at least one pack with `$addpack` before opening the draft!");
			}else{
				stats.upBribes(1);
				editingDraft.status = "open";
				version.logLater["draft"] = true;
				msg.channel.send(msg.author.username + " has opened a " + generateDraftName(editingDraft) + " draft! Join now with `$joindraft " + editingDraft.name + "`");
				msg.author.send("You have opened the draft! Use `$startdraft` to start the draft once enough players have joined.");
			}
		}
		//close the draft submission and start opening packs
		if(msg.content.match(/\$startdraft/i) && editingDraft.status == "open" && editingDraft.playerIDs.length > 1) {
			stats.upBribes(1);
			startDraft(editingDraft);
		}
	}
	//player draft commands
	if(msg.content.match(/\$draftbots/i))
		msg.channel.send(draftBots.meetTheBots)
	if(msg.content.match(/\$draft ?info/i)) { //drafting info dump
		let defaulttext = "LackeyBot can now host an async draft of any size or setup, allowing custom drafts without getting eight people in one game.\n";
		defaulttext += "During the draft, LackeyBot will automatically handle passing packs and keeping cardpools, and will PM you when your next pack is ready.\n";
		defaulttext += "\nUse `$drafting` to check out the current drafts or `$drafthelp` for drafting commands.";
		msg.channel.send(defaulttext);
		stats.upBribes(1);
	}
	if(msg.content.match(/\$drafting/i)) { //current draft info
		stats.upBribes(1);
		let output = "";
		for(let draft in draftDex.drafts) {
			if(draftDex.drafts[draft].status == "open")
				output += "\n`$joindraft " + draft + "`: " + generateDraftName(draftDex.drafts[draft])
		}
		if(output == "") {
			output = "There aren't any drafts open. You can start one with `$newdraft`";
		}else{
			output = "**Open Drafts**" + output;
		}
		msg.channel.send(output);
	}
	let joindraftMatch = msg.content.match(/\$joindraft ?(\d+)/i)
	if(joindraftMatch) { //join the current draft
		stats.upBribes(1);
		msg.channel.send(addDraftPlayer(draftDex.drafts[joindraftMatch[1]], msg.author.id));
	}
	if(msg.content.match(/\$viewtable/i)) { //view the tableString
		msg.channel.send(showTable(editingDraft, msg.author.id));
		stats.upBribes(1);
	}
	let focusMatch = msg.content.match(/\$focusdraft (\d+)/i)
	if(focusMatch) { //change draft focus
		msg.channel.send(moveDraftPlayerFocus(draftDex.drafts[focusMatch[1]], msg.author.id));
	}
	if(msg.content.match(/\$mydrafts/)) {
		let playerData = draftDex.players[msg.author.id];
		if(playerData) {
			let output = playerData.focus + ": **" + generateDraftName(editingDraft) + "**\n";
			if(playerData.drafts.length > 1)
				output = "__Focus__\n" + output;
			let own = "", play = "";
			for(let d in playerData.drafts) {
				if(draftDex.drafts[playerData.drafts[d]] && draftDex.drafts[playerData.drafts[d]].owner == msg.author.id)
					own += playerData.drafts[d] + ": " + generateDraftName(draftDex.drafts[playerData.drafts[d]]) + "\n";
				if(draftDex.drafts[playerData.drafts[d]] && draftDex.drafts[playerData.drafts[d]].playerIDs.includes(msg.author.id))
					play += playerData.drafts[d] + ": " + generateDraftName(draftDex.drafts[playerData.drafts[d]]) + "\n";
			}
			if(own)
				output += "__Drafts you own__\n" + own;
			if(play)
				output += "__Drafts you're in__\n" + play;
			if(playerData.drafts.length > 1)
				output += "\nUse `$focusdraft #` to make the draft with that # the one commands will apply to."; 
			msg.channel.send(output)
		}else{
			msg.channel.send("You are not in any drafts.")
		}
	}
	//generates a pack of a given set
	let packcheck = msg.content.match(/(\$|\?|!)(open|p1p1|supreme) ([A-Z0-9]+)/i)
	if(packcheck) {
		let library = arcanaData.square.data;
		if(packcheck[1] == "!") {
			library = arcanaData.angle.data;
		}else if(packcheck[1] == "?") {
			library = arcanaData.curly.data;
		}
		let expacName = packcheck[3].toUpperCase();
		if((library.setData.hasOwnProperty(expacName) && library.setData[expacName].packSlots.length > 0) || expacName == "CHAOS") {
			stats.upBribes(1);
			stats.packs++;
			let chaosFlag = 0;
			if(expacName == "CHAOS") {
				let setsArray = [];
				for(let set in library.setData) {
					if(library.setData[set].packSlots.length > 0)
						setsArray.push(set);
				}
				let setCount = setsArray.length;
				let num = Math.floor(Math.random()*setCount);
				expacName = setsArray[num];
				chaosFlag = 1;
			}
			let genPack = generatePack(expacName, library, " -is:bonus");
			if(packcheck[2].toLowerCase() == "open") {
				let embedInfo = buildPackEmbed(library, genPack, expacName, msg.author.id, 0);
				let packEmbed = embedInfo[0];
				packStash[msg.author.id] = embedInfo[1];
				msg.channel.send(packEmbed)
					.then(function(mess){(packStash[msg.author.id].msg = mess.id)
						mess.react(leftArrow)
						.then(() => mess.react(rightArrow))
						.then(() => mess.react(plainText))})
					.catch(function(e){console.log(e)})
			}else if(packcheck[2].toLowerCase() == "supreme"){
				let embedInfo = buildSupremeEmbed(library, psPackSorter(genPack, library), expacName, {pack:1, pick:1, picked:null, picks:[]}, 0);
				let packEmbed = embedInfo[0];
				packStash[msg.author.id] = embedInfo[1];
				msg.channel.send(packEmbed)
					.then(function(mess){
						mess.react(plainText);
						mess.react(leftArrow);
						mess.react(rightArrow);
						packStash[msg.author.id].msg = mess.id;
						if(!scratchPad.supreme)
							scratchPad.supreme = {};
						scratchPad.supreme[msg.author.id] = {};
						scratchPad.supreme[msg.author.id].mID = mess.id;
						scratchPad.supreme[msg.author.id].pool = {};
					})
					.catch(function(e){console.log(e)}) //TODO come back
			}else{
				let embedInfo = buildPickEmbed(library, genPack, expacName);
				let packEmbed = embedInfo[0];
				msg.channel.send(packEmbed)
					.then(mess => mess.react(plainText))
					.catch(function(e){console.log(e)})
			}
		}
	}
	if(msg.content.match(/\$poolsupreme/i)) {
		if(!scratchPad.supreme || !scratchPad.supreme[msg.author.id])
			msg.channel.send("You don't have a Supreme pool.");
		let pool = "**Supreme Pool**\n";
		for(let c in scratchPad.supreme[msg.author.id].pool) {
			pool += scratchPad.supreme[msg.author.id].pool[c] + " " + c.replace(/_.*/, "") + "\n";
		}
		msg.channel.send(pool)
	}
	//show the user their current pack
	if(msg.content.match(/\$viewpack/i)) {
		stats.upBribes(1);
		showPack(editingDraft, msg.author.id);
	}
	//show the user their current pool
	let viewpoolmatch = msg.content.match(/\$viewpool ?(\d+)?/i);
	if(viewpoolmatch) {
		stats.upBribes(1);
		let user;
		if(editingDraft.owner == msg.author.id && viewpoolmatch[1])
			user = draftPlayerByID(editingDraft, viewpoolmatch[1])
		if(!user)
			user = msg.author.id;
		msg.channel.send(showPool(editingDraft, user));
	}
	//show the user appropriate draft commands
	if(msg.content.match(/\$draft ?help/i)) {
		stats.upBribes(1);
		let d;
		if(editingDraft.owner == msg.author.id)
			d = editingDraft;
		msg.channel.send(helpMessage(d));
	}
	if(msg.content.match(/\$drop/i)) {
		stats.upBribes(1);
		if(editingDraft != null && editingDraft.players[msg.author.id]) {
			msg.channel.send(dropDraftPlayer(editingDraft, msg.author.id, true));
		}else{
			msg.channel.send("You are not in a draft, or are focused on the wrong draft. If the later, use `$mydrafts` to find your draft's number and `$focusdraft N` to make it your focus.");
		}
	}
}

exports.dl = dl;
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.initializeDraft = initializeDraft;
exports.focusedDraft = focusedDraft;
exports.buildPackEmbed = buildPackEmbed;
exports.buildDraftEmbed = buildDraftEmbed;
exports.buildPickEmbed = buildPickEmbed;
exports.buildSupremeEmbed = buildSupremeEmbed;
exports.supremePicker = supremePicker;
exports.addBotDrafter = addBotDrafter
exports.generatePack = generatePack
exports.sendDex = function() {
	return draftDex;
}
exports.packCache = function() {
	return packStash;
}