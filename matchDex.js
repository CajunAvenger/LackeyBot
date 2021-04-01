var config = require('./config/lackeyconfig.js').config;
let admin = config.dev;
let arcana = require('./arcana.js');
let botname = config.live.botname;
var {azArray} =('./emoteBuffet.js');
var toolbox = require('./toolbox.js');
var Discord = require('discord.js');
var eris = require('./eris.js');
var Client = eris.Client();
var dbx = require('./boxofmud.js');
var fs = require('fs');
var fuzzy = require('./fuzzy.js');
var version = require('./version.js');
var gpDex = require('./gpDex.js');
var matchDex = {};
var stats = require('./stats.js');
const bye = "343475440083664896";//bye player id
var tournamentNames = '(gp|league)', organizers = [admin, config.login.TO], tournamentChannels = [config.login.comp, config.login.league, config.login.cnm, config.login.sealed];
var tournamentReges = ['GP[A-Z]', 'league'];
var gpCell = []; //holds to-be-deleted tournaments
var { //emote buffet
	yeet, boop,
	azArray, azEmoteArray,
	blank, resetList, leftArrow, rightArrow,
	old_plainText, old_xEmote, plainText,
	xEmote, tieEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');

function messageHandler(msg, perms) {													//converts discord messsage into matchDex scripts
	if(perms.includes(0)) { //admin commands
		if(msg.content.match(/!force/)) {
			if(msg.content.match(/!forceplayer/)) {
				let id = msg.content.match(/id: ?([0-9]+)/);
				let tourney = msg.content.match(/tourna?m?e?n?t?y?: ?([^\n]+)/);
				if(id[1] && tourney[1]) {
					msg.channel.send(addNewPlayer(tourney[1], id[1], true));
				}
			}else if(msg.content.match(/!forcematch/)) {
				let p1 = msg.content.match(/p1: ?([0-9]+)/);
				let p2 = msg.content.match(/p2: ?([0-9]+)/);
				let tourney = msg.content.match(/tourna?m?e?n?t?y?: ?([^\n]+)/);
				let koM = msg.content.match(/ko/);
				let ko = false;
				if(koM)
					ko = true;
				if(p1[1] && p2[1] && tourney[1]) {
					msg.channel.send(newGPMatch(tourney[1], p1[1], p2[1], ko))
				}
			}
		}
		if(msg.content.match(/!matchpatch/)) {
			let t = msg.content.match(/tourney: ?([^\n]+)/i);
			let m = msg.content.match(/match: ?(\d+)/i);
			if(t && m)
				msg.channel.send(matchPatch(t[1], m[1], msg.content))
		}
		if(msg.content.match(/!newmatch/)) {
			let tourney = msg.content.match(/!newmatch ([^\n]+)/)[1];
			let p1 = msg.content.match(/p1: ?(\d+)/)[1];
			let p2 = msg.content.match(/p2: ?(\d+)/)[1];
			if(matchDex[tourney].data.pairing == "league") {
				let p1w = msg.content.match(/p1w: ?(\d+)/);
				let p2w = msg.content.match(/p2w: ?(\d+)/);
				let match = msg.content.match(/match: ?(\d+)/);
				if(p1w) {
					p1w = p1w[1];
				}else{
					p1w = 0;
				}
				if(p2w) {
					p2w = p2w[1];
				}else{
					p2w = 0;
				}
				if(match) {
					match = match[1];
				}else{
					match = 0;
				}
				if(!matchDex[tourney].players[p1].runs.length) {
					matchDex[tourney].players[p1].runs = [{matches:[], dropLink:""}];
					matchDex[tourney].players[p1].currentRun = 1;
				}
				if(!matchDex[tourney].players[p2].runs.length) {
					matchDex[tourney].players[p2].runs = [{matches:[], dropLink:""}];
					matchDex[tourney].players[p2].currentRun = 1;
				}
				msg.channel.send(updateMatch(tourney, p1, p2, p1w, p2w, match));
				if(msg.content.match(/await/)) {
					let matchNo = matchDex[tourney].matches.length;
					matchDex[tourney].players[p1].awaitingMatches.push(matchNo);
					matchDex[tourney].players[p2].awaitingMatches.push(matchNo);
					if(!matchDex[tourney].awaitingMatches)
						matchDex[tourney].awaitingMatches = [];
					matchDex[tourney].awaitingMatches.push(matchNo);
					version.logMatch(matchDex);
				}
		}else{
				newGPMatch(tourney, p1, p2, false)
			}
		}
		let lbAdder = msg.content.match(/!addlb ([\s\S]+)/i);
		if(lbAdder){
			msg.channel.send(addLackeyBot(lbAdder[1]));
		}
		let tourneyAdder = msg.content.match(/!editmatch/i);
		if(tourneyAdder) {
			let tourneyname = msg.content.match(/name: ([^\n]+)/i);
			if(tourneyname && matchPermit(msg, tourneyname[1])) {
				tourneyname = tourneyname[1];
				let pairing = null, TO = null, EO = null, channel = null, rematch = null, runLength = null, set = null, subName = null, pingtime = null, crownID = null, reg = null;

				let pairCheck = msg.content.match(/pairing: (swiss-knockout|swiss|league)/i);
				let toCheck = msg.content.match(/TO: ([^\n]+)/i);
				let eoCheck = msg.content.match(/EO: ([^\n]+)/i);
				let channelCheck = msg.content.match(/channel: ([^\n]+)/i);
				let rematchCheck = msg.content.match(/rematch: ([^\n]+)/i);
				let runsCheck = msg.content.match(/runLength: ([^\n]+)/i);
				let setCheck = msg.content.match(/set: ([^\n]+)/i);
				let subNameCheck = msg.content.match(/subtitle: ([^\n]+)/i);
				let timeCheck = msg.content.match(/pingtime: (\d+) ([^\n]+)/i);
				let crownCheck = msg.content.match(/crown: (\d+)/i);
				let regCheck = msg.content.match(/regex: ([^\n]+)/i);
				let delCheck = msg.content.match(/delete: ?true/i);
				if(delCheck) {
					if(!matchDex.hasOwnProperty(tourneyname)) {
						msg.channel.send('Tourney not found.');
						return;
					}else if(matchDex[tourneyname].matches.length){
						msg.channel.send('Tourney must be archived before deletion.');
						return;
					}else{
						delete matchDex[tourneyname];
						msg.channel.send(`${tourneyname} deleted.`)
					}
				}else{
					if(pairCheck)
						pairing = pairCheck[1];
					if(toCheck) {
						TO = toCheck[1];
						if(TO.match(/me/i))
							TO = msg.author.id;
					}
					if(eoCheck)
						EO = eoCheck[1];
					if(channelCheck)
						channel = channelCheck[1];
					if(rematchCheck)
						rematch = rematchCheck[1];
					if(runsCheck)
						runLength = runsCheck[1];
					if(setCheck)
						set = setCheck[1];
					if(subNameCheck)
						subName = subNameCheck[1];
					if(timeCheck)
						pingtime = [parseInt(timeCheck[1]), timeCheck[2]];
					if(crownCheck)
						crownID = crownCheck[1]
					if(regCheck)
						reg = regCheck[1]
					
					if(!matchDex.hasOwnProperty(tourneyname)) {
						matchDex[tourneyname] = {matches:[], players:{}, round:0, awaitingMatches:[], data:{}};
						msg.channel.send("Tournament created!");			
					}else{
						msg.channel.send("Tournament edited.");
					}
					if(TO)
						matchDex[tourneyname].data.TO = TO;
					if(EO)
						matchDex[tourneyname].data.EO = EO;
					if(pairing)
						matchDex[tourneyname].data.pairing = pairing;
					if(channel)
						matchDex[tourneyname].data.channel = channel;
					if(rematch)
						matchDex[tourneyname].data.rematch = parseInt(rematch);
					if(runLength)
						matchDex[tourneyname].data.runLength = parseInt(runLength);
					if(set)
						matchDex[tourneyname].data.set = set;								
					if(subName)
						matchDex[tourneyname].data.name = subName;
					if(pingtime)
						matchDex[tourneyname].data.time = pingtime;
					if(crownID)
						matchDex[tourneyname].data.crown = crownID;
					if(reg) {
						matchDex[tourneyname].data.submitRegex = reg;
					}else if(!matchDex[tourneyname].data.submitRegex){
						matchDex[tourneyname].data.submitRegex = tourneyname;
					}
				}
				version.logMatch(matchDex);
				let matchString = '('
				tournamentReges = [];
				for(let tourney in matchDex) {
					if(tourney != "version") {
						matchString += tourney + '|'
						if(matchDex[tourney].data.submitRegex)
							tournamentReges.push(matchDex[tourney].data.submitRegex);
					}
				}
				matchString = matchString.replace(/\|$/, ")");
				tournamentNames = matchString;
				if(TO && !organizers.includes(TO))
					organizers.push(TO);
				if(channel) {
					if(!tournamentChannels.includes(channel)) {
						tournamentChannels.push(channel);
					}else{
						msg.channel.send("This channel is already set for another tournmanent.")
					}
				}
			}else{
				let output = "Use !editmatch to edit matchDex tournaments.\n";
				output += "**name**: name of the tournament behind the scenes. Determines the name of $gpleader and $report gp.\n";
				output += "**subtitle**: the name used for front facing things. Used for things like \"Your CNM Matches\" and \"Round 1 of GPL\"\n";
				output += "**TO**: id of Tournament Organizer\n";
				output += "**EO**: id of Event Organizer role\n";
				output += "**pairing**: tournament pairing. Supports swiss, knockout, swiss-knockout, and league\n";
				output += "**channel**: the channel id where the tournament is housed\n";
				output += "**rematch**: in leagues, the number of rematches allowed\n";
				output += "**runLength**: in leagues, the number of matches in a run. Leave blank for unlimited lengths\n";
				output += "**set**: in sealed leagues, the set to generate pools from\n";
				output += "**pingtime**: after pushing a round, set a reminder to check on them after this time\n";
				msg.channel.send(output);
			}
		}	
	}

	//TO commands
	let permCheckMatch  = msg.content.match(/!permit ([^\n]+)/)
	if(permCheckMatch && matchDex.hasOwnProperty(permCheckMatch[1].toLowerCase()))
		msg.channel.send(matchPermit(msg, permCheckMatch[1]))
	var archiveMatch = msg.content.match(/!archive ?(.*)/i);
	var killMatch = msg.content.match(/!delete ?(.*)/i);
	if(killMatch && !killMatch[1].match(/^ ?https:\/\//) && matchPermit(msg, killMatch[1])) {
		if(gpCell[0] && gpCell[0][killMatch[1]]) {
			if(killMatch[1] != 'league')
				msg.channel.send(deleteTourney(killMatch[1]));
			if(killMatch[1] == 'league')
				msg.channel.send(rolloverTourney('league',1));
			gpCell = [];
		}else{
			archiveMatch = killMatch
		}
	}
	let contCheck = msg.content.match(/!continue ?(league|primordial)/);
	if(contCheck && gpCell[0] && gpCell[0][contCheck[1]] && matchPermit(msg, contCheck[1]))
		msg.channel.send(rolloverTourney(contCheck[1],0));
	if(archiveMatch) {
		gpCell = resetTourney(archiveMatch[1])
		msg.channel.send(gpCell[1]);
		setTimeout(function() {
			matchDex = require('./msem/matchDex.json');
			console.log('matchDex has reloaded');
		}, 1000*60*5)
	}
	//matchDex maintenance
	let nulRegex = new RegExp('!null ' + tournamentNames + ' ([0-9]+)','i')
	var nulMatch = msg.content.match(nulRegex)
	if(toolbox.hasValue(nulMatch) && matchPermit(msg, nulMatch[1])) {
		msg.channel.send(nullMatch(nulMatch[1], parseInt(nulMatch[2])));
	}
	let pushRegex = new RegExp('!push ?' + tournamentNames,'i')
	let pushMatch = msg.content.match(pushRegex);
	if(pushMatch && matchPermit(msg, pushMatch[1])) { //move to next round
		let message = "";
		let tourney = pushMatch[1].toLowerCase();
		if(matchDex[tourney].data.pairing != "league") {
			if(matchDex[tourney].matches.length == 0) {
				matchDex[tourney].round++;
				message = startTourney(tourney);
			}else{
				message = pushTourney(tourney);
			}
			if(message != "" && !message.match(/^The following matches/)) {
				postTourney(tourney, message, msg.author.id, msg.channel.id);
			}else if(message.match(/^The following matches/)) {
				msg.channel.send(message)
			}
		}
	}
	/*if(msg.content.match(/!ping ?gp/i)) {
		msg.channel.send("```\n"+pingTourney('gp')+"```");
	}*/
	let playerRegex = new RegExp('!players ?' + tournamentNames,'i');
	let playerMatch = msg.content.match(playerRegex);
	if(playerMatch && matchPermit(msg, playerMatch[1])) {
		msg.channel.send(writePlayerIndexes(playerMatch[1].toLowerCase()));
	}
	let dropRegex = new RegExp('!(un)?drop ?' + tournamentNames + ' ?player ([0-9]+)','i')
	let dropMatch = msg.content.match(dropRegex);
	if(dropMatch && matchPermit(msg, dropMatch[2])) {
		let tourney = dropMatch[2].toLowerCase();
		let playing = 0;
		if(dropMatch[1])
			playing = 1;
		let refIndex = Object.keys(matchDex[tourney].players);
		msg.channel.send(dropTourneyPlayer(tourney, refIndex[dropMatch[3]], playing));
		version.logMatch(matchDex);
	}
	if(msg.content.match(/\$match ?h?elp/i)){
		msg.channel.send(adminHelpMessage());
	}

	
	let gpName, isLeague;
	for(let t in matchDex) {
		if(matchDex[t].hasOwnProperty('data') && matchDex[t].data.hasOwnProperty('channel')) {
			if(matchDex[t].data.channel == msg.channel.id && !gpName) {
				gpName = t;
				isLeague = (matchDex[gpName].data.pairing == "league");
			}
		}
	}
	var listMatch = msg.content.match(/([0-9]+)x?[ ]+([^\n]+)(\n|$)/i);
	var listBulk = msg.content.match(/([0-9]+)x?[ ]+([^\n]+)\n/ig)
	var deckMatch = msg.content.match(/^\$fancy ?([^\n]+)?/i);
	if(deckMatch !== null && listMatch !== null) {
		deckName = deckMatch[1];
		fancification(msg.content, msg.author, deckName);
		stats.upBribes(1);
	}
	let deckCheckMatch = msg.content.match(/^\$deckcheck ?([^\n]+)?/i);
	if(deckCheckMatch && listMatch) {
		let legalData = makeFancyDeck(msg.content, "test", "fancy")[1];
		msg.channel.send(writeLegal(legalData));
		stats.upBribes(1);
	}
	let subMatch = msg.content.match(/\$submit/i);
	let uploadcheck;
	if(subMatch) {
		uploadcheck = "\\$submit (";
		for(let r in tournamentReges)
			uploadcheck += tournamentReges[r] + "|";
		uploadcheck = uploadcheck.replace(/\|$/, ") ?([^\\n]+)?");
		uploadcheck = new RegExp(uploadcheck, 'i');
	}
	if(uploadcheck)
		uploadcheck = msg.content.match(uploadcheck);
	if(uploadcheck) {
		if(botname != "TestBot")
			Client.channels.cache.get('634557558589227059').send("```\n"+msg.content.replace("$",'')+"```");
		deckName = uploadcheck[2];
		let user = msg.author;
		if(msg.author.id == admin && msg.content.match(/override/)) {
			let spoofMatch = msg.content.match(/override (\d+)/i);
			if(spoofMatch)
				user = eris.pullPing(spoofMatch[1]);
		}
		let tourneyname = uploadcheck[1].toLowerCase();
		if(tourneyname.match(/primordial/i)) { //primordial deckcheck
			if(!listMatch) {
				uploadcheck = null;
			}else{
				let checkSet = tourneyname.match(/primordial ([A-Z0-9]+)/i);
				if(checkSet) {
					let checkedSet = checkSet[1].toUpperCase(); //the set to check legality on
					if(checkedSet.match(/(WAW|DOA|101|STN|CAC|MAC|MS1|MS2)/)) {
						msg.channel.send("Mono-rarity and Masters sets (101, CAC, DOA, MAC, STN, WAW, MS1, MS2) are illegal in Primordial.");
						return;
					}
					let deckContent = giveFancyDeck(msg.content, msg.author, deckName,0,['Primordial',checkedSet], arcana.msem);
					if(deckContent[1].match(/This deck is legal in Primordial!/)) {
						let path = '/pie/' + toolbox.stripEmoji(msg.author.username) + '.txt';
						dbx.dropboxUpload(path, deckContent[0])
						msg.author.send(uploadcheck[1] + " decklist submitted!");
						if(botname != "TestBot")
							Client.guilds.cache.get('317373924096868353').members.cache.get(msg.author.id).roles.add('588781514616209417');
						if(matchDex.pie.round > 0) {
							//deckContent[1] = "";
							msg.author.send("Sorry, but deck submissions for the GP are closed!");
						}
						if(matchDex.pie.round == 0) {
							msg.channel.send(addNewPlayer('pie', msg.author.id).replace("pie", tourneyname));
							addNewRun("pie",msg.author.id,toolbox.stripEmoji(msg.author.username),deckName)
							version.logMatch(matchDex);
						}
					}
				}
			}
		}else if(uploadcheck[1].match(/sealed/i)){ //sealed deck give
			let addNew = addNewPlayer("sealed", msg.author.id);
			if(addNew != "") {
				msg.channel.send(addNew);
				let deckContent = giveSealedDeck(6, ['Sealed', matchDex['sealed'].data.set])
				msg.channel.send(deckContent[0]);
				let path = '/sealed/' + toolbox.stripEmoji(msg.author.username) + '.txt';
				addNewRun("sealed",msg.author.id, toolbox.stripEmoji(msg.author.username), msg.author.username+"'s Sealed Pool");
				dbx.dropboxUpload(path, deckContent[1])
				version.logMatch(matchDex);
			}
		}else if(uploadcheck[1].match(/tuc/i)){
			if(matchDex.tuc.players.hasOwnProperty(user.id)) {
				if(matchDex.tuc.round > 0) {
					msg.channel.send("The tournament has started, decklists can't be changed.");
				}else{
					if(!listMatch) {
						uploadcheck = null;
					}else{
						let deckContent = giveFancyDeck(msg.content, msg.author, deckName, 0, ['Team Unified Constructed'], arcana.msem);
						addNewRun('tuc', user.id, toolbox.stripEmoji(user.username), deckName, tourneyname)
						version.logMatch(matchDex);
						if(deckContent[1].match(/This deck is legal/)) {
							let path = toolbox.lastElement(matchDex.tuc.players[user.id].runs).dropLink;
							dbx.dropboxUpload(path, deckContent[0])
							let confirmM = uploadcheck[1] + " decklist submitted!"
							if(confirmM)
								msg.channel.send(confirmM);
						}
					}
				}
			}else{
				msg.channel.send("You are not registered for the Team Unified Constructed event.")
			}
		}else if(uploadcheck[1].match(/gladiator \d+/i)){
			if(!listMatch) {
				uploadcheck = null;
			}else{
				let listNo = uploadcheck[1].match(/gladiator (\d+)/i)[1];
				listNo = parseInt(listNo)-1;
				if(listNo != 0 && listNo != 1 && listNo != 2) {
					msg.channel.send("Please include the run number; `$submit gladiator 2 User's Deck`");
					return;
				}
				tourney = 'gladiator';
				let joinM = addNewPlayer("gladiator", msg.author.id)
				if(joinM) {
					msg.channel.send(joinM);
					matchDex.gladiator.players[user.id].decks = [];
					matchDex.gladiator.players[user.id].currentRun = 1;
				}
				let username = toolbox.stripEmoji(user.username)
				if(!matchDex[tourney].players[msg.author.id].runs[listNo]) { //new run
					var deckContent = giveFancyDeck(msg.content, msg.author, deckName, 0, ['Gladiator', 'King of the Hill'], arcana.msem);
					if(deckContent[1].match(/This deck is legal/)) {
						listNo = matchDex.gladiator.players[user.id].runs.length;
						let newRun = {matches:[], deckName:deckName, dropLink:`/gladiator/${username}${listNo+1}.txt`};
						matchDex.gladiator.players[user.id].runs.push(newRun);
						matchDex.gladiator.players[user.id].decks.push(matchDex.gladiator.players[user.id].deckObj);
						delete matchDex.gladiator.players[user.id].deckObj
						version.logMatch(matchDex);
					}else{
						delete matchDex.gladiator.players[user.id].deckObj
					}
				}else{ //edit run
					let hold = toolbox.cloneObj(matchDex.gladiator.players[user.id].decks[listNo]);
					matchDex.gladiator.players[user.id].decks[listNo] = {};
					var deckContent = giveFancyDeck(msg.content, msg.author, deckName, 0, ['Gladiator', 'King of the Hill'], arcana.msem);
					if(deckContent[1].match(/This deck is legal/)) {
						matchDex.gladiator.players[user.id].runs[listNo].deckName = deckName;
						matchDex.gladiator.players[user.id].decks[listNo] = matchDex.gladiator.players[user.id].deckObj;
						delete matchDex.gladiator.players[user.id].deckObj;
						version.logMatch(matchDex);
					}else{
						delete matchDex.gladiator.players[user.id].deckObj;
						matchDex.gladiator.players[user.id].decks[listNo] = hold;
					}
				}
				if(deckContent[1].match(/This deck is legal/)) {
					let path = matchDex.gladiator.players[user.id].runs[listNo].dropLink;
					dbx.dropboxUpload(path, deckContent[0])
					let confirmM = uploadcheck[1] + " decklist submitted!"
					if(confirmM)
						msg.channel.send(confirmM);
				}
			}
			
		}else if(uploadcheck[1].match(/(gp[a-z]|league|cnm|cmn|pauper)/i)) { //msem deckcheck
			if(!listMatch) {
				uploadcheck = null;
			}else{
				tourneyname = tourneyname.replace(" ", "");
				let legality = ["MSEM"];
				let tourney = "gp"
				if(tourneyname.match(/(cnm|cmn)/i))
					tourney = 'cnm';
				if(tourneyname.match(/pauper/i)) {
					tourney = 'pauper';
					legality = ['Pauper'];
				}
				let deckContent = giveFancyDeck(msg.content, msg.author, deckName,0, legality, arcana.msem);
				if(tourneyname == "league") {
					tourney = "league";
					let joinM = addNewPlayer("league",msg.author.id);
					if(joinM)
						msg.channel.send(joinM);
					let the_time = toolbox.arrayTheDate();
					tourneyname += "_" + the_time[0] + "_" + the_time[1];
					let lastRun = toolbox.lastElement(matchDex.league.players[msg.author.id].runs)
					if(lastRun && lastRun.matches && lastRun.matches.length == 4) //check for 4-0s
						fourWinPoster("league", msg.author.id, matchDex.league.players[msg.author.id].runs[matchDex.league.players[msg.author.id].currentRun-1]);
					msg.channel.send(addNewRun("league", msg.author.id, toolbox.stripEmoji(msg.author.username), deckName, tourneyname));
					version.logMatch(matchDex);
					if(botname != "TestBot")
						Client.guilds.cache.get('317373924096868353').members.cache.get(msg.author.id).roles.add('638181322325491744');
				}else{
					if(matchDex[tourney].round > 0) {
						deckContent[1] = "";
						msg.author.send("Sorry, but deck submissions for this tournament are closed!");
					}
					if(matchDex[tourney].round == 0) {
						let addM = addNewPlayer(tourney, msg.author.id).replace("gp", tourneyname);
						if(addM)
							msg.channel.send(addM);
						addNewRun(tourney,msg.author.id,toolbox.stripEmoji(msg.author.username), deckName, tourneyname)
						version.logMatch(matchDex);
						if(botname != "TestBot")
							Client.guilds.cache.get('317373924096868353').members.cache.get(msg.author.id).roles.add('588781514616209417');
					}
				}
				if(deckContent[1].match(/This deck is legal/)) {
					let path = toolbox.lastElement(matchDex[tourney].players[msg.author.id].runs).dropLink;
					dbx.dropboxUpload(path, deckContent[0])
					let confirmM = uploadcheck[1] + " decklist submitted!"
					console.log(confirmM);
					if(confirmM)
						msg.author.send(confirmM);
				}
			}
		}else{ //general tournament without deckchecks or sealed pools
			let joinM = addNewPlayer(tourneyname, user.id, true); //todo finish
			if(joinM)
				msg.channel.send(joinM);
			addNewRun(tourneyname, user.id, toolbox.stripEmoji(msg.author.username), "");
		}
	}
	//primordial submissions
	let canonUploadCheck = msg.content.match(/!submit (primordial [A-Z0-9]+) ?([^\n]+)/i);
	if(canonUploadCheck && listMatch) {
		deckName = canonUploadCheck[2];
		let tourneyname = canonUploadCheck[1].toLowerCase();
		
		if(tourneyname.match(/primordial/i)) { //primordial deckcheck
			let checkSet = tourneyname.match(/primordial ([A-Z0-9]+)/i);
			if(checkSet && arcana.magic.setData.hasOwnProperty(checkSet[1].toUpperCase())) {
				let checkedSet = checkSet[1].toUpperCase(); //the set to check legality on
				let setInfo = arcana.magic.setData[checkedSet];
				if(setInfo.type != 'core' && setInfo.type != 'expansion' && !checkedSet.match(/(GS1|S00|S99|POR|P02|P3K)/)) {
					msg.channel.send("Only premier and core sets are legal in Primordial.");
					return;
				}
				let deckContent = giveFancyDeck(msg.content, msg.author, deckName,0,['Primordial',checkedSet], arcana.magic);
				if(deckContent[1].match(/This deck is legal in Primordial!/)) {
					let joinM = addNewPlayer("primordial",msg.author.id);
					matchDex.primordial.players[msg.author.id].set = checkedSet;
					if(joinM)
						msg.channel.send(joinM);
					let lastRun = toolbox.lastElement(matchDex.primordial.players[msg.author.id].runs)
					if(lastRun && lastRun.matches && lastRun.matches.length == 4) //check for 4-0s
						fourWinPoster("primordial", msg.author.id, matchDex.primordial.players[msg.author.id].runs[matchDex.primordial.players[msg.author.id].currentRun-1]);
					msg.channel.send(addNewRun("primordial",msg.author.id,toolbox.stripEmoji(msg.author.username),deckName, "primordial"));
					version.logMatch(matchDex);
					Client.guilds.cache.get('413055835179057173').members.cache.get(msg.author.id).roles.add('763102029504970823');
					let path = toolbox.lastElement(matchDex.primordial.players[msg.author.id].runs).dropLink;
					dbx.dropboxUpload(path, deckContent[0])
					msg.author.send(canonUploadCheck[1] + " decklist submitted!");
				}
			}
		}
	}
	let deckCommands = msg.content.match(/\$(deckcheck|convert|plain)/i);
	let ignoreCommands = msg.content.match(/\$pack/i)
	if(!uploadcheck && !canonUploadCheck && !deckCommands && !ignoreCommands && (subMatch || (msg.channel.type == 'dm' && listBulk && listBulk.length > 2))){
		let submitHelp = "To submit a decklist, use the form ";
		let currentGP = "GPJ";
		if(matchDex.gp.data.hasOwnProperty('name') && matchDex.gp.data.name != "")
			currentGP = matchDex.gp.data.name;
		if(msg.guild == "317373924096868353"){ //msem
			submitHelp += "`$submit GP<letter> Name's Deck`, `$submit league Name's Deck`, `$submit cnm Name's Deck`, or `$submit sealed Name`, "
		}else if(msg.guild == "413055835179057173") {
			submitHelp += "`!submit primordial SET Name's Deck`, ";
		}else{ //dms or other serverrs list all tournaments
			submitHelp += "`$submit GP<letter> Name's Deck`, `$submit league Name's Deck`, `$submit cnm Name's Deck`, `$submit sealed Name`, or `!submit primordial SET Name's Deck`,";			
		}
		submitHelp += "followed by the decklist. LackeyBot will check its legality and inform you if it has been submitted.\n";
		submitHelp += "Example:\n```$submit " + currentGP + " " + msg.author.username + "'s Island Tribal\n60 Island\nSideboard:\n15 Island```";
		submitHelp += "\nLackeyBot can read decklists copied from Lackey or Cockatrice (annotated or normal), and (for MSEM tournaments) you can add _SET tags after the names for specific printings.";
		msg.channel.send(submitHelp)
	}
	let unsubCheck = msg.content.match(/\$unsubmit ([^\n]+)/i);
	if(unsubCheck) {
		msg.channel.send(removeEmptyRun(unsubCheck[1].toLowerCase(), msg.author.id));
	}
	let countcheck = msg.content.match(/^\$count ?([^\n]+)?/i);
	if (countcheck != null && listMatch != null)
		countCardRarities(msg.content, msg.author);
	let convertcheck = msg.content.match(/^\$convert ?([^\n]+)?/i);
	if(convertcheck !== null && listMatch !== null) {
		thisSet = convertcheck[1];
		dekBuilder(triceListTrimmer(msg.content),thisSet,msg.author.id);
		stats.upBribes(1);
	}
	//matchDex commands
	let leagueName = "league";
	if(msg.guild && msg.guild == "413055835179057173")
		leagueName = "primordial";
	if(gpName && isLeague)
		leagueName = gpName;
	if(msg.content.match(/sealed/i))
		leagueName = 'sealed';
	let leagueMessage = "MSEM Leagues are monthly events where you play runs of up to 5 best-of-3 matches with a single deck against different opponents. At any point you can end your league run, which can use a different deck.\nDuring each month, you earn points from your 3 best runs: 1 point for each win, and a bonus point for each perfect 5-0 run, for a max of 18 points each month. At the end of the League season (every 4 months), the player with the highest cumulative score for the season will be awarded a Champion promo card of their choice.\nTo get started with monthly Leagues, DM LackeyBot the following command and your league decklist:\n```$submit league cajun's Cat Tax\n4x Saigura Tam\n...```";
	if(leagueName == "primordial")
		leagueMessage = "Primordial Leagues are monthly events where you play runs of up to 5 best-of-3 matches with a single deck against different opponents. At any point you can end your league run, which can use a different deck.\nDuring each month, you earn points from your 3 best runs: 1 point for each win, and a bonus point for each perfect 5-0 run, for a max of 18 points each month.\nTo get started with monthly Leagues, DM LackeyBot the following command and your league decklist:\n```!submit primordial M13 cajun's goblins\n1x Krenko, Mob Boss\n...```";
	var partLeagueMatch = msg.content.match(/\$(sealed ?)?league ?(\d+)/i);
	if(msg.content.match(/\$(sealed ?)?league/i)) {
		stats.upBribes(1);
		let player = msg.author.id;
		if(perms.includes(5) && msg.content.match(/override:? ?(\d+)/))
			player = msg.content.match(/override:? ?(\d+)/)[1];
		if(matchDex[leagueName].players[player] && toolbox.hasValue(matchDex[leagueName].players[player].runs) && !msg.content.match(/\$leaguehelp/i)) {
			let lookback = 0;
			if(partLeagueMatch)
				lookback = partLeagueMatch[2];
			msg.channel.send(reportRecord(leagueName, player, lookback)[0])
			.then(function(mess) {
				mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
						.then(() => mess.react(plainText))})
			.catch(e => console.log(e))
		}else{
			msg.channel.send(leagueMessage);
		}
	}
	var leagueDeckMatch = msg.content.match(/\$list ?([^ ]+) ?(\d*)/i)
	if(leagueDeckMatch) {
		let tourney = leagueDeckMatch[1].toLowerCase();
		let thisPlayer = matchDex[tourney].players[msg.author.id];
		if(matchDex.hasOwnProperty(tourney) && matchDex[tourney].players[msg.author.id] != undefined) {
			let thisPlayer = matchDex[tourney].players[msg.author.id];
			stats.upBribes(1);
			let run = thisPlayer.currentRun-1;
			if(leagueDeckMatch[2])
				run = parseInt(leagueDeckMatch[2]-1);
			let pullLink = thisPlayer.runs[run].dropLink;
			let deck = thisPlayer.runs[run].deckName;
			dbx.filesDownload({path:pullLink})
				.then(function(data) {
					console.log(data.name);
					fs.writeFile(deck+'.txt', data.fileBinary, 'binary', function(err) {
						if(err) throw err;
						fs.readFile(deck+'.txt', "utf8", function read(err, data) {
							if(err) throw err;
							let deckData = extractPlain(data);
							msg.author.send("```\n"+deckData+"```");
							//fs.unlink('./decks/temp/'+deck+'.txt', (err) => {if (err) throw err;});
						});
					});
				})
				.catch(function(err){console.log(err)})
		}
	}
	if(msg.content.match(/\$(sealed ?)?matches/i)) {
		stats.upBribes(1);
		let user = msg.author.id
		let overCheck = msg.content.match(/override (\d+)/);
		if(admin && overCheck) {
			user = overCheck[1];
		}
		let output = "";
		for(let t in matchDex) {
			if(matchDex[t].hasOwnProperty('players') && matchDex[t].players.hasOwnProperty(user)) {
				let thisRun = matchDex[t].players[user].runs
				if(thisRun.length) {
					output += `__Your ${matchDex[t].data.name} matches:__\n`;
					let thatMatchArray = matchDex[t].players[user].runs[thisRun.length-1].matches;
					for(let thatMatch in thatMatchArray) {
						let thisRecord = listRecord(matchDex[t].matches[thatMatchArray[thatMatch]-1]).replace(/ \(#\d\)/g,"");
						thisRecord = thisRecord.replace("0-0","(unreported)");
						output += thatMatchArray[thatMatch] + " — " + thisRecord + "\n";
					}
				}
			}
		}
		output += "__Recent league matches:__\n";
		for(let cm = Math.max(0,matchDex[leagueName].matches.length-5); cm<matchDex[leagueName].matches.length; cm++) {
			output += cm+1 + " — " + listRecord(matchDex[leagueName].matches[cm]) + "\n";
		}
		msg.channel.send(output);
	}
	if(msg.content.match(/\$(sealed ?)?leaderboard/i)) {
		stats.upBribes(1);
		msg.channel.send(renderLeaderBoard(leagueName, msg.author.id));
	}
	if(msg.content.match(/\$monthleader/i)) {
		stats.upBribes(1);
		msg.channel.send(renderLeaderBoard(leagueName,msg.author.id,"month"));
	}

	//judge warnings
	let warnRegEx = new RegExp('\\$(un)?warn ?' + tournamentNames + '? <@!?(\\d+)>([\\s\\S]+)', 'i');
	let warnMatch = msg.content.match(warnRegEx);
	let judgeID = "770088341865496596";
	if(warnMatch && msg.member.roles.cache.find(val => val.id == judgeID)) {
		let unWarn = warnMatch[1];
		let tourn = warnMatch[2];
		if(!tourn || !matchDex[tourn])
			tourn = 'gp';
		let playerID = warnMatch[3];
		let warnStack = warnMatch[4];
		if(!matchDex[tourn].players[playerID]) {
			msg.channel.send("Player is not in that tournament.");
		}else{
			msg.channel.send(warnHandler(matchDex[tourn], playerID, msg.author.id, warnStack, unWarn));
			//version.logMatch(matchDex);
		}
	}
	let warnCheck = msg.content.match(/\$warnings/i);
	let mentionMatch = msg.content.match(/<@!?(\d+)>/);
	if(warnCheck) {
		let playerID = msg.author.id;
		if(msg.member.roles.cache.find(val => val.id == judgeID) && mentionMatch)
			playerID = mentionMatch[1];
		let outM = "";
		for(let t in matchDex) {
			if(matchDex[t].players && matchDex[t].players[playerID] && matchDex[t].players[playerID].warns)
				outM += "__" + matchDex[t].data.name + "__\n" + writeCurrentWarns(matchDex[t].players[playerID]) + "\n";
		}
		if(!outM)
			outM = "Player has no warnings.";
		msg.channel.send(outM);
	}
	let gpBoardRegex = new RegExp('\\$' + tournamentNames + '(leader|board|score)', 'i');
	gpBoardMatch = msg.content.match(gpBoardRegex);
	if(gpBoardMatch) {
		stats.upBribes(1);
		let tourneyname = gpBoardMatch[1];
		if(isLeague) {
			msg.channel.send(renderLeaderBoard(matchDex[tourneyname]));					
		}else{
			let board = renderGPLeaderBoard(matchDex[tourneyname], false, 0)
			msg.channel.send(board[0], board[1])
				.then(function(mess) {
					mess.react(tieEmote);
					mess.react(leftArrow);
					mess.react(rightArrow);
				})
				.catch(e => console.log(e))
		}
	}
	if(msg.content.match(/\$(sealed ?)?(foes|vsSeeker)/i)) {
		stats.upBribes(1);
		msg.channel.send(vsSeeker(leagueName, msg.author.id));
	}
	var deckChangeMatch = msg.content.match(/\$rename (gp|league) ?(\d+)? ?: ?([^\n]+)/);
	if(toolbox.hasValue(deckChangeMatch)) {
		stats.upBribes(1);
		let tourney = deckChangeMatch[1];
		let run = 1;
		if(toolbox.hasValue(deckChangeMatch[2]))
			run = deckChangeMatch[2];
		let deckName = deckChangeMatch[3];
		let message = changeDeckName(tourney, msg.author.id, deckName, run);
		msg.channel.send(message);
		if(message != "You are not in this tournament.")
			version.logMatch(matchDex);
	}
	//reporting
	if(msg.guild && tournamentChannels.includes(msg.channel.id)) {//MatchDex reports
		let reportGPMatch = msg.content.match(/\$report([^\n]+)/i)
		if(reportGPMatch && !codeCheck) { //reporting matches
			let reportLine = reportGPMatch[1];
			let scoresMatch = reportLine.match(/(\d+) *[-\/]+ *(\d+) *[-\/]* *(\d+)?/);
			let matchMatch = reportLine.match(/match (\d+)/i);
			let playersMatch = toolbox.globalCapture('<@!?([0-9]+)>', reportLine, true);
			if(scoresMatch && playersMatch && gpName) {
				let ids = []; //player ids
				if(playersMatch.length > 1 && (perms.includes(1) || msg.author.id == matchDex[gpName].data.TO)) {
					for(let p in playersMatch)
						ids.push(playersMatch[p][1]);
				}else{
					ids = [msg.author.id, playersMatch[0][1]];
				}
				let matchNo = 0;
				if(matchMatch) //if they give a match number, use that
					matchNo = matchMatch[1];
				if(matchNo == 0) { //if they didn't give a match number, see if they have awaiting
					let refPlayer = matchDex[gpName].players[ids[0]];
					for(let aMatch in refPlayer.awaitingMatches) {
						let checkMatch = matchDex[gpName].matches[refPlayer.awaitingMatches[aMatch]-1];
						if(ids.includes(checkMatch.p1) || ids.includes(checkMatch.p2))
							matchNo = refPlayer.awaitingMatches[aMatch];
					}
				}
				if(isLeague) {
					stats.bribes++;
					msg.channel.send(`${eris.pullPing(msg.author.id)} ${updateMatch(gpName, ids[0], ids[1], scoresMatch[1], scoresMatch[2], matchNo, msg.guild)}`);
				}else{
					if(matchNo == 0) { //if we still fail, check for a match with both players
						let run1 = matchDex[gpName].players[ids[0]].runs
						let run2 = matchDex[gpName].players[ids[1]].runs
						let match1 = run1[run1.length-1].matches;
						let match2 = run2[run1.length-1].matches;
						let pairs = toolbox.arrayDuplicates(match1, match2);
						for(let m in pairs){
							if(pairs[m] > matchNo)
								matchNo = pairs[m];
						}
					}
					if(matchNo == 0) { //if we *still* don't have a match, something went wrong or the players are wrong
						msg.channel.send("Could not find match. Ensure you have pinged the correct person, or use a match number.");
					}else{ //(tourney, p1id, p2id, p1w, p2w, match) {
						msg.channel.send(`${eris.pullPing(msg.author.id)} ${updateGPMatch(gpName, ids[0], ids[1], scoresMatch[1], scoresMatch[2], matchNo)}`);
						if(matchDex[gpName].awaitingMatches.length == 0)
							msg.channel.send("<@!" + matchDex[gpName].data.TO + ">, All matches have been reported!");
						stats.bribes++;
					}
				}
			}else{ //help message for malformed report commands
				let helpMess = "Report or edit match results by pinging your opponent and using the $report commands:\n";
				helpMess += "> $report gp YourWins-Opponent'sWins @Opponent\n> $report league YourWins-Opponent'sWins @Opponent\n";
				helpMess += "LackeyBot will give a confirm message that includes your match number. If you need to edit the results, use that number after the tournament name, for example:\n"
				helpMess += "> $report gp match 1 0-2 <@341937757536387072>";
				msg.channel.send(helpMess);
			}
		}
	}

}

function dl(cb) {																		//download matchDex.json
	dbx.dropboxDownload('msem/matchDex.json','https://www.dropbox.com/s/3rn1zu8qly0z52o/matchDex.json?dl=0',reloadMatchBase);
}
function reloadMatchBase() {															//loads matchdex after downloading
	console.log('Reloading matchDex');
	let test;
	test = require("./msem/matchDex.json");
	if(test.version < version.versionCheck.matchDex)
	console.log("Version error in matchDex.");
	matchDex = test;
	let matchString = '(';
	let tempReges = [];
	tournamentChannels = [];
	for(let tourney in matchDex) {
		if(tourney != "version") {
			matchString += tourney + '|'
			if(!organizers.includes(matchDex[tourney].data.TO))
				organizers.push(matchDex[tourney].data.TO)
			if(!tournamentChannels.includes(matchDex[tourney].data.channel)) {
				tournamentChannels.push(matchDex[tourney].data.channel)
			}else{
				eris.pullPing(admin).send(`Duplicated match channel at ${tourney}.`)
			}
			if(matchDex[tourney].pairing)
				delete matchDex[tourney].pairing;
			if(matchDex[tourney].data.submitRegex)
				tempReges.push(matchDex[tourney].data.submitRegex);
		}
	}
	matchString = matchString.replace(/\|$/, ")");
	tournamentNames = matchString;
	tournamentReges = tempReges;
	addKeys();
	return matchDex;
}

var warnsObj = {
	MT: {
		type: "Game Play Errors",
		upgrade: 3,
		check: function(warnList) {
			return warnList.match(/M(issed)? ?T(rigger)?/i);
		}
	},
	LEC: {
		type: "Game Play Errors",
		upgrade: 3,
		check: function(warnList) {
			return warnList.match(/L(ooking)? ?(At|A|@) ?E(xtra)? ?C(ard)?/i);
		}
	},
	HCE: {
		type: "Game Play Errors",
		upgrade: 3,
		check: function(warnList) {
			return warnList.match(/H(idden)? ?C(ard)? ?E(rror)?/i);
		}
	},
	GRV: {
		type: "Game Play Errors",
		upgrade: 3,
		check: function(warnList) {
			return warnList.match(/G(ame)? ?R(ule)? ?V(iolation)?/i);
		}
	},
	MPV: {
		type: "Game Play Errors",
		upgrade: 3,
		check: function(warnList) {
			return warnList.match(/M(ulligan)? ?P(rocedure)? ?V(iolation)?/i);
		}
	},
	FTMGS: {
		type: "Game Play Errors",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/F(ailure)? ?t(o)? ?M(aintain)? ?G(ame)? ?S(tate)?/i);
		}
	},
	IE: {
		type: "Game Play Errors",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/I(nterface)? ?E(rror)?/i);
		}
	},
	Tardiness: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/T(ar)?d(iness)?/i);
		}
	},
	OA: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/O(utside)? ?A(ssistance)?/i);
		}
	},
	SP: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/S(low)? ?P(lay)?/i);
		}
	},
	DLP: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/D(eck)?l(ist)? ?P(roblem)?/i);
		}
	},
	DP: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/D(eck)? ?P(roblem)?/i);
		}
	},
	LPV: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/L(imited)? ?P(rocedure)? ?V(iolation)?/i);
		}
	},
	CPV: {
		type: "Tournament Errors",
		upgrade: 2,
		check: function(warnList) {
			return warnList.match(/C(ommunication)? ?P(olicy)? ?V(iolation)?/i);
		}
	},
	UCMinor: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/U(nsporting)? ?C(onduct)? ?-? ?Minor/i);
		}
	},
	UCMajor: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/U(nsporting)? ?C(onduct)? ?-? ?Major/i);
		}
	},
	IDW: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/I(mproperly)? ?D(etermining)? ?A? ?W(inner)?/i);
		}
	},
	BW: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/B(ribery)? ?(And)? ?W(agering)?/i);
		}
	},
	AB: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/A(ggressive)? ?B(ehavior)?/i);
		}
	},
	Stalling: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/Stalling/i);
		}
	},
	Cheating: {
		type: "Unsporting Conduct",
		upgrade: null,
		check: function(warnList) {
			return warnList.match(/Cheating/i);
		}
	}
}

