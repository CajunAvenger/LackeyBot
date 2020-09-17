var arcana = require('./arcana.js');									//can work with card fields
var archiveArray = [];													//holds array of tourneyArchive files
var baseFilters = {after:2004};											//default to after May Madness update
const bye = "343475440083664896"; 										//bye player id
const config = require("./config/lackeyconfig.json");					//for logging into Discord
var discClient = require('./discClient.js');							//other Discord stuff
var fs = require('fs');
var fuzzy = require('./fuzzy.js');										//fuzzy searching for fun and profit
var statDex = {															//a baby statDex
	cards:{},															//card data, holds historic W-L, decks that contain them, matches that contain them
	players:{},															//player data, holds historid W-L, their decks, and their matches
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
function initialize(data){												//copy LackeyBot's edits when on live
	arcana = data.arcana;
	loadArchives();
}
function loadArchives(cb) { 											//reads the archived tournament files
	fs.readdir("tourneyArchives",function(err, array) {
		archiveArray = array;
		if(cb)
			cb();
	});
}
function fixFiles(fixArray) { 											//update older/broken files
	for(let ar in fixArray){
		let tourney = archiveArray[ar].replace(/\.json$/, "");
		var archive = require('./tourneyArchives/'+tourney+'.json');
		for(let match in archive.matches) {
			for(let player in archive.matches[match].players) {
				let thisPlayer = archive.matches[match].players[player];
				if(thisPlayer.username == thisPlayer.list)
					thisPlayer.list = `/${tourney}/${thisPlayer.username}.txt`
			}
		}
		for(let player in archive.players) {
			if(archive.players[player].lists[0] == "")
				archive.players[player].lists[0] = `/${tourney}/${archive.players[player].username}.txt`;
		}
		fs.writeFile('./tourneyArchives/'+tourney+'.json', JSON.stringify(archive), function(err) {
			if(err)
				throw err;
			console.log(tourney + ' fixed');
		});
	}
}
function givePlayersUsernames(){										//update player usernames
	for(let player in statDexPreBuilt.players) {
		statDexPreBuilt.players[player].username = discClient.pullUsername(player);
	}
	fs.writeFile('statDex.json', JSON.stringify(statDexPreBuilt), function(){
		console.log('done');
	})
}
function discordAccess(cb) {											//login to Discord to access player names/pings
	discClient.initialize();
	var Client = discClient.sendClient();
	Client.login(config.live.token)
	Client.on("ready", () => { //performed when the bot logs in
		console.log("Ready as "+Client.user.username);
		cb();
	});
}

//build dexes
function buildStatDex(decksArray) { 									//builds a statDex from an array of decklist folders
	var archives = {};
	var dex = {cards:{}, players:{}, global:{matches:0, decks:0, playedCards:0}};;
	for(let archive in decksArray) {
		let thisArchive = require('./tourneyArchives/' + decksArray[archive]);
		let tourneyName = decksArray[archive].match(/(league|gp)_[0-9][0-9]_[0-9][0-9]/);
		archives[tourneyName[0]] = (thisArchive);
	}
	//go through the archives, grab each decklist
	//count its W-L, winLists, and lossLists
	//convert deck to json, then apply W-L to each card in them
	for(let archive in archives) {																//for each tournament in the archive...
		console.log(`starting ${archive}`)
		for(let player in archives[archive].players) {											//for each player in the tournament...
			if(player != bye){
				for(let list in archives[archive].players[player].lists) {						//for each decklist of that player...
					dex.global.decks++;
					let wins = 0;
					let losses = 0;
					let draws = 0;
					let winLists = []; //the lists the deck beat
					let lossLists = []; //the lists the deck lost to
					let allMatches = [];
					let thisList = archives[archive].players[player].lists[list]; 				//a decklist from the array
					if(thisList == "")
						thisList = "/" + archive + "/" + archives[archive].players[player].username + ".json";
					thisList = thisList.replace("_archive", "");
					thisList = thisList.replace(".txt", ".json"); //change file types from HTML to JSON lists
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
						let convertedList = require("./decks"+thisList);
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
						}
						dex.players[player].wins += wins;
						dex.players[player].losses += losses;
						for(let aMatch in allMatches) {
							if(!dex.players[player].matches.hasOwnProperty(archive))
								dex.players[player].matches[archive] = [];
							if(!dex.players[player].matches[archive].includes(allMatches[aMatch]))
								dex.players[player].matches[archive].push(allMatches[aMatch]);
						}
						//console.log("Converted ./decks" + thisList + "...");
					}catch(e){
						/*console.log()
						console.log("Missing file at " + thisList)
						console.log()*/
						continue;
					}
				}//end of lists in a player
			}//player isn't bye
		}//end of players in an archive
	}//end of archives
	return dex;
}
function generateFilteredDex(filters) { 								//returns a smaller statDex following certain filters
	let filteredArray = [];
	for(let folder in archiveArray) {
		if(tourneyFilter(archiveArray[folder], filters))
			filteredArray.push(archiveArray[folder]);
	}
	return buildStatDex(filteredArray);
}
function addNewStatDexCard(dex, card) { 								//adds a new card to statDex
	let statName = fuzzy.searchCards(arcana.msem, card)
	
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
function integrateDecklists(dex) {										//add decklists to statDex
	dex.decklists = {};
	dex.tournaments = {};
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
function playerWinRate(dex) { 											//writes player spreadsheet of statDex
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
function sortWinRates(dex, minMatches, filters, flagLands) {			//sorts cards by winrate, can enforce minimum #of matches to count
	let cards = Object.keys(dex.cards);
	let filteredWRs = {};
	let cullSlots = [];
	for(let card in cards) {
		filteredWRs[cards[card]] = filteredWinRate(dex, cards[card], filters);
		if(filteredWRs[cards[card]].matches < minMatches || (flagLands && isBoring(cards[card])))
			cullSlots.push(card);
		filteredWRs[cards[card]].wr = winValToWR(filteredWRs[cards[card]])
	}
	cullSlots.reverse();
	for(let card in cullSlots)
		cards.splice(cullSlots[card], 1)
	cards.sort(function(a, b) {
		let result = filteredWRs[b].wr - filteredWRs[a].wr;
		if(result == 0)
			result = filteredWRs[b].wins - filteredWRs[a].wins;
		return result;
	});
	return [cards, filteredWRs];
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

//analyze the dex
function filteredWinRate(dex, card, filters) { 							//returns general card win rate
	let refCard = dex.cards[card];
	let results = {matches:0, wins:0}
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters)){
			if(tourneyFilter(tourney, filters)) {
				let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
				for(let match in refCard.matches[tourney]) {
					let thisMatch = thisTourney.matches[refCard.matches[tourney][match]-1];
					for(let player in thisMatch.players) {
						let list = thisMatch.players[player].list.replace('.txt', '.json');
						if(refCard.decks.includes(list)) {
							results.matches++;
							if(thisMatch.players[player].id == thisMatch.winner)
								results.wins++;
						}
					}
				}
			}
		}
	}
	
	return results;
}
function pairedWinRate(dex, card1, card2, matchFunction, filters) { 	//finds winrates of two cards in a match
	let scoreArray = [0,0];
	if(!dex.cards.hasOwnProperty(card1) || !dex.cards.hasOwnProperty(card2))
		return scoreArray;
	let refCard = dex.cards[card1];
	let pairCard = dex.cards[card2];
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters) && pairCard.matches.hasOwnProperty(tourney)) {
			let pairedMatches = toolbox.arrayDuplicates(refCard.matches[tourney], pairCard.matches[tourney]);
			let scores = matchFunction(dex, card1, card2, tourney, pairedMatches);
			scoreArray[0] += scores[0];
			scoreArray[1] += scores[1];
		}
	}
	return scoreArray;
}
function vsScore(dex, card1, card2, tourney, pairedMatches) {			//finds winrates of one card vs another
	let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
	let thoseMatches = thisTourney.matches;
	let score = [0,0];
	for(let aMatch in pairedMatches) {
		let thisMatch = thisTourney.matches[pairedMatches[aMatch]-1];
		let player1 = thisMatch.players[0];
		let player2 = thisMatch.players[1];
		let winner = thisMatch.winner;
		if(winner != player1.id && winner != player2.id)
			continue; //tie
		let winList = player1.list.replace('.txt', '.json'), loseList = player2.list.replace('.txt', '.json')
		if(winner == player2.id)
			winList = player2.list.replace('.txt', '.json'), loseList = player1.list.replace('.txt', '.json');
		if(dex.cards[card1].decks.includes(winList) && dex.cards[card2].decks.includes(loseList))
			score[0]++;
		if(dex.cards[card1].decks.includes(loseList) && dex.cards[card2].decks.includes(winList))
			score[1]++;
		//check they're in opposite decks, ticks up both in the mirror
	}
	return score;
}
function pairedScore(dex,card1,card2,tourney,pairedMatches) {			//finds winrates of one card when paired with another
	let thisTourney = require('./tourneyArchives/' + tourney + '_archive.json');
	let thoseMatches = thisTourney.matches;
	let score = [0,0];
	for(let aMatch in pairedMatches) {
		let thisMatch = thisTourney.matches[pairedMatches[aMatch]-1];
		let player1 = thisMatch.players[0];
		let player2 = thisMatch.players[1];
		let winner = thisMatch.winner;
		if(winner != player1.id && winner != player2.id)
			continue; //tie
		let winList = player1.list.replace('.txt', '.json'), loseList = player2.list.replace('.txt', '.json')
		if(winner == player2.id)
			winList = player2.list.replace('.txt', '.json'), loseList = player1.list.replace('.txt', '.json');
		if(dex.cards[card1].decks.includes(winList) && dex.cards[card2].decks.includes(winList))
			score[0]++;
		if(dex.cards[card1].decks.includes(loseList) && dex.cards[card2].decks.includes(loseList))
			score[1]++;
		//check they're in the same deck, ticks up both in the mirror
	}
	return score;
}
function unpairedWinRate(dex, card1, card2, filters) { 					//finds winrates of card 1 played without card 2
	let score = [0,0];
	if(!dex.cards.hasOwnProperty(card1) || !dex.cards.hasOwnProperty(card2))
		return [0,0];
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
					let list = thisMatch.players[player].list.replace('.txt', '.json');
					if(refCard.decks.includes(list) && !pairCard.decks.includes(list)){
						if(thisMatch.players[player].id == thisMatch.winner) {
							score[0]++;
						}else{
							score[1]++;
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
				}
			}
		}
	}
	return [p1w, p2w, draw]
}
function playerComboCard(dex, player, card, filters) { 					//finds winrate of a card when played by a particular player vs everyone else
	let playerArray = [0,0];
	let othersArray = [0,0];
	let refCard = dex.cards[card];
	let refPlayer = dex.players[player];
	let scoredMatch = 0;
	for(let tourney in refCard.matches) {
		if(tourneyFilter(tourney, filters)) {
			let archive = require(`./tourneyArchives/${tourney}_archive.json`)
			for(let match in refCard.matches[tourney]){
				let refMatch = archive.matches[refCard.matches[tourney][match]-1];
				for(let play in refMatch.players) {
					let thisPlayer = refMatch.players[play];
					if(refCard.decks.includes(thisPlayer.list.replace('.txt','.json'))) { //in this list yaay
						scoredMatch++;
						let inputArray = playerArray;
						if(thisPlayer.id != player) {
							inputArray = othersArray;
						}
						if(refMatch.winner == thisPlayer.id) {
							inputArray[0]++;
						}else{
							inputArray[1]++;
						}
					}
				}
			}
		}
	}
	return [playerArray, othersArray]
}
function statFromSet(dex, set, exclusion) {			 					//finds winningest cards from a set
	let cardArray = [];
	for(let card in dex.cards) {
		if(!dex.cards[card].hasOwnProperty('set')) {
			let fullname = fuzzy.searchCards(arcana.msem, card)
			dex.cards[card].set = arcana.msem.cards[fullname].prints;
		}
		if(dex.cards[card].set.includes(set) && (!exclusion || dex.cards[card].set.length == 1)){
			cardArray.push(card)
		}
	}
	cardArray.sort(function(a,b) {
		return wr(dex.cards[b]) - wr(dex.cards[a]);
	});
	for(let card in cardArray) {
		if(dex.cards[cardArray[card]].matchWins > 5)
			console.log(cardArray[card] + ": " + wr(dex.cards[cardArray[card]]))
	}
	return cardArray;
}
function statFromDesign(dex, designer) {		 						//finds winningest cards from a designer
	let cardArray = [];
	for(let card in dex.cards) {
		if(arcana.msem.cards[fuzzy.searchCards(arcana.msem, card)].designer == designer){
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
function tourneyInfo(tourneyName) { 									//gives tourney type and truncated date number
	let nameMatch = tourneyName.match(/(gp|league)_(\d+)_(\d+)/i);
	if(nameMatch) {
		let tour = nameMatch[1];
		let date = nameMatch[2] + nameMatch[3];
		date = parseInt(date);
		return [tour, date];
	}
	return [null, 0];
}
function tourneyFilter(tourneyName, tData) {	 						//returns if card passes tourney filters
	let info = tourneyInfo(tourneyName);
	if(tData.hasOwnProperty('after') && tData.after >= info[1]) //before an after check
		return false;
	if(tData.hasOwnProperty('before') && tData.before <= info[1]) //after a before check
		return false;
	if(tData.hasOwnProperty('type') && !tData.type.includes(info[0])) //not an approved type
		return false;
	return true;
}
function buildUsernameData(dex) {										//returns an array of usernames in the dex
	let array = [];
	let array2 = [];
	for(let player in dex.players) {
		if(dex.players[player].username != "PlayerUnknown") {
			array.push(dex.players[player].username)
			array2.push(player)
		}
	}
	return [array, array2];
}
function isBoring(cardName) {											//removes boring lands from topWins
	let thisCard = arcana.msem.cards[cardName];
	if(thisCard.typeLine.match("Basic"))
		return true;
	if(thisCard.prints.includes("SHRINE"))
		return true;
	if(thisCard.cardName == "Nebula of Empty Gold")
		return true;
	if(thisCard.notes.includes("checkland") || thisCard.notes.includes("plagueland") || thisCard.notes.includes("shockfetch") || thisCard.notes.includes("desertshock"))
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

//process commands from Discord
function processFilters(input) {										//process filters into filter objects
	let filters = baseFilters;
	let message = "";
	if(input.match(/filter:? ?all/i))
		return [{}, " without filters"];
	let afFilter = input.match(/filter after:? ?(\d+)/i);
	let befFilter = input.match(/filter before:? ?(\d+)/i);
	let typeFilter = input.match(/filter type:? ?(gp|league)/i);
	if(afFilter)
		filters.after = parseInt(afFilter[1]);
	if(befFilter)
		filters.before = parseInt(befFilter[1]);
	if(typeFilter)
		filters.type = [typeFilter[1]];
	if(filters.hasOwnProperty('after'))
		message += " after " + datify(filters.after);
	if(filters.hasOwnProperty('before'))
		message += " before " + datify(filters.before);
	if(filters.hasOwnProperty('type'))
		message += " in " + filters.type + " tournaments";
	return [filters, message];
}
function processCommands(msg) { 										//processes commands from Discord posts
	let input = msg.content;
	let dex = statDexPreBuilt;
	let filterData = processFilters(input);
	let filters = filterData[0];
	let filterMessage = filterData[1];
	let flagLands = false;
	if(input.match(/nolands/i))
		flagLands = true;
		if(input.match(/cardwin/i)){				//winrates of a card
			let c = input.match(/\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let res = filteredWinRate(dex, card1, filters);
				let output = `${pullSet(card1)} win rate `;
				output += `for matches${filterMessage}\n`;
				output += `${pullSet(card1)} won ${res.wins}/${res.matches} (${winValToWR([res.wins,res.matches],2)}%)\n`
				//output += `Mainboard count: ${res.mainCount}\n`;
				//output += `Sideboard count: ${res.sideCount}\n`
				return output;
			}
		}
		if(input.match(/vsWinRate/i)) {				//X vs Y winrates
			let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let card2 = addNewStatDexCard(dex, c[2]);
				let res = pairedWinRate(dex, card1, card2, vsScore, filters);
				let matchcount = res[0]+res[1];
				let output = `${pullSet(card1)} vs ${pullSet(card2)}:\n`;
				output += `Found ${matchcount} matches${filterMessage}\n`;
				output += `${pullSet(card1)} won ${res[0]}/${matchcount} (${winValToWR([res[0], matchcount])}%)\n`
				output += `${pullSet(card2)} won ${res[1]}/${matchcount} (${winValToWR([res[1], matchcount])}%)`
				return output;
			}
		}
		if(input.match(/unComboWinRate/i)) {		//X - Y winrates
			let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let card2 = addNewStatDexCard(dex, c[2]);
				let res = unpairedWinRate(dex, card1, card2, filters);
				let matchcount = res[0]+res[1];
				let output = `${pullSet(card1)} without ${pullSet(card2)}:\n`;
				output += `Found ${matchcount} matches${filterMessage}\n`;
				output += `Decks playing ${pullSet(card1)} without ${pullSet(card2)} won ${res[0]}/${matchcount} (${winValToWR([res[0], matchcount])}%)\n`
				return output;
			}
		}
		if(input.match(/comboWinRate/i)) {			//X + Y winrates
			let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let card2 = addNewStatDexCard(dex, c[2]);
				let res = pairedWinRate(dex, card1, card2, pairedScore, filters);
				let matchcount = res[0]+res[1];
				let output = `${pullSet(card1)} comboed with ${pullSet(card2)}:\n`;
				output += `Found ${matchcount} matches${filterMessage}n`;
				output += `Decks playing both ${pullSet(card1)} and ${pullSet(card2)} won ${res[0]}/${matchcount} (${winValToWR([res[0], matchcount])}%)\n`
				return output;
			}
		}
		if(input.match(/playerComboCard/i)) {		//winrates of a player with a card
			let c = input.match(/(.*) ?playerComboCard ?\[([^\]]+)\]/i);
			if(c) {
				console.log(c);
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
				let res = playerComboCard(dex, play1, card1, filters);
				let matchcount1 = res[0][0]+res[0][1];
				let matchcount2 = res[1][0]+res[1][1];
				let output = `${pullSet(card1)} being played by ${playName}:\n`;
				output += `Found ${matchcount1} matches${filterMessage}\n`;
				output += `Decks where ${playName} plays ${pullSet(card1)} won ${res[0][0]}/${matchcount1} (${winValToWR([res[0][0], matchcount1])}%)\n`
				output += `${pullSet(card1)} being played by other people:\n`;
				output += `Found ${matchcount2} matches${filterMessage}\n`;
				output += `Decks where literally anyone else plays ${pullSet(card1)} won ${res[1][0]}/${matchcount2} (${winValToWR([res[1][0], matchcount2])}%)\n`
				return output;
			}
		}
		if(input.match(/topWinVs/i)){				//top N winrates vs a particular card
			let c = input.match(/\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let cardsArray = [];
				let filteredWRs = {};
				let topN = 10;
				let minMatch = 0;
				let minMatchMatch = input.match(/min: ?(\d+)/i);
				if(minMatchMatch)
					minMatch = parseInt(minMatchMatch[1]);
				for(let card in dex.cards) {
					let res = pairedWinRate(dex, card1, card, vsScore, filters);
					let matchcount = res[0]+res[1];
					let winRate = winValToWR([res[1], matchcount]);
					if(winRate > 0 && matchcount >= minMatch && !(flagLands && isBoring(card))){
						cardsArray.push(card)
						filteredWRs[card] = {};
						filteredWRs[card].wr = winRate;
						filteredWRs[card].mc = matchcount;
					}
				}
				cardsArray.sort(function(a,b){
					let result = filteredWRs[b].wr - filteredWRs[a].wr
					if(result == 0)
						result = filteredWRs[b].mc - filteredWRs[a].mc
					return result;
				});
				let topNMatch = input.match(/count: ?(\d+)/i);
				if(topNMatch)
					topN = parseInt(topNMatch[1]);
				if(topN > cardsArray.length)
					topN = cardsArray.length;
				if(topN > 50)
					topN = 50;
				let mess = `Top ${topN} winrates against ${pullSet(card1)} with at least ${minMatch} matches and${filterMessage}\n`;
				for(var i=0; i<topN; i++)
					mess += `${i+1}: ${pullSet(cardsArray[i])} (${filteredWRs[cardsArray[i]].wr}%)\n`;
				return mess;
			}
		}
		if(input.match(/topWin/i)) {				//top N winrates
			let minMatch = 0;
			let topN = 10;
			let minMatchMatch = input.match(/min: ?(\d+)/i);
			if(minMatchMatch)
				minMatch = parseInt(minMatchMatch[1]);
			let wrData = sortWinRates(dex, minMatch, filters, flagLands);
			let array = wrData[0];
			let topNMatch = input.match(/count: (\d+)/i);
			if(topNMatch)
				topN = parseInt(topNMatch[1]);
			if(topN > array.length)
				topN = array.length;
			if(topN > 50)
				topN = 50;
			let mess = `Top ${topN} winrates with at least ${minMatch} matches and${filterMessage}\n`;
			for(var i=0; i<topN; i++) {
				mess += `${i+1}: ${pullSet(array[i])} (${wrData[1][array[i]].wr}%)\n`;
			}
			return mess;
		}
		if(input.match(/playerVs/i)) {				//player vs player winrate
			let c = input.match(/([^ \n]+) playerVs ([^ \n]+)/i);
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
				return `${player1.username} has a ${winData[0]}-${winData[1]}-${winData[2]} record (${winValToWR([winData[0],(winData[0]+winData[1]+winData[2])])}%) when playing against ${player2.username}`;
			}
		}
	/* finish api
		if(input.match(/setWinRate/i)) {			//finds most wins in set
			statFromSet(statDexPreBuilt, "DOA", false)
		}
		if(input.match(/designerWinRate/i)) {		//finds most wins by designer
			statFromDesign(statDexPreBuilt, "Pipsqueak")
		}
		//disabled on live
		
		if(input.match(/buildDefaultDex/i)) {		//builds statDex
			statDex = buildStatDex(archiveArray);
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
		}
	*/
}


