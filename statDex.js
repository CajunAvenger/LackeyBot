/*
 statDex
 Compiles all the stats data from MSEM tournaments
 Includes several ways to analyze the data
 Can see how being played with or against other cards influences winrates
 Or pinpoint times to watch how win and play rates change after a card change
*/

const statDexEnabled = [												//channels with statDex enabled
	"765687542036561930",
	"755707492947722301",
	"765707235434823730"
]
var arcana = require('./arcana.js');									//can work with card fields
var archiveArray = [];													//holds array of tourneyArchive files
var baseFilters = {after:2004};											//default to after May Madness update
var blankDex = {cards:{}, players:{}, tournaments:{}, decklists:{}, global:{matches:0, decks:0, playedCards:0}};
const bye = "343475440083664896"; 										//bye player id
var cardBase = arcana.msem.cards;
var cardBanned = arcana.msem.legal.modernBan;
const config = require("./config/lackeyconfig.js");					//for logging into Discord
var eris = require('./eris.js');							//other Discord stuff
var fs = require('fs');
var fuzzy = require('./fuzzy.js');										//fuzzy searching for fun and profit
var globalPlayrates = null;
var skipThese = function(){
	return false; //don't skip anything by default
};
var statDex = {															//a baby statDex
	cards:{},															//card data, holds historic W-L, decks that contain them, matches that contain them
	players:{},															//player data, holds historic W-L, their decks, and their matches
	decklists:{},														//decklist data, holds cards and their counts, their player, and their tournament
	tournaments:{},														//tournament data, each holds array of decks submitted to it
	global:{matches:0, decks:0, playedCards:0}							//some useful global counts
	};