function runWarnStack (warnList) {														//returns array of warns in list
	let out = [];
	for(let w in warnsObj) {
		if(warnsObj[w].check(warnList))
			out.push(w);
	}
	return out;
}
function writeCurrentWarns(player) {													//returns list of player's current warns
	if(!player.hasOwnProperty('warns'))
		return "Player has no warnings.";
	let outM = "";
	let hold = "";
	for(let w in warnsObj) {
		if(player.warns[w]) {
			if(warnsObj[w].type != hold) {
				hold = warnsObj[w].type;
				outM += hold + ":\n";
			}
			outM += w + ": " + player.warns[w].length + "\n";
		}
	}
	return outM;
}
function unWarn (player, judge, warn) {													//remove a warn, return judge name of removed warn
	//remove last warning from same judge if possible, otherwise the last
	let grab = player.warns[warn].length-1;
	for(let w in player.warns[warn]) {
		if(player.warns[warn].judge == judge)
			grab = w;
	}
	let oldJudge = player.warns[warn][grab].judge;
	player.warns[warn] = toolbox.spliceArray({array:player.warns[warn], index:grab, replace:true});
	return oldJudge;
}
function warnHandler (tournament, player, judge, warnList, unFlag) {					//handles the warn command
	let arrayOfWarns = runWarnStack(warnList);
	let username = eris.pullUsername(player);
	toolbox.addIfNew(tournament.players[player], "warns", {});
	let outMessage = `Added warns to ${username}: `;
	if(unFlag)
		outMessage = `Removed warns from ${username}: `;
	for(let w in arrayOfWarns) {
		if(unFlag && tournament.players[player].warns && tournament.players[player].warns[arrayOfWarns[w]]) { //remove warns
			toolbox.addIfNew(tournament.players[player], "unwarns", []);
			let oldJudge = unWarn(tournament.players[player], judge, arrayOfWarns[w]);
			let newWarn = {
				judge: judge,
				date: new Date(),
				warn: arrayOfWarns[w]
			}
			if(judge != oldJudge)
				newWarn.oldJudge = oldJudge;
			tournament.players[player].unwarns.push(newWarn);
			outMessage += arrayOfWarns[w] + ", ";
		}else{ //add warns
			toolbox.addIfNew(tournament.players[player].warns, arrayOfWarns[w], []);
			let newWarn = {
				judge: judge,
				date: new Date()
			}
			tournament.players[player].warns[arrayOfWarns[w]].push(newWarn);
			outMessage += arrayOfWarns[w] + ", ";
		}
	}
	outMessage = outMessage.replace(/, $/, ""); //remove trailing comma
	outMessage += `\nCurrent warns for ${username}:\n`
	outMessage += writeCurrentWarns(tournament.players[player]);
	return outMessage;
}
function archiveToTourney (archive, data, checkRounds) {								//converts an archive into a tourney to run normal commands on
	//let statDex = require('./statDex.json');
	let temp = {matches:[], players:{}, data:data, awaitingMatches:[], round:0};
	let holdingMatches = [];
	for(let m in archive.matches) { //rebuild matches
		let newMatch = {
				p1: archive.matches[m].players[0].id,
				p1w: archive.matches[m].players[0].wins,
				p1r: archive.matches[m].players[0].run,
				p2: archive.matches[m].players[1].id,
				p2w: archive.matches[m].players[1].wins,
				p2r: archive.matches[m].players[1].run,
				winner: archive.matches[m].winner
		}
		if(archive.matches[m].round) {
			newMatch.round = archive.matches[m].round;
		}else if(checkRounds) { //save match number and we'll interpret its round number later
			holdingMatches.push(temp.matches.length+1);
		}
		if(archive.matches[m].knockout)
			newMatch.knockout = true;
		temp.matches.push(newMatch);
	}
	for(let p in archive.players) {
		let newPlayer = {
			lifetime: 0,
			season: 0,
			month: archive.players[p].monthScore,
			playing: 1,
			runs: [],
			currentRun: archive.players[p].lists.length,
			gpWin: archive.players[p].wins,
			gpLoss: archive.players[p].losses,
			gpDraw: archive.players[p].draws,
			awaitingMatches: [],
			rank: 16
		}
		if(archive.players[p].rank)
			newPlayer.rank = archive.players[p].rank;
		for(let l in archive.players[p].lists) {
			let newRun = {
				matches: archive.players[p].matches[l],
				deckName: archive.players[p].lists[l],
				dropLink: archive.players[p].lists[l]
			}
			newPlayer.runs.push(newRun);
			if(holdingMatches.length) { //check for rounds if there's any missing
				for(let m in newRun.matches) {
					if(holdingMatches.includes(newRun.matches[m])) { //if we've got an unrounded match
						let round = newRun.matches.indexOf(newRun.matches[m]);
						temp.matches[newRun.matches[m]-1].round = round + 1; //matchNo 1 is matches[0], round index 0 is round 1
					}
				}
			}
		}
		temp.players[p] = newPlayer;
	}
	return temp; //returns rebuilt tourney object
}

