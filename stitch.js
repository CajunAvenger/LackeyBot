/* Stitch
 Stitches newcards.json into msem/cards.json
 Alerts if not all prints are changed
 Due for some cleanup and updates
 Doesn't delete renamed cards
*/
const http = require("http");
const fs = require("fs");
const express = require('express');
const request = require("request");
const app = express();
const port = process.env.PORT || 4000;
const token = process.env.TOKEN;
const mod_magic = require('./magic.js');
let format = "msem";
if(process.argv[2] != undefined) {
	format = process.argv[2];
}
var cards = {};
var instData = {};
var newcards = {};
var cardsSets = {};
var cardsSetNames = Object.keys(cardsSets);
var legal = require(`./${format}/legal.json`);
var tempSetsArray = {};
var cardNameArray = [];
var reprintArray = [];
var uninstallInfo = require(`./${format}/uninstall.json`);
var allprints = {};

function logInst() { //updates instdata.json
	fs.writeFile(`${format}/instdata.json`, JSON.stringify(instData), (err) => {
		if (err) throw err;
		console.log('instData.json written');
		});
}
function msecardsStitcher(channel) { //adds newcards.json to msecards.json and sorts it
	let tempcards = {}; //the combined cards object
	let changelog = ""; //logs changes so we make sure nothing goes wrong
	tempSetsArray["BOT"] = {cards:[], promos:[], tokens:[]}; //add BOT to tempSets
	for(let thisSet in cardsSets) { //add the sets in the preset order (alphabetical by normal then by masterpieces)
		if(thisSet.match(/^[0-9]+$/)) {
			tempSetsArray[thisSet + "_numcorr"] = {cards:[], promos:[], tokens:[]};
		}else{
			tempSetsArray[thisSet] = {cards:[], promos:[], tokens:[]};
		}
	}
	if(format == "msem")
		tempSetsArray["MSEMAR"] = {cards:[], promos:[], tokens:[]}; //add MSEMAR to tempSets
	for(let thisCard in cards) //add cards, promo, and token arrays to tempSets
		nameStitcher(cards, thisCard);
	for(let thisCard in newcards) {
		colorFixer(thisCard);
		nameStitcher(newcards, thisCard);
	}
	for(let thisSet in tempSetsArray) { //for each set, write the normal cards in order
		if(tempSetsArray[thisSet].cards != []) {
			writtenCards = rebuildCards(tempcards, tempSetsArray[thisSet].cards);
			changelog += writtenCards[0];
			if(writtenCards[1] != 0)
				changelog += "Added " + writtenCards[1] + " cards to " + thisSet+"\r\n";
		}
	}
	for(let thisSet in tempSetsArray) { //for each set, write the special rarity cards in order
		if(tempSetsArray[thisSet].promos != []) {
			writtenCards = rebuildCards(tempcards, tempSetsArray[thisSet].promos);
			changelog += writtenCards[0];
			if(writtenCards[1] != 0)
				changelog += "Added " + writtenCards[1] + " promos to " + thisSet+"\r\n";
		}
	}
	for(let thisSet in tempSetsArray) { //for each set, write the token cards in order
		if(tempSetsArray[thisSet].tokens != []) {
			writtenCards = rebuildCards(tempcards, tempSetsArray[thisSet].tokens);
			changelog += writtenCards[0];
			if(writtenCards[1] != 0)
				changelog += "Added " + writtenCards[1] + " tokens to " + thisSet+"\r\n";
		}
	}
	console.log(changelog);
	return tempcards
}
function colorFixer(card) {				//adds colors to 3+c cards since MSE has trouble with them
	if(newcards[card].color == "" && newcards[card].manaCost.match(/\}\{/i)) {
		let colors = [];
		if(newcards[card].manaCost.match(/W/))
			colors.push("W");
		if(newcards[card].manaCost.match(/U/))
			colors.push("U");
		if(newcards[card].manaCost.match(/B/))
			colors.push("B");
		if(newcards[card].manaCost.match(/R/))
			colors.push("R");
		if(newcards[card].manaCost.match(/G/))
			colors.push("G");
		let order = mod_magic.arrangeColors(colors);
		if(!order.length)
			return;
		let longs = {
			W: "White",
			U: "Blue",
			B: "Black",
			R: "Red",
			G: "Green"
		}
		let out = "{";
		for(let c in order)
			out += longs[order[c]] + "/";
		out = out.replace(/\/$/, "} ");
		newcards[card].color = out;
	}
}
function addPrints(cardObj) {
	let refObj = {};
	let countObj = {};
	for(let card in cardObj) { //run all the cardObj and build a reference object
		if(cardObj[card].setID == "tokens" || cardObj[card].setID == "BOT")
			continue;
		let thisName = cardObj[card].cardName;
		if(cardObj[card].designer == "")
			cardObj[card].designer = cardsSets[cardObj[card].setID].Design;
		if(!refObj.hasOwnProperty(thisName))
			refObj[thisName] = {entries:[], firstNo:999, firstPrint:"", prints:[], rarities:[]};
		refObj[thisName].entries.push(card);
		if(!refObj[thisName].prints.includes(cardObj[card].setID))
			refObj[thisName].prints.push(cardObj[card].setID);
		if(!refObj[thisName].rarities.includes(cardObj[card].rarity))
			refObj[thisName].rarities.push(cardObj[card].rarity);
		if(!cardsSets[cardObj[card].setID].reprint && cardsSets[cardObj[card].setID].releaseNo < parseInt(refObj[thisName].firstNo)) {
			refObj[thisName].firstNo = parseInt(cardsSets[cardObj[card].setID].releaseNo);
			refObj[thisName].firstPrint = card;	
		}
		if(thisName == "Endless Reverie")
			refObj[thisName].firstPrint = "Endless Reverie_ORP";
		if(!countObj.hasOwnProperty(cardObj[card].setID))
			countObj[cardObj[card].setID] = {};
		if(!countObj[cardObj[card].setID].hasOwnProperty(cardObj[card].cardID)) {
			countObj[cardObj[card].setID][cardObj[card].cardID] = card;
		}else{
			console.log(`Number conflict at ${cardObj[card].setID}/${cardObj[card].cardID} between ${countObj[cardObj[card].setID][cardObj[card].cardID]} and ${card}.`)
		}
		
	}
	for(let name in refObj) {
		let formats = [];
		if(format == "msem") {
			if(!legal.modernBan.includes(cardObj[refObj[name].entries[0]].fullName))
				formats.push("msem");
			if(!legal.edhBan.includes(cardObj[refObj[name].entries[0]].fullName))
				formats.push("msedh");
		}else{
			if(!legal.banned.includes(cardObj[refObj[name].entries[0]].fullName))
				formats.push(format);
		}
		for(let entry in refObj[name].entries) {
			let thisEntry = refObj[name].entries[entry];
			cardObj[thisEntry].formats = formats;
			cardObj[thisEntry].prints = refObj[name].prints;
			cardObj[thisEntry].rarities = refObj[name].rarities;
			if(thisEntry != refObj[name].firstPrint && !cardObj[thisEntry].notes.includes("reprint"))
				cardObj[thisEntry].notes.push("reprint");
		}
	}
	return cardObj;
}
function writeTheFile(cardOb) {
	//write new file in human readable fashion
	let words = JSON.stringify(cardOb).replace(/[}],"/g,"},\n	\"");
	fs.writeFile(`${format}/cards.json`, words, (err) => {
		if (err) throw err;
		console.log(`${format}/cards.json written`);
		});
	let uninstall = JSON.stringify(uninstallInfo).replace(/[}],"/g,"},\n	\"");
	fs.writeFile(`${format}/uninstall.json`, uninstall, (err) => {
		if (err) throw err;
		console.log(`${format}/uninstall.json written`);
	});

	console.log("New instigatorID: " + instData.nextInstigatorID);
	logInst();

}
function nameStitcher (database, thisCard) { //creates arrays of card, promo, and token names in tempSets
	let specialcheck = thisCard.match(/_PRO/);
	if(database[thisCard].setID == "tokens" && specialcheck == null){
		let thisSet = thisCard.replace(/[^_]+_TKN_/, "");
		if(thisSet.match(/^[0-9]+$/))
			thisSet += "_numcorr";
		tempSetsArray[thisSet].tokens.push(thisCard);
	}else{
		let tempSet = database[thisCard].setID;
		if(tempSet.match(/^[0-9]+$/))
			tempSet += "_numcorr";
		if(tempSet == "tokens") {
			tempSet = thisCard.replace(database[thisCard].cardName + "_PRO_", "");
			tempSet = tempSet.replace(database[thisCard].cardName + "_TKN_", "");
		}
		if(database[thisCard].rarity == "special"){
			tempSetsArray[tempSet].promos.push(thisCard);
		}else{
			tempSetsArray[tempSet].cards.push(thisCard);
		}
	}
	if(database == newcards) {
		uninstallInfo.push({name: thisCard, setID: database[thisCard].setID, cardID: database[thisCard].cardID});
		if(!cardNameArray.includes(database[thisCard].fullName)) {
			cardNameArray.push(database[thisCard].fullName);
			if(majorChange(thisCard)) {
				for(let thisSet in cardsSets) {
					if(thisSet != database[thisCard].setID && cards.hasOwnProperty(database[thisCard].fullName+"_"+thisSet)) {
						reprintArray.push(database[thisCard].fullName+"_"+thisSet);
					}
				}
			}
			//console.log(cardNameArray);
			//console.log(reprintArray);
		}
		if(reprintArray.includes(thisCard))
			reprintArray.splice(reprintArray.indexOf(thisCard), 1)
	}
}
function majorChange(name) { //checks if a card change is likely to have affected other cards
	let oldCard = cards[name];
	let newCard = newcards[name];
	if(!oldCard)
		return false; //first printing
	if(oldCard.rulesText != newCard.rulesText)
		return true; //rulestext change
	if(oldCard.typeLine != newCard.typeLine)
		return true; //type change
	if(oldCard.power != newCard.power)
		return true; //power change
	if(oldCard.toughness != newCard.toughness)
		return true; //toughness change
	if(oldCard.loyalty != newCard.loyalty)
		return true; //loyalty change
	if(oldCard.manaCost != newCard.manaCost)
		return true; //mana cost change
	if(newCard.hasOwnProperty('cardName2')){
		if(oldCard.ruleText2 != newCard.ruleText2)
			return true; //rulestext change
		if(oldCard.typeLine2 != newCard.typeLine2)
			return true; //type change
		if(oldCard.power2 != newCard.power2)
			return true; //power change
		if(oldCard.toughness2 != newCard.toughness2)
			return true; //toughness change
		if(oldCard.loyalty2 != newCard.loyalty2)
			return true; //loyalty change
		if(oldCard.manaCost2 != newCard.manaCost2)
			return true; //mana cost change
	}
	//otherwise, probably a new print or an art change or a rarity shift that doesn't affect the other versions
	return false;
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
function rebuildCards(database, nameList) { //uses tempSets to create a combined cards.json
	if(nameList[0] != "no") {
		for(var i=0; i<nameList.length; i++)
			nameList[i] = aposCorrect(nameList[i], "remove");
		nameList.sort();
		for(var i=0; i<nameList.length; i++)
			nameList[i] = aposCorrect(nameList[i], "revert");
	}
	let changelog = "";
	let addedCards = 0;
	for(var i = 0; i < nameList.length; i++) {
		if(nameList[i] != nameList[i-1]) {
			thisName = nameList[i];
			let thisEntry = "";
			let thisMultiverse = "";
			if(cards[thisName] != undefined)
				thisEntry = cards[thisName];
			if(newcards[thisName] != undefined) {
				if(thisEntry != "") {
					changelog += "Replaced " + thisName + "\n";
					thisMultiverse == thisEntry.instigatorID;
				}else{
					addedCards += 1;
				}
				if(thisMultiverse == "") {
					thisMultiverse = instData.nextInstigatorID;
					instData.nextInstigatorID += 1;
				}
				thisEntry = newcards[thisName];
				thisEntry.instigatorID = thisMultiverse;
			}
			if(cards[thisName] == undefined && newcards[thisName] == undefined)
				changelog += "Card not found: " + thisName +"\n";
			database[thisName] = thisEntry;
		}
	}
	return [changelog,addedCards];
}
function stitch() {
	cards = require(`./${format}/cards.json`);
	instData = require(`./${format}/instdata.json`);
	newcards = require("./newcards.json");
	cardsSets = require(`./${format}/setData.json`);
	let newObj = msecardsStitcher();
	newObj = addPrints(newObj);
	writeTheFile(newObj);
	if(reprintArray[0]) {
		console.log("\nWarning: The following reprints were not updated:");
		for(let print in reprintArray)
			console.log(reprintArray[print]);
		console.log(' ');
	}
}
stitch();