var toolbox = require('./toolbox.js');									//personal assistance scripts
var statDexPreBuilt = statDex;
try{																	//load saved statDex if we have it
	statDexPreBuilt = require('./statDex.json')
}catch(e){
	console.log('No prebuild statDex available.')
}
//setup
function loadArchives(cb) { 											//reads the archived tournament files
	fs.readdir("tourneyArchives",function(err, array) {
		archiveArray = array;
		if(cb)
			cb(array);
	});
}
function fixFiles(fixArray) { 											//update older/broken files
	let fix = "files";
	let replaces = gatherRenames();
	for(let ar in fixArray){
		let tourney = fixArray[ar].replace(/\.json$/, "");
		if(fix == "fields") {
			var archive = require('./tourneyArchives/'+tourney+'.json');
			//scripts go here
			fs.writeFile('./tourneyArchives/'+tourney+'.json', JSON.stringify(archive), function(err) {
				if(err)
					throw err;
				console.log(tourney + ' fixed');
			});
		}else if(fix == "files"){
			fs.readFile('./tourneyArchives/'+tourney+'.json', 'utf8', function(err, data){
				//scripts go here
				for(let r in replaces) {
					let swap = new RegExp(r, 'g');
					data = data.replace(swap, replaces[r]);
				}
				fs.writeFile('./tourneyArchives/'+tourney+'.json', data, function(err) {
					if(err)
						throw err;
					console.log(tourney + ' fixed');
				});
			});
		}
	}
	if(fix == "files") {
		console.log(replaces)
		fs.readFile('./statDex.json', 'utf8', function(err, data){
			for(let r in replaces) {
				let swap = new RegExp(r, 'g');
				data = data.replace(swap, replaces[r]);
			}
			fs.writeFile('./statDex.json', data, function(err) {
				if(err)
					throw err;
				console.log('statDex fixed');
			});
		});
	}
}
function gatherRenames() {												//search for cards that need renames
	let replaceObj = { //replace old names with new ones
		"Hallowed Dungeon_L": "Legacy Foundations_L",
		"Mystic Spire_L": "Horizon of Origins_L",
		"Hidden Hovel_L": "Deserted Trail_L",
		"Valiant's Stronghold_L": "Imperial Barracks_L",
		"Distant Domains_L": "Flourishing Waterways_L",
		"Plaxolotl_KOD": "Plaxolotl Pyari_KOD"
	}
	for(let c in statDexPreBuilt.cards) { //find original prints
		if(replaceObj[c])
			continue;
		let card = arcana.msem.cards[c];
		let rename = "";
		if(card.notes.includes("reprint")) {
			for(let print in card.prints) {
				let test = c.replace(/_[A-Z0-9_]+/, "_" + card.prints[print]);
				if(arcana.msem.cards[test] && !arcana.msem.cards[test].notes.includes("reprint"))
					rename = test;
			}
			if(!rename) { //we're on a reprint and it was originally printed somewhere weird
				for(let c2 in arcana.msem.cards) {
					if(arcana.msem.cards[c2].fullName == card.fullName && !arcana.msem.cards[c2].notes.includes("reprint")) {
						rename = c2;
						break;
					}
				}
			}
			if(!rename) { //everything is reprints or something went weird
				console.log(`Reprint error at card ${c}`);
			}else{
				replaceObj[c] = rename;
			}
		}
	}
	return replaceObj;
}
function findFirstPrint(card) {											//gets first print of a card
	if(card.fullName == "Endless Reverie")
		return "Endless Reverie_ORP";
	let hold = [999, ""];
	let cardSets = arcana.msem.setData;
	for(let p in card.prints) {
		let setID = card.prints[p];
		if(!cardSets[setID].reprint && parseInt(cardSets[setID].releaseNo) < hold[0]) {
			hold = [cardSets[setID].releaseNo, setID]
		}
	}
	return fuzzy.searchCards(arcana.msem, card.fullName + "_" + hold[1]);
}
function printFixer(dex) {
	for(let deck in dex.decklists) {
		for(let cardName in dex.decklists[deck].cards) {
			if(!dex.cards.hasOwnProperty(cardName)) { //card without a fp name
				let fpName = findFirstPrint(cardBase[cardName]);
				dex.decklists[deck].cards[fpName] = dex.decklists[deck].cards[cardName];
				delete dex.decklists[deck].cards[cardName];
			}
		}
	}
}
function fuseEntries(dex, card1, card2) {								//combines two entries, for fixing renames, printing errors
	//raw numbers
	console.log(card1 + " to " + card2)
	if(dex.cards[card1] && !dex.cards[card2]) {
		console.log("Can't fuse to nonexistent card " + card1);
		return;
	}	
	dex.cards[card1].mainCount += dex.cards[card2].mainCount;
	dex.cards[card1].sideCount += dex.cards[card2].sideCount;
	dex.cards[card1].setCount += dex.cards[card2].setCount;
	dex.cards[card1].matchWins += dex.cards[card2].matchWins;
	dex.cards[card1].matchLoss += dex.cards[card2].matchLoss;
	dex.cards[card1].matchDraw += dex.cards[card2].matchDraw;
	//copy over decklists and edit existing lists
	for(let d in dex.cards[card2].decks) {
		if(!dex.cards[card1].decks.includes(dex.cards[card2].decks[d]))
			dex.cards[card1].decks.push(dex.cards[card2].decks[d])
		let decklist = dex.decklists[dex.cards[card2].decks[d]];
		if(decklist.cards[card2]) {
			decklist.cards[card1] = decklist.cards[card2];
			delete decklist.cards[card2];
		}
	}
	//copy over the match numbers
	for(let t in dex.cards[card2].matches){
		let list = dex.cards[card2].matches[t];
		if(!dex.cards[card1].matches[t])
			dex.cards[card1].matches[t] = [];
		for(let m in list) {
			if(!dex.cards[card1].matches[t].includes(list[m]))
				dex.cards[card1].matches[t].push(list[m]);
		}
	}
	delete dex.cards[card2];
}
function addMatchesToLists(dex, time) {										//adds matches to old decklists
	for(let t in dex.tournaments){
		if(!t.match(time)) //update here
			continue;
		let thisTourney = require(`./tourneyArchives/${t}_archive.json`);
		for(let match in thisTourney.matches) {
			for(let p in thisTourney.matches[match].players) {
				let thisPlayer = thisTourney.matches[match].players[p];
				if(thisPlayer.id != bye) {
					console.log(thisPlayer.list.replace('.txt', '.json'));
					let thatList = dex.decklists[thisPlayer.list.replace('.txt', '.json')];
					toolbox.addIfNew(thatList, "matches", []);
					thatList.matches.push(parseInt(match)+1);
				}
			}
		}
	}
}
function givePlayersUsernames(){										//update player usernames
	for(let player in statDexPreBuilt.players) {
		statDexPreBuilt.players[player].username = eris.pullUsername(player);
	}
	fs.writeFile('statDex.json', JSON.stringify(statDexPreBuilt), function(){
		console.log('done');
	})
}
function statPatcher() {												//update player usernames without discord 
	for(let p in statDexPreBuilt.players) {
		if(statDexPreBuilt.players[p].username == undefined) {
			let listName = statDexPreBuilt.players[p].lists[0];
			if(listName.match(/^\/gp/)) {
				statDexPreBuilt.players[p].username = listName.replace(/\/[^\/]+\//, "")
			}else{
				statDexPreBuilt.players[p].username = listName.replace(/\/[^\/]+\//, "").replace(/\d$/, "")
			}
		}
	}
	fs.writeFile('statDex.json', JSON.stringify(statDexPreBuilt), function(){
		console.log('done');
	})
}

//build dexes
function updateStatDex(dex, decksArray) { 								//builds a statDex from an array of decklist folders
	var archives = {};
	var names = {}
	for(let archive in decksArray) {
		let thisArchive = require('./tourneyArchives/' + decksArray[archive]);
		let tourneyName = decksArray[archive].match(/(league|gp|tuc)_[0-9][0-9]_[0-9][0-9]/);
		archives[tourneyName[0]] = (thisArchive);
		names[tourneyName[0]] = decksArray[archive];
		dex.tournaments[tourneyName[0]] = [];
	}
	//go through the archives, grab each decklist
	//count its W-L, winLists, and lossLists
	//convert deck to json, then apply W-L to each card in them
	for(let archive in archives) {																//for each tournament in the archive...
		console.log(`starting ${archive}`)
		for(let player in archives[archive].players) {											//for each player in the tournament...
			if(player != bye){
				for(let list in archives[archive].players[player].lists) {						//for each decklist of that player...
					let wins = 0;
					let losses = 0;
					let draws = 0;
					let winLists = []; //the lists the deck beat
					let lossLists = []; //the lists the deck lost to
					let allMatches = [];
					let thisList = archives[archive].players[player].lists[list]; 				//a decklist from the array
					if(thisList == "")
						thisList = "/" + archive + "/" + archives[archive].players[player].username;
					thisList = thisList.replace("_archive", "");
					thisList = thisList.replace(".txt", ""); //change file types from HTML to JSON lists
					let thoseMatches = archives[archive].players[player].matches[list];			//the set of matches for that run
					for(let match in thoseMatches) {											//for each match that decklist was in...
						dex.global.matches++;
						thisMatch = archives[archive].matches[thoseMatches[match]-1];			//the match object
						allMatches.push(thoseMatches[match]);
						if(thisMatch.winner == player) {
							wins++;
							winLists.push(thisMatch.players[1].list); //push the loser's list
						}else if(thisMatch.winner == "") {
							draws++;
						}else{
							losses++;
							lossLists.push(thisMatch.players[0].list); //push the winner's list
						}
					}//end of matches in a list
					//convert the list, extract plain, feed list
					try{
						let convertedList = require("./decks"+thisList+".json");
						for(let card in convertedList) {											//for each card in that decklist...
							let cardName = addNewStatDexCard(dex, card);
							dex.cards[cardName].mainCount += convertedList[card].mainCount;
							dex.cards[cardName].sideCount += convertedList[card].sideCount;
							dex.cards[cardName].setCount += Math.min(Math.floor(0.25*(convertedList[card].mainCount + convertedList[card].sideCount)), 1);
							dex.cards[cardName].decks.push(thisList);
							dex.cards[cardName].matchWins += wins;
							dex.cards[cardName].matchLoss += losses;
							dex.cards[cardName].matchDraw += draws;
							for(let aMatch in allMatches) {
								if(!dex.cards[cardName].matches.hasOwnProperty(archive))
									dex.cards[cardName].matches[archive] = [];
								if(!dex.cards[cardName].matches[archive].includes(allMatches[aMatch]))
									dex.cards[cardName].matches[archive].push(allMatches[aMatch]);
							}
						}//end of cards in list
						if(!dex.players.hasOwnProperty(player)) {
							dex.players[player] = {};
							dex.players[player].wins = 0;
							dex.players[player].losses = 0;
							dex.players[player].matches = {};
							dex.players[player].lists = [];
						}
						dex.players[player].wins += wins;
						dex.players[player].losses += losses;
						for(let aMatch in allMatches) {
							if(!dex.players[player].matches.hasOwnProperty(archive))
								dex.players[player].matches[archive] = [];
							if(!dex.players[player].matches[archive].includes(allMatches[aMatch]))
								dex.players[player].matches[archive].push(allMatches[aMatch]);
						}
						if(!dex.players[player].lists.includes(thisList))
							dex.players[player].lists.push(thisList);
						toolbox.addIfNew(dex.decklists, thisList, {cards:convertedList, player:player, tournament:archive})
						if(archives[archive].players[player].rank)
							dex.decklists[thisList].rank = archives[archive].players[player].rank;
						if(!dex.tournaments[archive].includes(thisList))
							dex.tournaments[archive].push(thisList);
					}catch(e){
						console.log(e)
						console.log("Missing file at " + thisList)
						console.log()
						continue;
					}
				}//end of lists in a player
			}//player isn't bye
		}//end of players in an archive
		let tName = names[archive];
		integrateDecklists(dex, [tName]);
		addMatchesToLists(dex, tName.match(/[^_\/]+_[0-9][0-9]_[0-9][0-9]/));
	}//end of archives
	return dex;
}
function generateFilteredDex(filters) { 								//returns a smaller statDex following certain filters
	let filteredArray = [];
	for(let folder in archiveArray) {
		if(tourneyFilter(archiveArray[folder], filters))
			filteredArray.push(archiveArray[folder]);
	}
	return updateStatDex(filteredArray);
}
function addNewStatDexCard(dex, card) { 								//adds a new card to statDex
	let statName = fuzzy.searchCards(arcana.msem, card)
	if(arcana.msem.cards[statName].notes.includes("reprint"))
		statName = findFirstPrint(arcana.msem.cards[statName])
	if(dex !== null && !dex.cards.hasOwnProperty(statName)) {
		dex.cards[statName] = {};
		dex.cards[statName].mainCount = 0;
		dex.cards[statName].sideCount = 0;
		dex.cards[statName].setCount = 0;
		dex.cards[statName].decks = [];
		dex.cards[statName].matchWins = 0;
		dex.cards[statName].matchLoss = 0;
		dex.cards[statName].matchDraw = 0;
		dex.cards[statName].matches = {};
		dex.global.playedCards++;
	}
	return statName;
}
function integrateDecklists(dex, archiveArray) {						//add decklists to statDex
	if(!dex.decklists)
		dex.decklists = {};
	if(!dex.tournaments)
		dex.tournaments = {};
	console.log('Loading decklists');
	for(let ar in archiveArray) {										//for each tourney
		let tourney = archiveArray[ar].replace(/_archive\.json/, "");
		console.log(`starting ${tourney}`)
		let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
		if(!dex.tournaments.hasOwnProperty(tourney))					//add an array of decklists
			dex.tournaments[tourney] = [];
		for(let player in thisTourney.players) {
			if(player == bye)
				continue;
			thisPlayer = thisTourney.players[player];
			for(let list in thisPlayer.lists) {							//adding the decklists to a few places
				let thisList = thisPlayer.lists[list].replace('.txt', '.json');
				if(thisList == "")
					thisList = `/${tourney}/${thisPlayer.username}.json`
				if(!thisList.match(/\.json$/))
					thisList += '.json';
				if(!thisList.match(/^\//))
					thisList = "/" + thisList;
				if(!dex.decklists.hasOwnProperty(thisList))				//dex.decklists contains cards and info to point to players
					dex.decklists[thisList] = {};
				dex.decklists[thisList].cards = {}
				let temp = require(`./decks${thisList}`); //get the cards;
				for(let card in temp) {
					let newName = addNewStatDexCard(null, card);
					dex.decklists[thisList].cards[newName] = temp[card];//translate because decklists are out of date
				}
				dex.decklists[thisList].player = player;				//save the pilot so we can go from here to elsewhere
				dex.decklists[thisList].tournament = tourney;			//save the tourney so we can go from here to elsewhere
				if(!dex.tournaments[tourney].includes(thisList))
					dex.tournaments[tourney].push(thisList)				//save it to its tourney array so we can get here from there
				if(!dex.players[player].hasOwnProperty('lists'))
					dex.players[player].lists = [];
				if(!dex.players[player].lists.includes(thisList))		//save it to its player so we can get here from there
					dex.players[player].lists.push(thisList);
			}
		}
	}
}
function rebuildDex() {													//build the full dex from scratch
	let now = new Date().getTime();
	loadArchives(function(array) {
		let newDex = updateStatDex({cards:{}, players: {}, decklists:{}, tournaments:{}, global:{}}, array);
		fs.writeFile('./statDexUpdate.json', JSON.stringify(newDex), function(){
			console.log('done');
			let later = new Date().getTime();
			console.log(later-now);
		})
	});
}
//compile final data
function statDexStats(dex) { 											//writes card spreadsheet of statDex
	let output = "Card Name 	Wins	Losses	Matches	WinRate	MainCount	SideCount\r\n";
	for(let card in dex.cards) {
		output += card + "	"
		output += dex.cards[card].matchWins + "	"
		output += dex.cards[card].matchLoss + "	"
		output += (dex.cards[card].matchWins + dex.cards[card].matchLoss) + "	"
		output += dex.cards[card].matchWins / (dex.cards[card].matchWins + dex.cards[card].matchLoss) + "	"
		output += dex.cards[card].mainCount + "	"
		output += dex.cards[card].sideCount + "	"
		output += "\r\n";
	}
	return output;
}
function playersWinRate(dex) { 											//writes player spreadsheet of statDex
	let output = "Player	Wins	Losses	Matches	WinRate\r\n";
	for(let player in dex.players) {
		output += dex.players[player].username + "	";
		output += dex.players[player].wins + "	";
		output += dex.players[player].losses + "	";
		output += (dex.players[player].wins + dex.players[player].losses) + "	";
		output += dex.players[player].wins / (dex.players[player].wins + dex.players[player].losses) + "\r\n";
	}
	return output;
}
function sortComparedData(dex,array,minMatches,filters,skipThese,comp) {//sorts cards by given compare function, can enforce minimum #of matches to count
	let filteredWRs = {};
	let cullSlots = [];
	for(let card in array) {
		filteredWRs[array[card]] = comp(dex, array[card], filters);
		if(filteredWRs[array[card]].matches < minMatches || (skipThese(array[card])))
			cullSlots.push(card);
		filteredWRs[array[card]].wr = winValToWR(filteredWRs[array[card]])
	}
	cullSlots.reverse();
	for(let card in cullSlots)
		array.splice(cullSlots[card], 1)
	array.sort(function(a, b) {
		let result = filteredWRs[b].wr - filteredWRs[a].wr;
		if(result == 0)
			result = filteredWRs[b].wins - filteredWRs[a].wins;
		return result;
	});
	return [array, filteredWRs];
}
//league compiler
function plainTextDecklist(listObj) {									//converts decklist object to plaintext
	let mb = "", sb = "";
	for(let card in listObj) {
		let thisCard = listObj[card];
		if(thisCard.mainCount > 0)
			mb += `${thisCard.mainCount} ${pullSet(card)}\n`
		if(thisCard.sideCount > 0)
			sb += `${thisCard.sideCount} ${pullSet(card)}\n`
	}
	let fullList = mb
	if(sb != "")
		fullList += "\nSideboard:\n" + sb;
	return fullList;
}
function compileLeagueData(dex, archive) {								//compiles a league into one doc
	let output = "League Compilation\n\n";
	let oldMatchBase = require('./oldmatchDex.json').league;
	for(let player in oldMatchBase.players) {
		let thisPlayer = dex.players[player];
		for(let run in oldMatchBase.players[player].runs) {
			let thisRun = oldMatchBase.players[player].runs[run];
			if(thisRun.matches.length == 0)
				continue;
			let listLink = thisRun.dropLink.replace('.txt', '.json');
			let thisList = dex.decklists[listLink];
			let recordObj = recordFinder(archive, thisRun.matches, player)
			let record = recordObj.wins + "-" + recordObj.losses;
			if(recordObj.draws)
				record += "-" + recordObj.draws; 
			output += `${thisPlayer.username}: ${thisRun.deckName} (${record})\n`;
			output += plainTextDecklist(thisList.cards);
			output += "\n\n";
		}
	}
	return output;
}
function compileGPData(dex, archiveName) {								//compiles a GP into one doc
	let archive = require(`./tourneyArchives/${archiveName}_archive.json`);
	
}
//analyze the dex
function filteredWinRate(dex, card, filters) { 							//returns general card win rate
	let refCard = dex.cards[card];
	let results = {matches:0, wins:0, losses:0};
	if(!refCard) {
		//console.log(card); //maybe
		return results;
	}
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters)){
			if(tourneyFilter(tourney, filters)) {
				let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
				for(let match in refCard.matches[tourney]) {
					let thisMatch = thisTourney.matches[refCard.matches[tourney][match]-1];
					for(let player in thisMatch.players) {
						if(matchFilter(thisMatch, thisMatch.players[player].id, filters, card)) {
							let list = thisMatch.players[player].list.replace('.txt', '.json');
							if(refCard.decks.includes(list)) {
								results.matches++;
								if(thisMatch.players[player].id == thisMatch.winner) {
									results.wins++;
								}else{
									results.losses++;
								}
							}
						}
					}
				}
			}
		}
	}
	
	return results;
}
function playerWinRate(dex, player, filters){							//returns winrate for a player
	let score = {wins:0, losses:0, matches:0, draws:0}
	for(let tourney in dex.players[player].matches) {
		if(tourneyFilter(tourney, filters)) {
			let thisTourney = require(`./tourneyArchives/${tourney}_archive.json`);
			for(let match in dex.players[player].matches[tourney]) {
				let matchNo = dex.players[player].matches[tourney][match] - 1;
				let thisMatch = thisTourney.matches[matchNo];
				score.matches++;
				if(thisMatch.winner == player) {
					score.wins++;
				}else if(thisMatch.winner == "") {
					score.draws++;
				}else{
					score.losses++;
				}
			}
		}
	}
	return score;
}
function pairedWinRate(dex, card1, card2, matchFunction, filters) { 	//finds winrates of two cards in a match
	let scores = {matches:0, wins:0, losses:0};
	if(!dex.cards.hasOwnProperty(card1) || !dex.cards.hasOwnProperty(card2))
		return scoreArray;
	let refCard = dex.cards[card1];
	let pairCard = dex.cards[card2];
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters) && pairCard.matches.hasOwnProperty(tourney)) {
			let pairedMatches = toolbox.arrayDuplicates(refCard.matches[tourney], pairCard.matches[tourney]);
			let scores2 = matchFunction(dex, card1, card2, tourney, pairedMatches, filters);
			scores.wins += scores2.wins;
			scores.losses += scores2.losses;
			scores.matches += scores2.wins+scores2.losses;
		}
	}
	return scores;
}
function vsScore(dex, card1, card2, tourney, pairedMatches,filters) {	//finds winrates of one card vs another
	let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
	let thoseMatches = thisTourney.matches;
	let scores = {matches:0, wins:0, losses:0, mirrors:0};
	for(let aMatch in pairedMatches) {
		if(matchFilter(thisTourney.matches[pairedMatches[aMatch]-1], "both", filters, card1)) {
			let thisMatch = thisTourney.matches[pairedMatches[aMatch]-1];
			let player1 = thisMatch.players[0];
			let player2 = thisMatch.players[1];
			let winner = thisMatch.winner;
			let win, lose;
			if(winner != player1.id && winner != player2.id)
				continue; //tie
			let winList = player1.list.replace('.txt', '.json'), loseList = player2.list.replace('.txt', '.json')
			if(winner == player2.id)
				winList = player2.list.replace('.txt', '.json'), loseList = player1.list.replace('.txt', '.json');
			if(dex.cards[card1].decks.includes(winList) && dex.cards[card2].decks.includes(loseList))
				win = true;
			if(dex.cards[card1].decks.includes(loseList) && dex.cards[card2].decks.includes(winList))
				lose = true;
			//check they're in opposite decks
			if(win)
				scores.wins++;
			if(lose)
				scores.losses++;
			if(win && lose)
				scores.mirrors++;
		}
	}
	return scores;
}
function pairedScore(dex,card1,card2,tourney,pairedMatches,filters) {	//finds winrates of one card when paired with another
	let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
	let thoseMatches = thisTourney.matches;
	let scores = {matches:0, wins:0, losses:0, mirrors:0};
	for(let aMatch in pairedMatches) {
		if(matchFilter(thisTourney.matches[pairedMatches[aMatch]-1], "both", filters, card1)) {
			let thisMatch = thisTourney.matches[pairedMatches[aMatch]-1];
			let player1 = thisMatch.players[0];
			let player2 = thisMatch.players[1];
			let winner = thisMatch.winner;
			let win, lose;
			if(winner != player1.id && winner != player2.id)
				continue; //tie
			let winList = player1.list.replace('.txt', '.json'), loseList = player2.list.replace('.txt', '.json')
			if(winner == player2.id)
				winList = player2.list.replace('.txt', '.json'), loseList = player1.list.replace('.txt', '.json');
			if(dex.cards[card1].decks.includes(winList) && dex.cards[card2].decks.includes(winList))
				win = true;
			if(dex.cards[card1].decks.includes(loseList) && dex.cards[card2].decks.includes(loseList))
				lose = true;
			//check they're in the same deck
			if(win)
				scores.wins++;
			if(lose)
				scores.losses++;
			if(win && lose)
				scores.mirrors++;
		}
	}
	return scores;
}
function unpairedWinRate(dex, card1, card2, filters) { 					//finds winrates of card 1 played without card 2
	let score = {matches:0, wins:0, losses:0};
	if(!dex.cards.hasOwnProperty(card1) || !dex.cards.hasOwnProperty(card2))
		return score;
	let refCard = dex.cards[card1];
	let pairCard = dex.cards[card2];
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters)) {
			let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
			for(let match in refCard.matches[tourney]) {
				let thisMatch = thisTourney.matches[refCard.matches[tourney][match]-1];
				if(thisMatch.winner != thisMatch.players[0].id && thisMatch.winner != thisMatch.players[1].id)
					continue; //skip ties
				for(let player in thisMatch.players) {
					if(matchFilter(thisMatch, thisMatch.players[player].id, filters, card1)) {
						let list = thisMatch.players[player].list.replace('.txt', '.json');
						if(refCard.decks.includes(list) && !pairCard.decks.includes(list)){
							score.matches++;
							if(thisMatch.players[player].id == thisMatch.winner) {
								score.wins++;
							}else{
								score.losses++;
							}
						}
					}
				}
			}
		}
	}
	return score;
}
function playerFace (p1id, p2id, dex, filters) { 						//find wins of player 1 vs player 2
	let player1 = dex.players[p1id];
	let player2 = dex.players[p2id];
	let p1w = 0;
	let p2w = 0;
	let draw = 0;
	let p3 = {wins:0, loss:0, draw:0}
	for(let tourney in player1.matches) {
		if(tourneyFilter(tourney, filters)) {
			let tFile = require(`./tourneyArchives/${tourney}_archive.json`);
			for(let match in player1.matches[tourney]) {
				if(player2.matches.hasOwnProperty(tourney) && player2.matches[tourney].includes(player1.matches[tourney][match])) {
					let theMatch = tFile.matches[player1.matches[tourney][match]-1];
					if(theMatch.winner == p1id) {
						p1w++
					}else if(theMatch.winner == p2id) {
						p2w++;
					}else{
						draw++;
					}
				}else{
					let theMatch = tFile.matches[player1.matches[tourney][match]-1];
					if(theMatch.winner == p1id) {
						p3.wins++
					}else if(theMatch.winner == "") {
						p3.draw++;
					}else{
						p3.loss++;
					}
				}
			}
		}
	}
	p3.matches = p3.wins + p3.loss + p3.draw;
	p4 = {
		wins: p1w,
		losses: p2w,
		draws: draw,
		matches: p1w+p2w+draw
	}
	return [p1w, p2w, draw, p3, p4]
}
function playerComboCard(dex, player, card, filters) { 					//finds winrate of a card when played by a particular player vs everyone else
	let playerScore = {matches:0, wins:0, losses:0};
	let othersScore = {matches:0, wins:0, losses:0};
	let refCard = dex.cards[card];
	let refPlayer = dex.players[player];
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters)) {
			let archive = require(`./tourneyArchives/${tourney}_archive.json`)
			for(let match in refCard.matches[tourney]){
				let refMatch = archive.matches[refCard.matches[tourney][match]-1];
				if(matchFilter(refMatch, "both", filters, card)) {
					for(let play in refMatch.players) {
						let thisPlayer = refMatch.players[play];
						if(refCard.decks.includes(thisPlayer.list.replace('.txt','.json'))) { //in this list yaay
							let inputScore = playerScore;				//if this is the chosen player
							if(thisPlayer.id != player) {				//if this is someone else
								inputScore = othersScore;
							}
							if(refMatch.winner == thisPlayer.id) {		//if this is the winner
								inputScore.matches++;					//tick up their matches and wins
								inputScore.wins++;
							}else{
								inputScore.matches++;
								inputScore.losses++;
							}
						}
					}
				}
			}
		}
	}
	return [playerScore, othersScore]
}
function playerVsCard(dex, player, card, filters) { 					//finds winrate of a card when played against a particular player vs everyone else
	let playerScore = {matches:0, wins:0, losses:0};
	let othersScore = {matches:0, wins:0, losses:0};
	let refCard = dex.cards[card];
	let refPlayer = dex.players[player];
	for(let tourney in refCard.matches) {												//in each of this card's tournaments
		if(tourneyFilter(tourney, filters)) {												//that pass the filter
			let archive = require(`./tourneyArchives/${tourney}_archive.json`)					//load the match data
			for(let match in refCard.matches[tourney]){									//in each match this card is in
				let refMatch = archive.matches[refCard.matches[tourney][match]-1];
				if(matchFilter(refMatch, "both", filters, card)) {
					let hasPlayer = (refMatch.players[0].id == player || refMatch.players[1].id == player); //is the given player in this match?
					for(let play in refMatch.players) {										//for each player in that match
						let thisPlayer = refMatch.players[play];
						if(refCard.decks.includes(thisPlayer.list.replace('.txt','.json'))) {//that is playing this card
							if(thisPlayer.id == player){ 										//if it's being played by the given player
								if(refMatch.winner == thisPlayer.id){								//and they won
									othersScore.matches++; 												//chalk a loss for others
									othersScore.losses++;
								}else{ 																//and they lost
									othersScore.matches++; 												//chalk a win for others
									othersScore.wins++;
								}
							}else if(hasPlayer){ 												//if it's being played against the given player
								if(refMatch.winner == thisPlayer.id){ 								//and the other player won
									playerScore.matches++; 												//chalk a loss for given player
									playerScore.losses++;
								}else{ 																//and the other player lost
									playerScore.matches++; 												//chalk a win for given player
									playerScore.wins++;
								}
							}else{																//if it's being played by and against other people
								if(refMatch.winner == thisPlayer.id){								//and player playing it won
									othersScore.matches++; 												//chalk a loss for others
									othersScore.losses++;
								}else{ 																//and the player playing it lost
									othersScore.matches++; 												//chalk a win for others
									othersScore.wins++;
								}
							}
						}
					}
				}
			}
		}
	}
	return [playerScore, othersScore]
}
function statFromSet(dex, min, filters, lands, conditional) {			//finds winningest cards from a set
	let cardArray = [];
	if(!conditional)
		conditional = function(){return true};
	for(let card in dex.cards) {
		if(conditional(card))
			cardArray.push(card);
	}
	let wrData = sortComparedData(dex, cardArray, min, filters, lands, filteredWinRate)
	return wrData;
}
function defaultConditional(sets, exclusion){							//default set filter
	return cond = function(cardName){
		let card = cardBase[cardName];
		if(!card)
			return false;
		let send = false;
		for(let set in sets) {
			if(card.prints && card.prints.includes(sets[set]))
				send = true;
		}
		if(send && exclusion) {
			if(card.prints.length == 1) {
				//stays the same
			}else{
				send = false; //don't send unless we get an original print
				for(let print in card.prints) {
					if(sets.includes(card.prints[print])) {
						let newName = cardName.replace(/_[A-Z0-9_]+/, "_" + card.prints[print]);
						let newCard = cardBase[newName];
						if(newCard && !newCard.notes.includes("reprint")) //original print
							send = true;
					}
				}
			}
		}
		return send;
	};
}
function statFromDesign(dex, designer) {		 						//finds winningest cards from a designer
	let cardArray = [];
	for(let card in dex.cards) {
		if(cardBase[fuzzy.searchCards(arcana.msem, card)].designer == designer){
			cardArray.push(card)
		}
	}
	cardArray.sort(function(a,b) {
		return dex.cards[b].matchWins - dex.cards[a].matchWins;
	});
	for(let card in cardArray) {
		if(dex.cards[cardArray[card]].matchWins > 5)
			console.log(cardArray[card] + ": " + dex.cards[cardArray[card]].matchWins)
	}
	return cardArray;
}
function playrateGenerator(dex, filters, skipThese, minMatches){		//generates playRate data for each card
	let miniDex = {}; 								//holds our cards and calc'd playrate values
	let deckCount = 0;								//keep track of how many decks we've checked
	if(!minMatches)
		minMatches = 1;
	for(let tourney in dex.tournaments){
		if(tourneyFilter(tourney, filters)){
			for(let list in dex.tournaments[tourney]) {
				let listName = dex.tournaments[tourney][list];
				let thisList = dex.decklists[listName];
				if(matchFilter(null, thisList.player, filters)) {
					deckCount++;
					for(let card in thisList.cards) {
						if(!skipThese(card)) {
							let thisCard = thisList.cards[card];
							if(!miniDex.hasOwnProperty(card))
								miniDex[card] = {decks:0, mainCount:0, sideCount:0, allCount:0, setCount:0, matches:0};
							miniDex[card].decks++;
							miniDex[card].mainCount += thisCard.mainCount;
							miniDex[card].sideCount += thisCard.sideCount;
							miniDex[card].allCount += thisCard.mainCount + thisCard.sideCount;
							if(thisCard.mainCount + thisCard.sideCount >= 4)
								miniDex[card].setCount++;
							if(thisList.matches) {
								miniDex[card].matches += thisList.matches.length;
							}else{
								//console.log(listName)
							}
						}
					}
				}
			}
		}
	}
	for(let card in miniDex) {
		if(miniDex[card].matches < minMatches) {
			delete miniDex[card]
		}else{
			//console.log(filteredWinRate(dex, card, filters));
			miniDex[card].wr = winValToWR(filteredWinRate(dex, card, filters), 2);
			miniDex[card].pwrm = parseFloat(miniDex[card].wr * miniDex[card].decks / deckCount).toFixed(2);
		}
	}
	return [miniDex, deckCount];
}
function colorRipper(dex, filters, skipThese){							//logs list of decks of each color
	let allTypes = {};
	for(let tourney in dex.tournaments) {
		if(tourneyFilter(tourney, filters)) {
			for(let list in dex.tournaments[tourney]) {
				let listName = dex.tournaments[tourney][list];
				let thisList = dex.decklists[listName];
				if(matchFilter(null, thisList.player, filters)) {
					let cols = countColors(thisList.cards);
					if(!allTypes.hasOwnProperty(cols))
						allTypes[cols] = 0;
					allTypes[cols]++;
				}
			}
		}
	}
	let types = Object.keys(allTypes);
	types.sort(function(a, b){
		return allTypes[b] - allTypes[a];
	})
	for(let type in types) {
		console.log(allTypes[types[type]] + ": " + types[type])
	}
}
function getPlayerCount(dex, filters) {									//returns miniDex of matches a card is played in per player
	let miniDex = {};
	for(let card in dex.cards) {
		miniDex[card] = {}
		for(let list in dex.cards[card].decks) {
			let thisList = dex.decklists[dex.cards[card].decks[list]];
			if(tourneyFilter(thisList.tournament, filters)) {
				toolbox.addIfNew(miniDex[card], thisList.player, 0)
				if(thisList.matches)
					miniDex[card][thisList.player] += thisList.matches.length;
			}
		}
	}
	return miniDex;
}
function runPlayerCounts(dex, filters, minimum){						//returns array of cards that have been played by at least the given number of players
	let miniDex = getPlayerCount(dex, filters);
	let clearedArray = [];
	for(let card in miniDex) {
		if(Object.keys(miniDex[card]).length >= minimum)
			clearedArray.push(card);
	}
	return clearedArray;
}
function stapleGrabber() {												//returns array of is:staple cards
	return processCommands({content:"stapleMaker rep:3 min:50 filter after:2011", author:{id:"190309440069697536", username:"Cajun"}}, "all", [5])
}
function stapleMaker(dex, filters, wr, skipThese, minMatch) {			//builds the staples code
	let playrates = playrateGenerator(dex, filters, skipThese, minMatch);
	let stapleArray = [];
	for(let card in playrates[0]) {
		let thisCard = cardBase[card];
		if(playrates[0][card].wr >= wr && !thisCard.typeLine.match(/Basic/i) && !cardBanned.includes(thisCard.fullName))
			stapleArray.push(card);
	}
	stapleArray.sort(function(a,b){
		return playrates[0][b].decks - playrates[0][a].decks;
	})
	return stapleArray;
}
//quickly grab stats
function wr(statCard) { 												//returns card's historic winrate
	let matchCount = statCard.matchWins + statCard.matchLoss + statCard.matchDraw
	return statCard.matchWins / matchCount;
}
function mc(statCard, minMatches) { 									//returns number of matches a card is in
	let matchCount = statCard.matchWins + statCard.matchLoss + statCard.matchDraw;
	if(minMatches) {
		if(matchCount >= minMatches)
			return 1;
		return 0;
	}
	return matchCount;
}
function winValToWR(array, precision) {									//converts [wins, matches] array into win rate percentage
	if(array.hasOwnProperty('matches'))
		array = [array.wins, array.matches];
	if(array[0] == 0)
		return 0;
	if(!precision)
		precision = 0;
	return parseFloat(100*array[0]/array[1]).toFixed(precision)
}
function subtractWRs(base, resPre){										//subtracts two WR objects
	let res = {};
	res.wins = base.wins - resPre.wins;
	res.matches = base.matches - resPre.matches;
	if(base.hasOwnProperty('draws') && resPre.hasOwnProperty('draws')) {
		res.draws = base.draws - resPre.draws;
	}else{
		res.draws = 0;
	}
	if(base.hasOwnProperty('losses') && resPre.hasOwnProperty('losses')) {
		res.losses = base.losses - resPre.losses;
	}else{
		res.losses = res.matches - res.wins - res.draws;
	}
	return res;
}
function tourneyInfo(tourneyName) { 									//gives tourney type and truncated date number
	let nameMatch = tourneyName.match(/(gp|league|tuc)_(\d+)_(\d+)/i);
	if(nameMatch) {
		let tour = nameMatch[1];
		let date = nameMatch[2] + nameMatch[3];
		date = parseInt(date);
		return [tour, date];
	}
	return [null, 0];
}
function tourneyFilter(tourneyName, filters) {	 						//returns if tourney passes tourney filters
	let info = tourneyInfo(tourneyName);
	if(filters.hasOwnProperty('after') && filters.after >= info[1]) //before an after check
		return false;
	if(filters.hasOwnProperty('before') && filters.before <= info[1]) //after a before check
		return false;
	if(filters.hasOwnProperty('type') && !filters.type.includes(info[0])) //not an approved type
		return false;
	return true;
}
function matchFilter(match, player, filters, card) {					//returns if match passes match filters
	if(player == "both" && filters.hasOwnProperty('player')) { //filter out players
		for(let aPlayer in match.players) {
			if(filters.player.includes(match.players[aPlayer].id)) {
				//bugFinder(match, player);
				return false;
			}
		}
	}else if(filters.hasOwnProperty('player') && filters.player.includes(player)) {
		//bugFinder(match);
		return false;
	}
	if(card && filters.mirror) { //filter out mirrors
		if(match.players[0].id == bye || match.players[1].id == bye) {
			return true;
		}
		let list1 = match.players[0].list;
		let list2 = match.players[1].list;
		let cards1 = statDexPreBuilt.decklists[list1].cards;
		let cards2 = statDexPreBuilt.decklists[list2].cards;
		if(cards1.hasOwnProperty(card) && cards2.hasOwnProperty(card)) {
			return false;
		}
	}
	return true;
}
function bugFinder(match, id) {
	for(let player in match.players) {
		let decklist = statDexPreBuilt.decklists[match.players[player].list.replace('.txt', '.json')].cards;
		if(decklist.hasOwnProperty("Intrepid_WAY")) {
			if(match.players[player].id == id)
				console.log("yeeeee")
			if(match.players[player].id != id)
				console.log("nooooo")
		}
	}
	console.log()
}
function buildUsernameData(dex) {										//returns an array of usernames in the dex
	let array = [];
	let array2 = [];
	for(let player in dex.players) {
		if(dex.players[player].username && dex.players[player].username != "PlayerUnknown") {
			array.push(dex.players[player].username)
			array2.push(player)
		}
	}
	return [array, array2];
}
function isBoring(cardName) {											//removes boring lands from topWins
	let thisCard = cardBase[cardName];
	if(!thisCard) { //abort if there's an error
		return true;
	}
	if(thisCard.typeLine.match("Basic"))
		return true;
	if(thisCard.prints.includes("SHRINE"))
		return true;
	if(thisCard.cardName == "Nebula of Empty Gold")
		return true;
	if(thisCard.notes.includes("checkland") || thisCard.notes.includes("plagueland") || thisCard.notes.includes("shockfetch") || thisCard.notes.includes("desertshock") || thisCard.notes.includes("monofetch"))
		return true;
	return false;
}
function recordFinder(archive, matches, player) {						//returns score object from list of matches			
	let score = {wins:0, losses:0, draws:0, matches:0}
	for(let match in matches) {
		let thisMatch = archive.matches[matches[match]-1];
		if(thisMatch.winner == player) {
			score.wins++;
		}else if(thisMatch.winner == "") {
			score.draws++;
		}else{
			score.losses++;
		}
		score.matches++;
	}
	return score;
}
function matchCount(playerCount) {										//expected matches in a gp
	let rounds = 4;
	if(playerCount < 9)
		rounds = 3;
	if(playerCount%2)
		playerCount++;
	let matchPer = playerCount / 2;
	let expMatches = matchPer * rounds;
	return expMatches;
}
function rankFinder(tourneyName) {										//sorts gp decklists to 1st, 2nd, top4, top8....
	let thisTourney = require('./tourneyArchives/'+tourneyName+'_archive.json');
	let win = [];
	let second = [];
	let top4 = [];
	let top8 = [];
	let theRest = [];
	let nabbed = [];
	let matches = thisTourney.matches;
	let last = matches.length;
	let lastMatch = matches[last-1];
	let players = thisTourney.players;
	let playerCount = Object.keys(players).length;
	let expectedMatches = matchCount(playerCount);
	expectedMatches += 3 //top 4 and top 2
		
	for(let player in lastMatch.players) {
		if(lastMatch.winner == lastMatch.players[player].id) {
			win.push(lastMatch.players[player].list)
		}else{
			second.push(lastMatch.players[player].list)
		}
		nabbed.push(lastMatch.players[player].list);
	}
	let top4s = [matches[last-2], matches[last-3]];
	for(let match in top4s) {
		for(let player in top4s[match].players) {
			if(!nabbed.includes(top4s[match].players[player].list) && top4s[match].players[player].id != bye) {
				top4.push(top4s[match].players[player].list)
				nabbed.push(top4s[match].players[player].list)
			}
		}
	}
	if(last > expectedMatches) { //there should be a top 8
		let top8s = [matches[last-4], matches[last-5], matches[last-6], matches[last-7]];
		for(let match in top8s) {
			for(let player in top8s[match].players) {
				if(!nabbed.includes(top8s[match].players[player].list) && top8s[match].players[player].id != bye) {
					top8.push(top8s[match].players[player].list)
					nabbed.push(top8s[match].players[player].list)
				}
			}			
		}
	}
	for(let player in players) {
		if(!nabbed.includes(players[player].lists[0]) && player != bye) {
			theRest.push(players[player].lists[0]);
			nabbed.push(players[player].lists[0]);
		}
	}
	let obj = {
		win: win,
		second: second,
		top4: top4,
		top8: top8,
		theRest: theRest,
		everybody: nabbed
	}
	return obj;
}
function leagueFourOhs(tourneyName){									//grabs 5-0, 4-1, and 4-1 league lists
	let thisTourney = require('./tourneyArchives/'+tourneyName+'_archive.json');
	let fourOhs = [];
	let fourOnes = [];
	let fiveOhs = [];
	for(let player in thisTourney.players) {
		for(let run in thisTourney.players[player].matches) {
			let thisRun = thisTourney.players[player].matches[run]
			let score = recordFinder(thisTourney, thisRun, player);
			if(score.wins == 5){
				fiveOhs.push(thisTourney.players[player].lists[run])
			}else if(score.wins == 4 && score.losses == 1){
				fourOnes.push(thisTourney.players[player].lists[run])				
			}else if(score.wins == 4){
				fourOhs.push(thisTourney.players[player].lists[run])
			}
		}
	}
	let obj = {
		fiveOhs: fiveOhs,
		fourOnes: fourOnes,
		fourOhs: fourOhs
	}
	return obj;
}
function grabHighLists(tourneyName) {									//grabs lists of top 8 decklists of GP or 4/5 win league decks
	let info = tourneyInfo(tourneyName);
	let output = "";
	if(info[0] == "gp") {
		let allLists = rankFinder(tourneyName);
		listsArray.push(allLists.win);
		listsArray.push(allLists.second);
	}else if(info[0] == "league") {
		let allLists = leagueFourOhs(tourneyName)
	}
}
function countColors(deckObj) {											//counts the colors in cards in a deck object
	let colCount = {
		white: [0,0],
		blue: [0,0],
		black: [0,0],
		red: [0,0],
		green: [0,0],
		colors: [0,0]
	}
	for(let card in deckObj) {
		let allCount = deckObj[card].mainCount + deckObj[card].sideCount;
		let thisCard = cardBase[card];
		if(thisCard.color)
			colCount.colors[1]++;
		if(thisCard.color.match(/White/)) {
			colCount.white[0] += allCount;
			colCount.colors[0] += allCount;
			colCount.white[1]++;
		}
		if(thisCard.color.match(/Blue/)) {
			colCount.blue[0] += allCount;
			colCount.colors[0] += allCount;
			colCount.blue[1]++;
		}
		if(thisCard.color.match(/Black/)) {
			colCount.black[0] += allCount;
			colCount.colors[0] += allCount;
			colCount.black[1]++;
		}
		if(thisCard.color.match(/Red/)) {
			colCount.red[0] += allCount;
			colCount.colors[0] += allCount;
			colCount.red[1]++;
		}
		if(thisCard.color.match(/Green/)) {
			colCount.green[0] += allCount;
			colCount.colors[0] += allCount;
			colCount.green[1]++;
		}
	}
	//colors break into core, secondary, and splash colors
	//call it 30%+, 20%+, and 10%+ for the minute
	let wPer = colCount.white[0] / colCount.colors[0];
	let uPer = colCount.blue[0] / colCount.colors[0];
	let bPer = colCount.black[0] / colCount.colors[0];
	let rPer = colCount.red[0] / colCount.colors[0];
	let gPer = colCount.green[0] / colCount.colors[0];
	let pers = [{p:wPer, n:"W"}, {p:uPer, n:"U"}, {p:bPer, n:"B"}, {p:rPer, n:"R"}, {p:gPer, n:"G"}];
	pers.sort(function(a, b){
		return b.p - a.p;
	});
	let core = [], secondary = [], splash = [], neg = [];
	for(let per in pers) {
		if(pers[per].p > 0.3) {
			core.push(pers[per])
		}else if(pers[per].p > 0.2) {
			secondary.push(pers[per])
		}else if(pers[per].p > 0.1) {
			splash.push(pers[per])
		}else{
			neg.push(pers[per])
		}
	}
	let cols = [core, secondary, splash];
	let colType = "";
	for(let c in cols[0])
		colType += cols[0][c].n;
	for(let c in cols[1])
		colType += cols[1][c].n;
	for(let c in cols[2])
		colType += cols[2][c].n;
	colType = colorCorrect(colType);
	return colType;
}
function colorCorrect(cols){											//turns a color string into the proper order
	let wMatch = cols.match(/W/);
	let uMatch = cols.match(/U/);
	let bMatch = cols.match(/B/);
	let rMatch = cols.match(/R/);
	let gMatch = cols.match(/G/);
	if(wMatch && uMatch && bMatch && rMatch && gMatch)
		return "WUBRG";
	if(wMatch && uMatch && bMatch && rMatch)
		return "WUBR";
	if(wMatch && uMatch && bMatch && gMatch)
		return "GWUB";
	if(wMatch && uMatch && rMatch && gMatch)
		return "RGWU";
	if(wMatch && bMatch && rMatch && gMatch)
		return "BRGW";
	if(uMatch && bMatch && rMatch && gMatch)
		return "UBRG";
	if(wMatch && uMatch && bMatch)
		return "WUB";
	if(wMatch && uMatch && gMatch)
		return "GWU";
	if(wMatch && uMatch && rMatch)
		return "URW";
	if(wMatch && bMatch && rMatch)
		return "WBR";
	if(uMatch && bMatch && rMatch)
		return "UBR";
	if(uMatch && bMatch && gMatch)
		return "UBG";
	if(wMatch && bMatch && gMatch)
		return "WBG";
	if(wMatch && rMatch && gMatch)
		return "RGW";
	if(bMatch && rMatch && gMatch)
		return "BRG";
	if(uMatch && rMatch && gMatch)
		return "GUR";
	if(wMatch && uMatch)
		return "WU";
	if(wMatch && gMatch)
		return "GW";
	if(wMatch && rMatch)
		return "RW";
	if(bMatch && rMatch)
		return "BR";
	if(uMatch && bMatch)
		return "UB";
	if(bMatch && gMatch)
		return "BG";
	if(wMatch && bMatch)
		return "WB";
	if(rMatch && gMatch)
		return "RG";
	if(uMatch && gMatch)
		return "GU";
	if(uMatch && rMatch)
		return "UR";
	return cols;
}
//formatting
function datify(num) {													//converts XX_YY to names
	let year = Math.trunc(num/100);
	let month = num-(year*100);
	let months = ['','Jan','Feb','March','April','May','June','July','Aug','Sept','Oct','Nov','Dec'];
	let monName = months[month];
	return monName + " " + (year + 2000);
}
function pullSet(name){													//remove _SET from cardnames
	return name.replace(/_[A-Z0-9_]+/, "");
}
function grabPlayerName(dex, msg, c, bigData) {							//grabs a player name from commands
	let player = msg.author.id;
	let playName = msg.author.username;
	if(bigData && c && c[1]) {
		if(!c[1].match(/^[0-9]+$/)) {
			let users = buildUsernameData(dex);
			let bestName = fuzzy.searchArray(c[1], users[0]);
			player = users[1][users[0].indexOf(bestName[0])];
		}else if(c){
			if(dex.players.hasOwnProperty(c[1]))
				player = c[1];
		}
		playName = dex.players[player].username;
	}
	return [player, playName];
}
function grabMin(input) {												//grabs a min filter from commands
	let minMatch = 1;
	let minMatchMatch = input.match(/min: ?(\d+)/i);
	if(minMatchMatch)
		minMatch = parseInt(minMatchMatch[1]);
	return minMatch;
}
function grabTop(array, input, topN) {									//grabs the topN from commands/limits
	if(!topN)
		topN = 10;
	let topNMatch = input.match(/count: ?(\d+)/i);
	if(topNMatch)
		topN = parseInt(topNMatch[1]);
	if(topN > array.length)
		topN = array.length;
	if(topN > 50)
		topN = 50;
	return topN
}
function instigatorPlayrateCoder(listOfNames, key){						//prints an is:key filter for instigator
	let varKey = toolbox.toTitleCase(key.replace(":", " ")).replace(" ", "");
	//convert is:pointed to IsPointed
	let output = "";
	output += `class Condition${varKey} < Condition\n`
	output += `\tdef search(db)\n`
	output += `\t\tnames = [\n`
	for(let name in listOfNames)
		output += `\t\t\t"${listOfNames[name].toLowerCase().replace(/\/\/.*/, "").replace(/_.*/, "")}",\n`
	output += `]\n\n`;
	output += `\t\tnames\n`;
	output += `\t\t\t.map{|n| db.cards[n]}\n`;
	output += `\t\t\t.flat_map{|card| card ? card.printings : []}\n`;
	output += `\t\t\t.to_set\n`;
	output += `\tend\n\n`;
	output += `\tdef to_s\n`;
	output += `\t\t"${key}"\n`;
	output += `\tend\n`;
	output += `end`;
	return output;
}

