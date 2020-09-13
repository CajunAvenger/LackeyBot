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
const commandNo = 40;

var cards = {};
var instData = {};
var newcards = {};
var setsArray = {};
var tempSetsArray = {};
var cardNameArray = [];
var reprintArray = [];
var uninstallInfo = require('./uninstall.json');
var allprints = {};

function logInst() { //updates instdata.json
	fs.writeFile('msem/instdata.json', JSON.stringify(instData), (err) => {
		if (err) throw err;
		console.log('instData.json written');
		});
}
function msecardsStitcher(channel) { //adds newcards.json to msecards.json and sorts it
	let tempcards = {}; //the combined cards object
	let changelog = ""; //logs changes so we make sure nothing goes wrong
	tempSetsArray["BOT"] = {cards:[], promos:[], tokens:[]}; //add BOT to tempSets
	for(let thisSet in setsArray) { //add the sets in the preset order (alphabetical by normal then by masterpieces)
		if(thisSet.match(/^[0-9]+$/)) {
			tempSetsArray[thisSet + "_numcorr"] = {cards:[], promos:[], tokens:[]};
		}else{
			tempSetsArray[thisSet] = {cards:[], promos:[], tokens:[]};
		}
	}
	tempSetsArray["MSEMAR"] = {cards:[], promos:[], tokens:[]}; //add MSEMAR to tempSets
	for(let thisCard in cards) //add cards, promo, and token arrays to tempSets
		nameStitcher(cards, thisCard);
	for(let thisCard in newcards)
		nameStitcher(newcards, thisCard);
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
	//write new file in human readable fashion
	let words = JSON.stringify(tempcards).replace(/[}],"/g,"},\n	\"");
	fs.writeFile('msem/cards.json', words, (err) => {
		if (err) throw err;
		console.log('msem/cards.json written');
		});
	let uninstall = JSON.stringify(uninstallInfo).replace(/[}],"/g,"},\n	\"");
	fs.writeFile('uninstall.json', uninstall, (err) => {
		if (err) throw err;
		console.log('uninstall.json written');
	});

	console.log(changelog);
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
			for(let thisSet in setsArray) {
				if(thisSet != database[thisCard].setID && cards.hasOwnProperty(database[thisCard].fullName+"_"+thisSet)) {
					reprintArray.push(database[thisCard].fullName+"_"+thisSet);
				}
			}
			//console.log(cardNameArray);
			//console.log(reprintArray);
		}
		if(reprintArray.includes(thisCard))
			reprintArray.splice(reprintArray.indexOf(thisCard), 1)
	}
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
function rebuildCards(database,nameList) { //uses tempSets to create a combined cards.json
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
	cards = require("./msem/cards.json");
	instData = require("./msem/instdata.json");
	newcards = require("./newcards.json");
	setsArray = require("./msem/setData.json");
	msecardsStitcher();
	if(reprintArray[0]) {
		console.log("\nWarning: The following reprints were not updated:");
		for(let print in reprintArray)
			console.log(reprintArray[print]);
		console.log(' ');
	}
}
stitch();