function adminHelpMessage() {
	let message = "**MatchDex Help Message!**\n";
	message += "In the commands below, <words> represent a word that must be input, and (words) represents optional words that can be added. In both cases, the brackets/parenthesis are not part of the commands.\n";
	message += "__Report Commands__\n"
	message += "`$report <tournament> (match N) X-Y @Opponent` //Normal report command\n"
	message += "`$report <tournament> (match N) @Player X-Y @Opponent` //The TO can report any match by pinging the 'reporting' player before the match score\n"
	message += "__GP-style tournament commands__\n"
	message += "`!push <tournament>` //Starts tournament, or pushes it to next round. Will warn (and not push) if there are still matches open\n"
	message += "`!players <tournament>` //Displays a list of players, their GP ID, and if they are dropped\n"
	message += "`!drop player <tournament> <GP ID>` //Drops player, 2-0s any awaiting matches\n"
	message += "`!undrop player <tournament> <GP ID>` //Undrops player **NOTE** this leaves the match as 2-0 until a player reports otherwise\n"
	message += "__League-style tournament commands__\n"
	message += "`!null <tournament> <match#>` //Zeros out all of the league match's data. This effects the scoring, run length, etc. of the match. This cannot be undone outside of a full rollback, but the matchup will be valid again.\n"
	message += "__Archival commands__\n"
	message += "`!archive <tournament>` //Ends the monthly tournaments\n";
	message += "`!continue league` //If the league season is still going, rolls it over to the next month\n";
	message += "`!delete <tournament>` //Resets the tournament to its default state. Can only be called within five minutes of the respective !archive command";
	return message;
}
function helpMessage() {
	let helpout = "**MatchDex Help**\n";
	helpout += "To submit a decklist, DM the following to LackeyBot:\n"
	helpout += "`$submit <tournament> Player's Deck Name\nDecklist`\n"
	helpout += "For example:\n`$submit league Cajun's Islands\n60 Island`\n\n";
	helpout += "To report a match, go to its channel and use the following command. If you make a mistake, redo the command but include 'match N', where N is the match number LackeyBot gives you after you report.\n"
	helpout += "`$report X-Y @Opponent`\n\n";
	helpout += "For Tournament Organizers, use `$match help` for admin commands.\n";
	return helpout;
}
//general scripts
function generateBracketSeeds (powers) {												//generate bracket with 2^input pairs
	var primeArray = [[1,2]];
	for(i=0; i<powers; i++) {
		let nextMax = 2*parseInt(primeArray[0][1])+1;
		let newArray = [];
		for(let thisArray in primeArray) {
			let oldArray = primeArray[thisArray];
			let first = oldArray[0];
			let second = nextMax-parseInt(first);
			let fourth = oldArray[1];
			let third = nextMax-parseInt(fourth);
			newArray.push([first,second]);
			newArray.push([third,fourth]);
		}
		primeArray = newArray;
	}
	return primeArray;
}
function matchPermit(msg, tourney) {													//is user able to edit this tourney?
	tourney = tourney.toLowerCase();
	if(msg.author.id == admin)
		return true;
	if(msg.author.id == matchDex[tourney].data.TO)
		return true;
	if(matchDex[tourney].data.EO && msg.member.roles.cache.find(val => val.id == matchDex[tourney].data.EO))
		return true;
	return false;
}
function resetTourney(tournamentObject) {												//archives tourney data
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	version.startWriting("match")
	let leagueArchive = {};
	let flag = {};
	for(let t in matchDex) {
		if(t != "version")
			flag[t] = 0;
	}
	if(tournamentObject.data.key == "league") {
		for(let p in tournamentObject.players) {
			let current = toolbox.lastElement(tournamentObject.players[p].runs);
			if(current && current.matches && current.matches.length == 4)
				fourWinPoster(tournamentObject, p, current);
		}
	}
	leagueArchive.matches = [];
	leagueArchive.players = {};
	let trolearray = {league: '638181322325491744', gp: '588781514616209417'}
	let prolearray = {primordial: '763102029504970823'}
	for(let thisPlayer in tournamentObject.players) {
		//remove their tourney role
		try{
			if(trolearray.hasOwnProperty(tournamentObject.data.key)) {
				let g = eris.pullGuild('317373924096868353')
				if(g)
					g.members.cache.get(thisPlayer).roles.remove(trolearray[tournamentObject.data.key]);
			}
			if(prolearray.hasOwnProperty(tournamentObject.data.key)) {
				let g = eris.pullGuild('413055835179057173')
				if(g)
					g.members.cache.get(thisPlayer).roles.remove(trolearray[tournamentObject.data.key]);
			}
		}catch(e){console.log(e)};
		leagueArchive.players[thisPlayer] = {};
		leagueArchive.players[thisPlayer].username = eris.pullUsername(thisPlayer);
		leagueArchive.players[thisPlayer].matches = [];
		leagueArchive.players[thisPlayer].lists = [];
		leagueArchive.players[thisPlayer].opponents = [];
		leagueArchive.players[thisPlayer].wins = 0;
		leagueArchive.players[thisPlayer].losses = 0;
		leagueArchive.players[thisPlayer].draws = 0;
		leagueArchive.players[thisPlayer].monthScore = 0;
		
		for(let aRun in tournamentObject.players[thisPlayer].runs) {
			if(tournamentObject.players[thisPlayer].runs[aRun].matches.length) {
				leagueArchive.players[thisPlayer].matches.push(tournamentObject.players[thisPlayer].runs[aRun].matches)
				leagueArchive.players[thisPlayer].lists.push(tournamentObject.players[thisPlayer].runs[aRun].dropLink.replace(".txt", ""))
				oppArrayArray = [];
				for(let aMatch in tournamentObject.players[thisPlayer].runs[aRun].matches) {
					//[opponent id, run number]
					let eMatch = tournamentObject.matches[tournamentObject.players[thisPlayer].runs[aRun].matches[aMatch]-1];
					let opp = (eMatch.p1 == thisPlayer ? eMatch.p2 : eMatch.p1);
					let oppR = (opp == eMatch.p1 ? eMatch.p1r : eMatch.p2r);
					let oppW = (opp == eMatch.p1 ? eMatch.p1w : eMatch.p2w);
					let plaW = (oppW == eMatch.p1w ? eMatch.p2w : eMatch.p1w);
					oppArrayArray.push([opp, oppR])
					if(plaW > oppW)
						leagueArchive.players[thisPlayer].wins++;
					if(plaW < oppW)
						leagueArchive.players[thisPlayer].losses++;
					if(plaW == oppW)
						leagueArchive.players[thisPlayer].draws++;
				}
				leagueArchive.players[thisPlayer].opponents.push(oppArrayArray);
				leagueArchive.players[thisPlayer].monthScore = bestRecord(tournamentObject,thisPlayer)[4]
			}
		}
	}
	let knockoutRound = 0;
	if(tournamentObject.data.pairing == "knockout") {
		var tops = [];
		let cut = toolbox.nextSquare(swissCut(tournamentObject).length);					//top past the cut
		while(cut > 1) {
			tops.push(cut)
			cut = cut/2;
		}
	}
	for(let thisMatch in tournamentObject.matches) {
		let currentMatch = tournamentObject.matches[thisMatch]
		let matchStats = {};
		matchStats.players = [];
		let leadArray = renderRecord(currentMatch.p1, currentMatch.p2, currentMatch.p1w, currentMatch.p2w, currentMatch.p1r, currentMatch.p2r)
		matchStats.players.push(archivePlayer(tournamentObject, leadArray[0], leadArray[2], leadArray[3], leadArray[4]));
		matchStats.players.push(archivePlayer(tournamentObject, leadArray[1], leadArray[3], leadArray[2], leadArray[5]));
		matchStats.winner = null;
		if(leadArray[2] > leadArray[3])
			matchStats.winner = leadArray[0];
		if(currentMatch.round)
			matchStats.round = currentMatch
		leagueArchive.matches.push(matchStats);
		if(tournamentObject.data.pairing == "knockout" && currentMatch.knockout) { //add top 8 ranks
			if(!knockoutRound)
				knockoutRound = currentMatch.round;
			let rankNo = currentMatch.round - knockoutRound;
				if(currentMatch.p1 == matchStats.winner) {
					leagueArchive.players[currentMatch.p1].rank = tops[rankNo+1];
				}else if(currentMatch.p1 != bye){
					leagueArchive.players[currentMatch.p1].rank = tops[rankNo];
				}
				if(currentMatch.p2 == matchStats.winner) {
					leagueArchive.players[currentMatch.p2].rank = tops[rankNo+1];
				}else if(currentMatch.p2 != bye){
					leagueArchive.players[currentMatch.p2].rank = tops[rankNo];
				}
		}
	}
	let leagueText = JSON.stringify(leagueArchive);
	let archName = tournamentObject.data.key+"_"+toolbox.setTheDate("_")+'_archive.json'
	fs.writeFile('./msem/'+archName, leagueText, (err) => {
		if(err) console.log(err);
	});
	dropboxUpload("/tourneyArchives/"+archName,leagueText, function(){version.doneWriting("match")})
	
	flag[tournamentObject.data.key] = 1;
	return [flag, "The " + tournamentObject.data.key + " database has been archived. If the tournament is over, send !delete " + tournamentObject.data.key + " to reset its database or `!continue league` to start a new month in the same season."];
}
function deleteTourney (tournamentObject) {												//resets a tourney to nothing/base data
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	version.startWriting("match")
	let oldName = tournamentObject.data.key;															//save name
	if(tournamentObject.data.name)
		oldName = tournamentObject.data.name;										//then reset the data
	tournamentObject = {};
	tournamentObject.matches = [];													//blank matches
	tournamentObject.players = {};													//blank players
	tournamentObject.data = {TO: login.TO, channel:login.comp, pairing:"league", runLength:null, rematch:null, name:oldName};
	tournamentObject.round = 0;													//and the round
	if(tournamentObject.data.key == "gp") {															//change the data defaults for recurring tournaments
		tournamentObject.data.pairing = "swiss-knockout";
		tournamentObject.awaitingMatches = [];
		let gpLetter = tournamentObject.data.name.match(/GP([A-Z])/i);				//figure out the next GP letter
		if(gpLetter){
			gpLetter = gpLetter[1].toLowerCase();
			let gpIndex = azArray.indexOf(gpLetter);
			gpIndex++;
			gpIndex = gpIndex%azArray.length;
			gpLetter = azArray[gpIndex].toUpperCase();
			tournamentObject.data.name = "GP" + gpLetter;
			tournamentObject.data.submitRegex = "GP" + gpLetter + "?";
			tournamentObject.data.time = [3, "day"];
		}
	}else if(tournamentObject.data.key == "league") {
		tournamentObject.data.channel = login.league;
		tournamentObject.data.runLength = 5;
		tournamentObject.data.crown = "762844099077210132";
		tournamentObject.data.name = "League";
		tournamentObject.data.submitRegex = "league";
	}else if(tournamentObject.data.key == "cnm") {
		tournamentObject.data.pairing = "swiss";
		tournamentObject.data.channel = login.cnm;
		tournamentObject.awaitingMatches = [];
		tournamentObject.data.time = [50, "minute"];
		tournamentObject.name = "Custom Night Magic";
		tournamentObject.submitRegex = "cnm|cmn";
	}else if(tournamentObject.data.key == "sealed") {
		tournamentObject.data.channel = login.sealed;
		tournamentObject.data.rematch = 2;
		tournamentObject.data.name = "Sealed League";
		tournamentObject.data.submitRegex = "sealed";
	}else if(tournamentObject.data.key == "primordial") {
		tournamentObject.data.channel = "762822819196960809";
		tournamentObject.data.runLength = 5;
		tournamentObject.data.TO = "186824142299856896";
		tournamentObject.data.crown = "762835408580640780";
		tournamentObject.data.name = "Primordial League";
		tournamentObject.data.submitRegex = "primordial [A-Z0-9_]+";
	}else if(tournamentObject.data.key == "gamenight") {
		tournamentObject.data.pairing = "swiss";
		tournamentObject.data.channel = "704798871666294855";
		tournamentObject.data.TO = "380481522416746502";
		tournamentObject.awaitingMatches = [];
		tournamentObject.data.time = [24, "hour"];
		tournamentObject.name = "Game Night";
		tournamentObject.submitRegex = "game ?night";
	}
	version.logMatch(matchDex);
	version.doneWriting("match");
	return "The " + tournamentObject.data.key + " database has been reset.";
}
function rolloverTourney (tournamentObject, cullID) {									//continues a multi-month tourney
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	version.startWriting("match");
	tournamentObject.matches = [];
	for(let player in tournamentObject.players) {
		if(cullID == 0)
			tournamentObject.players[player].season += tournamentObject.players[player].month;
		tournamentObject.players[player].lifetime += tournamentObject.players[player].month;
		tournamentObject.players[player].month = 0;
		if(cullID == 1) //at the end of a season, also clear season points
			tournamentObject.players[player].season = 0;
		tournamentObject.players[player].runs = [];
		tournamentObject.players[player].currentRun = 0;
	}
	version.logMatch(matchDex);
	version.doneWriting("match");
	if(cullID == 1)
		return "The league season has ended."
	return "The league month has rolled over.";
}
function archivePlayer(tournamentObject, id, wins, losses, run) {						//saves player data for a match
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let partRun = tournamentObject.players[id].runs[run-1];
	let archPlay = {};
	archPlay.id = id;
	archPlay.username = eris.pullUsername(id);
	archPlay.wins = parseInt(wins);
	archPlay.losses = parseInt(losses);
	archPlay.winner = (wins > losses ? 1 : 0);
	archPlay.run = run;
	if(partRun && partRun.dropLink) {
		archPlay.list = partRun.dropLink.replace(".txt", "");
	}else{
		archPlay.list = `/${tournamentObject.data.key}/${archPlay.username}`;
	}
	return archPlay
}
function addLackeyBot(tournamentObject){												//adds LackeyBot to a tournament for testing
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	addNewPlayer(tournamentObject, '341937757536387072', false);
	addNewRun(tournamentObject, '341937757536387072', 'idk', 'idk');
	return "LackeyBot added to " + tournamentObject.data.key;
}
function tempAddTUCTeams (id) {															//this should get improved a lot but quick fix
	let teamArrays = [
		["263126101344256001", "107957368997834752", "326956620535955457"],
		["180885469037461504", "380148829128884236", "201750307485515776"],
		["460867085694795797", "186824142299856896", "152881531356971008"],
		["126785105556537344", "139184614567575553", "177643422268653568"],
		["161279778672869377", "233946395067940864", "191169027064725504"],
		["190309440069697536", "154993946525696010", "209090460726067201"],
		["166685542740787200", "387422509928284160", "524687574992945163"],
		["411007764685520917", "189949684125663232", "256060750492073984"]
	]
	for(let array in teamArrays) {
		if(teamArrays[array].includes(id))
			return teamArrays[array];
	}
	return null;
}
function addNewPlayer (tournamentObject, id, midFlag) {									//adds new player to given tourney
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(tournamentObject.players[id]) {
		return "";
	}else{
		let newPlayer = {};
		newPlayer.lifetime = 0;
		newPlayer.season = 0;
		newPlayer.month = 0;
		newPlayer.playing = 1;
		newPlayer.runs = [];
		if(midFlag) { //adds a matches array if in the middle of a tournament
			newPlayer.runs.push({matches:[], dropLink:""})
		}
		newPlayer.currentRun = 0;
		newPlayer.gpWin = 0;
		newPlayer.gpLoss = 0;
		newPlayer.gpDraw = 0;
		newPlayer.awaitingMatches = [];
		if(tournamentObject.data.key == "tuc") {
			let teams = tempAddTUCTeams(id);
			if(!teams)
				return "You are not registered for Team Unified Constructed";
			newPlayer.team = teams;
			newPlayer.deckObj = {};
		}
		if(tournamentObject.data.key == "primordial")
			newPlayer.set = "";
		tournamentObject.players[id] = newPlayer;
		return "You have been added to " + tournamentObject.data.key + ".";
	}
}
function getPlayedOpps (tournamentObject, id, thisRun, knockFlag) {						//returns [ [opponent ids], [opponent runs], [opponent matches] ]
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(!tournamentObject.players.hasOwnProperty(id))
		return [[],[],[]];
	let matchArray = [];
	if(tournamentObject.players[id].runs[thisRun-1])
		matchArray = tournamentObject.players[id].runs[thisRun-1].matches;
	let oppArray = [];
	let oppRunArray = [];
	let oppMatchArray = [];
	for(let thisMatch in matchArray) {
		if(!tournamentObject.matches[0]) {
			return [[],[],[]];
		}else{
			if(tournamentObject.matches[matchArray[thisMatch]-1] && !(toolbox.hasValue(knockFlag) && tournamentObject.matches[matchArray[thisMatch]-1].hasOwnProperty('knockout') && tournamentObject.matches[matchArray[thisMatch]-1].knockout == 1)) {
				oppMatchArray.push(matchArray[thisMatch]);
				if(tournamentObject.matches[matchArray[thisMatch]-1].p1 == id) {
					oppArray.push(tournamentObject.matches[matchArray[thisMatch]-1].p2);
					oppRunArray.push(tournamentObject.matches[matchArray[thisMatch]-1].p2r);
				}else{
					oppArray.push(tournamentObject.matches[matchArray[thisMatch]-1].p1);
					oppRunArray.push(tournamentObject.matches[matchArray[thisMatch]-1].p1r);		
				}
			}
		}
	}
	return [oppArray, oppRunArray, oppMatchArray];
}
function getRecord (tournamentObject, id, run) {										//returns given player's ['W - L', tournament score, monthly points]
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let matchArray = tournamentObject.players[id].runs[run-1].matches;
	let wins = 0;
	let loss = 0;
	let draw = 0;
	for(let thisMatch in matchArray) {
		if(matchArray !== [] && tournamentObject.matches[matchArray[thisMatch]-1]) {
			if(tournamentObject.matches[matchArray[thisMatch]-1].winner == null) {
				draw++;
			}else{
				if(tournamentObject.matches[matchArray[thisMatch]-1].winner == id) {
					wins++;
				}else{
					loss++;
				}
			}
		}
	}
	let winString = wins.toString();
	winString += " - ";
	winString += loss.toString();
	if(draw)
		winString += " - " + draw.toString();
	let score = wins + 0.5*draw;
	let points = wins;
	if(points === tournamentObject.data.runLength) // bonus point for perfect run //TODO League customization
		points++;
	return [winString, score, points];
}
function bestRecord (tournamentObject, id) {											//returns best ['W - L', tournament score, monthly points, run number, total monthly points]
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let bestScore = ["",0,0,0]; //string, score, points, run, total
	let scoreArray = [];
	for(let i=1; i<tournamentObject.players[id].runs.length+1; i++) {
		let temp = getRecord(tournamentObject, id, i)
		if(temp[1] >= bestScore[1]) {
			bestScore = temp;
			bestScore.push(i);
		}
		scoreArray.push(temp[2]);
	}
	scoreArray.sort(function(a, b){return b-a});
	bestScore.push(0); //add total
	for(let j=0;j<Math.min(3,scoreArray.length);j++) {
		bestScore[4] += scoreArray[j];
	}
	bestScore[3]++;
	return bestScore;
}
function renderRecord(p1, p2, p1w, p2w, p1r, p2r) {										//returns [winner.id, loser.id, winner.wins, loser.wins, winner.run, loser.run]
	if(p1w < p2w)
		return [p2, p1, p2w, p1w, p2r, p1r];
	return [p1, p2, p1w, p2w, p1r, p2r];
}
function playerMatchResults(aMatch, playerID) {											//given a match object, returns the given player's [wins, losses, draws, boolean(win?)]
	let returnArray = [];
	let noMatches = 3; //max number of matches for future Bo5+ support
	if(playerID == aMatch.p1) {
		returnArray.push(aMatch.p1w);
		returnArray.push(aMatch.p2w);
	}else{
		returnArray.push(aMatch.p2w);
		returnArray.push(aMatch.p1w);
	}
	if(aMatch.p1w+aMatch.p2w < 2 || (aMatch.p1w == 1 && aMatch.p2w == 1)) {
		returnArray.push(noMatches-aMatch.p1w-aMatch.p2w); //1-1-1, 1-0-2, 0-0-3
	}else{
		returnArray.push(0); //2-1-0, 2-0-0
	}
	if(aMatch.winner == playerID) {
		returnArray.push(true);
	}else{
		returnArray.push(false);
	}
	return returnArray;
}
function renderSelfRecord(match, id) {													//returns [[player.id, player.wins, player.run],[opp.id, opp.wins, opp.run]]
	let thisPlayer = [];
	let thatPlayer = [];
	if(match.p1 == id) {
		thisPlayer = [match.p1, match.p1w, match.p1r];
		thatPlayer = [match.p2, match.p2w, match.p2r];
	}else{
		thatPlayer = [match.p1, match.p1w, match.p1r];
		thisPlayer = [match.p2, match.p2w, match.p2r];
	}
	return [thisPlayer, thatPlayer]
}
function listRecord(match) {															//returns Winner vs Loser (WW - LW)
	let rendArray = renderRecord(match.p1, match.p2, match.p1w, match.p2w, match.p1r, match.p2r);
	return eris.pullUsername(rendArray[0]) + " (#" + rendArray[4] + ") vs " + eris.pullUsername(rendArray[1]) + " (#" + rendArray[5] + ") — " + rendArray[2] + "-" + rendArray[3];
}
//league specific scripts
function renderLeaderBoard(tournamentObject, user, flag) {								//creates the list of players sorted by best seasonal record
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let scoresArray = [];
	let playersArray = [];
	let indexArray = [];
	let decksArray = [];
	let output = "";
	for(let thisPlayer in tournamentObject.players) {
		let yourScore = tournamentObject.players[thisPlayer].month;
		if(flag != "month")
			yourScore += tournamentObject.players[thisPlayer].season;
		scoresArray.push(yourScore);
		playersArray.push(thisPlayer);
	}
	for(let i=0; i<scoresArray.length; i++) {
		let max = Math.max(...scoresArray);
		indexArray.push(scoresArray.indexOf(max));
		scoresArray[indexArray[i]] = -1;
	}
	if(scoresArray.length == 0)
		return "There's no one on the leaderboard yet. You could be the first!";
	let rank = 0;
	let bankedScore = 100;
	for(i = 0; i<playersArray.length; i++) {
		try{
			let theirScore = parseInt(tournamentObject.players[playersArray[indexArray[i]]].month);
			if(flag != "month")
				theirScore += parseInt(tournamentObject.players[playersArray[indexArray[i]]].season);
			if(theirScore < bankedScore) {
				rank = i+1;
				bankedScore = theirScore;
			}
			let rankLine = rank + ": " + eris.pullUsername(playersArray[indexArray[i]]) + " (" + theirScore + " points)\n";
			if(i < 10 || (i == 10 && playersArray[indexArray[i]] == user))
				output += rankLine;
			if(i > 10 && playersArray[indexArray[i]] == user)
				output += "---\n" + rankLine;
		}catch(e){console.log(e);}
	}
	output = output.replace(/\(1 points\)/g, "(1 point)");
	output = "League Leaderboard\n" + output;
	return output;
}
function nullMatch (tournamentObject, number) {											//nullifies a league match
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let thisMatch = tournamentObject.matches[number-1];
	//remove it from runs match array
	let errIndex = tournamentObject.players[thisMatch.p1].runs[thisMatch.p1r-1].matches.indexOf(number)
	tournamentObject.players[thisMatch.p1].runs[thisMatch.p1r-1].matches.splice(errIndex,1);
	errIndex = tournamentObject.players[thisMatch.p2].runs[thisMatch.p2r-1].matches.indexOf(number)
	//nix data from matches list
	tournamentObject.players[thisMatch.p2].runs[thisMatch.p2r-1].matches.splice(errIndex,1);
	tournamentObject.matches[number-1].p1w = 0;
	tournamentObject.matches[number-1].p2w = 0;
	tournamentObject.matches[number-1].winner = null;
	//audit player's points
	auditMatches(tournamentObject, thisMatch.p1);
	auditMatches(tournamentObject, thisMatch.p2);
	version.logMatch(matchDex);
	return "Nulled match " + number + " from " + tournamentObject.data.key; 
}
function addNewRun (tournamentObject, id, username, deckName, tID) {					//adds new league run
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(!tID)
		tID = tournamentObject.data.key;
	let newRun = {};
	newRun.matches = [];
	newRun.deckName = deckName;
	if(tournamentObject.players[id].currentRun == 0 || toolbox.hasValue(tournamentObject.players[id].runs[tournamentObject.players[id].currentRun-1].matches)) { //replace if last run is empty, else push
		tournamentObject.players[id].runs.push(newRun);
		tournamentObject.players[id].currentRun++;
	}else{
		tournamentObject.players[id].runs[tournamentObject.players[id].currentRun-1] = newRun;
	}
	let numString = "";
	if(tournamentObject.data.pairing == "league")
		numString += tournamentObject.players[id].currentRun
	newRun.dropLink = `/${tID}/${username}${numString}.txt`;
	return "You have started a new league run.";
}
function removeEmptyRun (tournamentObject, id) {										//deletes an empty league run and rolls the currentRun back for accidental submissions
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let tournament = tournamentObject;
	if(!tournament)
		return "Tournament not found.";
	let player = tournament.players[id];
	if(!player)
		return "You are not in this tournament.";
	let currentRun = player.currentRun-1;
	let prevRun = currentRun-1;
	if(!player.runs[prevRun])
		return "You have no previous run to roll back to.";
	if(player.runs[currentRun].matches.length)
		return "Runs with matches can't be deleted, but you are free to start a new run at any time."
	if(tournament.data && tournament.data.runLength && player.runs[prevRun].matches.length == tournament.data.runLength)
		return "Your previous run is already complete.";
	tournamentObject.players[id].runs = toolbox.spliceArray({replace:true, index:currentRun, array:tournamentObject.players[id].runs})
	tournamentObject.players[id].currentRun = prevRun;
	version.logMatch(matchDex);
	return "Run " + parseInt(currentRun+1) + " deleted. Rolled back to run " + currentRun;
}
function updateMatch (tournamentObject, p1id, p2id, p1w, p2w, match, guild){			//creates or edits a league match
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	version.startWriting("match");
	let sendString = "";
	if(match) {
		if(tournamentObject.matches[match-1].p1 != p1id && tournamentObject.matches[match-1].p2 != p1id)
			sendString += `${eris.pullUsername(p1id)} is not in match ${match}.\n`;
		if(tournamentObject.matches[match-1].p1 != p2id && tournamentObject.matches[match-1].p2 != p2id)
			sendString += `${eris.pullUsername(p2id)} is not in match ${match}.\n`;
		if(sendString) {
			version.doneWriting("match");
			return sendString;
		}
		tournamentObject.matches[match-1].p1 = p1id;
		tournamentObject.matches[match-1].p2 = p2id;
		tournamentObject.matches[match-1].p1w = p1w;
		tournamentObject.matches[match-1].p2w = p2w;
		tournamentObject.matches[match-1].p1r = tournamentObject.players[p1id].currentRun;
		tournamentObject.matches[match-1].p2r = tournamentObject.players[p2id].currentRun;
		let player1 = eris.pullUsername(p1id);
		let player2 = eris.pullUsername(p2id);
		let winString = `${player1} and ${player2} draw with ${p1w} wins each`;
		tournamentObject.matches[match-1].winner = null;
		if(p1w > p2w) {
			tournamentObject.matches[match-1].winner = p1id;
			winString = `${player1} wins ${p1w} - ${p2w} over ${player2}`;
		}
		if(p2w > p1w) {
			tournamentObject.matches[match-1].winner = p2id;
			winString = `${player2} wins ${p2w} - ${p1w} over ${player1}`;
		}
		sendString = `corrected match ${match}: ${winString}.`;
		if(tournamentObject.players[p1id].awaitingMatches.includes(parseInt(match)))
			removeAwaits(tournamentObject, p1id, p2id, {match:parseInt(match)})
	}else{
		let disqualified = invalidMatch(tournamentObject, p1id, p2id);
		if(disqualified)
			return disqualified;
		let newMatch = {};
		let player1 = eris.pullUsername(p1id);
		let player2 = eris.pullUsername(p2id);
		let winString = `${player1} and ${player2} draw with ${p1w} wins each`;
		newMatch.p1 = p1id;
		newMatch.p1w = p1w;
		newMatch.p1r = tournamentObject.players[p1id].currentRun;
		newMatch.p2 = p2id;
		newMatch.p2w = p2w;
		newMatch.p2r = tournamentObject.players[p2id].currentRun;
		newMatch.winner = null;
		if(p1w > p2w) {
			newMatch.winner = p1id;
			winString = `${player1} wins ${p1w} - ${p2w} over ${player2}`;
		}
		if(p2w > p1w) {
			newMatch.winner = p2id;
			winString = `${player2} wins ${p2w} - ${p1w} over ${player1}`;
		}
		tournamentObject.matches.push(newMatch);
		tournamentObject.players[p1id].runs[tournamentObject.players[p1id].currentRun-1].matches.push(tournamentObject.matches.length);
		tournamentObject.players[p2id].runs[tournamentObject.players[p2id].currentRun-1].matches.push(tournamentObject.matches.length);
		let matchNo = tournamentObject.matches.length;
		sendString = `recorded match ${matchNo}: ${winString}.`;
	}
	sendString += "\n" + auditMatches(tournamentObject, p1id);
	sendString += "\n" + auditMatches(tournamentObject, p2id);
	if(guild && tournamentObject.data.hasOwnProperty('crown')) {
		let crownM = leagueCrown(tournamentObject, guild);
		if(crownM)
			sendString += "\n" + crownM;
	}
	sendString = sendString.replace("\n\n", "\n");
	version.logMatch(matchDex);
	version.doneWriting("match");
	return sendString;
}
function auditMatches(tournamentObject, id) {											//ensures score is correct and alerts that run has ended
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let temp = bestRecord(tournamentObject, id);
	tournamentObject.players[id].month = temp[4];
	if(tournamentObject.data.runLength != null && tournamentObject.players[id].runs[tournamentObject.players[id].currentRun-1].matches.length >= tournamentObject.data.runLength) {
		if(tournamentObject.data.key == "league" || tournamentObject.data.key == "primordial") //TODO League customization
			fourWinPoster(tournamentObject, id, tournamentObject.players[id].runs[tournamentObject.players[id].currentRun-1]);
		let rolearray = {league: ['317373924096868353','638181322325491744'], primordial: ['413055835179057173','763102029504970823']}
		try{
			if(rolearray.hasOwnProperty(tournamentObject.data.key))
				eris.pullGuild(rolearray[tournamentObject.data.key][0]).members.cache.get(id).roles.remove(rolearray[tournamentObject.data.key][1]);
		}catch(e){
			console.log(e)
		};
		return `${eris.pullPing(id)}, your run is now over. You may start a new run by submitting a deck through DMs.`;
	}
	return "";
}
function leagueCrown(tournamentObject, guild) {											//league crown role that is given to best league runs
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let scoresArray = [0, []];
	let gain = [], lost = [], startCrowns = [], endCrowns = [];
	let crown = tournamentObject.data.crown;
	if(!crown)
		return;
	for(let thisPlayer in tournamentObject.players) {
		let yourScore = tournamentObject.players[thisPlayer].month + tournamentObject.players[thisPlayer].season;
		if(yourScore > scoresArray[0])
			scoresArray = [yourScore, []]
		if(yourScore == scoresArray[0])
			scoresArray[1].push(thisPlayer);
	}
	for(let player in tournamentObject.players) {
		let thatPlayer = tournamentObject.players[player];
		let name = eris.pullUsername(player)
		if(thatPlayer.hasOwnProperty('crown') && thatPlayer.crown && !scoresArray[1].includes(player)) { //lost the crown
			//remove crown
			startCrowns.push(name);
			let member = guild.members.cache.get(player);
			if(member) {
				member.roles.remove(crown)
				thatPlayer.crown = false;
				lost.push(name);
			}
		}else if(scoresArray[1].includes(player) && (!thatPlayer.hasOwnProperty('crown') || !thatPlayer.crown)) { //gain the crown
			//give the crown
			let member = guild.members.cache.get(player);
			if(member) {
				member.roles.add(crown)
				thatPlayer.crown = true;
				endCrowns.push(name);
				gain.push(name);
			}
		}else if(thatPlayer.hasOwnProperty('crown') && thatPlayer.crown){ //keeping the crown
			startCrowns.push(name);
			endCrowns.push(name);
		}
	}
	let output = "";
	if(gain.length && !lost.length && startCrowns.length != 0) {
		for(let user in gain) {
			output += gain[user] + " has joined the top of the league!\n";
		}
	}else if(gain.length || lost.length) {
		for(let user in endCrowns) {
			output += endCrowns[user] + " is now leading the league!\n";
		}
	}
	return output;
}
function invalidMatch (tournamentObject, p1id, p2id) {									//true if match is illegal
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let errors = "";
	if(p1id == p2id)
		errors += "Error: Both players are the same."
	if(errors)
		return errors;
	if(!tournamentObject.players[p1id]) //if a player isn't signed up
		errors += "Error: " + eris.pullUsername(p1id) + " is not signed up for " + tournamentObject.data.key + ".\n";
	if(!tournamentObject.players[p2id])
		errors += "Error: " + eris.pullUsername(p2id) + " is not signed up for " + tournamentObject.data.key + ".\n";
	if(errors)
		return errors;
	if(tournamentObject.data.runLength) {
		if(tournamentObject.players[p1id].runs[tournamentObject.players[p1id].currentRun-1].matches.length >= tournamentObject.data.runLength) //if a player is over their five matches
			errors += "Error: " + eris.pullUsername(p1id) + " has already completed their current run.\n";
		if(tournamentObject.players[p2id].runs[tournamentObject.players[p2id].currentRun-1].matches.length >= tournamentObject.data.runLength)
			errors += "Error: " + eris.pullUsername(p2id) + " has already completed their current run.\n";
		if(errors)
			return errors;
	}
	let oppArrays = getPlayedOpps(tournamentObject, p1id, tournamentObject.players[p1id].currentRun);
	if(!oppArrays[0].includes(p2id)) //if they haven't played this player
		return 0; //match is valid
	//check the rematchLimit
	let opCurrentRun = tournamentObject.players[p2id].currentRun;
	let opRematchCounter = 0; //number of matches these runs have had
	for(let thisOpp in oppArrays[0]) { //for each opponent
		if(oppArrays[0][thisOpp] == p2id && oppArrays[1][thisOpp] == opCurrentRun)	//if their current run
			opRematchCounter++;
	}
	let remLimit = tournamentObject.data.rematch;
	if(!remLimit)
		remLimit = 1;
	if(opRematchCounter >= remLimit)
		return `Invalid match: These two runs have already played each other${(remLimit > 1 ? " the maximum number of times" : "")}.`
	return 0;
}
function buildLeagueInfoRecord(tournamentObject, id, lookback) {						//the $league embed
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let oppString = "", runRecords = "";
	let thisPlayer = tournamentObject.players[id];
	let thisRun = thisPlayer.currentRun;
	var opps = null;
	let playRuns = thisPlayer.runs;
	let mScore = thisPlayer.month;
	let sScore = parseInt(thisPlayer.month+thisPlayer.season);
	let lScore = parseInt(thisPlayer.month+thisPlayer.season+thisPlayer.lifetime);
	let title = `${eris.pullUsername(id)} League Info`;
	if(tournamentObject.data.key != 'league')
		title += ` - ${tournamentObject.data.name}`
	let desc = `You are on run #${thisRun}: ${thisPlayer.runs[thisRun-1].deckName}`
	if(thisPlayer.runs[thisRun-1].matches.length >= tournamentObject.data.runLength)
		desc += ". This run has ended, be sure to submit a new deck before playing more League games";
	if(toolbox.hasValue(lookback) && lookback < thisRun && lookback != 0) {
		thisRun = lookback;
		desc = `This is your ended run #${thisRun}: ${thisPlayer.runs[lookback-1].deckName}.`
		desc += `\nThis run's record was ${getRecord(tournamentObject, id, thisRun)[0]}`;
	}
	if(tournamentObject.players[id].runs[0] && tournamentObject.players[id].runs[thisRun-1] && tournamentObject.players[id].runs[thisRun-1].matches)
		opps = getPlayedOpps(tournamentObject, id, thisRun);
	if(opps) {
		let bestRun = bestRecord(tournamentObject, id);
		lScore = parseInt(thisPlayer.lifetime + bestRun[4]);
		for(let i=0; i<opps[0].length; i++) {
			let anOpp = eris.pullUsername(opps[0][i]);
			let refMatch = tournamentObject.matches[opps[2][i]-1];
			let refData = renderSelfRecord(refMatch, id);
			if(tournamentObject.players[opps[0][i]].currentRun > opps[1][i]){
				oppString += tournamentObject.players[opps[0][i]].runs[opps[1][i]-1].deckName
			}else{
				oppString += anOpp;
			}
			oppString += " (#" + opps[1][i] + ", ";
			oppString += refData[0][1] + "-" + refData[1][1];
			oppString += ")"
			if(i != opps[0].length-1)
				oppString += "\n";
		}
		if(oppString == "")
			oppString = "no one";
		if(playRuns.length == 0) {
			runRecords += "You have no runs yet.";
		}else{
			for(let i=1; i<playRuns.length+1; i++) {
				runRecords += getRecord(tournamentObject, id, i)[0];
				runRecords += " (" + thisPlayer.runs[i-1].deckName +")";
				if(i != playRuns.length) {
					runRecords += "\n";
				}
			}
		}
	}
	let embedded = new Discord.MessageEmbed()
		.setTitle(title)
		.setDescription(desc)
		.addField('Scores', `Month: ${mScore}\nSeason: ${sScore}\nLifetime: ${lScore}`, true)
		//.addField('Month Score', mScore, true)
		//.addField('Season Score', sScore, true)
		//.addField('Lifetime Score', lScore, true)
		.addField(`Your Run Record${(playRuns.length == 1 ? " is" : "s are")}`, runRecords, true)
		.addField('Matches This Run', oppString, true)
		.setFooter(`${tournamentObject.data.key} run data ${thisRun}/${thisPlayer.currentRun}`)
	return [embedded, (thisPlayer.currentRun != 1)]
}
function reportRecord (tournamentObject, id, lookback, textFlag) {						//the $league info command
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let output = "";
	if(!textFlag)
		return buildLeagueInfoRecord(tournamentObject, id, lookback);
	if(tournamentObject.players[id]) {
		let oppString = "";
		let thisPlayer = tournamentObject.players[id];
		let thisRun = thisPlayer.currentRun
		if(toolbox.hasValue(lookback) && lookback < thisRun && lookback != 0)
			thisRun = lookback;
		let bestRun = bestRecord(tournamentObject, id);
		output += eris.pullUsername(id) + ", you are on run #" + thisRun + ":" + thisPlayer.runs[thisRun-1].deckName;
		if(thisPlayer.runs[thisRun-1].matches.length >= tournamentObject.data.runLength)
			output += ". This run has ended, be sure to submit a new deck before playing more League games";
		if(toolbox.hasValue(lookback) && lookback < thisRun && lookback != 0) {
			output = eris.pullUsername(id) + ", this is your ended run #" + thisRun;
			output += ".\nThis run's record was " + getRecord(tournamentObject, id, thisRun)[0];			
		}
		output += ".\n";
		let neTitle = `${eris.pullUsername(id)} League Info`;
		if(tournamentObject.data.key != 'league')
			neTitle += ` - ${tournamentObject.data.name}`
		var nullEmbed = new Discord.MessageEmbed()
			.setTitle(neTitle)
			.setFooter(`${tournamentObject.data.key} run data ${thisRun}/${thisPlayer.currentRun}`)
		if(tournamentObject.players[id].runs[0] && tournamentObject.players[id].runs[thisRun-1] && tournamentObject.players[id].runs[thisRun-1].matches) {
			var opps = getPlayedOpps(tournamentObject, id, thisRun);
		}else{
			output += "You have not played any matches this run.\nYour league score this month is " + thisPlayer.month + ". Your league score this season is " + parseInt(thisPlayer.month+thisPlayer.season) + ". Your lifetime league score is " + parseInt(thisPlayer.month+thisPlayer.lifetime) + ".";
			return [[output, nullEmbed], (thisPlayer.currentRun != 1)];
		}
		let lifescore = parseInt(thisPlayer.lifetime + bestRun[4]);
		for(let i=0; i<opps[0].length; i++) {
			let anOpp = eris.pullUsername(opps[0][i]);
			let refMatch = tournamentObject.matches[opps[2][i]-1];
			let refData = renderSelfRecord(refMatch, id);
			oppString += anOpp + " (#" + opps[1][i] + ", ";
			oppString += refData[0][1] + "-" + refData[1][1];
			oppString += ")"
			if(i != opps[0].length-1)
				oppString += ", ";
		}
		if(oppString == "")
			oppString = "no one"
		let runRecords = "";
		let playRuns = thisPlayer.runs;
		if(playRuns.length == 0) {
			output += "You have no runs yet.\n";
		}else{
			if(playRuns.length == 1)
				output += "Your run record is ";
			if(playRuns.length >= 2)
				output += "Your run records are ";
			for(let i=1; i<playRuns.length+1; i++) {
				output += getRecord(tournamentObject, id, i)[0];
				output += " (" + thisPlayer.runs[i-1].deckName +")";
				if(i != playRuns.length) {
					output += ", ";
				}else{
					output += ".\n";
				}
			}
		}
		output += "This run you have played against " + oppString + ".\n";
		output += "Your league score this month is " + bestRun[4] + ". Your league score this season is " + parseInt(bestRun[4]+thisPlayer.season) + ". Your lifetime league score is " + lifescore + ".";
		return [[output, nullEmbed], (thisPlayer.currentRun != 1)];
	}else{
		return ["Error: You are not signed up for this league."];
	}
}
function vsSeeker (tournamentObject, id) {												//finds players the command user can play in the league
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = tournamentObject.players;
	let thisPlayer = players[id]
	let oppArray = getPlayedOpps(tournamentObject, id, thisPlayer.currentRun); //TODO League customization rematches
	let openArray = getCurrentPlayers(tournamentObject);
	let clearedArray = [];
	for(let playerArray in openArray) {
		let thisOpponent = openArray[playerArray][0];
		if(!invalidMatch(tournamentObject, id, thisOpponent))
			clearedArray.push(thisOpponent);
	}
	let output = eris.pullUsername(id) + ", you are able to play the following opponents: ";
	let i = clearedArray.length;
	for(let thisOpponent in clearedArray) {
		i--
		if(i==0)
			output += "and "
		output += eris.pullUsername(clearedArray[thisOpponent]);
		if(i != 0)
			output += ", "
	}
	if(clearedArray.length == 1)
		output = output.replace(": and", ":");
	return output;
}
function getCurrentPlayers (tournamentObject) {											//finds all players than can play in the tourney
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = tournamentObject.players;
	let openArray = [];
	for(let player in players) {
		let currentRun = players[player].currentRun;
		if(toolbox.hasValue(currentRun) && (tournamentObject.data.runLength == null || players[player].runs[currentRun-1].matches.length < tournamentObject.data.runLength)) {
			let oppArray = [player, currentRun];
			openArray.push(oppArray)
		}
	}
	return openArray;
}
function changeDeckName (tournamentObject, id, name, run) {								//changes a tourney deck's name
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let thisPlayer = tournamentObject.players[id];
	if(thisPlayer == undefined)
		return "You are not in this tournament.";
	if(run == undefined || run == null || run > thisPlayer.currentRun)
		run = thisPlayer.currentRun;
	thisPlayer.runs[run-1].deckName = name;
	return "Run " + run + "'s deck name changed to " + name;
	
}
function fourWinPoster(tournamentObject, id, runInfo) {									//posts decks that go 4-1 or better
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let runScore = getRecord(tournamentObject, id, tournamentObject.players[id].currentRun);
	if(runScore[2] >= 4 && !runInfo.hasOwnProperty('printed')) {
		let pullLink = runInfo.dropLink;
		let deck = runInfo.deckName;
		dbx.filesDownload({path:pullLink})
			.then(function(data) {
				fs.writeFile(deck+'.txt', data.fileBinary, 'binary', function(err) {
					if(err) throw err;
					fs.readFile(deck+'.txt', "utf8", function read(err, data) {
						if(err) throw err;
						let deckData = extractPlain(data);
						let chan = "475851199812337695", name = "League";
						if(tournamentObject.data.key == "primordial") {
							chan = "762806682152730636";
							name = "Primordial League"
							if(matchDex.primordial.players[id].set) {
								deck += " (Set: " + matchDex.primordial.players[id].set + ")";
							}else{
								let setNab = data.match(/mse-modern.com\/msem2\/images\/([A-Z0-9_])\//);
								if(setNab)
									deck += " (Set: " + setNab[1] + ")";
							}
						}
						let deckChannel = Client.channels.cache.get(chan);
						let deckMessage = `${name}: ${deck} (${runScore[0]})\n`;
						deckMessage += deckData;
						deckChannel.send(deckMessage);
						//mark it so it won't repost it
						tournamentObject.players[id].runs[tournamentObject.players[id].currentRun-1].printed = true;
					});
				});
			})
			.catch(function(err){console.log(err)})
	}
}
//gp specific scripts
function renderGPLeaderBoard (tournamentObject, showBreakers, page) {					//renders the gp leaderboard
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = Object.keys(tournamentObject.players);
	let sortedArray = sortWithBreakers(tournamentObject, players);
	let infoArray = [];
	let pageObj = {current:0, 0:""};
	let longestString = 7; //minimum length, for "Players"
	//big tournaments ran into the character limit, determine the maximum length of names
	let maximumString = 32; //maximum length of a name, may need to be truncated due to character limit
	let noOfPlayers = players.length; //number of players
	let lenOfBlocks = 3; //length of the code blocks, ```
	let lenOfData = 43; //length of score columns
	if(!showBreakers)
		lenOfData = 10;
	let nameLine = `${tournamentObject.data.key} leaderboard with tiebreakers:\n`;
	if(!showBreakers)
		nameLine = nameLine.replace('with tiebreakers:', 'without tiebreakers:');
	let matchesRemaining = `\n**${tournamentObject.awaitingMatches.length} matches** remain this round.`
	matchesRemaining = matchesRemaining.replace("*1 matches** remain", "*1 match** remains");
	
	let minLength = lenOfBlocks + lenOfBlocks;					//```Players```
	minLength += lenOfData; 			 						//+the score columns
	minLength += nameLine.length + matchesRemaining.length;		//+title and matches remaning
	let remaining = 2000 - minLength; //remaining characters for names
	//build the table
	let ranks = {rank: 1, score: 0, tw: 0, mb: 0, pd: 0}
	let byeCorrect = 0; //bye doesn't always sort to bottom, so correct for people ranking "under" it
	for(let i=0; i<sortedArray.length; i++) {
		if(sortedArray[i] == bye) {
			byeCorrect++;
		}else{
			let thisArray = [];
			thisArray.push(i+1-byeCorrect);                                                  	//thisArray[0] = rank
			let theirUsername = toolbox.stripEmoji(eris.pullUsername(sortedArray[i]));
			thisArray.push(theirUsername);											//thisArray[1] = username
			thisArray.push(tournamentObject.players[sortedArray[i]].gpWin);     	//thisArray[2] = gpWin
			thisArray.push(tournamentObject.players[sortedArray[i]].gpLoss);    	//thisArray[3] = gpLoss
			thisArray.push(tournamentObject.players[sortedArray[i]].gpDraw);    	//thisArray[4] = gpDraw
			thisArray.push(thisArray[2] + (0.5*thisArray[4]));                   	//thisArray[5] = Score
			thisArray.push(omw(tournamentObject, sortedArray[i]));    		  				//thisArray[6] = OM%
			thisArray.push(gameWinPercentage(tournamentObject, sortedArray[i],0));			//thisArray[7] = GW%
			thisArray.push(ogw(tournamentObject, sortedArray[i])); 							//thisArray[8] = OGW%
			//bank stuff for real ranks
			if(ranks.score == thisArray[5] && ranks.tw == thisArray[6] && ranks.mb == thisArray[7] && ranks.pd == thisArray[8]) {
				thisArray[0] = ranks.rank;
			}else{
				ranks.rank = thisArray[0];
				ranks.score = thisArray[5];
				ranks.tw = thisArray[6];
				ranks.mb = thisArray[7];
				ranks.pd = thisArray[8];
			}
			let titleString = thisArray[0] + ": " + thisArray[1];
			if(titleString.length > longestString) 									//check longestString for later
				longestString = titleString.length;
			infoArray.push(thisArray);
		}
	}
	remaining -= longestString;
	for(i=0; i<infoArray.length; i++) {
		let output = "";
		output += toolbox.fillLength(infoArray[i][0] + ": " + infoArray[i][1], longestString, "", " ") + " | "; //add rank and name, fill with spaces to keep first column even
		output += infoArray[i][2] + "-" + infoArray[i][3] + "-" + infoArray[i][4] + " | "; 							//add W-L-T
		if(showBreakers) {
			output += " " + infoArray[i][5].toFixed(1) + " " + " | "; 												//add Score
			output += toolbox.fillLength(infoArray[i][6].toFixed(2), 5, " ", "") + " | "; 							//add OM%
			output += toolbox.fillLength(infoArray[i][7].toFixed(2), 5, " ", "") + " | "; 							//add GW%
			output += toolbox.fillLength(infoArray[i][8].toFixed(2), 5, " ", "") + " |"; 							//add OG%
		}
		if(i<sortedArray.length-1)
			output += "\n";
		if((output.length + pageObj[pageObj.current].length + 1) > remaining) { //add
			pageObj.current++;
			pageObj[pageObj.current] = output;
		}else{
			pageObj[pageObj.current] += output;
		}
	}
	let headers = " | W-L-T |";
	if(showBreakers)
		headers += " Score |  OMP  |  GWP  |  OGP  |"
	let output = nameLine + "```" + toolbox.fillLength("Players", longestString, "", " ") + headers + "\n"
	output += pageObj[page];
	output += "```";
	output = output.replace(/\|  0\.00 \|/g, "|  0.0  |");
	output = output.replace(/\| 100\.00 \|/g, "| 100.0 |");
	output += matchesRemaining;
	let pageEmbed = new Discord.MessageEmbed()
		.setFooter(`${page+1}/${pageObj.current+1} ${tournamentObject.data.key} leaderboard`)
	return [output, pageEmbed];
}
function dropTourneyPlayer (tournamentObject, id, playing) {							//removes or adds player from tourney, adds or removes bye as needed
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let output = "";
	let awaitHold = ""
	if(playing == 0 && tournamentObject.round == 0) { //if they are dropping and the tournament hasn't started
		delete tournamentObject.players[id]; //delete their data
		return eris.pullUsername(id) + " has been removed from " + tournamentObject.data.key + ".";
	}
	//else if the tournament has started
	tournamentObject.players[id].playing = playing; //they still exist, 0 for no longer pair, 1 for repairing
	if(tournamentObject.players.hasOwnProperty(bye)) { //if the bye player exists already, change its pairing status
		var byePlay = tournamentObject.players[bye].playing;
		tournamentObject.players[bye].playing = (byePlay == 0 ? 1 : 0) //if 0, then 1, else 0
	}else{ //if it doesn't, add it
		addNewPlayer(tournamentObject, bye, true);
	}
	if(playing == 0) { //if a drop, autolose any awaiting matches
		let awaiting = tournamentObject.players[id].awaitingMatches;
		for(let matches in awaiting) {
			awaitHold = awaiting[matches];
			let theMatch = tournamentObject.matches[awaiting[matches]-1];
			let p2id = (theMatch.p1 == id ? theMatch.p2 : theMatch.p1)
			output += updateGPMatch (tournamentObject, id, p2id, 0, 2, awaiting[matches])
		}
	}
	output = eris.pullUsername(id) + " has been dropped from " + tournamentObject.data.key + " and may be readded later.\n" + output;
	if(playing == 1) {
		output = eris.pullUsername(id) + " has been readded to " + tournamentObject.data.key + ".";
		if(awaitHold)
			output += " Remind them to use $report gp match " + awaitHold + " to edit their match.";
	}
	return output
}
function writePlayerIndexes (tournamentObject) {										//writes the player indexes for dropping players
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let output = "";
	let i = 0;
	for(let player in tournamentObject.players) {
		if(player != bye) {
			output += i + " — " + eris.pullUsername(player);
			if(tournamentObject.players[player].playing == 0)
				output += " (dropped)";
			output += "\n";
			i++;
		}
	}
	output += "Send `!drop <tournament> player 0` etc to drop player 0. Use `!undrop <tournament> player 0` if you need to add them back."
	return output;
}
function newGPMatch (tournamentObject, p1, p2, knockout) {								//creates new gp match, auto-scores byes
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let newMatch = {};
	if(p1 == bye || p2 == bye) {
		if(p1 == bye) {
			newMatch.p1 = p1;
			newMatch.p1w = 0;
			newMatch.p1r = 0;
			newMatch.p2 = p2;
			newMatch.p2w = 2;
			newMatch.p2r = 0;
			newMatch.winner = p2;
			newMatch.round = tournamentObject.round;
			if(knockout != undefined && knockout == "knockout") {
				newMatch.knockout = 1;
			}else{
				tournamentObject.players[p2].gpWin++;
				tournamentObject.players[p1].gpLoss++;
			}
		}
		if(p2 == bye) {
			newMatch.p1 = p1;
			newMatch.p1w = 2;
			newMatch.p1r = 0;
			newMatch.p2 = p2;
			newMatch.p2w = 0;
			newMatch.p2r = 0;
			newMatch.winner = p1;
			newMatch.round = tournamentObject.round;
			if(knockout != undefined && knockout == "knockout") {
				newMatch.knockout = 1;
			}else{
				tournamentObject.players[p1].gpWin++;
				tournamentObject.players[p2].gpLoss++;
			}
		}
		tournamentObject.matches.push(newMatch);
	}else{
		newMatch.p1 = p1;
		newMatch.p1w = 0;
		newMatch.p1r = 0;
		newMatch.p2 = p2;
		newMatch.p2w = 0;
		newMatch.p2r = 0;
		newMatch.winner = "";
		newMatch.round = tournamentObject.round;
		if(knockout != undefined && knockout == "knockout")
			newMatch.knockout = 1;
		tournamentObject.matches.push(newMatch);
		tournamentObject.players[p1].awaitingMatches.push(tournamentObject.matches.length);
		tournamentObject.players[p2].awaitingMatches.push(tournamentObject.matches.length);
		tournamentObject.awaitingMatches.push(tournamentObject.matches.length);
	}
	tournamentObject.players[p1].runs[0].matches.push(tournamentObject.matches.length);
	tournamentObject.players[p2].runs[0].matches.push(tournamentObject.matches.length);
	let ping = `${eris.pullPing(newMatch.p1)} vs. ${eris.pullPing(newMatch.p2)}\n`;
	ping = ping.replace(/<@!?343475440083664896>/,"Bye");
	return ping;
}
function startTourney(tournamentObject) {												//begin swiss pairing
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(tournamentObject.data.pairing == "knockout" || tournamentObject.data.pairing == "double-elimination") //if knockout tourney go straight to that
		return beginKnockoutRounds(tournamentObject)
	//else swiss it
	let numberOfPlayers = Object.keys(tournamentObject.players).length;
	let odd = numberOfPlayers % 2;
	if(odd) //add bye player
		addNewPlayer(tournamentObject, bye, true);
	return swissPair(tournamentObject)
}
function pushTourney(tournamentObject) {												//move tournament to next round, change style if needed
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(tournamentObject.awaitingMatches.length) { //if there are awaiting matches, alert the TO instead of pushing
		let warnMessage = "The following matches are still awaiting reports. The tournament can't proceed until they have been finished or dropped.\n";
		for(let match in tournamentObject.awaitingMatches) {
			let lateMatch = tournamentObject.matches[tournamentObject.awaitingMatches[match]-1];
			let pl1 = "";
			let pl2 = "";
			pl1 = eris.pullUsername(lateMatch.p1);
			pl2 = eris.pullUsername(lateMatch.p2);
			warnMessage += "Match " + tournamentObject.awaitingMatches[match] + ": " + pl1 + " vs " + pl2 + ".\n";
		}
		return warnMessage;
	}
	tournamentObject.round++;
	let numberOfHumans = 0;
	for(let thisPlayer in tournamentObject.players) {
		if(thisPlayer != bye)
			numberOfHumans++;
	}
	//if we're in a knockout round, knockout matches
	if(tournamentObject.data.pairing == 'knockout') {
		return knockoutRound(tournamentObject);
	}
	//if we're past the swiss rounds in a swiss-knockout, cut to top
	if(tournamentObject.round > swissCount(numberOfHumans) && tournamentObject.data.pairing != 'swiss') {
		return beginKnockoutRounds(tournamentObject);
	}
	//otherwise, swiss it
	return swissPair(tournamentObject);
}
function postTourney(tournamentObject, message, author, channel) {						//posts the gp matchups and sets a reminder to check them in three days
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let gpChan = tournamentObject.data.channel;
	Client.channels.cache.get(gpChan).send(message)
		.then(thatMess => asyncSwapPins(thatMess, {author:Client.user.id}, 1))
		.catch(e => console.log(e))
	let pings = [3, "day"];
	if(tournamentObject.data.time)
		pings = tournamentObject.data.time
	let pingTime = setTimeDistance(pings[0], pings[1]);
	remindAdder(channel, author, `Check the round ${tournamentObject.round} ${tournamentObject.data.key} matches.`, `${pings[0]} ${pings[1]}`, pingTime.getTime())
}
function pingTourney(tournamentObject) {												//pings everyone with awaiting matches
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let pingParty = "";
	let awaiting = tournamentObject.awaitingMatches;
	for(let match in awaiting) {
		let thisPlayer = eris.pullPing(awaiting[match].p1);
		if(thisPlayer.username != "PlayerUnknown")
			pingParty += `${thisPlayer} `;
		thisPlayer = eris.pullPing(awaiting[match].p2);
		if(thisPlayer.username != "PlayerUnknown")
			pingParty += `${thisPlayer} `;
	}
	return pingParty;
}
function updateGPMatch (tournamentObject, p1id, p2id, p1w, p2w, match) {				//edits a gp match
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let sendString = "";
	let recOrCorr = "reported";
	if(tournamentObject.matches[match-1].p1 != p1id && tournamentObject.matches[match-1].p2 != p1id)
		sendString += eris.pullUsername(p1id) + " is not in match " + match + ".\n";
	if(tournamentObject.matches[match-1].p1 != p2id && tournamentObject.matches[match-1].p2 != p2id)
		sendString += eris.pullUsername(p2id) + " is not in match " + match + ".\n";
	if(p1id == p2id)
		sendString += "Both players are the same.\n";
	if(sendString)
		return sendString;
	tournamentObject.matches[match-1].p1 = p1id;
	tournamentObject.matches[match-1].p2 = p2id;
	tournamentObject.matches[match-1].p1w = p1w;
	tournamentObject.matches[match-1].p2w = p2w;
	tournamentObject.matches[match-1].p1r = 1; //set this at 1 because league takes p1r-1 and we want this to be 0
	tournamentObject.matches[match-1].p2r = 1;
	let player1 = eris.pullUsername(p1id);
	let player2 = eris.pullUsername(p2id);
	let winString = player1 + " and " + player2 + " draw with " + p1w + " wins each";
	tournamentObject.matches[match-1].winner = null;
	if(p1w > p2w) {
		tournamentObject.matches[match-1].winner = p1id;
		winString = player1 + " wins " + p1w + " - " + p2w + " over " + player2;
	}
	if(p2w > p1w) {
		tournamentObject.matches[match-1].winner = p2id;
		winString = player2 + " wins " + p2w + " - " + p1w + " over " + player1;
	}
	let tindex = tournamentObject.awaitingMatches.indexOf(match);
	if(tindex != -1) {
		removeAwaits(tournamentObject, p1id, p2id, {index:tindex, match:match})
	}else{
		recOrCorr = "corrected";	
	}
	
	auditGPMatches(tournamentObject, p1id);
	auditGPMatches(tournamentObject, p2id);
	version.logMatch(matchDex);
	return recOrCorr + " match " + match + ": " + winString + ".";
}
function removeAwaits(tournamentObject, p1id, p2id, data) {								//removes awaitingMatches data
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let tindex = -1;
	if(data.hasOwnProperty('index')) {
		tindex = data.index;
	}else if(data.hasOwnProperty('match')) {
		tindex = tournamentObject.awaitingMatches.indexOf(data.match);
	}
	if(tindex == -1)
		return;
	tournamentObject.awaitingMatches.splice(tindex, 1)
	let p1index = tournamentObject.players[p1id].awaitingMatches.indexOf(data.match);
	tournamentObject.players[p1id].awaitingMatches.splice(p1index, 1)
	let p2index = tournamentObject.players[p2id].awaitingMatches.indexOf(data.match);
	tournamentObject.players[p2id].awaitingMatches.splice(p2index, 1)
}
function gpLeaderBoard2 (tournamentObject) {											//creates the list of players sorted by best gp record, not sure why there's 2 oop
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = tournamentObject.players;
	let playersArray = Object.keys(players);
	if(playersArray.length == 0)
		return "There is no GP running.";
	playersArray = sortWithBreakers(tournamentObject, playersArray);
	let output = "";
	for(i=1; i<playersArray.length+1; i++){
		output += i + ": " + eris.pullUsername(playersArray[i-1]) + " (" + players[playersArray[i-1]].gpWin + " - " + players[playersArray[i-1]].gpLoss + " - " + players[playersArray[i-1]].gpDraw + ")\n";
	}
	return output;
}
function auditGPMatches (tournamentObject, id) {										//ensures the GP scores stay correct
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let theMatches = tournamentObject.players[id].runs[0].matches;
	let wins = 0;
	let loss = 0;
	let draw = 0;
	let awaiting = [];
	for(let theMatch in theMatches) {
		if(tournamentObject.matches[theMatches[theMatch]-1].winner == id && !toolbox.hasValue(tournamentObject.matches[theMatches[theMatch]-1].knockout)) {
			wins++;
		}else if(tournamentObject.matches[theMatches[theMatch]-1].winner == "") {
			awaiting.push(theMatches[theMatch])
		}else if(tournamentObject.matches[theMatches[theMatch]-1].winner == null && !toolbox.hasValue(tournamentObject.matches[theMatches[theMatch]-1].knockout)) {
			draw++;
		}else if(tournamentObject.matches[theMatches[theMatch]-1].winner != id && !toolbox.hasValue(tournamentObject.matches[theMatches[theMatch]-1].knockout)) {
			loss++;
		}
	}
	tournamentObject.players[id].gpWin = wins;
	tournamentObject.players[id].gpLoss = loss;
	tournamentObject.players[id].gpDraw = draw;
	tournamentObject.players[id].awaitingMatches = awaiting;
	if(tournamentObject.data.key == "gladiator") {
		if(loss < 3) {
			tournamentObject.players[id].currentRun = loss+1;
		}else{
			tournamentObject.players[id].currentRun = 3;
			tournamentObject.players[id].playing = 0;
			
		}
		
	}
	
}
function swissCount (num) {																//number of swiss rounds for num players
	if(num < 4)
		return 0
	if(num < 9)
		return 3
	if(num < 32)
		return 4
	return 5
}
function swissCut (tournamentObject) {													//returns array of players who make the swiss cut
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let out = [];
	let players = tournamentObject.players;
	if(tournamentObject.data.cutScript) {
		if(tournamentObject.data.cutScript == "X-2") { //X-2s make the cut
			for(let p in players) {
				if(p != bye && players[p].gpLoss + players[p].gpDraw < 3)
					out.push(p);
			}
		}else if(tournamentObject.data.cutScript.match(/^Top\d+/i)){
			let board = sortWithBreakers(tournamentObject, players);
			let topN = tournamentObject.data.cutScript.match(/^Top(\d+)/i)[1];
			for(let i = 0; i<topN; i++) {
				if(board[i] == bye) {
					topN++;
				}else{
					out.push(board[i]);
				}
			}
		}
	}else{
		//cut 1 losses+draws
		for(let p in players) {
			if(p != bye && players[p].gpLoss + players[p].gpDraw < 2)
				out.push(p);
		}
	}
	return out;
}
function swissPair (tournamentObject) {													//pairs players swiss style
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	version.startWriting("match");
	let playerIDArray = [];
	let pingParty = "";
	let byeTemp = "";
	
	if(tournamentObject.round <= 1 || tournamentObject.data.pairing == "random") {
		//random
		let tName = tournamentObject.data.name;
		if(!tName)
			tName = tournamentObject.data.key;
		let defTime = "3 days";
		if(tournamentObject.data.time)
			defTime = tournamentObject.data.time[0] + " " + tournamentObject.data.time[1] + (tournamentObject.data.time[0] != 1 ? "s" : "")
		pingParty = "Round " + tournamentObject.round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + tournamentObject.data.TO + "> for extensions.\n";
		for(let thisPlayer in tournamentObject.players) {
			if(tournamentObject.players[thisPlayer].playing)
				playerIDArray.push(thisPlayer);
		}
		playerIDArray = toolbox.shuffleArray(playerIDArray);
		for(let i=0; i<playerIDArray.length; i = i+2) {
			//addNewRun(tournamentObject, playerIDArray[i], "");
			//addNewRun(tournamentObject, playerIDArray[i+1], "");
			if(playerIDArray[i] == bye || playerIDArray[i+1] == bye) {
				byeTemp = newGPMatch(tournamentObject, playerIDArray[i], playerIDArray[i+1]);
			}else{
				pingParty += newGPMatch(tournamentObject, playerIDArray[i], playerIDArray[i+1]);
			}
		}
		pingParty += byeTemp;
		version.logMatch(matchDex);
		version.doneWriting("match");
		return pingParty;
	}

	//else swiss it
	let tName = tournamentObject.data.name;
	if(!tName)
		tName = tournamentObject.data.key;
	let defTime = "3 days";
	if(tournamentObject.data.time)
		defTime = tournamentObject.data.time[0] + " " + tournamentObject.data.time[1] + (tournamentObject.data.time[0] != 1 ? "s" : "")
	pingParty = "Round " + tournamentObject.round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + tournamentObject.data.TO + "> for extensions.\n";
	let recordArray = [];
	for(let thisPlayer in tournamentObject.players) {
		if(tournamentObject.players[thisPlayer].playing) {
			tournamentObject.players[thisPlayer].sortPoint = tournamentObject.players[thisPlayer].gpWin - (tournamentObject.players[thisPlayer].gpLoss / 100);
			if(thisPlayer == bye)
				tournamentObject.players[thisPlayer].sortPoint = -100;	//make sure bye always goes last
			if(!recordArray.includes(tournamentObject.players[thisPlayer].sortPoint))
				recordArray.push(tournamentObject.players[thisPlayer].sortPoint);
		}
	}
	recordArray.sort(function(a, b){return b-a});
	let playRecArray = [];
	for(i=0;i<recordArray.length;i++)
		playRecArray[i] = [];
	for(let thisPlayer in tournamentObject.players) {
		if(tournamentObject.players[thisPlayer].playing) {
			playRecArray[recordArray.indexOf(tournamentObject.players[thisPlayer].sortPoint)].push(thisPlayer);
			delete tournamentObject.players[thisPlayer].sortPoint;
		}
	}
	for(i=0;i<recordArray.length;i++)
		playRecArray[i] = toolbox.shuffleArray(playRecArray[i]);
	
	let pairUpArray = []; //players who were paired up
	let pairDownArray = []; //players who were paired down
	//using these we can make sure a paired up and paired down player don't normally fight
	playRecArray.reverse();
	if(playRecArray[0].length == 1) { //pair up a lone last place
		playRecArray[1].splice(0, 0, playRecArray[0].pop());
		pairUpArray.push(playRecArray[1][0]);
	}
	if(playRecArray[playRecArray.length-1].length == 1) { //pair down a lone first place
		playRecArray[playRecArray.length-2].push(playRecArray[playRecArray.length-1].pop());
		pairDownArray.push(playRecArray[playRecArray.length-2][playRecArray[playRecArray.length-2].length-1]);
	}

	let pairsArray = swissEngine(tournamentObject, playRecArray, pairUpArray, pairDownArray, 0);
	if(pairsArray == null) {
		version.doneWriting("match");
		return "Unable to generate swiss pairings.";
	}
	for(let pair in pairsArray) {
		if(pairsArray[pair][0] == bye || pairsArray[pair][1] == bye) {
			byeTemp += newGPMatch(tournamentObject, pairsArray[pair][0], pairsArray[pair][1]);
		}else{
			pingParty += newGPMatch(tournamentObject, pairsArray[pair][0], pairsArray[pair][1]);
		}
	}
	pingParty += byeTemp;
	pingParty = pingParty.replace('<@343475440083664896>','Bye')
	version.logMatch(matchDex);
	version.doneWriting("match");
	return pingParty;
}
function swissEngine (tournamentObject,playRecArray,pairUpArray,pairDownArray,loops){	//attempts to build a swiss pairing
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let pairsArray = []; //holds all our good pairings, resets when we get stuck
	let playerIDArray = []; //holds our players and removes them as they pair off
	for(let thisScore in playRecArray) {
		for(let aPlayer in playRecArray[thisScore])
			playerIDArray.push(playRecArray[thisScore][aPlayer]);
	}
	let numberOfPlayers = playerIDArray.length;
	
	for(let thisScore in playRecArray) { //for each unique score
	let valid = {}; //temporarily holds all valid matches for this score array
	let unpaired = 0;
		for(let thisPlayerA in playRecArray[thisScore]) { //for each player with that score
			if(playRecArray[thisScore][thisPlayerA]) { //if it still exists
				valid[playRecArray[thisScore][thisPlayerA]] = [];
				unpaired++;
				let opps = getPlayedOpps(tournamentObject, playRecArray[thisScore][thisPlayerA], 1)[0];
				for(let thisPlayerB in playRecArray[thisScore]) { //check each player with the same score
					if(playRecArray[thisScore][thisPlayerB] != playRecArray[thisScore][thisPlayerA] && !opps.includes(playRecArray[thisScore][thisPlayerB]) && !((pairUpArray.includes(playRecArray[thisScore][thisPlayerA]) && pairDownArray.includes(playRecArray[thisScore][thisPlayerB])) || (pairUpArray.includes(playRecArray[thisScore][thisPlayerB]) && pairDownArray.includes(playRecArray[thisScore][thisPlayerA]))))
						valid[playRecArray[thisScore][thisPlayerA]].push(playRecArray[thisScore][thisPlayerB]); //if it isn't the same person, previously played, or pairedUp vs pairedDown, save it
				}
				//valid[aPlayer] = array of players with the same score aPlayer can fight
			}
		}
		let loops = 0;
		while(unpaired > 1 && loops < 2) {
			//get shortest array, it controls pairings
			let shortstack = ["",[0],100]; //id, opps, length
			for(let id in valid) {
				if(valid[id].length < shortstack[2] || (valid[id].length == shortstack[2] && id == bye))
					shortstack = [id, valid[id], valid[id].length];
			}
			if(shortstack[2] != 1) //shuffle the array
				shortstack[1] = toolbox.shuffleArray(shortstack[1])
			let paired = shortstack[1][0];
			let pairCheck = [shortstack[0], paired]
			let pairCheck2 = [paired, shortstack[0]]
			//TODO make this favor paired up people?
			for(id in valid) { //if this pair causes anyone to be unpairable, pair that person instead
				if(valid[id] == pairCheck || valid[id] == pairCheck2)
					shortstack[0] = id;
			}
			if(!paired)
				loops++ //if you manage to have multiple that can't pair, loops breaks us out;
			if(paired) {
				pairsArray.push([shortstack[0], paired]); //bank our paired matches
				playerIDArray.splice(playerIDArray.indexOf(shortstack[0]),1);
				playerIDArray.splice(playerIDArray.indexOf(paired),1);
				for(id in valid) {
					if(valid[id].includes(shortstack[0])) //remove them from our valid matches
						valid[id].splice(valid[id].indexOf(shortstack[0]),1);
					if(valid[id].includes(paired))
						valid[id].splice(valid[id].indexOf(paired),1);
				}
				delete valid[shortstack[0]];
				delete valid[paired];
				unpaired -= 2; //two have been paired, check if we can pair some more
			}
		}
		if(unpaired) { //usually an odd one out, sometimes an unpairable loop
			for(let lonePlayer in valid) { //for each of our unpaired players
				if(playRecArray[parseInt(thisScore)+1]) {
					playRecArray[parseInt(thisScore)+1].splice(0,0,lonePlayer); //add them to the beginning of the next score
					pairUpArray.push(lonePlayer);
				}
			}
		}
	}
	if(playerIDArray.length == 2) {
		let oppsArray = getPlayedOpps(tournamentObject, playerIDArray[0], 1);
		if(!oppsArray.includes(playerIDArray[1]))
			pairsArray.push([playerIDArray[0],playerIDArray[1]])
	}
	if(2*pairsArray.length == numberOfPlayers)
		return pairsArray;
	if(loops < 3)
		return swissEngine (tournamentObject, playRecArray, pairUpArray, pairDownArray, loops+1)
	return null;
}
function beginKnockoutRounds(tournamentObject) {										//pairs players seeded bracket style
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let topArray = [];
	let tName = tournamentObject.data.name;
	if(!tName)
		tName = tournamentObject.data.key;
	let defTime = "3 days";
	if(tournamentObject.data.time)
		defTime = tournamentObject.data.time[0] + " " + tournamentObject.data.time[1] + (tournamentObject.data.time[0] != 1 ? "s" : "")
	let pingParty = "Round " + tournamentObject.round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + tournamentObject.data.TO + "> for extensions.\n";
	let players = tournamentObject.players;
	let matches = tournamentObject.matches;
	tournamentObject.knockoutMatches = [];
	for(let thisPlayer in tournamentObject.players) { //get all the players with 0 or 1 losses //TODO GP customization
		if(tournamentObject.players[thisPlayer].gpLoss+tournamentObject.players[thisPlayer].gpDraw < 2 && tournamentObject.players[thisPlayer].playing && thisPlayer != bye)
			topArray.push(thisPlayer);
	}
	if(topArray.length > 1)
		topArray = sortWithBreakers(tournamentObject,topArray); //sort by highest to lowest gpWin
	let numberOfHumans = topArray.length;
	let numberOfPlayers = 2;	//increase to next square
	while(numberOfHumans > numberOfPlayers) {
		numberOfPlayers = numberOfPlayers*2
	}
	for(let i=numberOfHumans; i<numberOfPlayers;i++) //add byes to get up to next square
		topArray.push(bye);
	let pairsArray = generateBracketSeeds(Math.log2(0.5*numberOfPlayers));
	for(let thisPair in pairsArray) {
		pingParty += newGPMatch(tournamentObject, topArray[pairsArray[thisPair][0]-1], topArray[pairsArray[thisPair][1]-1],'knockout');
		tournamentObject.knockoutMatches.push(tournamentObject.matches.length);
	}
	tournamentObject.data.pairing = "knockout";
	version.logMatch(matchDex);
	return pingParty;
}
function arrayDuplicates(array1, array2) {												//returns array of duplicate elements between two arrays
	let shortArray = [];
	let longArray = [];
	let dupeArray = [];
	if(array1.length > array2.length) {
		shortArray = array2;
		longArray = array1;		
	}else{
		shortArray = array1;
		longArray = array2;	
	}
	for(let value in shortArray) {
		if(longArray.includes(shortArray[value]))
			dupeArray.push(shortArray[value]);
	}
	return dupeArray;
}
function buchholz(tournamentObject, id, cull) {											//buchholz or modified buchholz scoring
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = tournamentObject.players;
	let opps = getPlayedOpps(tournamentObject, id, 1, true)[0];
	let scores = [];
		for(let opp in opps) {
			if(opp != bye) { // 1 point for a win, half for a draw
				scores.push(players[opps[opp]].gpWin + 0.5 * players[opps[opp]].gpDraw);
			}
		}
	if(cull === 'modified') {
		scores.sort(function(a, b){return b-a}); //sort scores
		scores[0] = 0; //drop highest score
		scores[scores.length-1] = 0; //drop lowest score
	}
	let mbs = scores.reduce(function(total, num) {return total + num;}); //add them up
	return mbs;
}
function tiedBreaker(tournamentObject, id) {											//number of wins against tied opponents
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let wins = 0;
	let matches = tournamentObject.matches;
	let players = tournamentObject.players;
	let refScore = players[id].gpWin + 0.5*players[id].gpDraw;
	for(let player in players) {
		if(player != id && toolbox.hasValue(players[id].runs) && toolbox.hasValue(players[player].runs[0])) {
			let oppMatches = arrayDuplicates(players[id].runs[0].matches, players[player].runs[0].matches);
			for(let match in oppMatches) {
				let thisScore = players[player].gpWin + 0.5*players[player].gpDraw;
				if(!toolbox.hasValue(matches[oppMatches[match]-1].knockout) && thisScore == refScore && matches[oppMatches[match]-1].winner == id)
					wins++
			}
		}
	}
	return wins;
}
function matchDiff(tournamentObject, playerID) {										//points difference
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let gameWins = 0;
	let gameLoss = 0;
	let matches = tournamentObject.matches;
	let player = tournamentObject.players[playerID];
	let theirMatches = player.runs[0].matches;
	for(let match in theirMatches) {
		let thisMatch = matches[theirMatches[match]-1];
		if(thisMatch.p1 == playerID) {
			gameWins += parseInt(thisMatch.p1w);
			gameLoss += parseInt(thisMatch.p2w);
		}else{
			gameLoss += parseInt(thisMatch.p1w);
			gameWins += parseInt(thisMatch.p2w);
		}
	}
	return gameWins - gameLoss;
}
function sortWithBreakers(tournamentObject, sortingArray) {								//sorting script that incorporates OMW, GW, and OGW breakers
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = tournamentObject.players;
	sortingArray.sort(function(a,b){return (players[b].gpWin + 0.5*players[b].gpDraw) - (players[a].gpWin + 0.5*players[a].gpDraw)});
	sortingArray.sort(function(a, b) {
		return applyBreakers(tournamentObject, a, b)
	});
	return sortingArray;
}
function applyBreakers (tournamentObject, a, b) {										//handles tiebreakers
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let players = tournamentObject.players;
	let matches = tournamentObject.matches;
	let result = (players[b].gpWin + 0.5*players[b].gpDraw) - (players[a].gpWin + 0.5*players[a].gpDraw);
	if(result == 0) //tiebreak by omw
		result = omw(tournamentObject, b) - omw(tournamentObject, a);
	if(result == 0) //tiebreak by gwp
		result = gameWinPercentage(tournamentObject, b, 0) - gameWinPercentage(tournamentObject, a, 0);
	if(result == 0) //tiebreak by ogw
		result = ogw(tournamentObject, b) - ogw(tournamentObject, a);
	/*if(result == 0) //tiebreak by a-b match winner
		result = tiedBreaker(tournamentObject, b) - tiedBreaker(tournamentObject, a);
	if(result == 0) //then tiebreak by modified Buchholz
		result = buchholz(tournamentObject, b, 'modified') - buchholz(tournamentObject, a, 'modified');
	if(result == 0) //then tiebreak by points difference
		result = (matchDiff(tournamentObject, b) - matchDiff(tournamentObject, a))*/
	return result;
}
function knockoutRound (tournamentObject) {												//handles knockout matches
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let tName = tournamentObject.data.name;
	if(!tName)
		tName = tournamentObject.data.key;
	let defTime = "3 days";
	if(tournamentObject.data.time)
		defTime = tournamentObject.data.time[0] + " " + tournamentObject.data.time[1] + (tournamentObject.data.time[0] != 1 ? "s" : "")
	let pingParty = "Round " + tournamentObject.round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + tournamentObject.data.TO + "> for extensions.\n";
	let newMatches = [];
	for(let i=0; i<tournamentObject.knockoutMatches.length; i+=2) {
		let fight1 = tournamentObject.matches[tournamentObject.knockoutMatches[i]-1];
		let fight2 = tournamentObject.matches[tournamentObject.knockoutMatches[i+1]-1];
		let f1w = bye;
		if(fight1.winner != null && tournamentObject.players[fight1.winner].playing)
			f1w = fight1.winner;
		let f2w = bye;
		if(fight2.winner != null && tournamentObject.players[fight1.winner].playing)
			f2w = fight2.winner;
		pingParty += newGPMatch(tournamentObject, f1w, f2w, 'knockout');
		newMatches.push(tournamentObject.matches.length);
	}
	tournamentObject.knockoutMatches = newMatches;
	version.logMatch(matchDex)
	return pingParty
}
function matchWinPercentage(tournamentObject, player, min) {							//finds a player's match win percentage
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(!min)
		min = 0;
	let thisPlayer = tournamentObject.players[player];
	let byed = getPlayedOpps(tournamentObject, bye, 1, true); //get info on byes
	let wins = 0, matches = 0; //set these as new numbers to avoid references
	wins += thisPlayer.gpWin;
	matches += thisPlayer.gpWin + thisPlayer.gpLoss + thisPlayer.gpDraw;
	if(byed[0].includes(player)) { //add all matches, then subtract a win and match if player has faced a bye
		wins--;
		matches--;
	}
	let p = wins / matches;
	if(isNaN(p))
		p = 0;
	return 100*Math.max(min, p);
}
function gameWinPercentage(tournamentObject, player, min) {								//finds a player's game win percentage
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	if(!min)
		min = 0;
	let thisPlayer = tournamentObject.players[player];
	let byed = getPlayedOpps(tournamentObject, bye, 1, true); //get info on byes
	let wins = 0, games = 0; //set these as new numbers to avoid references
	for(let match in thisPlayer.runs[0].matches) {
		let matchNo = thisPlayer.runs[0].matches[match]
		if(!byed[2].includes(matchNo) && !tournamentObject.matches[matchNo-1].knockout) { //for each match that isn't a bye or knockout round
			let thisMatch = tournamentObject.matches[matchNo-1];
			let res = playerMatchResults(thisMatch, player); //[#wins, #losses, #draws, boolean(win?)]
			wins += parseInt(res[0]);
			games += parseInt(res[0]) + parseInt(res[1]) + parseInt(res[2]);
		}
	}
	let p = wins / games;
	if(isNaN(p))
		p = 0;
	return 100*Math.max(min, p);
}
function oppWinPercentage(tournamentObject, player, percentageFunction) {				//find a player's OMW or OGW
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let opps = getPlayedOpps(tournamentObject, player, 1, true);
	let omws = [];
	for(let opp in opps[0]) {
		let thisOpp = opps[0][opp];
		if(thisOpp != bye)
			omws.push(percentageFunction(tournamentObject, thisOpp, 0.3333).toFixed(2)); //for opponents MW or GW, minimum is 0.33
	}
	let omw = toolbox.avgArray(omws);
	if(omw < 33.33)
		omw = 33.33
	return omw;
}
function omw(tournamentObject, player) {												//quick Opponent Match Win function
	return oppWinPercentage(tournamentObject, player, matchWinPercentage)
}
function ogw(tournamentObject, player) {												//quick Opponent Game Win function
	return oppWinPercentage(tournamentObject, player, gameWinPercentage)
}
function matchPatch(tournamentObject, number, data) {									//command to patch a match report
	if(typeof tournamentObject == "string")
		tournamentObject = matchDex[tournamentObject];
	let p1 = data.match(/p1: ?(\d+)/);
	let p1w = data.match(/p1w: ?(\d+)/);
	let p1r = data.match(/p1r: ?(\d+)/);
	let p2 = data.match(/p2: ?(\d+)/);
	let p2w = data.match(/p2w: ?(\d+)/);
	let p2r = data.match(/p2r: ?(\d+)/);
	if(p1 && p2 && p1w && p2w) {
		if(!p1r && !p2r) {
			return updateGPMatch(tournamentObject, p1[1], p2[1], p1w[1], p2w[1], number);
		}else if(p1r && p2r) {
			return updateMatch(tournamentObject, p1[1], p2[1], p1w[1], p2w[1], number)
		}else{
			return "Incomplete data."
		}
	}
}
function addKeys(){																		//add tourney's key to its data
	for(let m in matchDex) {
		if(m != "version" && !matchDex[m].data.key) {
			matchDex[m].data.key = m;
		}
	}
	version.logMatch(matchDex);
}
function nabListNames() {																//prints league decklists names
	let players = matchDex.league.players;
	for(let thisPlayer in players) {
		for(let thisRun in players[thisPlayer].runs) {
			console.log(players[thisPlayer].runs[thisRun].deckName)
		}
	}
}

//decklists
//Fancy Decklist Engine
function fancification (deckString, user, deckName) {									//fancy engine handler
	giveFancyDeck(deckString, user, deckName, 1, ['msem']);
	user.send("Here is your fancified decklist!", { //sends a user a HTML formatted decklist
		files:[{attachment:"fancyDeck.txt"}]
		});
	if(deckName == undefined)
		user.send("Don't forget to replace DECK NAME AND TITLE HERE with your deck's name.");
}
function giveSealedDeck (count, deckChecking) {											//give sealed deck of given code
	let pool = {};
	for(let i=0; i<count; i++) {
		let pack = draftDexScripts.generatePack(deckChecking[1], arcana.msem, " -is:bonus");
		for(let card in pack) {
			if(pack[card].match(/^★ (Plains|Island|Swamp|Mountain|Forest)( [a-z]|\d+)_/)) {
				//be nice to sealed players and give them a random foil common instead of foil basic. Snow and Dry basics stay though.
				let randtemp = fuzzy.scryDatabase(randBase, 'e:' + deckChecking[1] + ' r=c', {exact:true})[0];
				if(randtemp.length > 0) {
					let num = Math.floor(Math.random()*randtemp.length);
					pack[card] = "★ " + toolbox.shuffleArray(randtemp)[0];
				}
			}
			let trimmedName = unFoil(pack[card]);
			if(!pool.hasOwnProperty(trimmedName))
				pool[trimmedName] = {mainCount:0, foil:0}
			pool[trimmedName].mainCount++;
			if(isFoil(pack[card]))
				pool[trimmedName].foil++;
		}
	}
	let cardList = Object.keys(pool);
	let rarArray = ["basic land", "common", "uncommon", "rare", "bonus", "mythic rare", "masterpiece", "special"]
	cardList.sort(function(a, b){
		let result = rarArray.indexOf(arcana.msem.cards[b].rarity) - rarArray.indexOf(arcana.msem.cards[a].rarity)
		if(result == 0)
			result = pool[b].mainCount - pool[a].mainCount
		return result;
	});
	let list = "```";
	let foils = "";
	for(let card in cardList) {
		list += pool[cardList[card]].mainCount + "  " + arcana.msem.cards[cardList[card]].cardName + "\n"
		if(pool[cardList[card]].foil)
			foils += pool[cardList[card]].foil + " " + arcana.msem.cards[cardList[card]].cardName + "\n";
	}
	list += "```";
	if(foils)
		list += "\nYou opened some foils! They are included in the decklist but listed below so you know your rarity counts are right:\n" + foils;
	return [list, pool];
}
function giveFancyDeck (deckString, user, deckName, save, deckChecking, library) {		//sends user legal errors and writes file
	if(!library)
		library = arcana.msem;
	let fancyDeck = makeFancyDeck(deckString, deckName, "fancy", deckChecking, library, user);
	if(deckChecking && deckChecking[0] == "Team Unified Constructed") {
		let decks = [matchDex.tuc.players[user.id].deckObj];
		for(let player in matchDex.tuc.players[user.id].team) {
			let thisID = matchDex.tuc.players[user.id].team[player];
			if(thisID != user.id) {
				let thatDeck = matchDex.tuc.players[thisID].deckObj;
				if(Object.keys(thatDeck).length)
					decks.push(thatDeck);
			}
		}
		fancyDeck[1] = tucChecker(decks, library, ["MSEM"]);
	}else if(deckChecking && deckChecking[0] == "Gladiator" && deckChecking[1] == "King of the Hill") {
		let decks = [matchDex.gladiator.players[user.id].deckObj];
		for(let d in matchDex.gladiator.players[user.id].decks)
			decks.push(matchDex.gladiator.players[user.id].decks[d]);
		fancyDeck[1] = tucChecker(decks, library, ["Gladiator"]);
	}
	let legalArray = fancyDeck[1];
	fancyDeck = fancyDeck[0];
	fancyDeck = fancyDeck.replace(/’/g, "'");
	var legalString = writeLegal(legalArray, deckChecking);
	if(legalString != "")
		user.send(legalString);
	if(save) {
		fs.writeFile('fancyDeck.txt', fancyDeck, (err) => {
			if (err) throw err;
		});
	}else{
		return [fancyDeck, legalString];
	}
}
function makeFancyDeck (deckString, deckName, toggle, deckChecking, library, user) {	//HTML assembly line
	//var format = "designer";
	deckString = triceListTrimmer(deckString);
	let pullLines = deckString.split("\n"); //split into an array of each line
	let deckFlag = "main";
	var deckObject = {};
	var deckStrings = {main: "", side: "", command: ""};
	for(i = 1; i < pullLines.length; i++) { //move the lines into the appropriate deck
		let thisLine = pullLines[i];
		if(thisLine.match(/^(\/\/)?( ?[0-9]* )?Sideboard/i))
			deckFlag = "side";
		if(thisLine.match(/^Command/i))
			deckFlag = "command";
		if(thisLine.match(/^(SB: )?[0-9]/)) {
			let number_and_name = thisLine.match(/([0-9]+)x?[ ]+([^\n]+)/i);
			let thisName = fuzzy.searchCards(library, promoCheck(number_and_name[2]));
			if(!deckObject[library.cards[thisName].fullName]) {
				deckObject[library.cards[thisName].fullName] = {};
				deckObject[library.cards[thisName].fullName].print = library.cards[thisName].setID;
				deckObject[library.cards[thisName].fullName].decks = {main: 0, side: 0};
				deckObject[library.cards[thisName].fullName].count = 0;
				deckObject[library.cards[thisName].fullName].refName = thisName;
			}
			deckObject[library.cards[thisName].fullName].decks[deckFlag] += parseInt(number_and_name[1]);
			deckObject[library.cards[thisName].fullName].count += parseInt(number_and_name[1]);
			deckStrings[deckFlag] += thisLine + "\n";
		}
	}
	var mainArray = makeCardArray(deckStrings["main"], library);
	var sideArray = "";
	if(deckStrings["side"] !== "")
		sideArray = makeCardArray(deckStrings["side"], library);
	var commandArray = "";
	if(deckStrings["command"] !== "")
		commandArray = makeCardArray(deckStrings["command"], library);
	let mainArraySort = sortMainArray(mainArray);
	
	if(toggle == "fancy")
		fancyOutput = makeFancySetup(mainArraySort, sideArray, commandArray, deckName, library);
	if(toggle == "json")
		fancyOutput = makeJsonSetup(mainArray, sideArray, deckName, commandArray, library);
	let legal = [];
	if(deckChecking[0] == "Team Unified Constructed") {
		matchDex.tuc.players[user.id].deckObj = deckObject;
	}else if(deckChecking[0] == "Gladiator" && deckChecking[1] == "King of the Hill") {
		matchDex.gladiator.players[user.id].deckObj = deckObject;
	}else if(deckChecking) {
		legal = checkLegal(deckObject, deckChecking, library);
	}
	return [fancyOutput, legal];
}
function makeCardArray(cardString, library) {											//turns a decklist into an array of cards and their useful information
	var numbersAndNames = cardString.match(/([0-9]+)x?[ ]+([^\n]+)(\n|$)/ig);
	var leng = numbersAndNames.length;
	var cardArray = {};
	for (var i = 0; i < leng; i++) {
		var numberThenName = numbersAndNames[i].match(/([0-9]+)x?[ ]+([^\n]+)(\n|$)/i);
		let thisName = numberThenName[2];
		thisName = promoCheck(thisName);
		let thisCard = fuzzy.searchCards(library,thisName);
		if(!library.cards[thisCard].setID.match(/^(PLAY|tokens|BOT|MSEMAR)$/)) {
			cardArray[thisCard] = {};
			cardArray[thisCard].name = thisCard;
			cardArray[thisCard].amountPlayed = numberThenName[1];
			cardArray[thisCard].type = library.cards[thisCard].cardType;
			cardArray[thisCard].setID = library.cards[thisCard].setID;
			cardArray[thisCard].cardID = library.cards[thisCard].cardID;
			cardArray[thisCard].cmc = library.cards[thisCard].cmc;
		}
	}
	return cardArray
}
function sortMainArray(cardArray) {														//sorts mainArray by type and converted mana cost
	landArray = {};
	creatureArray = {};
	planeswalkerArray = {};
	instantArray = {};
	sorceryArray = {};
	enchantmentArray = {};
	artifactArray = {};
	conspiracyArray = {};
	for(var j = 0; j < 16; j++) {
		for (let i in cardArray) {
			if(cardArray[i].cmc == j) {
				if (cardArray[i].type.match(/Land/)) {
					cardArray[i].type = "Land";
					landArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Creature/)) {
					cardArray[i].type = "Creature";
					creatureArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Planeswalker/)) {
					cardArray[i].type = "Planeswalker";
					planeswalkerArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Instant/)) {
					cardArray[i].type = "Instant";
					instantArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Sorcery/)) {
					cardArray[i].type = "Sorcery";
					sorceryArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Enchantment/)) {
					cardArray[i].type = "Enchantment";
					enchantmentArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Artifact/)) {
					cardArray[i].type = "Artifact";
					artifactArray[i] = cardArray[i];
				}
				if (cardArray[i].type.match(/Conspiracy/)) {
					cardArray[i].type = "Conspiracy";
					conspiracyArray[i] = cardArray[i];
				}
			}
		}
	}
	var thisArray = {};
	if (creatureArray !== {})
		thisArray.Creature = creatureArray;
	if (planeswalkerArray !== {})
		thisArray.Planeswalker = planeswalkerArray;
	if (instantArray !== {})
		thisArray.Instant = instantArray;
	if (sorceryArray !== {})
		thisArray.Sorcery = sorceryArray;
	if (enchantmentArray !== {})
		thisArray.Enchantment = enchantmentArray;
	if (artifactArray !== {})
		thisArray.Artifact = artifactArray;
	if (conspiracyArray !== {})
		thisArray.Conspiracy = conspiracyArray;
	if (landArray !== {})
		thisArray.Land = landArray;
	return thisArray;
}
function makeFancySetup (mainArray, sideArray, commandArray, deckName, library) {		//sets up the structure of fancy HTML output
	let totalCount = 0;
	let number = 0;
	let toggle = 0;
	if(deckName === undefined)
		deckName = "DECK NAME AND TITLE HERE";
	let i = 1;
	var fancyOutput = "</script>\r\n</head>\r\n<body>\r\n<hr>\r\n<h4>" + deckName + "</h4>\r\n<hr>\r\n<table>\r\n<tr>\r\n	<td>\r\n";
	for (var type in mainArray) {
		for(let thisCard in mainArray[type])
			number++;
		if(number !== 0) {
			number = 0;
			if(type == "Land") {
				fancyOutput += "\r\n	</td>\r\n	<td>\r\n";
				toggle = 1;
			}
			let output = makeFancyBlock (mainArray[type], type, totalCount, library);
			var block = output[0];
			totalCount = output[1];
			fancyOutput += block;
			}		
	}
	if(toggle == 0)
		fancyOutput = fancyOutput + "\r\n	</td>\r\n	<td>\r\n";
	fancyOutput = fancyOutput + "	<br/>\r\n";
	if(sideArray !== "") {
		var side = makeFancyBlock (sideArray, "Sideboard", totalCount, library);
		fancyOutput = fancyOutput + side[0];
		totalCount = side[1];
	}
	if(commandArray !== "") {
		var command = makeFancyBlock (commandArray, "Command", totalCount, library);
		fancyOutput = fancyOutput + command[0];
		totalCount = command[1];
	}
	fancyOutput = fancyOutput + "\r\n	</td>\r\n	<td>\r\n		<img class=\"trans\" id=\"pic\" src=\"https://upload.wikimedia.org/wikipedia/en/a/aa/Magic_the_gathering-card_back.jpg\" alt=\"\" height=\"350\" width=\"250\" />\r\n</td>\r\n</tr>\r\n</body>\r\n</html>";
	let topString = "<html>\r\n<head>\r\n<style>\r\ntable td { \r\n	display: table-cell;\r\n	vertical-align: top;\r\n	float: left;\r\n	width: 140px;\r\n	font-family: \"Garamond\";\r\n	padding: 3px;\r\n}\r\nh4 {\r\n	font-family: \"Arial Black\";\r\n	color: #778899;\r\n}\r\n</style>\r\n<script language=\"JavaScript\">\r\n	function change(elId) {\r\n	  document.getElementById('pic').src = document.getElementById(elId).getAttribute(\"url\");\r\n	}\r\n\r\n	document.addEventListener('DOMContentLoaded', function () {\r\n";
	for(var j = 1; j < totalCount+1; j++) {
		topString += "		document.getElementById('card";
		topString += j;
		topString += "').addEventListener('mouseover', function() {\r\n			change('card";
		topString += j;
		topString += "');\r\n		});\r\n"
	}
	topString += "	});\r\n";
	fancyOutput = topString + fancyOutput;
	return fancyOutput;
}
function makeFancyBlock (cardArray, name, totalCount, library) {						//turns a card array into fancy HTML output
	var fancyBlock = "";
	let typeNumber = 0;
	for (let thisCard in cardArray) {
		let thisOutput = makeFancyString(cardArray[thisCard], totalCount, library);
		var cardString = thisOutput[0];
		totalCount = thisOutput[1];
		fancyBlock += cardString + "\r\n";
		typeNumber += parseInt(cardArray[thisCard].amountPlayed);
	}

	titleLine = "		<div><b><i>" + name + " (" + typeNumber + ")</i></b></div>";
	fancyBlock = titleLine + "\r\n" + fancyBlock;
	fancyBlock += "		<br/>\r\n";
	return [fancyBlock, totalCount];
}
function makeFancyString (card, i, library) {											//turns a single card into its image link
	let cardName = library.cards[card.name].cardName;
	let letter = "";
	if(library.cards[card.name].shape == "split") {
		cardName += " // " + library.cards[card.name].cardName2;
		letter = "b";
	}
	if(library.cards[card.name].shape == "doubleface")
		letter = "a";
	i++;
	var fancyString = "		<div url=\"http://mse-modern.com/msem2/images/" + card.setID + "/" + card.cardID + letter + ".jpg\" id=\"card" + i + "\">" + card.amountPlayed + "x " + cardName + "</div>";
	if(library.cards[card.name].shape == "doubleface") {
		i++;
		fancyString += "\r\n		<div url=\"http://mse-modern.com/msem2/images/" + card.setID + "/" + card.cardID + "b.jpg\" id=\"card" + i + "\">(Transformed)</div>"
	}
	return [fancyString, i];
}
function checkLegal (deckObject, deckChecking, library) {								//checks if deck is legal in given format
	let format = deckChecking[0];
	let secondaryCheck = deckChecking[1];
	let legal = [];
	let warning = [];
	let cardCount = [0,0];
	if(format == "Primordial") {
		let rareCount = [0,0,0]; //CUR
		let refLegal = primordialReferences(library, deckObject, "in:" + secondaryCheck);
		for(let thisCard in deckObject){
			cardCount[0] += deckObject[thisCard].decks.main;
			cardCount[1] += deckObject[thisCard].decks.side;
			let trimname = thisCard.replace(/_[^\n]+/i,"");
			let cardInfo = library.cards[deckObject[thisCard].refName]; //get the given print
			if(secondaryCheck == "TSP" && (cardInfo.prints.includes("TSB") || cardInfo.notes.includes("shifted"))) {
				let firstPrint = cardInfo.prints[0];
				if(cardInfo.setID != firstPrint)
					cardInfo = library.cards[fuzzy.searchCards(library, thisCard + "_" + cardInfo.prints[0])]; //use the original print for rarity counts;
				refLegal.push(thisCard) //and call it legal
			}
			let basicCheck = checkBasic(cardInfo);
			let snowBasic = cardInfo.typeLine.match(/Basic Snow/)
			if(!cardInfo.prints.includes(secondaryCheck) && (!basicCheck || snowBasic) && !refLegal.includes(thisCard))	//make sure its in the right set, basic, or referred
				legal.push(trimname + " is not in set " + secondaryCheck + ".");
			//if we're not on the right print, grab that one for the deck check
			if(!refLegal.includes(thisCard) && (cardInfo.setID != secondaryCheck || cardInfo.rarity == "special")) {
				cardInfo = library.cards[fuzzy.searchCards(library, cardInfo.fullName + "_" + secondaryCheck)];
			}
			if(cardInfo.rarity == "common") {
				rareCount[0] += deckObject[thisCard].decks.main;
				if(!basicCheck && deckObject[thisCard].decks.main > 4)
					legal.push("More than four copies of common " + trimname + " detected.");
			}else if(!basicCheck && cardInfo.rarity == "uncommon") {
				rareCount[1] += deckObject[thisCard].decks.main;
				if(!basicCheck && deckObject[thisCard].decks.main > 2)
					legal.push("More than two copies of uncommon " + trimname + " detected.");
			}else if(!basicCheck){
				rareCount[2] += deckObject[thisCard].decks.main;
				if(!basicCheck && deckObject[thisCard].decks.main > 1)
					legal.push("More than one copy of rare " + trimname + " detected.");
			}
			let allCount = deckObject[thisCard].decks.main + deckObject[thisCard].decks.side;
			if(!basicCheck && allCount > 4 && !(cardInfo.rarity == "common" && deckObject[thisCard].decks.main > 4)) //alert for 4+ copies if we haven't already
				legal.push("More than four copies of " + trimname + " detected.")
			let banned = checkBanned(trimname, "Primordial", library);
			if(library.cards[fuzzy.searchCards(library,thisCard)].typeLine.match("Conspiracy"))
				legal.push(trimname + " is banned in Primordial.");
			if(banned == 2)
				legal.push(trimname + " is masterpiece only and not legal in Primordial.");
		}

		if(rareCount[2] > 2)
			legal.push("Mainboard has more than two rares.");
		if(rareCount[1] > 6)
			legal.push("Mainboard has more than six uncommons.");
		if(rareCount[2] < 2)
			legal.push("Mainboard has fewer than two rares.");
		if(rareCount[1] < 6)
			legal.push("Mainboard has fewer than six uncommons.");

		if(cardCount[0] < 40)
			legal.push("Mainboard has fewer than forty cards.");
		if(cardCount[1] > 8)
			legal.push("Sideboard has more than eight cards.");
		if(cardCount[0] > 40)
			warning.push("Mainboard has more than forty cards.");
		if(cardCount[1] < 8)
			warning.push("Sideboard has fewer than eight cards.");
	}
	else if(format == "MSEM" || format == "Gladiator" || format == "Pauper") {
		let maxCount = [4, "four copies"];
		if(format == "Gladiator")
			maxCount = [1, "one copy"];
		for(let thisCard in deckObject){
			cardCount[0] += deckObject[thisCard].decks.main;
			cardCount[1] += deckObject[thisCard].decks.side;
			let trimname = thisCard.replace(/_[^\n]+/i,"");
			if(deckObject[thisCard].count > maxCount[0] && checkBasic(fuzzy.searchCards(library,thisCard)) == 0)
				legal.push(`More than ${maxCount[1]} of ${trimname} detected.`);
			let banned = checkBanned(trimname, "MSEM", library);
			if(banned == 1 || library.cards[fuzzy.searchCards(library,thisCard)].typeLine.match("Conspiracy"))
				legal.push(trimname + " is banned in MSEModern.");
			if(banned == 2)
				legal.push(trimname + " is masterpiece only and not legal in MSEModern.");
			if(format == "Pauper") {
				if(!library.cards[fuzzy.searchCards(library,thisCard)].rarities.includes("common") && !library.cards[fuzzy.searchCards(library,thisCard)].rarities.includes("basic land"))
					legal.push(trimname + " is not common and not legal in MSEM Pauper.")
			}
		}
		if(cardCount[0] < 60)
			legal.push("Mainboard has fewer than sixty cards.");
		if(cardCount[1] > 15)
			legal.push("Sideboard has more than fifteen cards.");
		if(cardCount[0] > 60)
			warning.push("Mainboard has more than sixty cards.");
		if(cardCount[1] < 15)
			warning.push("Sideboard has fewer than fifteen cards.");
		let otherReqs = deckRequirements(deckObject, library);
		for(let r in otherReqs[0])
			legal.push(otherReqs[0][r])
		for(let r in otherReqs[1])
			warning.push(otherReqs[1][r])
	}
	if(format == "Designer") {
		let testDesigner = "";
		for(let thisCard in deckObject) {
			if(testDesigner == "")
				testDesigner = library.cards[fuzzy.searchCards(library, thisCard)].designer;
			if(!library.cards[fuzzy.searchCards(library, thisCard)].typeLine.match("Basic") && library.cards[fuzzy.searchCards(library, thisCard)].designer != testDesigner) {
				legal.push("Not all cards have the same designer.");
				return legal;
			}
		}
	}
	return [legal, warning];
}