//process commands from Discord
function processFilters(dex, msg, bigData) {							//process filters into filter objects
	let input = msg.content
	let filters = toolbox.cloneObj(baseFilters);
	let message = "";
	if(input.match(/filter:? ?all/i))
		return [{}, " without filters"];
	let afFilter = input.match(/filter after:? ?(\d+)/i);
	let befFilter = input.match(/filter before:? ?(\d+)/i);
	let typeFilter = input.match(/filter type:? ?(gp|league|tuc)/i);
	let setFilter = input.match(/filter set:? ?([A-Z0-9_]+)/i);
	let mirrorFilter = input.match(/filter: ?(no)?mirrors?/i);
	if(befFilter) {
		filters.before = parseInt(befFilter[1]);
		delete filters.after
	}
	if(afFilter)
		filters.after = parseInt(afFilter[1]);
	if(typeFilter)
		filters.type = [typeFilter[1]];
	if(mirrorFilter)
		filters.mirror = true;
	if(setFilter)
		filters.set = setFilter[1];
	if(filters.hasOwnProperty('after'))
		message += " after " + datify(filters.after);
	if(filters.hasOwnProperty('before'))
		message += " before " + datify(filters.before);
	if(filters.hasOwnProperty('type'))
		message += " in " + filters.type + " tournaments";
	if(filters.hasOwnProperty('set'))
		message += " in " + filters.set;
	if(bigData) {
		let playerFilter = toolbox.globalCapture(/filter out: ?([^ ]+)/, input);
		if(playerFilter) {
			filters.player = [];
			for(let match in playerFilter) {
				let info = grabPlayerName(dex, msg, playerFilter[match], true);
				filters.player.push(info[0])
				message += " and skipping " + info[1];
			}
		}
	}
	return [filters, message];
}
function messageHandler(msg, offline, admincheck) {
	if(msg.channel && statDexEnabled.includes(msg.channel.id)) { //statDex handler
		let out = processCommands(msg, offline, admincheck)
		if(out)
			msg.channel.send(out)
	}
}
function processCommands(msg, offline, admincheck) {					//processes commands from Discord posts
	let input = msg.content;
	let dex = statDexPreBuilt;
	let bigData = admincheck.includes(5); //let msem council access more commands
	let filterData = processFilters(dex, msg, bigData);		//converts filter:all, filter before:YYMM, filter after:YYMM, filter type:gp/league
	let filters = filterData[0];							//min:# and count:# get pulled later
	let filterMessage = filterData[1]; 						//normal text tourney filter description
	let landFilter = "";									//normal text card filter description
	let repFilter = input.match(/(rep|represent|represented|representation): ?(\d+)/i);
	let stapleCheck = input.match(/(is|yes|not?)staple/i);
	let clearedCards = {rep:[], staple:[]};
	if(repFilter) {
		clearedCards.rep = runPlayerCounts(dex, filters, repFilter[2]);
		landFilter += " skipping cards played by fewer than " + repFilter[2] + " players"
	}
	if(stapleCheck) {
		clearedCards.staple = stapleGrabber();
		if(stapleCheck[1].match(/not?/i)) {
			landFilter += " skipping staples";
		}else{
			landFilter += " showing only staples";
		}
	}
	skipThese = function(cardName) {
		let test = false;
		if(filters.set && !cardBase[cardName].prints.includes(filters.set))
			return true;
		if(repFilter) {
			if(!clearedCards.rep.includes(cardName))
				return true;
		}
		if(stapleCheck) {
			let inStaple = clearedCards.staple.includes(cardName);
			let noStaples = false;
			if(stapleCheck[1].match(/not?/i))
				noStaples = true;
			if(noStaples == inStaple) //staple with nostaple
				return true;
		}
		if(input.match(/nolands/i)) {
			test = isBoring(cardName);
			if(test)
				return test;
		}
		if(input.match(/yeslands/i)) {
			test = !isBoring(cardName);
			if(test)
				return test;
		}
		let colorFlag = input.match(/everything (mono)?(white|blue|black|red|green|gold)/i);
		if(colorFlag) {
			let colorPoke = new RegExp(colorFlag[2], 'i')
			if(colorFlag[1] && colorFlag[1].match(/mono/i)) {
				if(cardBase[cardName].color.match("/"))
					return true;
				test = !cardBase[cardName].color.match(colorPoke);
			}else if(colorFlag[2].match(/gold/i)){
				test = !cardBase[cardName].color.match("/");
			}else{
				test = !cardBase[cardName].color.match(colorPoke);
			}
			if(test)
				return test;
		}
		let typeFlag = input.match(/yes(artifact|creature|enchantment|instant|sorcery|planeswalker|tribal)/i)
		if(typeFlag){											//skip everything but proper type
			let typePoke = new RegExp(typeFlag[1], 'i');
			if(cardBase[cardName].hasOwnProperty('typeLine2') && cardBase[cardName].typeLine2.match(typePoke)) {
				 test = false;
			}else{
				test = !cardBase[cardName].typeLine.match(typePoke)
			}
			if(test)
				return test;
		}
		if(input.match(/noncreatures/)) {
			test = cardBase[cardName].typeLine.match(/Creature/i);
			if(test)
				return test;
		}
		if(input.match(/nonbasic/)) {
			test = cardBase[cardName].typeLine.match(/Basic/i);
			if(test)
				return test;
		}
		return false;
	}
	if(input.match(/nolands/i))							//skip boring lands with nolands
		landFilter += " and no boring lands";
	if(input.match(/yeslands/i))							//skip everything but boring lands with yeslands
		landFilter += " and only boring lands";
	let colorFlag = input.match(/everything (mono)?(white|blue|black|red|green|gold)/i)
	if(colorFlag)											//skip everything but color/monocolor cards
		landFilter += " and everything is " + (colorFlag[1]||"") + colorFlag[2];
	let typeFlag = input.match(/yes(artifact|creature|enchantment|instant|sorcery|planeswalker|tribal)/i)
	if(typeFlag)											//skip everything but proper type
		landFilter += " and only " + typeFlag[1] + " cards";
	if(input.match(/noncreatures/))							//skip creatures
		landFilter += " and only noncreature cards";
	if(input.match(/nonbasic/))								//skip basic lands
		landFilter += " and only nonbasic cards";
	filterMessage += landFilter;
	let minMatch = grabMin(input);
	//run commands
	if(input.match(/cardPrice/i)) {						//calculated cost of a card
		if(!arcana.msem.setData["101"].counter) //calc the play numbers if we haven't yet
			calcPlayCounts(dex);
		if(globalPlayrates == null) {
			globalPlayrates = playrateGenerator(dex, {}, function(){
				return false;
			});
			globalPlayrates[2] = playrateReporter(globalPlayrates);
		}
		let c = input.match(/\[([^\]]+)\]/);
		if(c) {
			let name = fuzzy.searchCards(arcana.msem, c[1])
			let deets = cardPricer(dex, name, globalPlayrates);
			let output = `Estimated card price for ${name}\n`;
			output += `$${deets[0]} [`;
			output += `base: ${deets[1]}, multipliers: `;
			output += `playRate: ${deets[2]}, `;
			output += `winRate: ${deets[3]}, `;
			output += `gpPlace: ${deets[4]}, `;
			output += `setPlay: ${deets[5]}, `;
			output += `setPlayables: ${deets[6]}, `;
			output += `age: ${deets[7]}, `;
			output += `reprints: ${deets[8]}`;
			output += `]`;
			return output;
		}else if(input.match(/cardPriceTop/i)) {
			let miniDex = [];
			for(let card in dex.cards) {
				dex.cards[card].price = cardPricer(dex, card, globalPlayrates);
				miniDex.push(card);
			}
			miniDex.sort(function(a, b) {
				return dex.cards[b].price[0] - dex.cards[a].price[0];
			});
			let topN = grabTop(miniDex, input);
			let output = `Top ${topN} card prices\n`
			let hits = 0;
			for(i=0; i<miniDex.length; i++) {
				if(!skipThese(miniDex[i])) {
					output += `${i+1}: ${dex.cards[miniDex[i]].price[0]} — ${miniDex[i]}\n`
					hits++;
					if(hits == topN)
						break;
				}
			}
			return output;
		}else if(input.match(/cardPriceSet ?[?[A-Z0-9_]+/i)){
			let set = input.match(/cardPriceSet ?\[?([A-Z0-9_]+)/i)[1].toUpperCase();
			let rarities = {common: 0, uncommon:0, rare:0, "mythic rare":0, bonus:0}
			let prices = {common: 0, uncommon:0, rare:0, "mythic rare":0, bonus:0}
			for(let card in arcana.msem.cards) {
				let cardData = arcana.msem.cards[card];
				if(cardData.setID == set) {
					if(rarities.hasOwnProperty(cardData.rarity)) {
						rarities[cardData.rarity]++;
						let price = cardPricer(dex, card, globalPlayrates)[0];
						prices[cardData.rarity] += parseFloat(price);
					}
				}
			}
			//get average value of each rarity;
			for(let r in prices)
				prices[r] = prices[r]/rarities[r];
			let ev = 0;
			if(set == "101") {
				ev = 97*prices.rare + 4*prices["mythic rare"];
			}else if(set == "DOA") {
				ev = 15*prices.rare;
			}else if(set == "WAW") {
				ev = 10*prices.rare;
				ev += 0.865*5*prices.common;
				ev += 0.135*5*prices.uncommon;
			}else if(set == "MAC" || set == "CAC" || set == "STN") {
				ev = 10*prices.rare;
			}else{
				ev = 10*prices.common;
				ev += 3*prices.uncommon;
				if(prices.bonus)
					ev += 1*prices.bonus;
				if(prices["mythic rare"]) {
					ev += 0.865*prices.rare;
					ev += 0.135*prices["mythic rare"];
				}else{
					ev += prices.rare;
				}
			}
			return `The EV for a pack of ${set} is $${ev.toFixed(2)}.`;
		}
	}
	if(input.match(/cardWin/i)){						//winrates of a card
		let c = input.match(/\[([^\]]+)\]/);
		if(c) {
			let card1 = addNewStatDexCard(dex, c[1]);
			let res = filteredWinRate(dex, card1, filters);
			let output = `${pullSet(card1)} win rate `;
			output += `for matches${filterMessage}\n`;
			output += `${pullSet(card1)} won ${res.wins}/${res.matches} (${winValToWR([res.wins,res.matches],2)}%)\n`
			return output;
		}
	}
	if(input.match(/vsWinRate/i)) {						//X vs Y winrates
		let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
		if(c) {
			let card1 = addNewStatDexCard(dex, c[1]);
			let card2 = addNewStatDexCard(dex, c[2]);
			let res = pairedWinRate(dex, card1, card2, vsScore, filters);
			let output = `${pullSet(card1)} vs ${pullSet(card2)}:\n`;
			output += `Found ${res.matches} matches${filterMessage}\n`;
			output += `${pullSet(card1)} won ${res.wins}/${res.matches} (${winValToWR(res)}%)\n`
			output += `${pullSet(card2)} won ${res.losses}/${res.matches} (${100-winValToWR(res)}%)`
			return output;
		}
	}
	if(input.match(/unComboWinRate/i)) {				//X - Y winrates
		let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
		if(c) {
			let card1 = addNewStatDexCard(dex, c[1]);
			let card2 = addNewStatDexCard(dex, c[2]);
			let res = unpairedWinRate(dex, card1, card2, filters);
			let output = `${pullSet(card1)} without ${pullSet(card2)}:\n`;
			output += `Found ${res.matches} matches${filterMessage}\n`;
			output += `Decks playing ${pullSet(card1)} without ${pullSet(card2)} won ${res.wins}/${res.matches} (${winValToWR(res)}%)\n`
			return output;
		}
	}
	if(input.match(/comboWinRate/i)) {					//X + Y winrates
		let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
		if(c) {
			let card1 = addNewStatDexCard(dex, c[1]);
			let card2 = addNewStatDexCard(dex, c[2]);
			let res = pairedWinRate(dex, card1, card2, pairedScore, filters);
			let output = `${pullSet(card1)} comboed with ${pullSet(card2)}:\n`;
			output += `Found ${res.matches} matches${filterMessage}\n`;
			output += `Decks playing both ${pullSet(card1)} and ${pullSet(card2)} won ${res.wins}/${res.matches} (${winValToWR(res)}%)\n`
			return output;
		}
	}
	if(input.match(/cardPlayers(Vs)?(Top|Bot)/i)) {		//players with best winrate with the card
		if(!bigData)
			return "";
		let c = input.match(/\[([^\]]+)\]/);
		if(c) {
			let card = addNewStatDexCard(dex, c[1]);
			let miniDex = {};
			for(let list in dex.cards[card].decks) { //get all the players
				let thisList = dex.cards[card].decks[list];
				for(let player in dex.players) {
					if(!miniDex.hasOwnProperty(player)){
						if(dex.players[player].lists.includes(thisList)) {
							miniDex[player] = {matches:0, wins:0, losses:0}
							continue;
						}
					}
				}
			}
			let matchFunction = playerComboCard;
			let withAg = "with";
			if(input.match(/cardPlayersVs/i)) {
				matchFunction = playerVsCard;
				withAg = "against";
			}
			for(let player in miniDex) {
				if(matchFilter(null, player, filters))
					miniDex[player] = matchFunction(dex, player, card, filters)[0];
			}
			let comp = function(dex, name, filters) {
				return miniDex[name];
			}
			let wrData = sortComparedData(dex, Object.keys(miniDex), minMatch, filters, skipThese, comp);
			let array = wrData[0];				//ordered by winrate
			let topN = grabTop(array, input);
			let topBot = "Top";
			if(input.match(/Players(Vs)?Bot/i)){
				array.reverse();
				topBot = "Bottom";
			}
			let mess = `${topBot} ${topN} player winrates ${withAg} ${pullSet(card)} with at least ${minMatch} matches and${filterMessage}\n`;
			for(var i=0; i<topN; i++) {
				if(dex.players[array[i]].username == "PlayerUnknown")
					console.log(dex.players[array[i]]);
				mess += `${i+1}: ${dex.players[array[i]].username} (${wrData[1][array[i]].wins}/${wrData[1][array[i]].matches} -> ${wrData[1][array[i]].wr}%)\n`;
			}
			return mess;
		}
	}
	if(input.match(/player(Combo|Vs)Card(Top|Bot)/i)){	//top/bottom winrates of cards of a player
		let c = input.match(/(.*) ?player(?:Combo|Vs)Card/i);
		let playArray = grabPlayerName(dex, msg, c, bigData);
		let player = playArray[0];
		let playName = playArray[1];		
		let youOrMe = 0;
		if(input.match(/other/i))
			youOrMe = 1;
		let matchScript = playerComboCard;
		let matchMessage = `when played by ${playName}`;
		if(input.match(/playerVsCard/i)) {
				matchScript = playerVsCard;
				matchMessage = `when played against ${playName}`;
		}
		if(youOrMe)
			matchMessage = matchMessage.replace(/when played (by|against)/, "when played $1 players other than")
		let comp = function(aDex, aCard, someFilters){
			return matchScript(aDex, player, aCard, someFilters)[youOrMe];
		}
		let wrData = sortComparedData(dex, Object.keys(dex.cards), minMatch, filters, skipThese, comp);
		let array = wrData[0];
		let topN = grabTop(array, input);
		let topBot = "Top";
		if(matchScript == playerVsCard)
			array.reverse();
		if(input.match(/CardBot/i)) {
			array.reverse();
			topBot = "Bottom";
		}
		let mess = `${topBot} ${topN} winrates ${matchMessage} with at least ${minMatch} matches and${filterMessage}\n`;
		for(var i=0; i<topN; i++) {
			if(matchScript == playerVsCard) {
				mess += `${i+1}: ${pullSet(array[i])} (${wrData[1][array[i]].losses}/${wrData[1][array[i]].matches} -> ${100-wrData[1][array[i]].wr}%)\n`;
			}else{
				mess += `${i+1}: ${pullSet(array[i])} (${wrData[1][array[i]].wins}/${wrData[1][array[i]].matches} -> ${wrData[1][array[i]].wr}%)\n`;
			}
		}
		return mess;
	}
	if(input.match(/player(Combo|Vs)Card/i)) {			//winrates of a player with a card
		let c = input.match(/(.*) ?player(?:Combo|Vs)Card ?\[([^\]]+)\]/i);
		if(c) {
			let matchScript = playerComboCard
			if(input.match(/playerVsCard/i))
				matchScript = playerVsCard;
			let card1 = addNewStatDexCard(dex, c[2]);
			let play1 = msg.author.id;
			let playName = msg.author.username;
			if(bigData && c[1]){
				if(!c[1].match(/^[0-9]+$/)) {
					let users = buildUsernameData(dex);
					let bestName = fuzzy.searchArray(c[1], users[0]);
					play1 = users[1][users[0].indexOf(bestName[0])];
				}
				playName = dex.players[play1].username;
			}
			let res = matchScript(dex, play1, card1, filters);
			let wr1 = winValToWR(res[0]);
			let wr2 = winValToWR(res[1]);
			if(matchScript == playerComboCard) {
				let output = `${pullSet(card1)} being played by ${playName}:\n`;
				output += `Found ${res[0].matches} matches${filterMessage}\n`;
				output += `Decks where ${playName} plays ${pullSet(card1)} won ${res[0].wins}/${res[0].matches} (${wr1}%)\n`
				output += `${pullSet(card1)} being played by other people:\n`;
				output += `Found ${res[1].matches} matches${filterMessage}\n`;
				output += `Decks where others play ${pullSet(card1)} won ${res[1].wins}/${res[1].matches} (${wr2}%)\n`
				return output;
			}else{
				let output = `${pullSet(card1)} being played against ${playName}:\n`;
				output += `Found ${res[0].matches} matches${filterMessage}\n`;
				output += `Decks where ${playName} plays against ${pullSet(card1)} won ${res[0].wins}/${res[0].matches} (${wr1}%)\n`
				output += `${pullSet(card1)} being played by other people:\n`;
				output += `Found ${res[1].matches} matches${filterMessage}\n`;
				output += `Decks where others play against ${pullSet(card1)} won ${res[1].wins}/${res[1].matches} (${wr2}%)\n`
				return output;
			}
		}
	}
	if(input.match(/playerUn(Combo|Vs)Card/i)) {		//winrates of a player without a card
		let c = input.match(/(.*) ?playerUn(?:Combo|Vs)Card ?\[([^\]]+)\]/i);
		if(c) {
			let matchScript = playerComboCard
			if(input.match(/playerUnVsCard/i))
				matchScript = playerVsCard;
			let card1 = addNewStatDexCard(dex, c[2]);
			let play1 = msg.author.id;
			let playName = msg.author.username;
			if(c[1]){
				if(!c[1].match(/^[0-9]+$/)) {
					let users = buildUsernameData(dex);
					let bestName = fuzzy.searchArray(c[1], users[0]);
					play1 = users[1][users[0].indexOf(bestName[0])];
				}
				playName = dex.players[play1].username;
			}
			let resPre = matchScript(dex, play1, card1, filters);
			let base = playerWinRate(dex, play1, filters);
			let res = [subtractWRs(base, resPre[0])];
			let wr1 = winValToWR(res[0]);
			if(matchScript == playerComboCard) {
				let output = `${pullSet(card1)} not being played by ${playName}:\n`;
				output += `Found ${res[0].matches} matches${filterMessage}\n`;
				output += `Decks where ${playName} doesn't play ${pullSet(card1)} won ${res[0].wins}/${res[0].matches} (${wr1}%)\n`
				return output;
			}else{
				let output = `${pullSet(card1)} not being played against ${playName}:\n`;
				output += `Found ${res[0].matches} matches${filterMessage}\n`;
				output += `Decks where ${playName} doesn't play against ${pullSet(card1)} won ${res[0].wins}/${res[0].matches} (${wr1}%)\n`
				return output;
			}
		}
	}
	if(input.match(/(top|bot)WinVs/i)){					//top N winrates vs a particular card
		let c = input.match(/\[([^\]]+)\]/);
		if(c) {
			let card1 = addNewStatDexCard(dex, c[1]);
			let cardsArray = [];
			let filteredWRs = {};
			for(let card in dex.cards) {
				let res = pairedWinRate(dex, card1, card, vsScore, filters);
				let winRate = winValToWR(res);
				if(winRate > 0 && res.matches >= minMatch && !(skipThese(card))){
					cardsArray.push(card)
					filteredWRs[card] = {};
					filteredWRs[card].wr = winRate;
					filteredWRs[card].mc = res.matches;
				}
			}
			cardsArray.sort(function(a,b){
				let result = filteredWRs[b].wr - filteredWRs[a].wr
				if(result == 0)
					result = filteredWRs[b].mc - filteredWRs[a].mc
				return result;
			});
			let topN = grabTop(cardsArray, input);
			let topBot = "Top";
			if(input.match(/botWin/i)) {
				cardsArray.reverse();
				topBot = "Bottom";
			}
			let mess = `${topBot} ${topN} winrates against ${pullSet(card1)} with at least ${minMatch} matches and${filterMessage}\n`;
			for(var i=0; i<topN; i++)
				mess += `${i+1}: ${pullSet(cardsArray[i])} (${filteredWRs[cardsArray[i]].wins}/${filteredWRs[cardsArray[i]].matches} -> ${filteredWRs[cardsArray[i]].wr}%)\n`;
			return mess;
		}
	}
	if(input.match(/(top|bot)Win/i)) {					//top N winrates
		let wrData = sortComparedData(dex, Object.keys(dex.cards), minMatch, filters, skipThese, filteredWinRate);
		let array = wrData[0];
		let topN = grabTop(array, input);
		let topBot = "Top";
		if(input.match(/botWin/i)) {
			array.reverse();
			topBot = "Bottom";
		}
		let mess = `${topBot} ${topN} winrates with at least ${minMatch} matches and${filterMessage}\n`;
		for(var i=0; i<topN; i++) {
			mess += `${i+1}: ${pullSet(array[i])} (${wrData[1][array[i]].wins}/${wrData[1][array[i]].matches} -> ${wrData[1][array[i]].wr}%)\n`;
		}
		return mess;
	}
	if(input.match(/playerVs/i)) {						//player vs player winrate
		if(!bigData)
			return "";
		let c = input.match(/([^ \n]+) playerVs ([^ \n]+)/i);
		let t = input.match(/([^ \n]+) playerVsTop/i)
		if(c) {
			let play1 = c[1];
			let play2 = c[2];
			if(!play1.match(/^[0-9]+$/) || !play2.match(/^[0-9]+$/)) {
				let users = buildUsernameData(dex);
				if(!play1.match(/^[0-9]+$/)) {
					let bestName = fuzzy.searchArray(play1, users[0]);
					play1 = users[1][users[0].indexOf(bestName[0])];
				}
				if(!play2.match(/^[0-9]+$/)) {
					let bestName = fuzzy.searchArray(play2, users[0]);
					play2 = users[1][users[0].indexOf(bestName[0])];
				}
			}
			let winData = playerFace(play1, play2, dex, filters);
			let player1 = dex.players[play1];
			let player2 = dex.players[play2];
			let output = `${player1.username} has a ${winData[0]}-${winData[1]}-${winData[2]} record (${winValToWR([winData[0],(winData[0]+winData[1]+winData[2])])}%) when playing against ${player2.username}`;
			output += `\n${player1.username} has a ${winData[3].wins}-${winData[3].loss}-${winData[3].draw} record (${winValToWR([winData[3].wins,(winData[3].wins+winData[3].loss+winData[3].draw)])}%) when playing against other players.\n`
			return output;
		}else if(input.match(/playerVsTop/i)){
			let play1 = msg.author.id;
			if(t) {
				play1 = t[1];
				if(!play1.match(/^[0-9]+$/)) {
					let users = buildUsernameData(dex);
					if(!play1.match(/^[0-9]+$/)) {
						let bestName = fuzzy.searchArray(play1, users[0]);
						play1 = users[1][users[0].indexOf(bestName[0])];
					}
				}
			}
			let miniDex = {};
			for(let player in dex.players) {
				if(player != play1)
					miniDex[player] = playerFace(play1, player, dex, filters);
			}
			let comp = function(dex, player, filters){
				return miniDex[player][4]
			}
			let wrData = sortComparedData(dex, Object.keys(miniDex), minMatch, filters, skipThese, comp)
			let array = wrData[0];
			let topN = grabTop(array, input);
			let topBot = "Top";
			if(input.match(/VsBot/i)) {
				array.reverse();
				topBot = "Bottom";
			}
			let mess = `${dex.players[play1].username}'s ${topBot} ${topN} winrates vs all players with at least ${minMatch} matches and${filterMessage}\n`;
			for(var i=0; i<topN; i++) {
				mess += `${i+1}: ${dex.players[array[i]].username} (${wrData[1][array[i]].wins}/${wrData[1][array[i]].matches} -> ${wrData[1][array[i]].wr}%)\n`;
			}
			return mess;
		}
	}
	if(input.match(/playerWin(Top|Bot)/i)) {			//top/bottom winrates of all players
		let miniDex = {};
		let boots = [];
		for(let player in dex.players) {
			miniDex[player] = playerWinRate(dex, player, filters);
			if(miniDex[player].matches < 4)
				boots.push(player);
		}
		let comp = function(dex, player) {
			return miniDex[player];
		}
		let wrData = sortComparedData(dex, Object.keys(miniDex), minMatch, filters, skipThese, playerWinRate);
		let array = wrData[0];
		let topN = grabTop(array, input);
		let topBot = "Top";
		if(input.match(/playerWinBot/i)) {
			array.reverse();
			topBot = "Bottom";
		}
		let output = `${topBot} ${topN} player winrates with at least ${minMatch} matches and${filterMessage}\n`;
		for(let i=0; i<topN; i++)
			output += `${i+1}: ${dex.players[array[i]].username} (${wrData[1][array[i]].wins}/${wrData[1][array[i]].matches} -> ${wrData[1][array[i]].wr}%)\n`;
		return output;
		/*
		let goodNames = [];
		let bootNames = [];
		for(let player in res[0]) {
			if(!boots.includes(res[0][player]))
				goodNames.push(dex.players[res[0][player]].username);
		}
		for(let player in boots) {
			bootNames.push(dex.players[boots[player]].username);
		}
		console.log("Players with fewer than 4 matches in the last 6 months:")
		console.log(bootNames);
			return "";
		*/
	}
	if(input.match(/playerWin/i)){						//basic player winrate
		let c = input.match(/(.*) ?playerWin/i);
		if(c) {
			let playerArray = grabPlayerName(dex, msg, c, bigData);
			let player = playerArray[0];
			let playerName = playerArray[1];
			let res = playerWinRate(dex, player, filters);
			let output = `${playerName} has a ${res.wins}-${res.losses}-${res.draws} (${winValToWR(res, 2)}%) record`;
			return output;
		}
	}
	if(input.match(/set(Top|Bot)/i)) {					//winrates of cards in a set or sets
		let exc = false;
		if(input.match(/exclus/))
			exc = true;
		let setsMatch = input.match(/set(Top|Bot) ?([A-Z0-9,-_\/]+)/i);
		if(setsMatch){
			let setsNab = setsMatch[2].match(/([A-Z0-9_]{1,7})/g);
			let cond = defaultConditional(setsNab, exc);
			let wrData = statFromSet(dex, minMatch, filters, skipThese, cond);
			let array = wrData[0];
			let wrObj = wrData[1];
			let topN = grabTop(array, input, 20);
			let topBot = "Top";
			if(input.match(/setBot/i)) {
				array.reverse();
				topBot = "Bottom"
			}
			let output = topBot + " winrates for " + setsNab.concat() + filterMessage + "\n";
			for(let i=0; i<topN; i++) {
				output += `${i+1}: ${pullSet(array[i])} (${wrObj[array[i]].wins}/${wrObj[array[i]].matches} -> ${winValToWR(wrObj[array[i]])}%)\n`;
			}
			return output;
		}
	}
	if(input.match(/playRate/i)) {						//returns playRate values of cards
		let playrates = playrateGenerator(dex, filters, skipThese);
		playrates[2] = playrateReporter(playrates, input.match(/RateMulti/i));
		let c = input.match(/\[([^\]]+)\]/);
		if(c) {
			let card = addNewStatDexCard(dex, c[1]);
			if(!playrates[0].hasOwnProperty(card)) {
				return "No playrate data for " + pullSet(card);
			}else{
				let rates = playrates[0][card]
				let output = "Playrate data for " + pullSet(card) + "\n";
				output += `Found ${rates.mainCount} in mainboards and ${rates.sideCount} in sideboards across ${rates.decks} decks${filterMessage}\n`;
				output += `${pullSet(card)} is played in ${parseFloat(100*rates.decks/playrates[1]).toFixed(2)}% of decks, making it the ${toolbox.ordinalize(playrates[2].indexOf(card)+1)} most played card.\n`
				output += `${pullSet(card)} has a win rate of ${rates.wr}% and a play-win rate multi of ${rates.pwrm}%.`
				return output;
			}
		}else{ //playRateTop/Bot
			let topBot = "Top";
			if(input.match(/playRate(Multi)?Bot/i)) {
				playrates[2].reverse();
				topBot = "Bottom";
			}
			let topN = grabTop(playrates[2], input);
			let output = `${topBot} ${topN} cards by playrate${filterMessage}\n`;
			if(input.match(/RateMulti/i))
				output = output.replace('playrate', 'playrate * winrate')
			for(let i=0; i<topN; i++) {
				let name = playrates[2][i];
				let rates = playrates[0][name];
				let mess = `(${rates.decks}/${playrates[1]} -> ${parseFloat(100*rates.decks/playrates[1]).toFixed(2)}%)`;
				if(input.match(/RateMulti/i))
					mess = `(${rates.pwrm}%)`;
				output += `${i+1}: ${pullSet(name)} ${mess}\n`;
			}
			return output;
		}
	}
	if(input.match(/stapleMaker/i)){
		if(!bigData)
			return "";
		let stapleArray = stapleMaker(dex, filters, 45, skipThese, minMatch)
		if(input.match(/Print/i)) {
			let file = instigatorPlayrateCoder(stapleArray, "is:staple");
			fs.writeFile('staples.txt', file, function(){
				console.log('done');
			})
		}else{
			return stapleArray;
		}
	}


