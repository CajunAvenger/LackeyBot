var arcana = require('./arcana.js');
var archiveArray = [];
var baseFilters = {after:2004}
const bye = "343475440083664896"; //bye player id for matchDex
var fs = require('fs');
var fuzzy = require('./fuzzy.js');
var statDex = {cards:{}, players:{}, global:{matches:0, decks:0, playedCards:0}};
var toolbox = require('./toolbox.js');
var statDexPreBuilt = statDex;
try{
	statDexPreBuilt = require('./statDex.json')
}catch(e){
	console.log('No prebuild statDex available.')
}

//setup
function initialize(data){										//copy LackeyBot's edits when on live
	arcana = data.arcana;
	loadArchives();
}
function loadArchives(cb) { 									//reads the archived tournament files
	fs.readdir("tourneyArchives",function(err, array) {
		archiveArray = array;
		if(cb)
			cb();
	});
}
function fixFiles(fixArray) { 									//update older/broken files
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

//build dexes
function buildStatDex(decksArray) { 							//builds a statDex from an array of decklist folders
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
function generateFilteredDex(filters) { 						//returns a smaller statDex following certain filters
	let filteredArray = [];
	for(let folder in archiveArray) {
		if(tourneyFilter(archiveArray[folder], filters))
			filteredArray.push(archiveArray[folder]);
	}
	return buildStatDex(filteredArray);
}
function addNewStatDexCard(dex, card) { 						//adds a new card to statDex
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

//compile final data
function statDexStats(dex) { 									//writes card spreadsheet of statDex
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
function playerWinRate(dex) { 									//writes player spreadsheet of statDex
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
function sortWinRates(dex, minMatches) { 						//sorts cards by winrate, can enforce minimum #of matches to count
	let cards = Object.keys(dex.cards);
	cards.sort(function(a, b) {
		let result;
		if(minMatches) {
			result = mc(dex.cards[b], minMatches) - mc(dex.cards[a], minMatches)
			if(result != 0)
				return result
		}
		result = wr(dex.cards[b]) - wr(dex.cards[a]);
		if(result == 0)
			result = dex.cards[b].matchWin - dex.cards[a].matchWin;
		return result;
	});
	return cards;
}

//analyze the dex
function pairedWinRate(dex, card1, card2, matchFunction) { 		//finds winrates of two cards in a match
	let scoreArray = [0,0];
	if(!dex.cards.hasOwnProperty(card1) || !dex.cards.hasOwnProperty(card2))
		return scoreArray;
	let refCard = dex.cards[card1];
	let pairCard = dex.cards[card2];
	for(let tourney in refCard.matches) {
		if(pairCard.matches.hasOwnProperty(tourney)) {
			let pairedMatches = toolbox.arrayDuplicates(refCard.matches[tourney], pairCard.matches[tourney]);
			let scores = matchFunction(dex, card1, card2, tourney, pairedMatches);
			scoreArray[0] += scores[0];
			scoreArray[1] += scores[1];
		}
	}
	return scoreArray;
}
function vsScore(dex, card1, card2, tourney, pairedMatches) {	//finds winrates of one card vs another
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
function pairedScore(dex,card1,card2,tourney,pairedMatches) {	//finds winrates of one card when paired with another
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
function unpairedWinRate(dex, card1, card2) { 					//finds winrates of card 1 played without card 2
	let score = [0,0];
	if(!dex.cards.hasOwnProperty(card1) || !dex.cards.hasOwnProperty(card2))
		return [0,0];
	let refCard = dex.cards[card1];
	let pairCard = dex.cards[card2];
	for(let tourney in refCard.matches) {
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
	return score;
}
function playerFace (p1id, p2id, dex) { 						//find wins of player 1 vs player 2
	let player1 = dex.players[p1id];
	let player2 = dex.players[p2id];
	let p1w = 0;
	let p2w = 0;
	for(let tourney in player1.matches) {
		let tFile = require(`./tourneyArchives/${tourney}_archive.json`);
		if(tourney.match(/^league/)){
			for(let match in player1.matches[tourney]) {
				if(player2.matches.hasOwnProperty(tourney) && player2.matches[tourney].includes(player1.matches[tourney][match])) {
					let theMatch = tFile.matches[player1.matches[tourney][match]-1];
					if(theMatch.winner == p1id) {
						p1w++
					}else if(theMatch.winner == p2id) {
						p2w++;
					}
				}
			}
		}
	}
	return [p1w, p2w]
}
function playerComboCard(dex, player, card) { 					//finds winrate of a card when played by a particular player vs everyone else
	let playerArray = [0,0];
	let othersArray = [0,0];
	let refCard = dex.cards[card];
	let refPlayer = dex.players[player];
	let uniqMatch = 0;
	let scoredMatch = 0;
	for(let tourney in refCard.matches) {
		let archive = require(`./tourneyArchives/${tourney}_archive.json`)
		for(let match in refCard.matches[tourney]){
			let heyWait = 0;
			let refMatch = archive.matches[refCard.matches[tourney][match]-1];
			uniqMatch++;
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
				}else{
					heyWait++
				}
			}
			if(heyWait == 2){
				console.log(refMatch.players[0].list)
				console.log(refMatch.players[1].list)
			}
		}
	}
	return [playerArray, othersArray]
}
function findPipsWR(dex, card) { 								//finds winrate of card by pip vs everyone else
	return playerComboCard(dex, "107957368997834752", card);
}
function statFromSet(dex, set, exclusion) { 					//finds winningest cards from a set
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
function statFromDesign(dex, designer) { 						//finds winningest cards from a designer
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
function wr(statCard) { 										//returns card's winrate
	let matchCount = statCard.matchWins + statCard.matchLoss + statCard.matchDraw
	return statCard.matchWins / matchCount;
}
function mc(statCard, minMatches) { 							//returns number of matches a card is in
	let matchCount = statCard.matchWins + statCard.matchLoss + statCard.matchDraw;
	if(minMatches) {
		if(matchCount >= minMatches)
			return 1;
		return 0;
	}
	return matchCount;
}
function printCardDetails(dex, card) { 							//returns general card stats
	let refCard = dex.cards[card];
	console.log(`wins: ${refCard.matchWins}`)
	console.log(`losses: ${refCard.matchLoss}`)
	console.log(`draws: ${refCard.matchDraw}`)
	console.log(`deckCount: ${refCard.decks.length}`)
	let matchCount = 0
	for(let tourney in refCard.matches){
		matchCount += refCard.matches[tourney].length;
	}
	console.log(`matchCount: ${matchCount}`);
}
function tourneyInfo(tourneyName) { 							//gives tourney type and truncated date number
	let nameMatch = tourneyName.match(/(gp|league)_(\d+)_(\d+)/i);
	if(nameMatch) {
		let tour = nameMatch[1];
		let date = nameMatch[2] + nameMatch[3];
		date = parseInt(date);
		return [tour, date];
	}
	return [null, 0];
}
function tourneyFilter(tourneyName, tData) { 					//returns if card passes tourney filters
	let info = tourneyInfo(tourneyName);
	if(tData.hasOwnProperty('after') && tData.after >= info[1]) //before an after check
		return false;
	if(tData.hasOwnProperty('before') && tData.before <= info[1]) //after a before check
		return false;
	if(tData.hasOwnProperty('type') && !tData.type.includes(info[0])) //not an approved type
		return false;
	return true;
}

//process commands from Discord
function processCommands(msg) { 								//processes commands from Discord posts
	let input = msg.content;
	let dex = statDexPreBuilt;

		if(input.match(/vsWinRate/i)) {				//X vs Y winrates
			let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let card2 = addNewStatDexCard(dex, c[2]);
				let res = pairedWinRate(dex, card1, card2, vsScore);
				let matchcount = res[0]+res[1];
				let output = `${card1} vs ${card2}:\n`;
				output += `Found ${matchcount} matches.\n`;
				output += `${card1} won ${res[0]}/${matchcount} (${Math.trunc(100*res[0]/matchcount)}%)\n`
				output += `${card2} won ${res[1]}/${matchcount} (${Math.trunc(100*res[1]/matchcount)}%)`
				return output;
			}
		}
		if(input.match(/unComboWinRate/i)) {		//X - Y winrates
			let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let card2 = addNewStatDexCard(dex, c[2]);
				let res = unpairedWinRate(dex, card1, card2);
				let matchcount = res[0]+res[1];
				let output = `${card1} without ${card2}:\n`;
				output += `Found ${matchcount} matches.\n`;
				output += `Decks playing ${card1} without ${card2} won ${res[0]}/${matchcount} (${Math.trunc(100*res[0]/matchcount)}%)\n`
				return output;
			}
		}
		if(input.match(/comboWinRate/i)) {			//X + Y winrates
			let c = input.match(/\[([^\]]+)\](?: | ?vs.? ?)?\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let card2 = addNewStatDexCard(dex, c[2]);
				let res = pairedWinRate(dex, card1, card2, pairedScore);
				let matchcount = res[0]+res[1];
				let output = `${card1} comboed with ${card2}:\n`;
				output += `Found ${matchcount} matches.\n`;
				output += `Decks playing both ${card1} and ${card2} won ${res[0]}/${matchcount} (${Math.trunc(100*res[0]/matchcount)}%)\n`
				return output;
			}
		}
		if(input.match(/playerComboCard/i)) {		//winrates of a player with a card
			let c = input.match(/\[([^\]]+)\]/);
			if(c) {
				let card1 = addNewStatDexCard(dex, c[1]);
				let res = playerComboCard(dex, msg.author.id, card1);
				let matchcount1 = res[0][0]+res[0][1];
				let matchcount2 = res[1][0]+res[1][1];
				let output = `${card1} being played by ${msg.author.username}:\n`;
				output += `Found ${matchcount1} matches.\n`;
				output += `Decks where ${msg.author.username} plays ${card1} won ${res[0][0]}/${matchcount1} (${Math.trunc(100*res[0][0]/matchcount1)}%)\n`
				output += `${card1} being played by other people:\n`;
				output += `Found ${matchcount2} matches.\n`;
				output += `Decks where literally anyone else plays ${card1} won ${res[1][0]}/${matchcount2} (${Math.trunc(100*res[1][0]/matchcount2)}%)\n`
				return output;
			}

		}
		if(input.match(/top/i)) {					//top N winrates
			let minMatch = 0;
			let topN = 10;
			let minMatchMatch = input.match(/min: ?(\d+)/i);
			if(minMatchMatch)
				minMatch = parseInt(minMatchMatch[1]);
			let array = sortWinRates(dex, minMatch);
			let topNMatch = input.match(/top (\d+)/i);
			if(topNMatch)
				topN = parseInt(topNMatch[1]);
			if(topN > array.length)
				topN = array.length;
			if(topN > 50)
				topN = 50;
			let mess = `Top ${topN} winrates with at least ${minMatch} matches:\n`;
			let lastNo = 101;
			for(var i=0; i<topN; i++) {
				let thisNo = Math.trunc(100*wr(dex.cards[array[i]]));
				if(thisNo <= lastNo) {
					mess += `${i+1}: ${array[i]} (${thisNo}%)\n`;
					lastNo = thisNo;
				}
			}
			return mess;
		}
	/* finish api
		if(input.match(/setWinRate/i)) {			//finds most wins in set
			statFromSet(statDexPreBuilt, "DOA", false)
		}
		if(input.match(/designerWinRate/i)) {		//finds most wins by designer
			statFromDesign(statDexPreBuilt, "Pipsqueak")
		}
		if(input.match(/playerVs/i)) {				//player vs player winrate
			let play1 = '107957368997834752';
			let play2 = '180885469037461504';
			console.log(playerFace(play1, play2, statDexPreBuilt))
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
/*console.log(processCommands("vsWinRate [Exeunt][Zhedina Envoy]"))
loadArchives(function(){
	let filters = {type:["league"]}
	statDex = generateFilteredDex(baseFilters);
	sortWinRates(statDex, 1);
});*/
//exports for live
exports.initialize = initialize
exports.processCommands = processCommands