function deckRequirements(deckObj, library) {											//other deck requirements, like companions
	let legal = [], warning = [];
	let cardNames = Object.keys(deckObj);	//array of cardnames
	/*	setup of deckObj entries
		'Card Name': {
			print: 'SET',
			decks: { main: 4, side: 0 },
			count: 4,
			refName: 'Card Name_SET'
		  },
	*/
	//First mates
	let mates = {
		"Alvarez of the Huntsman": alvarezCheck,
		"Garth of the Chimera": garthCheck,
		"Harriet of the Pioneer": harrietCheck,
		"Holcomb of the Peregrine": holcombCheck,
		"Hugo of the Shadowstaff": hugoCheck,
		"Mable of the Sea's Whimsy": mableCheck,
		"Marisa of the Gravehowl": marisaCheck,
		"Searle of the Tempest": searleCheck,
		"Tabia of the Lionheart": tabiaCheck,
		"Valencia of the Concordant": valenciaCheck
	}
	for(let n in mates) { //for each first mate in this decks sideboard
		if(cardNames.includes(n) && deckObj[n].decks.side) {
			let req = mates[n](deckObj, library); //check if the deck fulfillls its condition
			if(req)
				warning.push(req);
		}
	}
	return [legal, warning];
}
function alvarezCheck(deckObj, library) {												//checks if deck fulfills Alvarez of the Huntsman's condition
	let legal = true;
	let lands = 0, cards = 0;
	for(let card in deckObj) {
		cards += deckObj[card].decks.main;
		if(library.cards[deckObj[card].refName].typeLine.match(/Land/))
			lands += deckObj[card].decks.main;
	}
	let check = lands/cards;
	if(check < 0.5)
		legal = false;
	if(!legal)
		return "This deck doesn't fulfill Alvarez of the *Huntsman*'s first mate condition.";
	return "";
}
function garthCheck(deckObj, library) {													//checks if deck fulfills Garth of the Chimera's condition
	let legal = true;
	for(let card in deckObj) {
		if(deckObj[card].decks.main && library.cards[deckObj[card].refName].typeLine.match(/Creature/))
			return "This deck doesn't fulfill Garth of the *Chimera*'s first mate condition.";
	}
	return "";
}
function harrietCheck(deckObj, library) {												//checks if deck fulfills Harriet of the Pioneer's condition
	let legal = true;
	let vehicles = 0;
	for(let card in deckObj) {
		if(deckObj[card].decks.main && library.cards[deckObj[card].refName].typeLine.match(/Vehicle/))
			vehicles += deckObj[card].decks.main;
	}
	legal = vehicles >= 12;
	if(!legal)
		return "This deck doesn't fulfill Harriet of the *Pioneer*'s first mate condition.";
	return "";
}
function holcombCheck(deckObj, library) {												//checks if deck fulfills Holcomb of the Peregrine's condition
	for(let card in deckObj) {
		if(!library.cards[deckObj[card].refName].typeLine.match(/Land/)) {
			if(deckObj[card].decks.main != 0 && deckObj[card].decks.main != 2)
				return "This deck doesn't fulfill Holcomb of the *Peregrine*'s first mate condition.";
		}
	}
	return "";
}
function hugoCheck(deckObj, library) {													//checks if deck fulfills Hugo of the Shadowstaff's condition
	for(let card in deckObj) {
		if(deckObj[card].decks.main) {
			let thisCard = library.cards[deckObj[card].refName];
			let cmc = 0 + thisCard.cmc;
			if(thisCard.shape == "split" || thisCard.shape == "aftermath")
				cmc += thisCard.cmc2;
			if(cmc != 0 && cmc != 1 && cmc != 3)
				return "This deck doesn't fulfill Hugo of the *Shadowstaff*'s first mate condition.";
		}
	}
	return "";
}
function mableCheck(deckObj, library) {													//checks if deck fulfills Mable of the Sea's Whimsy's condition
	let legal = true;
	for(let card in deckObj) {
		if(deckObj[card].decks.main) {
			if(library.cards[deckObj[card].refName].typeLine.match(/Instant|Land/))
				continue; //is an instant or land
			if(!library.cards[deckObj[card].refName].rulesText.match(/Flash/i)) {
				legal = false;
				break;	//definetly doesn't have flash
			}
			if(library.cards[deckObj[card].refName].rulesText.replace(library.cards[deckObj[card].refName].cardName, "~").match(/(^\bFlash\b|Flash\b)(?![^.]*\.)/i));
				continue; //has keyword flash
			legal = false;
			break; //has flash but not inherently
		}
	}
	if(!legal)
		return "This deck doesn't fulfill Mable of the *Sea's Whimsy*'s first mate condition.";
	return "";
}
function marisaCheck(deckObj, library) {												//checks if deck fulfills Marisa of the Gravehowl's condition
	for(let card in deckObj) {
		if(deckObj[card].decks.main) {
			let thisCard = library.cards[deckObj[card].refName];
			if(thisCard.typeLine.match(/Land/))
				continue; //lands
			let oracle = thisCard.rulesText.replace(/\*?\([^)]\)\*?/g, ''); //remove remindertext
			oracle = oracle.replace(thisCard.cardName, "~");				//remove card name
			if(oracle.match(/\b(dies?|died|dying)\b/i))
				continue;
			if(oracle.match(/\bdestroy(s|ed)?\b/i))
				continue;
			if(oracle.match(/\bgraveyards?\b/i))
				continue;
			if(oracle.match(/\bmill(s|ed)?\b/i))
				continue;
			return "This deck doesn't fulfill Marisa of the *Gravehowl*'s first mate condition.";
		}
	}
	return "";
}
function searleCheck(deckObj, library) {												//checks if deck fulfills Searle of the Tempest's condition
	for(let card in deckObj) {
		if(deckObj[card].decks.main) {
			let thisCard = library.cards[deckObj[card].refName];
			if(thisCard.typeLine.match(/Aura|Land/i))
				continue; //Auras inherently target
			let oracle = thisCard.rulesText.replace(/\*?\([^)]\)\*?/g, ''); //remove remindertext
			oracle = oracle.replace(thisCard.cardName, "~");				//remove card name
			let matches = oracle.match(/["“][^”"]*[”"]|(target)/ig);		//gets target, or string of targeting ability
			if(matches && (matches.includes("Target") || matches.includes("target")))	//so if one is just Target, its a match
				continue;
			//otherwise it doesn't target
			return "This deck doesn't fulfill Searle of the *Tempest*'s first mate condition.";
		}
	}
	return "";
}
function tabiaCheck(deckObj, library) {													//checks if deck fulfills Tabia of the Lionheart's condition
	let typeCounts = {
		Artifact: 0,
		Creature: 0,
		Enchantment: 0,
		Instant: 0,
		Planeswalker: 0,
		Sorcery: 0,
		Tribal: 0
	}
	for(let card in deckObj) {
		if(deckObj[card].decks.main) {
			let types = library.cards[deckObj[card].refName].typeLine.split(" ");
			for(let t in types) {
				if(typeCounts.hasOwnProperty(types[t]))
					typeCounts[types[t]] += deckObj[card].decks.main;
			}
		}
	}
	for(let t in typeCounts) {
		if(typeCounts[t] > 8)
			return "This deck doesn't fulfill Tabia of the *Lionheart*'s first mate condition.";
	}
	return "";
}
function valenciaCheck(deckObj, library) {												//checks if deck fulfills Valencia of the Concordant's condition
	let manas = [];
	for(let card in deckObj) {
		let thisCard = library.cards[deckObj[card].refName];
		if(!thisCard.typeLine.match(/Land/) && deckObj[card].decks.main) {
			if(!manas.includes(thisCard.manaCost))
				manas.push(thisCard.manaCost)
			if(manas.length > 4)
				return "This deck doesn't fulfill Valencia of the *Concordant*'s first mate condition.";
		}
	}
	return "";
}

function tucChecker(decks, library, format) {											//deckchecks for Team Unified Constructed
	let cardNames = [];
	let legalMess = checkLegal(decks[0], format, library) //make sure the individual deck is legal
	for(let i=0; i<decks.length; i++) {
		for(let card in decks[i]) {
			let thisCard = library.cards[decks[i][card].refName];
			if(thisCard.typeLine.match(/Basic/)) //basics can be repeated
				continue;
			if(i > 0) { //check for crossovers
				if(cardNames.includes(thisCard.cardName))
					legalMess[0].push(`${thisCard.cardName} is already in a teammate's deck.`)
			}
			cardNames.push(thisCard.cardName);
		}
	}
	return legalMess;
}
function writeLegal(legalArray, deckChecking) {											//writes the deckcheck warnings
	var illegalString = "";
	if(legalArray[0] !== []) {
		for(let thisLegal in legalArray[0]) {
			illegalString += legalArray[0][thisLegal] + "\n";
		}
	}
	if(illegalString == "") {
		illegalString = `This deck is legal in ${deckChecking[0]}!`;
	}else{
		illegalString = `This deck is not legal in ${deckChecking[0]}! Please review this list and make any corrections. If you believe this to be incorrect, contact Cajun.\n${illegalString}`;
	}
	let warnArray = legalArray[1] 
	let warnString = "";
	for(let warn in warnArray)
		warnString += warnArray[warn] + "\n";
	if(warnString != "")
		warnString = "\nSubmission warning, if you weren't expecting the below, check your decklist:\n" + warnString;
	let legalString = illegalString + warnString;
	legalString = legalString.replace("\n\n", "\n");
	return legalString;
}
function checkBasic (thisCard) {														//checks if a card is basic or has a Relentless Rats clause
	let basic = 0;
	if(!thisCard.hasOwnProperty("fullName"))
		thisCard = arcana.msem.cards[thisCard]
	let basicmatch = thisCard.typeLine.match("Basic");
	let ratsmatch = thisCard.rulesText.match(/A deck can have any number of cards named/i);
	if(basicmatch !== null || ratsmatch !== null)
		basic = 1;
	return basic;
}
function checkBanned (thisCard, format, library) {										//checks if a card is banned in a given format
	let banned = 0;
	if(format == "MSEM") {
		if(arcana.msem.legal.modernBan.includes(thisCard))
			banned = 1;
		if(arcana.msem.legal.masterpiece.includes(thisCard))
			banned = 2;
	}
	if(format == "Primordial") {
		if(library.legal.primordial.includes(thisCard))
			banned = 1;
	}
	return banned;
}
function primordialReferences(library, deckObject, addon) {								//creates an array of referenced cards that become legal in Primordial
	let refs = [], cardsToCheck = "";
	if(!addon)
		addon = "";
	let referrals = fuzzy.scryDatabase(library, "o:/(card|creature|spell|land|permanent|artifact|enchantment|planeswalker)s? named/ "+addon, {exact:false})[0];
	if(referrals.length) {
		for(let aCard in deckObject)
			cardsToCheck += aCard + "|";
		cardsToCheck = "(" + cardsToCheck.replace(/\|$/, ")");
	}
	for(let refCard in referrals) {
		let name = library.cards[referrals[refCard]].fullName;
		if(deckObject.hasOwnProperty(name)) { //this allows cards from other sets to be legal
			let doubleReg = new RegExp(`(?:card|creature|spell|land|permanent|artifact|enchantment|planeswalker)s? named ${cardsToCheck}( and\/or | and | or )${cardsToCheck}`)
			let doubleMatch = library.cards[referrals[refCard]].rulesText.match(doubleReg);
			if(doubleMatch){
				refs.push(doubleMatch[1]);
				refs.push(doubleMatch[3]);
			}else{
				let singleReg = new RegExp(`(?:card|creature|spell|land|permanent|artifact|enchantment|planeswalker)s? named ${cardsToCheck}`)
				let singleMatch = library.cards[referrals[refCard]].rulesText.match(singleReg);
				if(singleMatch)
					refs.push(singleMatch[1]);
			}
		}
	}
	return refs;
}
function triceListTrimmer(list) {														//preformats cocktrice decklists
	list = list.replace(/^\n+/, ""); //remove leading linebreaks
	list = list.replace(/(_[A-Z0-9_]+)? ?\/\/ ?/g, "//"); //format split cards
	//GHQ land fix
	list = list.replace(/Mountain_GHQ/gi, "Mountain a_GHQ")
	list = list.replace(/Forest_GHQ/gi, "Forest a_GHQ")
	if(list.match(/SB: /)){ //annotated
		list = list.replace(/\/\/ \d+ [^\n]+\n/g, "");
		list = list.replace(/^\n+/, ""); //remove leading linebreaks again
		list = list.replace(/\n\n/g, "\n");
		list = list.replace(/SB: /, "Sideboard:\n"); //expand first SB
		list = list.replace(/SB: /g, ""); //remove the rest
	}else if(list.match(/\n\n/) && !list.match(/Sideboard/)) { //unannotated
		list = list.replace(/\n\n/, "\nSideboard:\n");
	}else{ //probably lackey
		//do nothing
	}
	return list;
}
function extractPlain (cardString) {													//converts HTML deck back to plain text
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
function makeJsonSetup (mainArray, sideArray, deckInfo, library) {						//writes the json decklists for the stats function
	var jsonOutput = '{\r\n	"mainboard": {\r\n'
	for(let thisCard in mainArray) {
		jsonOutput += '		"' + library.cards[thisCard].fullName + '": {"count": ' + mainArray[thisCard].amountPlayed + '},\r\n'
	}
	jsonOutput += '	},\r\n	"sideboard": {\r\n'
	for(let thisCard in sideArray) {
		jsonOutput += '		"' + library.cards[thisCard].fullName + '": {"count": ' + sideArray[thisCard].amountPlayed + '},\r\n'
	}
	jsonOutput += '	},\r\n	"wins": ' + deckInfo[2] + ',\r\n';
	jsonOutput += '	"losses": ' + deckInfo[3] + '\r\n}';
	jsonOutput = jsonOutput.replace(/},\r\n	},\r\n	"/g,'}\r\n	},\r\n	"');
	return jsonOutput;
}
//Lackey dek Writers
function dekBuilder (cardString, thisSet, user) {										//generates a Lackey .dek file
	let poolText = "<deck version=\"0.8\">\r\n";
	poolText += "	<meta>\r\n";
	poolText += "		<game>msemagic</game>\r\n";
	poolText += "	</meta>\r\n";
	cardString = cardString.replace(/\$convert[^\n]*/, "Deck:");
	let blockArray = cardString.match(/([A-Z]+):[ ]*\n(([0-9]+)x?[ ]+([^\n]+)(\n|$))+/ig);
	if(!blockArray) {
		eris.pullPing(user).send("There was an error with this decklist. If you were trying to convert a Cockatrice list, be sure to use unannoted form or remove the linebreaks.");
		return;
	}
	leng = blockArray.length;
	for(i=0; i<leng; i++) {
		thisBlock = blockArray[i];
		blockName = thisBlock.match(/([A-Z]+):[ ]*/i);
		thisBlock = thisBlock.replace(blockName, "");
		blockName = blockName[1];
		poolText += "	<superzone name=\"" + blockName +"\">\r\n";
		poolText += dekBlockWriter(thisBlock, thisSet);
		poolText += "	</superzone>\r\n";
	}
	poolText += "</deck>";
	fs.writeFile("convertedDeck.dek", poolText, (err) => {
		if (err) throw err;
		});
	setTimeout(function(){
		eris.pullPing(user).send("Here is your converted .dek file, rename it as you like and move it to LackeyCCG/plugins/msemagic/decks/", {
				files:[{attachment:"convertedDeck.dek"}]
			});
	}, 3000);		
}
function dekBlockWriter(thisBlock, thisSet) {											//writes card data
	let temptext = "";
	var theseCards = thisBlock.match(/([0-9]+)x?[ ]+([^\n]+)(\n|$)/ig);
	var leng = theseCards.length;
	for (var i=0; i < leng; i++) {
		var thisEntry = theseCards[i].match(/([0-9]+)x?[ ]+([^\n]+)(\n|$)/i);
		let numPlayed = thisEntry[1];
		let thisCard = thisEntry[2];
		for(var j=0; j < numPlayed; j++) {
			if(thisSet !== undefined) { //For non MSEM draftpools
				temptext += dekLineWriter(1, thisCard, thisSet);
			}else{ //For MSEM decks
				let fullCard = arcana.msem.cards[fuzzy.searchCards(arcana.msem,promoCheck(thisCard))];
				let lackeyName = fullCard.cardName;
				if(fullCard.shape == "split")
					lackeyName += " // " + fullCard.name2;
				if(fullCard.setID.match(/(MPS|L2|L3)/) || fullCard.rarity == "special")
					lackeyName += ".";
				if(fullCard.hasOwnProperty("hidden"))
					lackeyName == fullCard.hidden;
				temptext += dekLineWriter(fullCard.cardID,lackeyName,fullCard.setID);
			}
		}
	}
	return temptext;
}
function dekLineWriter(thisNo,thisName,thisSet) {										//writes lackey readable card data
	let temptext = "		<card><name id=\"" + thisNo;
	temptext += "\">" + thisName.replace(/('|’)/g, "&apos;") + "</name><set>" + thisSet + "</set></card>\r\n";
	return temptext;
}
function promoCheck (thisName) {														//attempts to convert to promo frames
	let tempName = thisName.replace(".","");
	if(thisName != tempName){
		thisName = thisName.replace(".","_PRO");
		if(arcana.msem.cards.hasOwnProperty(tempName + "_L2"))
			thisName = tempName + "_L2";
		if(arcana.msem.cards.hasOwnProperty(tempName + "_MPS_MSE"))
			thisName = tempName + "_MPS_MSE";
		if(arcana.msem.cards.hasOwnProperty(tempName + "_MPS_HI12"))
			thisName = tempName + "_MPS_HI12";
		if(arcana.msem.cards.hasOwnProperty(tempName + "_MPS_MIS"))
			thisName = tempName + "_MPS_MIS";
		if(arcana.msem.cards.hasOwnProperty(tempName + "_MPS_OPO"))
			thisName = tempName + "_MPS_OPO";
	}
	return thisName;
}


exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
/*exports.matchDex = matchDex;
exports.tournamentNames = tournamentNames;
exports.tournamentReges = tournamentReges;
exports.organizers = organizers;
exports.tournamentChannels = tournamentChannels;

exports.warnHandler = warnHandler;
exports.writeCurrentWarns = writeCurrentWarns;
exports.archiveToTourney = archiveToTourney;

exports.generateBracketSeeds = generateBracketSeeds;
exports.resetTourney = resetTourney;
exports.deleteTourney = deleteTourney;
exports.rolloverTourney = rolloverTourney;
exports.archivePlayer = archivePlayer;
exports.addLackeyBot = addLackeyBot;
exports.tempAddTUCTeams = tempAddTUCTeams;
exports.addNewPlayer = addNewPlayer;
exports.getPlayedOpps = getPlayedOpps;
exports.getRecord = getRecord;
exports.bestRecord = bestRecord;
exports.renderRecord = renderRecord;
exports.playerMatchResults = playerMatchResults;
exports.renderSelfRecord = renderSelfRecord;
exports.listRecord = listRecord;

exports.renderLeaderBoard = renderLeaderBoard;
exports.nullMatch = nullMatch;
exports.addNewRun = addNewRun;
exports.removeEmptyRun = removeEmptyRun;
exports.updateMatch = updateMatch;
exports.auditMatches = auditMatches;
exports.leagueCrown = leagueCrown;
exports.invalidMatch = invalidMatch;
exports.buildLeagueInfoRecord = buildLeagueInfoRecord;
exports.reportRecord = reportRecord;
exports.vsSeeker = vsSeeker;
exports.getCurrentPlayers = getCurrentPlayers;
exports.changeDeckName = changeDeckName;
exports.fourWinPoster = fourWinPoster;

exports.renderGPLeaderBoard = renderGPLeaderBoard;
exports.dropTourneyPlayer = dropTourneyPlayer;
exports.writePlayerIndexes = writePlayerIndexes;
exports.newGPMatch = newGPMatch;
exports.startTourney = startTourney;
exports.pushTourney = pushTourney;
exports.postTourney = postTourney;
exports.pingTourney = pingTourney;
exports.updateGPMatch = updateGPMatch;
exports.removeAwaits = removeAwaits;
exports.gpLeaderBoard = gpLeaderBoard;
exports.auditGPMatches = auditGPMatches;
exports.swissCount = swissCount;
exports.swissCut = swissCut;
exports.swissPair = swissPair;
exports.swissEngine = swissEngine;
exports.beginKnockoutRounds = beginKnockoutRounds;
exports.arrayDuplicates = arrayDuplicates;
exports.buchholz = buchholz;
exports.tiedBreaker = tiedBreaker;
exports.matchDiff = matchDiff;
exports.sortWithBreakers = sortWithBreakers;
exports.applyBreakers = applyBreakers;
exports.knockoutRound = knockoutRound;
exports.matchWinPercentage = matchWinPercentage;
exports.gameWinPercentage = gameWinPercentage;
exports.oppWinPercentage = oppWinPercentage;
exports.omw = omw;
exports.ogw = ogw;
exports.matchPatch = matchPatch;
exports.addKeys = addKeys;*/

exports.organizerArray = function() {
	return organizers;
}
exports.addOrg = function(id) {
	organizers.push(id);
}
exports.isOrg = function(id) {
	return organizers.includes(id);
}
exports.sayOrg = function(){
	console.log(organizers);
}
exports.tournamentNames = tournamentNames;
exports.tournamentReges = tournamentReges;
exports.organizers = organizers;
exports.tournamentChannels = tournamentChannels;
exports.warnHandler = warnHandler;
exports.writeCurrentWarns = writeCurrentWarns;
exports.archiveToTourney = archiveToTourney;
exports.generateBracketSeeds = generateBracketSeeds;
exports.resetTourney = resetTourney;
exports.deleteTourney = deleteTourney;
exports.rolloverTourney = rolloverTourney;
exports.archivePlayer = archivePlayer;
exports.addLackeyBot = addLackeyBot;
exports.tempAddTUCTeams = tempAddTUCTeams;
exports.addNewPlayer = addNewPlayer;
exports.getPlayedOpps = getPlayedOpps;
exports.getRecord = getRecord;
exports.bestRecord = bestRecord;
exports.renderRecord = renderRecord;
exports.playerMatchResults = playerMatchResults;
exports.renderSelfRecord = renderSelfRecord;
exports.listRecord = listRecord;
exports.renderLeaderBoard = renderLeaderBoard;
exports.nullMatch = nullMatch;
exports.addNewRun = addNewRun;
exports.removeEmptyRun = removeEmptyRun;
exports.updateMatch = updateMatch;
exports.auditMatches = auditMatches;
exports.leagueCrown = leagueCrown;
exports.invalidMatch = invalidMatch;
exports.buildLeagueInfoRecord = buildLeagueInfoRecord;
exports.reportRecord = reportRecord;
exports.vsSeeker = vsSeeker;
exports.getCurrentPlayers = getCurrentPlayers;
exports.changeDeckName = changeDeckName;
exports.fourWinPoster = fourWinPoster;
exports.renderGPLeaderBoard = renderGPLeaderBoard;
exports.dropTourneyPlayer = dropTourneyPlayer;
exports.writePlayerIndexes = writePlayerIndexes;
exports.newGPMatch = newGPMatch;
exports.startTourney = startTourney;
exports.pushTourney = pushTourney;
exports.postTourney = postTourney;
exports.pingTourney = pingTourney;
exports.updateGPMatch = updateGPMatch;
exports.removeAwaits = removeAwaits;
exports.gpLeaderBoard2 = gpLeaderBoard2;
exports.auditGPMatches = auditGPMatches;
exports.swissCount = swissCount;
exports.swissCut = swissCut;
exports.swissPair = swissPair;
exports.swissEngine = swissEngine;
exports.beginKnockoutRounds = beginKnockoutRounds;
exports.arrayDuplicates = arrayDuplicates;
exports.buchholz = buchholz;
exports.tiedBreaker = tiedBreaker;
exports.matchDiff = matchDiff;
exports.sortWithBreakers = sortWithBreakers;
exports.applyBreakers = applyBreakers;
exports.knockoutRound = knockoutRound;
exports.matchWinPercentage = matchWinPercentage;
exports.gameWinPercentage = gameWinPercentage;
exports.oppWinPercentage = oppWinPercentage;
exports.omw = omw;
exports.ogw = ogw;
exports.matchPatch = matchPatch;
exports.addKeys = addKeys;
exports.dl = dl;