/* disabled on live	
	if(input.match(/buildDefaultDex/i)) {		//builds statDex
		statDex = updateStatDex(archiveArray);
	}
	if(input.match(/buildFilteredDex/i)) {		//builds filtered statDex
		filters = {};
		let filmatch = input.match(/before: ?(\d+)/i);
		if(filmatch)
			filters.before = parseInt(filmatch[1]);
		filmatch = input.match(/after: ?(\d+)/i);
		if(filmatch)
			filters.after = parseInt(filmatch[1]);
		filmatch = input.match(/type: ?(gp|league)/i);
		if(filmatch)
			filters.type = [filmatch[1]];
		statDex = generateFilteredDex(filters);
		return 'done';
	}
	if(input.match(/printStatDex/i)) {			//writes statDex.json
		fs.writeFile('statDex.json', JSON.stringify(statDex).replace(/"]},"/g,'"]},\r\n"'), 'binary', function(err) {
			if(err) throw err;
		});
	}
	if(input.match(/printStatSheet/i)) {		//writes card spreadsheet of statDex
		fs.writeFile('statDex.txt', statDexStats(statDexPreBuilt), 'binary', function(err) {
			if(err) throw err;
			console.log("Done");
		});
	}
	if(input.match(/printPlayerSheet/i)) {		//writes player spreadhseet of statDex
		fs.writeFile('playerDex.txt', playerWinRate(statDexPreBuilt), 'binary', function(err) {
			if(err) throw err;
			console.log("Done");
		});
	if(input.match(/fixFiles/i))
		loadArchives(fixFiles);
	}
*/
}
function playrateReporter(info, multi) {										//sorts and reports playRate data
	let miniDex = info[0];
	let deckCount = info[1];
	let cards = Object.keys(miniDex);
	let wrm = function(v){
		if(!multi)
			return 1;
		return miniDex[v].wr;
	}
	cards.sort(function(a, b){
		let result = wrm(b)*miniDex[b].decks - wrm(a)*miniDex[a].decks;
		if(result == 0)
			result = wrm(b)*miniDex[b].allCount - wrm(a)*miniDex[a].allCount
		if(result == 0)
			result = wrm(b)*miniDex[b].mainCount - wrm(a)*miniDex[a].mainCount
		if(result == 0)
			result = wrm(b)*miniDex[b].sideCount - wrm(a)*miniDex[a].sideCount
		if(result == 0)
			result = wrm(b)*miniDex[b].setCount - wrm(a)*miniDex[a].setCount
		return result;
	});
	return cards;
}