function playrateGenerator(dex, filters){								//generates playRate data for each card
	let miniDex = {}; 								//holds our cards and calc'd playrate values
	let deckCount = 0;								//keep track of how many decks we've checked
	for(tourney in dex.tournaments){
		if(tourneyFilter(tourney, filters)){
			for(let list in dex.tournaments[tourney]) {
				deckCount++;
				let listName = dex.tournaments[tourney][list];
				let thisList = dex.decklists[listName];
				for(let card in thisList.cards) {
					let thisCard = thisList.cards[card];
					if(!miniDex.hasOwnProperty(card))
						miniDex[card] = {decks:0, mainCount:0, sideCount:0, allCount:0, setCount:0};
					miniDex[card].decks++;
					miniDex[card].mainCount += thisCard.mainCount;
					miniDex[card].sideCount += thisCard.sideCount;
					miniDex[card].allCount += thisCard.mainCount + thisCard.sideCount;
					if(thisCard.mainCount + thisCard.sideCount >= 4)
						miniDex[card].setCount++;
				}
			}
		}
	}
	for(let card in miniDex) {
		miniDex[card].wr = winValToWR(filteredWinRate(dex, card, filters), 2);
	}
	return [miniDex, deckCount];
}
function playrateReporter(info) {										//sorts and reports playRate data
	let miniDex = info[0];
	let deckCount = info[1];
	let cards = Object.keys(miniDex);
	cards.sort(function(a, b){
		let result = miniDex[b].wr*miniDex[b].decks - miniDex[a].wr*miniDex[a].decks;
		if(result == 0)
			result = miniDex[b].wr*miniDex[b].allCount - miniDex[a].wr*miniDex[a].allCount
		if(result == 0)
			result = miniDex[b].wr*miniDex[b].mainCount - miniDex[a].wr*miniDex[a].mainCount
		if(result == 0)
			result = miniDex[b].wr*miniDex[b].sideCount - miniDex[a].wr*miniDex[a].sideCount
		if(result == 0)
			result = miniDex[b].wr*miniDex[b].setCount - miniDex[a].wr*miniDex[a].setCount
		return result;
	});
	let i = 0;
	console.log("CardName,,Play%,,Win%,,flaggedLand");
	for(let card in cards) {
		console.log(`${pullSet(cards[card])},,${parseFloat(100*miniDex[cards[card]].decks/deckCount).toFixed(2)},,${miniDex[cards[card]].wr},,${(isBoring(cards[card]) ? "Y" : "N")}`)
	}
}

//exports for live
exports.initialize = initialize
exports.processCommands = processCommands