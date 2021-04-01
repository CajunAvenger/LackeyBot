/* Process
 Processes HTML decklists into statDex jsons
*/
var fs = require('fs');
var toolbox = require('./toolbox.js');
const bye = "343475440083664896";
var cards = require('./msem/cards.json');
var archives = [
	'gp_21_03_archive.json',
	'league_21_03_archive.json'
];

function extractPlain (cardString) { //converts HTML deck back to plain text
	let deckFile = "";
	cardString = cardString.replace("<div><b><i>Sideboard","<div 0x Sideboard</div>");
	let cardMatch = cardString.match(/<div [^<]*<\/div>/g);
	for(let card_line in cardMatch) {
		let countMatch = cardMatch[card_line].match(/[0-9]+x [^<]+/);
		if(countMatch != null)
			deckFile += countMatch[0] + "\n";
	}
	deckFile = deckFile.replace("0x Sideboard","\nSideboard:");
	return deckFile;
}
function anglicizeLetters (string){ //convert non-English characters into English equivalents
	string = string.replace(/[âáà]/g,"a");
	string = string.replace(/é/g,"e");
	string = string.replace(/í/g,"i");
	string = string.replace(/ö/g,"o");
	string = string.replace(/[ûú]/g,"u");
	return string;
}
function fuzzySearch (needle,thread,needlescore) { //scoring function for the search
	let charScore = 1; stringBonus = 0.5; newstart = 0;
	if(thread.length > 65) { //for very long names, reduce the score
		charScore = 0.5; stringBonus = 1;
	}
	needleLine: for (var i = 0; i < needle.length; i++) { //for each character in the search string
		for (var j = newstart; j < thread.length; j++){ //
			if(thread.toLowerCase().charCodeAt(j) === needle.toLowerCase().charCodeAt(i)){
				needlescore += charScore;
				if(j == newstart)
					needlescore += stringBonus;
				newstart = j+1;
				continue needleLine;
			}
		}
	}
	return needlescore;
}
function searchInput(database,searchstring,needleWeight) {  //main search function
	if(database.hasOwnProperty(searchstring))
		return searchstring; //if there is an exact match, it sends that
	let bestMatch = ["no",2];
	let splitString = searchstring.match(/([^_|]+)_?([A-Z0-9_]+)?\|?([^\n]+)?/i); //check for set codes and scryfall filters
	for(let entry in database) {
		//if there is an exact cardname match, it sends the first one
		let name = database[entry].cardName;
		let legendName = name.match(/^([A-Za-z0-9']+)/i);
		if(legendName)
			legendName = legendName[1];
		if(name.toLowerCase() === searchstring.toLowerCase() || (database[entry].typeLine.match(/Legendary/) && legendName && legendName.toLowerCase() === searchstring.toLowerCase()))
			return entry;
		if(database[entry].cardName2 !== undefined) {
			name = database[entry].cardName2;
			if(name.toLowerCase() == searchstring.toLowerCase() || legendName && legendName.toLowerCase() === searchstring.toLowerCase())
				return entry;
		}
		name = database[entry].fullName;
		if(name.toLowerCase() == searchstring.toLowerCase())
			return entry;
		var needlescore = 0 //otherwise, prepare to fuzzy search
		if(splitString[2] !== null && splitString[2] !== undefined) {
			if(splitString[2].toUpperCase().match(database[entry].setID))
				needlescore = 4;
			if(splitString[2].match(/PRO/i) && database[entry].rarity == "special")
				needlescore = 4;
			if(splitString[2].match(/MPS/i) && database[entry].rarity == "masterpiece")
				needlescore = 4;
			if(splitString[2].match(/TKN/i) && database[entry].setID == "tokens")
				needlescore = 4;
		}
		if(splitString[1].match(/\.$/) && database[entry].rarity == "special") //check for promo dot
			needlescore += 1;
		if(needleWeight)
			needlescore += eval(needleWeight); //evaluate a passed needleWeight function, may be able to change to needleWeight()
		var trimmedString = splitString[1].match(/^([ ]+)[A-Z]/);
		if(trimmedString !== null)
			splitString[1] = splitString[1].replace(trimmedString[1], "");
		name = anglicizeLetters(name).replace(/-/g," "); //prepare for non-exact matches
		splitString[1] = anglicizeLetters(splitString[1]).replace(/-/g," ");
		let i = fuzzySearch(splitString[1],name,needlescore);
		if(i>bestMatch[1])
			bestMatch=[entry,i]; //whenever a better score is found, score and card name are recorded
	}
	return bestMatch[0];
}
function convertDeck(thisList){
		fs.readFile("./decks"+thisList+".txt", "utf8", function read(err, data) {
		if(!err) {
			let deckString = extractPlain(data);
			let splitDeck = deckString.split("Sideboard");
			let mainMatch = function (string) {
				if(!toolbox.hasValue(string))
					return ["","",""];
				return string.match(/([0-9]+)x ([^\n]+)/g)
			}
			let mainBoard = mainMatch(splitDeck[0]);
			let sideBoard = mainMatch(splitDeck[1]);
			let convertedList = {};
			if(mainBoard && mainBoard[0]) {
				for(let match in mainBoard) {
					let card = mainBoard[match].match(/([0-9]+)x ([^\n]+)/);
					let cardName = searchInput(cards, card[2]);
					if(!convertedList.hasOwnProperty(card[2]))
						convertedList[cardName] = {mainCount: 0, sideCount: 0};
					convertedList[cardName].mainCount += parseInt(card[1]);
				}
			}
			if(sideBoard && sideBoard[0]) {
				for(let match in sideBoard) {
					let card = sideBoard[match].match(/([0-9]+)x ([^\n]+)/);
					let cardName = searchInput(cards, card[2]);
					if(!convertedList.hasOwnProperty(card[2]))
						convertedList[cardName] = {mainCount: 0, sideCount: 0};
					convertedList[cardName].sideCount += parseInt(card[1]);
				}
			}
			fs.writeFile("./decks"+thisList+".json", JSON.stringify(convertedList), function read(err, data) {
				if (err) throw err
				console.log("./decks"+thisList+".json written")
			});
		}else{
			console.log(err);
		}
	});
}



function processJsons(archiveArray) {
	console.log(archiveArray);
	for(let archive in archiveArray) {
		let thisArchive = require('./tourneyArchives/' + archiveArray[archive]);
		let tourneyName = archiveArray[archive].match(/(league|gp|tuc)_[0-9][0-9]_[0-9][0-9]/);
		archives[tourneyName[0]] = (thisArchive);
	}
	for(let archive in archives) {														//for each tournament in the archive...
		for(let player in archives[archive].players) {									//for each player in the tournament...
			if(player != bye){
				for(let list in archives[archive].players[player].lists) {						//for each decklist of that player...
					let thisList = archives[archive].players[player].lists[list]; 					//a decklist from the array
					if(thisList == "")
						thisList = "/" + archive + "/" + archives[archive].players[player].username;
					console.log('trying ' + thisList);
					try{
						let testList = require(`./decks${thisList}.json`);
					}catch(e){
						console.log('converting ' + thisList);
						convertDeck(thisList);
					}
				}
			}
		}
	}
}
function justDecks(){
	fs.readdir("decks/league_21_03", function(err, array) {
		for(let a in array) {
			console.log(`trying ${array[a]}`);
			convertDeck(`/league_21_03/${array[a].replace('.txt', '')}`)
		}
	})
}
justDecks()
//processJsons(archives)
/*
fs.readdir("tourneyArchives",function(err, array) {
	processJsons(array);
});
*/