function biggun() {
	let miniDex = {};
	let pairs = 0;
	let card_names = Object.keys(statDexPreBuilt.cards);
	for(let i=0; i<card_names.length; i++) {
		miniDex[card_names[i]] = {};
		for(let j=i+1; j<card_names.length; j++) {
			let res = pairedWinRate(statDexPreBuilt, card_names[i], card_names[j], pairedScore, baseFilters);
			if(res.matches > 0) {
				miniDex[card_names[i]][card_names[j]] = res;
				pairs++
			}
		}
	}
	i = 0;
	let megaDex = {};
	for(let card in miniDex) {
		for(let sub in miniDex[card]) {
			megaDex[i] = miniDex[card][sub];
			megaDex[i].cards = [card, sub];
			i++
		}
	}
	let comp = function(dex, ind, filters) {
		return megaDex[ind];
	}
	let wrData = sortComparedData(statDexPreBuilt, Object.keys(megaDex), 20, {}, skipThese, comp);
	let array = wrData[0];
	//console.log(wrData)
	for(i = 0; i<50; i++)
		console.log(`${i}: ${pullSet(megaDex[array[i]].cards[0])} + ${pullSet(megaDex[array[i]].cards[1])}, ${wrData[1][array[i]].wr}% in ${wrData[1][array[i]].matches} matches`)
}

function findDupes(archives) {
	for(let a in archives) {
		let thisTourney = require('./tourneyArchives/'+archives[a]);
		for(let player in thisTourney.players) {
			let theseLists = thisTourney.players[player].lists;
			let hold = [];
			for(let list in theseLists) {
				if(!hold.includes(theseLists[list])) {
					hold.push(theseLists[list]);
				}else{
					console.log('Duped list found: ' + theseLists[list])
					console.log(theseLists);
				}
			}
		}
	}
}
function fixDupes(){
	let archives = {
		'league_19_12': ['284763898920304651'],
		'league_20_09': ['233946395067940864','380148829128884236','524687574992945163','494540442445021206','107957368997834752']
	}
	for(let a in archives) {
		let thisTourney = require('./tourneyArchives/'+a+'_archive.json');
		for(let p in archives[a]) {
			let thisPlayer = archives[a][p];
			let playerData = thisTourney.players[thisPlayer];
			for(let list in playerData.lists) {
				let listName = playerData.lists[list];
				for(let aMatch in playerData.matches[list]) {
					let realMatchNo = playerData.matches[list][aMatch]-1;
					let match = thisTourney.matches[realMatchNo];
					let matchPlayer = match.players[0];
					if(matchPlayer.id != thisPlayer)
						matchPlayer = match.players[1];
					if(matchPlayer.id != thisPlayer) {
						console.log('aaaaaaaaaaaaaaaa')
					}else{
						matchPlayer.list = listName;
						matchPlayer.run = parseInt(list)+1;
					}
				}
			}
			fs.writeFile('./tourneyArchives/'+a+'_archive.json', JSON.stringify(thisTourney), function(){
				console.log('./tourneyArchives/'+a+'_archive.json written');
			})
		}
	}
}
//fixDupes();
function matchCounter(archives) {
	let matches = 0;
	for(let a in archives) {
		let thisTourney = require('./tourneyArchives/' + archives[a])
		matches += thisTourney.matches.length;
	}
	console.log(matches);
}
function cardPricer(dex, name, playrates) {
	let avgPlay = calcAvgPlay(); //average play values
	let avgSetPlay = avgPlay[0]; //average plays a set gets
	let avgSetCards = avgPlay[1];//average playables a set has
	let medCardPlay = calcMedCount(playrates);
	let card = arcana.msem.cards[name];
	if(!card)
		return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	if(card.prints.length > 1) { //make sure we use the first print for pulling from statDex
		name = findFirstPrint(card);
	}
	let thisSet = arcana.msem.setData[card.setID];
	let eachSetData = determineAverageSetPlays(card, avgSetPlay, avgSetCards);
	let eachSetPlays = eachSetData[0];
	let eachSetCards = eachSetData[1];
	let wr = 0.2;																	//default wr for .7x multi for unplayed cards
	let playCount = 0.7*medCardPlay;												//default pr for .7x prm
	if(playrates[0][name]) {
		wr = playrates[0][name].wr/100;												//card's decimal win rate
		playCount = playrates[0][name].allCount;									//pure # of this card played
	}
	let adjPC = playCount/medCardPlay;
	if(adjPC < 1) {
		let dif = 1 - adjPC;
		adjPC += 0.5*dif
	}
	let pcMulti = Math.min(8, adjPC).toFixed(2);									//multiplier based on play rate vs median
	let wrMulti = Math.pow(wr+0.7, 3).toFixed(2);									//multiplier based on win rate
	let sprMulti = Math.max(0.33, Math.pow(avgSetPlay / eachSetPlays, 1.2)).toFixed(2);	//multiplier based on how opened the set was
	let plbMulti = Math.max(0.9, avgSetCards / eachSetCards).toFixed(2);			//multiplier based on how playable the set was
	let ageMulti = determineAge(thisSet.releaseDate);								//multiplier based on how old the set is
	let rpMulti = determineReprints(card).toFixed(2);								//multiplier based on how reprinted the card is
	let gpMulti = determineGPMulti(dex, name).toFixed(2);							//multiplier for good GP performance
	let base = determineBaseCost(card);												//base cost for this card
	let finalCost = base * pcMulti * wrMulti * gpMulti * sprMulti * plbMulti * ageMulti * rpMulti;
	finalCost = finalCost.toFixed(2);
	if(finalCost < 0.01)
		finalCost = 0.01;
	return [finalCost, base, pcMulti, wrMulti, gpMulti, sprMulti, plbMulti, ageMulti, rpMulti];
}
function determineAverageSetPlays(card, avgSetPR, avgCardPR) {	//calculate playability of sets its in
	let allcount = 0, uniques = 0, counted = 0;
	for(let p in card.prints) {
		if(arcana.msem.setData[card.prints[p]].priceSkip || !arcana.msem.setData[card.prints[p]].counter)
			continue;
		allcount += Math.min(arcana.msem.setData[card.prints[p]].counter[0], 2*avgSetPR);
		uniques += Math.min(arcana.msem.setData[card.prints[p]].counter[1], 2*avgCardPR);
		counted++;
		if(card.prints[p] == card.setID) { //count the given set twice for some weight
			allcount += Math.min(arcana.msem.setData[card.prints[p]].counter[0], 2*avgSetPR);
			uniques += Math.min(arcana.msem.setData[card.prints[p]].counter[1], 2*avgCardPR);
			counted++;
		}
		/*if(card.prints[p].match(/^MS\d+$/)) { //halve MS scores cause they're so crazy opened
			allcount -= 0.5*arcana.msem.setData[card.prints[p]].counter[0];
			uniques -= 0.5*arcana.msem.setData[card.prints[p]].counter[1];
			//counted -= 0.5;
		}*/
	}
	let avgCount = allcount/counted
	if(arcana.msem.setData[card.setID].counter && arcana.msem.setData[card.setID].counter[0] > avgCount)
		avgCount = arcana.msem.setData[card.setID].counter[0]
	let avgUnique = uniques/counted
	if(arcana.msem.setData[card.setID].counter && arcana.msem.setData[card.setID].counter[1] > avgUnique)
		avgUnique = arcana.msem.setData[card.setID].counter[1]
	return [avgCount, avgUnique];
}
function determineGPMulti(dex, name) {	//calculate multiplier of GP placements
	let tourns = [ //weigh newer GPs higher, older GPs lower
		"gp_21_01",
		"gp_20_12",
		"gp_20_11",
		"gp_20_10",
		"gp_20_09",
		"gp_20_08",
		"gp_20_07",
		"gp_20_06",
		"gp_20_05",
		"gp_20_04",
		"gp_20_03",
		"gp_20_02",
		"gp_20_01",
		"gp_19_12",
		"gp_19_11"
	];
	let weightArray = [1.2, 1.15, 1.1, 1.05, 1.00, .95, .90, .90, .90, .90, .90, 0.85, 0.85, 0.85, 0.85, 0.85];
	let base = 0, add = 0;
	function uptick(rank, tourney) {
		let multi = 0.8;
		let newMultiIndex = tourns.indexOf(tourney);
		if(newMultiIndex && weightArray[newMultiIndex])
			multi = weightArray[newMultiIndex];
		let testBase, testAdd;
		switch(rank) { 
			case 1: //2.5 + .3 for winning GPs
				testBase = 2.2;
				testAdd = 0.3;
				break;
			case 2: //2.0 + .2 for getting 2nd
				testBase = 1.8;
				testAdd = 0.2;
				break;
			case 4: //1.75 + .15 for getting top 4
				testBase = 1.6;
				testAdd = 0.15;
				break;
			case 8: //1.5 + .1 for getting top 8
				testBase = 1.4;
				testAdd = 0.1;
				break;
			default: //if something weird happened don't increment
				testBase = 1.0;
				testAdd = 0;
		}
		testBase = testBase * multi;
		if(testBase > base)
			base = testBase;
		add += (testAdd * multi);
	}
	for(let t in dex.tournaments) {
		if(t.match(/^gp/)) {
			let thisT = dex.tournaments[t];
			for(let d in thisT) {
				let thisList = dex.decklists[thisT[d]];
				if(thisList.rank && thisList.cards.hasOwnProperty(name))
					uptick(thisList.rank, t)
			}
		}
	}
	if(!base) //if it never won anything, send 1.0x
		base = 1;
	return base + add;
}
function determineReprints(card) {
	if(card.typeLine.match(/Basic/i))
		return 0;
	let reprints = 0;
	let vals = {
		"basic land": 1,
		"token": 1,
		common: 1,
		uncommon: 2.5,
		rare: 4.5,
		bonus: 4.5,
		special: 4.5,
		mythic: 5,
		"mythic rare": 5,
		masterpiece: 1
	}
	let refValue = vals[card.rarity];
	for(let p in card.prints) {
		if(arcana.msem.setData[card.prints[p]].priceSkip)
			continue;
		let printVal = 1;
		try{
			let reprinted = arcana.msem.cards[card.fullName + "_" + card.prints[p]];
			let dif = refValue - vals[reprinted.rarity];
			if(card.rarity != "masterpiece" && reprinted.rarity != "masterpiece") { //masterpiece reprints don't affect pricing
				if(div > 0)
					printVal += dif;
				if(div < 0)
					printVal *= 0.80
				if(reprinted.setID.match(/^MS\d/))
					printVal *= 1.5;
				reprints += printVal;
			}
		}catch(e){
			if(card.prints[p].match(/^MS\d/))
				printVal *= 1.5;
			reprints += printVal;
		}
	}
	if(!reprints)
		return 1;
	return 1 / reprints;
}
function determineAge(release) {
	let year = release.match(/^(20\d\d)/);
	let month = release.match(/-\d\d-/);
	let current = 2020;
	let dif = 2020 - parseInt(year);
	//do 0.5 per year
	return 1 + 0.3*dif;
}
function determineBaseCost(card) {	//determines base cost of card based on rarity
	if(card.setID == "101")
		return 1;
	if(card.rarity == "masterpiece")
		return 30;
	if(card.setID == "L3")
		return 20;
	if(card.setID == "L2")
		return 10;
	if(card.rarity == "common")
		return 0.1;
	if(card.rarity == "uncommon")
		return 0.5;
	if(card.rarity == "rare" || card.rarity == "bonus")
		return 1;
	if(card.rarity == "mythic rare")
		return 2;
	return 1;
}
function calcMedCount(playrates) {	//median played amount
/*	if(playrates[2].length%2) { //odd, take middle
		let half = playrates[2].length/2;
		return playrates[0][playrates[2][half-0.5]].allCount;
	}else{ //even, take avg
		let half = playrates[2].length/2;
		console.log(playrates[0][playrates[2][half]]);
		console.log(playrates[0][playrates[2][half-1]]);
		let c1 = playrates[0][playrates[2][half]].allCount;
		let c2 = playrates[0][playrates[2][half-1]].allCount;
		return (c1+c2)/2;
	}*/
	let allcounter = 0, cardCounter = 0;
	for(let card in playrates[0]) {
		if(playrates[0][card].allCount > 10) {
			allcounter += playrates[0][card].allCount;
			cardCounter++;
		}
	}
	return allcounter / cardCounter;
}
function calcAvgPlay() {			//avg plays and playables in a set
	let allCount = 0, uniqueCount = 0, setCount = 0;
	for(let set in arcana.msem.setData) {
		if(!arcana.msem.setData[set].priceSkip && arcana.msem.setData[set].counter) {
			allCount += arcana.msem.setData[set].counter[0];
			uniqueCount += arcana.msem.setData[set].counter[1];
			setCount++;
		}
	}
	return [allCount/setCount, uniqueCount/setCount];
}
function calcPlayCounts(dex) {		//add counts to each set
	for(let card in dex.cards) {
		let theCard = arcana.msem.cards[card];
		if(!theCard || theCard.typeLine.match(/Basic/))
			continue;
		let allCount = dex.cards[card].mainCount + dex.cards[card].sideCount;
		for(let set in theCard.prints) {
			let thisSet = arcana.msem.setData[theCard.prints[set]];
			toolbox.addIfNew(thisSet, 'counter', [0,0,0]);
			thisSet.counter[0] += allCount; //sum of all
			thisSet.counter[1]++;			//sum of unique
		}
	}
}
//fixFiles()
function checkCouncilWRs() {
	let coun = {wins:0, losses:0, matches:0, wr:0, players:0};
	let pop = {wins:0, losses:0, matches:0, wr:0, players:0};
	let curvebreakers = {wins:0, losses:0, matches:0, wr:0, players:0};
	for(let player in statDexPreBuilt.players) {
		let score = playerWinRate(statDexPreBuilt, player, {});
		let input = pop;
		if(config.admin[player] && config.admin[player].includes(5)) //council
			input = coun;
		if(player == "107957368997834752" || player == "152881531356971008")
			input = curvebreakers
		input.wins += score.wins;
		input.losses += score.losses;
		input.matches += score.matches;
		input.draws += score.draws;
		input.wr += (score.wins/score.matches);
		input.players++;
	}
	console.log(coun);
	console.log(pop);
	console.log(curvebreakers);
}
//exports for live
exports.messageHandler = messageHandler
var baseline = {
	"Kyne's Devoted": 18,
	'Spell Stutter': 28,
	'Snow-Covered Forest': 12,
	'Brimstone Volley': 1,
	'Hostile Dunes': 8,
	Disseminate: 14,
	'Lonely Dunes': 3,
	'Cold Grave': 17,
	'Elvish Opportunist': 26,
	'Waterway Dam': 4,
	'Snowfield Mother': 6,
	'Volta Hearth': 7,
	Remorse: 5,
	'Canyon Falls': 3,
	'Lakeside Market': 2,
	'Unbreachable Walls': 6,
	"Jarl's Brutalizer": 1,
	'Saigura Tam': 1,
	'Nighthallow Ritual': 1,
	'Saigura Mao, Wanderer': 1,
	"Gyalla's Clutch": 1,
	'Nest Watchers': 1,
	'Arid Ruins': 3,
	'Tezmodo, the Golden City': 1,
	'Weathered Oasis': 6,
	'Sunset Sands': 3,
	'Unravel Mind': 1,
	'Sink Under': 1,
	'Unending Sands': 6,
	'Honorless Offering': 1,
	'Deem Unworthy': 4,
	'Snow-Covered Plains': 6,
	'Snow-Covered Swamp': 3,
	'Tomb of Shifting Sands': 1,
	'Snow-Covered Island': 14,
	'Knight of Order': 1,
	'Investment Returns': 2,
	'Snow-Covered Mountain': 5,
	Smelt: 2,
	Fateshaper: 2,
	'Chaos in Bloom': 2,
	'Arcane Genesis': 2,
	'Back Alley': 3,
	'Torchlit Shipyard': 2,
	'Armored Flunkie': 5,
	'Blessings of Armor': 5,
	'Splitting Bloom': 1,
	'Province Messenger': 1,
	'Peakpoint Presence': 1,
	'Punishing Heat': 1,
	'Impulsive Plan': 4,
	"Nocturnal's Informant": 1,
	'Mountain Spring': 6,
	'Markarth Assailant': 3,
	'Sunlit Cactus': 2,
	'Scorched Canyon': 3,
	'Clay Mesa': 4,
	'Solar Flare': 7,
	'Greedy Hands': 2,
	'Living Gallery': 1,
	'Helvalla, God of Glory': 1,
	'Judicial Verdict': 1,
	'Wicked Weaving': 2,
	'Howling Alpha': 1,
	'Dwemer-Made Dovah': 2,
	'Stormwing Dovah': 2,
	'Diving Dovah': 2,
	"Dovah's Ire": 2,
	'Winged Descent': 2,
	'Forgotten Knowledge': 2,
	'Draconic Divulging': 2,
	"Governess's Might": 1
  }
function krowFinder() {
	let filters = {after:2009};
	let playrates = playrateGenerator(statDexPreBuilt, filters, skipThese);
	for(let card in playrates[0]) {
		let thisCard = cardBase[card];
		if(thisCard && baseline.hasOwnProperty(thisCard.cardName))
			playrates[0][card].decks += baseline[thisCard.cardName]; //add in march data
	}
	playrates[2] = playrateReporter(playrates, 1);					//sort by decks then card counts
	let playercounts = getPlayerCount(statDexPreBuilt, filters);	//get list of player data
	/*
		{ playrates[1]
			card: {
				decks: 5,
				mainCount:, sideCount:, allCount:, setCount:,
				wr: 50
			}
		}
		{ playercounts
			card: {
				player: 5 //matches with that card
			}//# keys in card = rep
		}
	*/
	//grab each krow card played in the last six months
	let output = "Card Name~Decks~Players~WinRate~Other Prints\n";
	for(let card in playrates[0]) {
		let thisCard = cardBase[card];
		if(thisCard && (thisCard.designer.match(/Honch?krow ?David|(Thisis)?Sakon/i) || thisCard.setID.match(/TGE|XPM|DYA|LNG|WAW/)) && !thisCard.cardName.match(/^(Plains|Island|Swamp|Mountain|Forest)$/)) { //likely krow card
			output += thisCard.fullName + "~";
			output += playrates[0][card].decks + "~";
			output += Object.keys(playercounts[card]).length + "~";
			output += playrates[0][card].wr + "~";
			for(let p in thisCard.prints) {
				if(!thisCard.prints[p].match(/TGE|XPM|DYA|LNG|WAW/)) //if not one of the five
					output += thisCard.prints[p] + ",";
			}
			output += "\n";
		}
	}
	console.log(output);
}
//console.log(processCommands({content:"reuben playercardcombo [Ever-Gnawing Rat]", author:{id:"190309440069697536", username:"Cajun"}}, "all", [5]))
//processCommands({content:"stapleMakerPrint rep:3 min:50 filter after:2011", author:{id:"190309440069697536", username:"Cajun"}}, "all", [5])
//console.log(leagueFourOhs('league_20_08'))
//let testDeck = statDexPreBuilt.decklists["/gp_20_08/cajun.json"].cards
//testDeck = require('./decks/bluestest.json')
//console.log(countColors(testDeck));
//colorRipper(statDexPreBuilt, {}, skipThese)
/*updateStatDex(statDexPreBuilt, ["gp_21_03_archive.json"])
addMatchesToLists(statDexPreBuilt, "21_03");
printFixer(statDexPreBuilt);
fs.writeFile('./statDexTest.json', JSON.stringify(statDexPreBuilt), function(){console.log("done");})
*/
//rebuildDex();