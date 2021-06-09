/* LackeyBot
 Card Fetching
*/
//Live and Test Bot login
var config = require('./config/lackeyconfig.js').config;
var login = config.live;
var botname = "LackeyBot";
var offline = false, queueing = false;
//if run as 'node lackeybot test', login as TestBot
if(process.argv[2] != undefined && process.argv[2].match(/test/i)) {
	login = config.test;
	botname = "TestBot";
}
if(process.argv[2] != undefined && process.argv[2].match(/offline/i)) {
	offline = true;
}
config.login = login;
config.offline = offline;
//load modules
var eris = require('./eris.js');
var Discord = require('discord.js');
var Client = eris.Client();
var arcana = require('./arcana.js');				//handles all the card databases
arcana.buildReference(arcana);							//build reference data
const fuzzy = require('./fuzzy.js');				//handles the general search engine
var dbx = require('./boxofmud.js');					//handles dropbox
var draftBots = require('./draftBots');				//handles draftBots
var dysnomia = require('./dysnomia.js');			//handle discordian commands
var extras = require("./msem/extras.json");
var games = require('./games.js');					//handles games
var help = require('./help.js');					//handles help messages
var imgManip = require('./imgManip.js');			//handles image editing
const mod_magic = require('./magic.js');			//handles Magic-specific coding
let psScrape = require('./psScrape.js');			//handles PS fetching
var statDexHandler = require('./statDex.js');		//handles the statDex analysis
const toolbox = require('./toolbox.js');			//personal toolbox scripts
var quoteDexScripts = require('./quotedex.js');		//testing scripts for $q command
var version = require('./version.js');				//handles version control

var devDexScripts = require('./devDex.js');			//handles devDex
var devDex = {};										//devDex object
var draftDexScripts = require('./draftDexScripts')	//handles draftDex
var draftDex = {};										//draftDex object
var gpDex = require('./gpDex.js');					//handles GP data
var gpbase = {};										//gpbase object
var matchDexScripts = require('./matchDex.js');		//handles matchDex scripts
var remindScripts = require('./remindScripts.js');	//handles the reminders
var reminderDex = {};									//reminder object
var roleDexScripts = require('./roleDexScripts.js');//handles roles
var roleDex = {};										//roles object
var roleRegex = roleDexScripts.roleRegex;				//regex for $role commands //todo think this needs to move
var scratchScripts = require('./scratchPad.js')		//handles scratchpad
var stats = require('./stats.js');				//handles the LackeyBot stats
var switcherooCache = {}, imgCache = {lastString: []};
for(let l in arcana.libraries) {
	imgCache[arcana.libraries[l]] = {};
}
var admin = config.dev;
var convars = config.variables;
var { //emote buffet
	yeet, boop, leftArrow, rightArrow, azArray, azEmoteArray,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote, xString,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');

setInterval(() => { //this will try to log the stats every 10 minutes
  try{
	  version.logStats(stats.stats());
	  if(!offline && botname != "TestBot")
		dysnomia.channelReminders();
  }catch(e){console.log(e);}
}, 600000);
setInterval(() => { //this will reset the self-destruct switch and current game every hour
	if(convars.disarm != "verydisarmed")
		convars.disarm = null;
	if(convars.playtime == 0){
		let mun = Math.floor(Math.random()*extras.games.length);
		let newGame = extras.games[mun];
		Client.user.setPresence( { activity: {name: newGame}});
	}
  if(convars.playtime == 1)
	  convars.playtime = 0;
  fuzzy.clearEmbedCache(); //clear out old scry caches;
}, 3600000);
setInterval(() => { //this will check the reminderBase every minute
	if(botname != "TestBot" && !offline) {
		remindScripts.checkReminders();
		if(version.logLater['draft']) {
			version.logDraft(draftDexScripts.sendDex());
			version.logLater['draft'] = false;
		}
	}
		if(version.logLater['match']) {
			version.logMatch(matchDexScripts.sendMatch());
			version.logLater['match'] = false;
		}
}, 60000);
/*setInterval(() => { //cull empty temp channels every ten minutes
	let sp = scratchScripts.sendPad();
	console.log(sp.tempVoice);
	for(let c in sp.tempVoice) {
		let thisChan = Client.channels.cache.get(sp.tempVoice[c]);
		console.log(thisChan);
		if(thisChan.members == 0) {
			thisChan.delete();
			sp.tempVoice.splice(c, 1)
		}
	}
}, 600000);*/
//Search Engine
function searchCards(library,searchstring,msg) {			//main search function	
	if(msg && library == arcana.devDex) {
		let needleScript = function(card){
			let score = (msg.author.id == arcana.devDex.setData[card.setID].leadID) ? 2 : 0;
			if(msg.channel.id == arcana.devDex.setData[card.setID].channel)
				score = 3;
			return score;
		}
		return fuzzy.searchCards(library, searchstring, needleScript)
	}
	return fuzzy.searchCards(library, searchstring)
}
function extractFetches(fetchMatches, library, msg) {		//grabs the card names for a fetch message
	let outputArray = [];
	let stringMatchesArray = [];
	for(let matchArray in fetchMatches) {
		let searchstring = fetchMatches[matchArray][1];
		if(searchstring != undefined){
			if(library.name == 'ps') {
				outputArray.push(searchstring);
				stringMatchesArray.push(searchstring);
			}else{
				let card_name = searchCards(library, searchstring, msg);
				if(!outputArray.includes(card_name)){
					outputArray.push(card_name)
					stringMatchesArray.push(searchstring)
				}
			}
		}
	}
	return [outputArray, stringMatchesArray];
}
//Format Cards
function priceCheck(outputArray,library,msg) { 				//checks each card is unique and sends it to the proper bribe function
	let output = [];
	for(let card in outputArray)
		output.push(library.formatBribes(outputArray[card],msg));
	return output;
}
function switchReacts(msg, emoteOrder, pages) { 			//callback that adds the switcheroo reacts
	let arrows = function() {
		if(pages>1) {
			msg.react(leftArrow)
				.then(msg.react(rightArrow))
		}
	}
	msg.react(xEmote)
		.then(() => msg.react(mag)
			.then(() => msg.react(ruler)
				.then(() => msg.react(emoteOrder[0])
					.then(() => msg.react(emoteOrder[1])
						.then(() => msg.react(emoteOrder[2])
							.then(() => arrows())
						)
					)
				)
			)
		)
		.catch(e => console.log(e))
}
function cacheImages(channel, card_array, destination) { 	//saves lastCards for $img and $rul
	if(!imgCache.hasOwnProperty(channel)) {
		imgCache[channel] = {lastString: []};
		for(let l in arcana.libraries)
			imgCache[channel][arcana.libraries[l]] = [];
	}
	imgCache[destination] = card_array;
	imgCache[channel][destination] = card_array;
}
function cacheStrings(channel, string_array, destination) { //saves searchstrings for $canon, and $fake
	if(!imgCache.hasOwnProperty(channel)) {
		imgCache[channel] = {lastString: []};
		for(let l in arcana.libraries)
			imgCache[channel][arcana.libraries[l]] = [];
	}
	imgCache[channel].lastString = string_array;
	imgCache.lastString = string_array;
}
function cachePost(msg, string) { 							//saves some data for switcheroo embeds
	if(!switcherooCache.hasOwnProperty(msg.channel.id))			//if we don't have this channel
		switcherooCache[msg.channel.id] = {order:[]};			//create it
	if(!switcherooCache[msg.channel.id].hasOwnProperty(msg.id)){//if we don't have this message
		switcherooCache[msg.channel.id][msg.id] = string;		//create it
		switcherooCache[msg.channel.id].order.push(msg.id)		//add it to the end of the order 
	}
	let ordered = switcherooCache[msg.channel.id].order;
	let thisCache = switcherooCache[msg.channel.id]
	if(ordered.length > 5) {									//if there's more than 5 cached
		delete thisCache[ordered[0]];							//delete the oldest
		switcherooCache[msg.channel.id].order = toolbox.spliceArray({array:ordered, index:0, replace:1})
	}
}
function printImages(card_array, library, first) { 			//generates link from proper site
	if(card_array == [])
		return;
	let printString = "";
	for(let thisCard in card_array) {
		printString += library.printImage(card_array[thisCard], first) + "\n";
	}
	return printString.replace(/\n$/,"");
}
function buildPSEmbed(nameArray, page, searchString, closestCanon, textFlag, imgFlag) { 					//builds the PS embed
	let thisCard = psScrape.psCache[nameArray[page]];
	if(thisCard.url.match(" ")) {
		thisCard.url = thisCard.url.replace(/\//g, "SLASH");
		thisCard.url = encodeURIComponent(thisCard.url);
		thisCard.url = thisCard.url.replace(/SLASH/g, "/");
	}
	let cardURL = `http://www.planesculptors.net${thisCard.url}`
	let pages = nameArray.length;
	let embedText = mod_magic.writeCard(nameArray[page], psScrape.psCache, null, false, "")
	let footerText = "Card " + parseInt(page+1) + "/" + pages + ". All hits: " + nameArray[0]
	if(pages > 1)
		footerText += ", " + nameArray[1]
	if(pages > 2)
		footerText += ", " + nameArray[2];
	if(textFlag) {
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("Planesculptors search results for: " + searchString)
			.setFooter(footerText)
		return [[embedText, nullEmbed], pages];
	}
	footerText += `\nReact ${old_mag} for image, ${old_excEmote} to search canon instead, ${old_xEmote} to delete, ${old_plainText} for plaintext.`
	if(!closestCanon)
		closestCanon = searchCards(arcana.magic, searchString);
	if(closestCanon != mod_magic.writeCardError)
		footerText += `\nLooking for ${closestCanon}? React with ${old_excEmote} to switch.`;
	var exampleEmbed = new Discord.MessageEmbed()
		.setColor('#00ff00')
		.setTitle("Planesculptors search results for: " + searchString)
		.setFooter(footerText)
	if(imgFlag) {
		exampleEmbed.setImage(cardURL)
	}else{
		exampleEmbed.setDescription(embedText)
		exampleEmbed.setThumbnail(cardURL.replace(/http:\/\/www\.planesculptors.nethttp/, "http"))
	}
	return [exampleEmbed, pages];
}
async function sendPSEmbed (outputArray, msg, arcanaData, stringMatchesArray, emoteOrder, name, matches) {	//async acquires data from PS to build its embed
	let nameArray = [];
	let nameString = "";
	let bounced = false;
	searchSearch: for(let search in outputArray) {
		let thisString = outputArray[search];
		nameString = thisString.replace(/_[^\|]*/, "").replace(/\|[^\n]*/, "")
		let setString = thisString.match(/_([^\|]*)/);
		let scryString = thisString.match(/\|([^\n]*)/);
		let contextString = "";
		if(setString && setString[1])
			contextString = setString[1];
		if(scryString && scryString[1]) {
			let setPull = scryString[1].match(/e:("[^"]+"|\/[^\/]+\/|[^ ]+)/i)
			if(setPull)
				contextString = setPull[1].replace(/["\/]/g, "").replace(/^e:/g, "");
		}
		let apiLink = `http://www.planesculptors.net/autocard?context=${contextString}&card=${nameString}&json`;
		nameArray = await psScrape.translatePS(apiLink);
		if(nameArray.length) {
			if(scryString && scryString[1]) {
				let scryFilter = fuzzy.stitchScryCode(scryString[1], {name:"ps"});
				let newNameArray = [];
				for(let name in nameArray) {
					if(scryFilter(psScrape.psCache[nameArray[name]]))
						newNameArray.push(nameArray[name])
				}
				if(newNameArray.length) {
					nameArray = newNameArray;
				}else{
					bounced = true;
					continue searchSearch;
				}
			}
			break;
		}
	}
	if(!nameArray.length) {
		let errM = "Error in Planesculptor search."
		if(bounced)
			errM += " Try searching with less strict filters.";
		errM += "\nDid you mean to search canon cards?:";
		msg.channel.send(errM)
		//send through canon because everyone thinks we're scryfallbot
		let library = arcana.magic;
		let extract = extractFetches(matches, library, msg); 							//convert [[strings]] into card names
		let outputArray = extract[0];
		let output = priceCheck(outputArray, library, msg)								//format the cards
		if(output != "") {																//post the message if not empty
			let embedded = buildCardFetchEmbed(output, arcanaData, "angle", stringMatchesArray, msg.content, 0);//pagify it
			let callback = function(mess) {
				switchReacts(mess, emoteOrder, embedded[2]);							//add switch reacts
				cachePost(mess, embedded[1]);											//save search for switcheroos
			}
			msg.channel.send(embedded[0])												//send it off
				.then(mess => callback(mess))
				.catch(e => console.log(e))
			cacheImages(msg.channel.id, outputArray, library.name)						//and save the names for card commands
		}
		
		return;
	}
	let embedInfo = buildPSEmbed(nameArray, 0, nameString, false, false, false);
	let messyCallback = function (mess) {
		if(embedInfo[1] != 0) {
			mess.react(leftArrow)
				.then(() => mess.react(rightArrow))
				.then(() => mess.react(mag))
				.then(() => mess.react(excEmote))
				.then(() => mess.react(xEmote))
				.then(() => mess.react(plainText))
		}
	}
	msg.channel.send(embedInfo[0])
		.then(mess => messyCallback(mess))
		.catch(console.log("An emote didn't spawn"))
}
function buildCardFetchEmbed(outputArray, arcanaData, mainArcanaName, strings, msg, page) {					//writes fetched cards and switcheroo embed
	let wraps = [];
	let base2 = [];
	let base3 = [];
	switch(mainArcanaName) {
		case "square":
			wraps = ["[[","]]"];
			base2 = arcanaData["angle"];
			base3 = arcanaData["curly"];
			break;
		case "angle":
			wraps = ["<<",">>"];
			base2 = arcanaData["square"];
			base3 = arcanaData["curly"];
			break;
		case "curly":
			wraps = ["{{","}}"];
			base2 = arcanaData["square"];
			base3 = arcanaData["angle"];
			break;
	}
	let searchStrings = "";
	for(let string in strings) {
		searchStrings += `${wraps[0]}${strings[string]}${wraps[1]}`
	}
	if(msg.match(new RegExp(`${arcanaData[mainArcanaName].prefix}ima?g`,'i')))
		searchStrings += `${arcanaData[mainArcanaName].prefix.replace(/\\+/,"")}img`;
	if(msg.match(new RegExp(`${arcanaData[mainArcanaName].prefix}rul`,'i')))
		searchStrings += `${arcanaData[mainArcanaName].prefix.replace(/\\+/,"")}rul`;
	let altMatch = msg.match(arcana.refSheet.anySwapRegex);
	if(altMatch)
		searchStrings += "$" + altMatch[1];
	let content = "";
	let charCount = 0;
	let textPages = [];
	//quickly calc the length;
	for(let bit in outputArray)
		content += outputArray[bit] + "\n";
	if(content.length > 2000) {
		let textSplits = [];
		for(let cardLine in outputArray) {
			let cardRuleSplits = outputArray[cardLine].split('\n\n•');
			if(!cardRuleSplits[0].match(/^Rulings for/))
				textSplits.push(cardRuleSplits[0] + "\n");
			if(cardRuleSplits[1] || cardRuleSplits[0].match(/^Rulings for/)) {
				let ruleLineSplits = cardRuleSplits[cardRuleSplits.length-1].split('•');
				for(split in ruleLineSplits) {
					let rul = '•' + ruleLineSplits[split] + '\n';
					textSplits.push(rul.replace('\n\n', '\n'))
				}
			}
		}
		let mainText = "";
		for(let split in textSplits) {
			if(mainText.length + textSplits[split].length > 1996) {
				textPages.push(mainText);
				mainText = "";
			}
			mainText += textSplits[split];
		}
		textPages.push(mainText);
		content = textPages[page%textPages.length];
	}
	
	let footerText = "";
	searchStrings = arcanaData[mainArcanaName].data.bigname + " search for " + searchStrings;
	footerText += searchStrings;
	if(textPages.length > 1)
		searchStrings += ", Page " + parseInt(page+1) + "/" + textPages.length;
	let embedded = new Discord.MessageEmbed()
		.setFooter(footerText)
	return [content, searchStrings, textPages.length]
}
//Bot Management
function sigtermOperations(msg) {
	if(!offline) { //possible to get sigterm'd multiple times, only fire it the first
		offline = true;	//stop responding to commands
		queueing = true; //TODO queue up discord commands, we might be able to answer them after reset. need to refactor some to do that.
		version.logStats(stats.stats());
		if(version.logLater["reminder"])
			version.logReminders();
		if(version.logLater["match"])
			version.logMatch();
		if(version.logLater["draft"])
			version.logDraft();
		setInterval(function(){ //while working on async operations, add them to the writing array. async operations won't fire while queueing.
			if(!version.writingArray().length) {	//recheck once a second, and close the process once we're done.
				if(msg) {
					msg.channel.send("Files recorded.")
						.then(m => process.exit(0))
						.catch(e => console.log(e))
				}else{
					process.exit(0);
				}
			}
		}, 2000)
	}
}
function checkRank(msg) {									//checks the rank of a poster
	//0 - Bot admin permissions
	//1 - TO permssions
	//2 - [free] old draft permissions
	//3 - Server admin permissions
	//4 - Server moderator permissions
	//5 - statDex advanced permissions
	//6 - [free]
	//7 - General permissions
	//8 - [unused] Restricted permissions
	//9 - Banned
	let user = msg.author.id;
	let rank = [7]; //general
	if(config.admin.hasOwnProperty(user)) { //admin permissions
		for(let perm in config.admin[user])
			rank.push(config.admin[user][perm]); //0 for admin, 1 for T0, 2 for draft mod, 5 for statDex permissions
	}
	if(matchDexScripts.isOrg(user))
			rank.push(1); //TO permissions
	if(msg.channel.type == "dm") // pms are always open and have no moderators
		return rank;
	let guildID = msg.guild.id;
	if(msg.member && msg.member.permissions.has("ADMINISTRATOR")){ //server admin
		rank.push(3); //3 for server admin, 4 for server mod
		rank.push(4); 
	}
	if(roleDex.guilds && roleDexScripts.liveGuild(guildID)) {
		if(!rank.includes(0) && !rank.includes(3) && roleDex.guilds && roleDex.guilds[guildID].banned.includes(user)) { //admins can't be banned
			rank.push(9); //9 for banned
		}
		let modRole = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name === roleDex.guilds[guildID].modRole)
		if(modRole && msg.member.roles.cache.find(val => val.id == modRole.id))
			rank.push(4);
	}
	return rank; 
}
async function startUpFunctions() {							//all the start up functions for nicer async
	let mun = Math.floor(Math.random()*extras.games.length); //sets a random game
	let newGame = extras.games[mun];
	Client.user.setPresence( { activity: {name: newGame}});
	var vs = await version.loadEmUp();
	stats.dl();
	remindScripts.dl();
	matchDexScripts.dl();
	roleDexScripts.dl();
	draftDexScripts.dl();
	gpDex.dl();
	devDexScripts.dl();
	scratchScripts.dl();
	try{
		Client.channels.cache.get(config.signinChannel).send(botname+" has connected.");
	}catch(e){
		console.log("HQ server disconnected. " + botname + " has connected.");
	}
}
var date = new Date();
console.log(`${date.getDate()}/${(date.getMonth()<10)? "0"+date.getMonth() : date.getMonth()} ${(date.getHours()<10) ? "0"+date.getHours() : date.getHours()}:${(date.getMinutes()<10)? "0"+date.getMinutes() : date.getMinutes()} Loading database.`);

Client.on("message", (msg) => {								//this is what runs every time LackeyBot reads a Discord message
	let realContent = "" + msg.content;						//split to not be a reference, remove codeblocks when checking commands
	msg.content = msg.content.replace(/```[\s\S]+```/g, "").replace(/`[\s\S]+`/g, "").replace(/@everyone/, "");
	let arcanaData = arcana.configureArcana(msg);
	let admincheck = checkRank(msg);
	if(msg.author.bot || admincheck.includes(9))
		return; //don't respond to bots or banned users
	if(offline && !admincheck.includes(0)) //only respond to dev in offline mode
		return
	if(msg.content.match(/\$ignore/i) && !(msg.content.match(/!test/i) && offline)) //ignore posts with $ignore, except !test$ignore in offline mode
		return;
	try{//admin/debugging commands
		if(admincheck.includes(0)) {							//commands limited to bot admin
			if(msg.content.match(/!shutdown/i))
				sigtermOperations(msg); //safely shut down lackeybot
			if(msg.content.match("hey lackeybot does your library support replies yet?"))
				msg.reply("What's it look like?")
			let newGameMatch = msg.content.match(/!game ([^\n]+)/)
			if(newGameMatch) //changes game on the fly
				Client.user.setPresence( { activity: {name: newGameMatch[1]}});
			var banMatch = (/!ban <?@?!?([0-9]+)>?/);
			if(banMatch) //temp bans a user from LackeyBot
				config.admin[banMatch[1]] = [5];
			if(msg.content.match("!restat")) //corrects the stats
				stat.statUpdate(msg);
			if(msg.content.match("!report")) { //reports the current stats {
				let statsSheet = stats.stats();
				msg.channel.send("count: " + statsSheet.cardCount + "\nbribes: " + statsSheet.bribes +"\nexplosions: " + statsSheet.explosions + "\ndrafts: " + statsSheet.drafts + "\npacks: " + statsSheet.packs);
			}
		}
	}catch(e){
		console.log("Admin commands:");
		console.log(e);
	}
	try{//this is where LackeyBot checks if you have searched for a card
		var output = "", outputArray = [], stringMatchesArray = [], stringArray = [];
		let squareMatches = toolbox.globalCapture("\\[\\[([^\\]]+)\\]\\]", msg.content);			//[[strings]]
		let angleMatches = toolbox.globalCapture("<<([^>]+)>>", msg.content);						//<<strings>>
		if(!angleMatches[0])
			angleMatches = [msg.content.match(/<<([^>]+)/)];										//allow for one <<string
		let curlyMatches = toolbox.globalCapture("\\{\\{([^\\}]+)\\}\\}", msg.content);				//curly matches
		let matchesInfo = [
			{matches:squareMatches, info:arcanaData.square, name:"square"},
			{matches:angleMatches, info:arcanaData.angle, name:"angle"},
			{matches:curlyMatches, info:arcanaData.curly, name:"curly"}
		];
		let emoteOrder = [matchesInfo[0].info.emote,matchesInfo[1].info.emote,matchesInfo[2].info.emote]
		for(let check in matchesInfo) {
			if(!matchesInfo[check].info.data) 	//skip if null library or psActive
				continue;
			let matches = matchesInfo[check].matches;												//each set of strings
			let info = matchesInfo[check].info;														//each set of arcana data
			let name = matchesInfo[check].name;														//each set of arcana data
			let library = info.data;																//each relevant arcana library
			if(matches[0]) {																		//if we have matches...
				let extract = extractFetches(matches, library, msg); 								//convert [[strings]] into card names
				let outputArray = extract[0];														//the array of card names
				let stringMatchesArray = extract[1]; 												//the array of search strings
				cacheStrings(msg.channel.id, stringMatchesArray, library.name)						//save the strings
				if(library.name == "ps") {															//PS is different
					sendPSEmbed(outputArray, msg, arcanaData, stringMatchesArray, emoteOrder, name, matches);//just send the embed
				}else{
					output = priceCheck(outputArray, library, msg)									//format the cards
					if(output != "") {																//post the message if not empty
						let embedded = buildCardFetchEmbed(output, arcanaData, name, stringMatchesArray, msg.content, 0);//pagify it
						let callback = function(mess) {
							switchReacts(mess, emoteOrder, embedded[2]);							//add switch reacts
							cachePost(mess, embedded[1]);											//save search for switcheroos
						}
						msg.channel.send(embedded[0])												//send it off
							.then(mess => callback(mess))
							.catch(e => console.log(e))
						cacheImages(msg.channel.id, outputArray, library.name)						//and save the names for card commands
					}
				}
			}else{																					//if no calls are made, check for card commands TODO move random here?
				let randomRegex = new RegExp(`${info.prefix}rand`, 'i');							//rand command
				if(!msg.content.match(randomRegex)) {  	
					let noLastCardError = "No last card data available. This may occur if LackeyBot has reset recently.";
					let imgRegex = new RegExp(`${info.prefix}ima?g`, 'i');							//image command
					let rulRegex;
					if(info.prefix != "!") {														//rul command except for !rul
						rulRegex = new RegExp(`${info.prefix}rul`, 'i');
					}else{																			//which has exception for judgebot
						rulRegex = new RegExp(`(^${info.prefix}rul(?!e [0-9]{3})|.${info.prefix}rul)`, 'i');
					}
					if(library.functions && library.functions.includes('img') && msg.content.match(imgRegex)) {//post cached images
						if(imgCache.hasOwnProperty(msg.channel.id)) {								//if we have data for this channel
							let showCard = imgCache[msg.channel.id][library.name];					//use that instead
							showCard = printImages(showCard, library)								//format it
							if(showCard == "")
								showCard = noLastCardError.replace("available", "available for this database");
							let outputArray = showCard.split('\n');
							let embedded = buildCardFetchEmbed(outputArray, arcanaData, name, imgCache[msg.channel.id].lastString, msg.content, 0)
							stats.upBribes(1);																//up the stats
							let callback = function(mess) {
								switchReacts(mess, emoteOrder, embedded[2]);						//add switch reacts
								cachePost(mess, embedded[1]);										//save search for switcheroos
							}
							msg.channel.send(embedded[0])											//send it
								.then(mess => callback(mess))										//save string for switcheroos
								.catch(e => console.log(e))
						}else{
							msg.channel.send(noLastCardError);										//send the error if no card data
						}
					}
					if(library.functions && library.functions.includes('rul') && msg.content.match(rulRegex)) {				//post rulings for cached cards
						let ruling = "Can't find anything on that one, boss.";						//default message
						if(imgCache.hasOwnProperty(msg.channel.id)) {								//if we have data for this channel
							let showCard = imgCache[msg.channel.id][library.name];					//use that instead
							if(!showCard[0]) {
								msg.channel.send(noLastCardError.replace("available", "available for this database"));
							}else{
								for(let thatCard in showCard) {											//for each banked card
									let cardName = library.cards[showCard[thatCard]].fullName;
									if(library.oracle.hasOwnProperty(cardName))							//if we have a ruling for it
										ruling = library.oracle[cardName].replace(/_/g,"•");			//use that and format it
									stats.upBribes(1);															//up the stats
									msg.channel.send("Rulings for " + cardName + "\n• " + ruling);		//then send card name + ruling
									if(library.name == "msem")
										Client.channels.cache.get(config.rulingsChannel).send(cardName);
								}
							}
						}else{
							msg.channel.send(noLastCardError)										//send the error if no card data
						}
					}
				}
			}
		}
	}catch(e){ //if something goes wrong, this prevents the bot from crashing
		console.log("Card Fetching:\n");
		console.log(e);
	}
	try{//LackeyBots other 
		let scryRand = msg.content.match(/(\$|\?|!)rando?m? ?([^\n]+)?/i);
		if(scryRand){ //random card of a scryfall filter
			let randBase = arcanaData.square.data;
			if(scryRand[1] == "!"){
				randBase = arcanaData.angle.data;
			}
			if(scryRand[1] == "?"){
				randBase = arcanaData.curly.data;
			}
			var rando;
			if(scryRand[2]) {
				let randtemp = fuzzy.scryDatabase(randBase, scryRand[2], {exact:true})[0];
				if(randtemp.length > 0) {
					let num = Math.floor(Math.random()*randtemp.length);
					rando = toolbox.shuffleArray(randtemp)[0];
				}else{
					rando = arcana.anyRandom(randBase);
				}
			}else{
				rando = arcana.anyRandom(randBase);
			}
			if(rando != undefined) {
				let randCard = randBase.formatBribes(rando,msg);
				cacheImages(msg.channel.id, [rando], randBase.name);
				msg.channel.send(randCard);
				stats.upCards(1);
				stats.upBribes(1);
			}
		}
		arcana.messageHandler(msg, admincheck);
		devDexScripts.messageHandler(msg, admincheck);
		draftDexScripts.messageHandler(msg, admincheck);
		dysnomia.messageHandler(msg, admincheck);
		games.messageHandler(msg, admincheck);
		gpDex.messageHandler(msg, admincheck);
		help.messageHandler(msg, admincheck);
		remindScripts.messageHandler(msg, admincheck);
		roleDexScripts.messageHandler(msg, admincheck);
		scratchScripts.messageHandler(msg, offline, admincheck);
		statDexHandler.messageHandler(msg, offline, admincheck);
		matchDexScripts.messageHandler(msg, admincheck);
		quoteDexScripts.messageHandler(msg, admincheck);
	}catch(e) {
		console.log("LackeyBot Other Commands");;
		console.log(e);
	}
	try{//$ping
		if(msg.content.match(/\$ping/)) {
			let pinged = msg.createdTimestamp;
			msg.channel.send("Pong!")
				.then(mess => mess.edit("Pong!\nResponse time: " + parseInt(mess.createdTimestamp-pinged) + "ms"))
				.catch(e => console.log(e))
		}
	}catch(e){
		console.log('Ping')
		console.log(e)
	}
});
Client.on("messageReactionAdd", async (message, user) => {	//functions when posts are reacted to
	if(message.message.partial) {
		try{
			await message.message.fetch();
		}catch(e){
			console.log(e);
			return;
		}
	}
	if(user.id == Client.user.id)
		return;
	if(!offline || user.id == admin) { //only reacts to admin in offline mode
		try{ //in a try/catch in case anything goes wrong
			let msg = message.message;
			let emittedEmote = message._emoji.name;
			let removeThisReact = function() {
				if(msg.channel.type != "dm" && message._emoji.reaction)
					message._emoji.reaction.users.remove(user)
			}
			let emitData = { message: message, user: user}
			let arcanaData = arcana.configureArcana(msg);
			if(message._emoji.id != null)
				emittedEmote = message._emoji.id;
			if(msg.author.id == Client.user.id) { //reaction to a LackeyBot post
				//if(emittedEmote == "📣")
				//	yeet(msg.content);
				let textFlag = false, update = true;
				if((emittedEmote == plainText && message.users.cache.find(val => val.id != Client.user.id) || (emittedEmote != plainText && msg.content != "")))
					textFlag = true; //someone reacts w/PT, or with something else in PTmode
				if(msg.content != "" && emittedEmote == plainText) { //someone reacts w/PT in PT mode
					textFlag = false, update = true;
				}
				if(update) {
					if(emittedEmote == xEmote || emittedEmote == old_xEmote) {
						msg.delete();
						return;
					}
					let embedData = msg.embeds[0];
					if((embedData && embedData.footer)) { //all reactable embeds will have a footer or switcheroo data, all unreactable embeds will not
						let emoteArray = msg.reactions.cache.array();
						if(embedData.title) { //embeds that depend on title data 
							let inroleTurn = embedData.title.match(/List of users in ([^\n]+) role/i);
							let draftedmatch = embedData.title.match(/(drafted|passed) a pack/i);
							let pickMatch = embedData.title.match(/^Pack 1, Pick 1: ([^\n]+)/)
							let psBotTurn = embedData.title.match(/Planesculptors search results for: ([^\n]+)/i);
							let leagueTurn = embedData.title.match(/^(.*) League Info/);
							if(embedData.title.match(/self-assignable/i) && roleDexScripts.liveGuild(msg.guild.id)) { //self-assignable role pages
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
								let embedBuild = function(thisPage) {return roleDexScripts.buildRoleEmbed(msg.guild.id, thisPage, textFlag)[0]};
								eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
							}
							else if(inroleTurn && msg.guild && roleDexScripts.liveGuild(msg.guild.id)) { //inrole pages
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
								let embedBuild = function(thisPage) {return roleDexScripts.buildInRoleEmbed(msg.guild, inroleTurn[1], thisPage, textFlag)[0]};
								eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
							}
							else if(embedData.title.match(/packSlots Documentation/i)){
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);							
								let embedBuild = function(thisPage) {return devDexScripts.buildPackDocs(thisPage, textFlag)[0]};
								eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
							}
							else if(embedData.title.match(/opened a pack/i)) { //pack pages
								if(draftDexScripts.packCache().hasOwnProperty(user.id) && msg.id == draftDexScripts.packCache()[user.id].msg) {
									let pageCheck = embedData.footer.text.match(/Card ([0-9]+)\/([0-9]+)/)
									let database = arcana[draftDexScripts.packCache()[user.id].database];
									let embedBuild = function(thisPage) {return draftDexScripts.buildPackEmbed(database, draftDexScripts.packCache()[user.id].cards, draftDexScripts.packCache()[user.id].set, user.id, thisPage, textFlag)[0]};
									eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
								}else{
									removeThisReact();
								}
							}
							else if(draftedmatch) { //draft pages
								if(draftDexScripts.packCache().hasOwnProperty(user.id) && msg.id == draftDexScripts.packCache()[user.id].msg) {
									let pageCheck = embedData.footer.text.match(/([0-9]+)\/([0-9]+), ([0-9]+):/);
									draftDexScripts.moveDraftPlayerFocus(draftDexScripts.sendDex().drafts[pageCheck[3]], user.id)
									let thisDraft = draftDexScripts.focusedDraft(user.id);
									if(azEmoteArray.includes(emittedEmote)) {
										let ind = azEmoteArray.indexOf(emittedEmote);
										if(ind > -1 && ind < draftDexScripts.packCache()[user.id].cards.length) {
											draftDexScripts.draftPick(thisDraft, user.id, draftDexScripts.packCache()[user.id].cards[ind]);
											return;
										}
									}
									if(emittedEmote == plainText)
										thisDraft.players[user.id].pt = !thisDraft.players[user.id].pt;
									let firstFlag = draftedmatch[1] == "drafted";
									let database = arcana[draftDexScripts.packCache()[user.id].database];
									let embedBuild = function(thisPage) {return draftDexScripts.buildDraftEmbed(database, draftDexScripts.packCache()[user.id].cards, draftDexScripts.packCache()[user.id].set, user.id, thisPage, textFlag, firstFlag)[0]};
									eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
								}else{
									removeThisReact();
								}
							}
							else if(embedData.title.match(/^Supreme Draft/i)) { //pack pages
								if(draftDexScripts.packCache().hasOwnProperty(user.id) && msg.id == draftDexScripts.packCache()[user.id].msg) {
									let pageCheck = embedData.footer.text.match(/([0-9]+)\/([0-9]+)/);
									let pickNos = embedData.title.match(/Pack (\d+), Pick (\d+): ([^\n]+)/);
									let newPack = parseInt(pickNos[1]);
									let newPick = parseInt(pickNos[2]);
									let newFlag;
									if(azEmoteArray.includes(emittedEmote)) {
										let pickResult = draftDexScripts.supremePicker(user.id, emittedEmote);
										if(pickResult[0]) {
											newPick = (newPick+1)%3
											if(newPick == 0) {
												newPick++;
												newPack++;
												draftDexScripts.packCache()[user.id].cards = psPackSorter(draftDexScripts.generatePack(draftDexScripts.packCache()[user.id].set, arcana[draftDexScripts.packCache()[user.id].database], " -is:bonus"), arcana[draftDexScripts.packCache()[user.id].database]);
												draftDexScripts.packCache()[user.id].picks = [];
												pageCheck[1] = 1;
												if(msg.channel.type == "dm") {
													newFlag = function(mess) {
														draftDexScripts.packCache()[user.id].msg = mess.id;
														mess.react(leftArrow);
														mess.react(rightArrow);
														mess.react(plainText);
													};
												}else{
													removeThisReact()
												}
											}
										}
									}
									if(newPack == 19) {
										let pool = "**Supreme Pool**\n";
										for(let c in scratchScripts.sendPad().supreme[user.id].pool) {
											pool += scratchScripts.sendPad().supreme[user.id].pool[c] + " " + c.replace(/_.*/, "") + "\n";
										}
										msg.channel.send(pool)
										delete scratchScripts.sendPad().supreme[user.id];
										delete draftDexScripts.packCache()[user.id];
									}else{
										let database = arcana[draftDexScripts.packCache()[user.id].database];
										let pickData = {
											pack: newPack,
											pick: newPick,
											picks: draftDexScripts.packCache()[user.id].picks,
											picked: emittedEmote,
											user: user.id,
										}
										let embedBuild = function(thisPage) {return draftDexScripts.buildSupremeEmbed(database, draftDexScripts.packCache()[user.id].cards, draftDexScripts.packCache()[user.id].set, pickData, thisPage, textFlag)[0]};
										eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag, false, newFlag);
									}
								}else{
									removeThisReact();
								}
							}
							else if(pickMatch) {
								let packArray;
								if(embedData.description)
									packArray = embedData.description.split("\n");
								if(msg.content)
									packArray = msg.content.split("\n");
								let database = arcana.magic;
								let dataName = arcana.decodeColor(embedData.color);
								if(dataName)
									database = arcana[dataName];
								let embedBuild = function(thisPage) {return draftDexScripts.buildPickEmbed(database, packArray, pickMatch[1], textFlag)[0]};
								eris.turnEmbedPage(emitData, [0, 1, 1], embedBuild, update, textFlag);
							}
							else if(psBotTurn) { //flips pages for PSBot searches
								if(emittedEmote == xEmote) {
									msg.delete();
									return;
								}else{
									let pageCheck = embedData.footer.text.match(/Card ([0-9]+)\/([0-9]+)/);
									let closestCanon = false;
									let ccMatch = embedData.footer.text.match(/Looking for ([^\n]+)\?/);
									if(ccMatch)
										closestCanon = ccMatch[1];
									let imageFlag = false;
									let delFlag = false;
									if(embedData.image)
										imageFlag = true;
									if(emittedEmote == excEmote && closestCanon) {
										msg.reactions.removeAll();
										let arcanaData = arcana.configureArcana(msg);
										let emoteOrder = [
											arcanaData.square.emote,
											arcanaData.angle.emote,
											arcanaData.curly.emote
										]
										let showCard = priceCheck([closestCanon], arcana.magic, msg);
										let embedded = buildCardFetchEmbed(showCard, arcanaData, "angle", [closestCanon], msg.content, 0)
										cachePost(msg, embedded[1]);
										let deadEmbed = new Discord.MessageEmbed()
											.setDescription('PS search converted to canon search')
										msg.edit(showCard, deadEmbed);
										switchReacts(msg, emoteOrder, embedded[2]);
										return;
									}
									if(emittedEmote == mag)
										imageFlag = !imageFlag
									let namesPull = embedData.footer.text.match(/hits: ([^\n]+)/);
									let nameArray = namesPull[1].split(", ");
									let embedBuild = function(thisPage) {return buildPSEmbed(nameArray, thisPage, psBotTurn[1], closestCanon, textFlag, imageFlag)[0]};
									eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
								}
							}
							else if(leagueTurn) { //flips pages for league data embed
								let thisUser = leagueTurn[1];
								let userID = Client.users.cache.find(val => val.username == thisUser).id;
								if(thisUser == user.id) {
									let pageCheck = embedData.footer.text.match(/run data (\d+)\/(\d+)/);
									let tourney = embedData.footer.text.match(/^(.*) run data/)[1];
									let embedBuild = function(thisPage) {return matchDexScripts.reportRecord(tourney, userID, thisPage, textFlag)[0]}
									eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag, 1)
								}else{
									removeThisReact();
								}
							}
						}
						if(embedData.description) { //embeds that depend on description data
							let searchTurn = embedData.description.match(arcana.refSheet.searchRegex)
							let hangCheck = embedData.description.match(/(Guess the card|Hangman is in plaintext mode.)/);
							let scodeCheck = embedData.description.match(/(Magic|MSEM|devDex) Set Codes/);
							
							if(searchTurn) { //flips pages for Instigator/Scryfall searches
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
								let database = arcana.magic;
								let dataName = arcana.decodeTitle(searchTurn[1])
								if(dataName)
									database = arcana[dataName];
								let imageFlag = false;
								if(embedData.image)
									imageFlag = true;
								let pageFlag = false;
								switch(emittedEmote) {
									case mag:
										imageFlag = !imageFlag;
										break;
									case xEmote:
										pageFlag = true;
										break;
									case (excEmote, old_excEmote):
										database = arcanaData.angle.data;
										switchFlag = true;
										break;
									case (dollarEmote, old_dollarEmote):
										database = arcanaData.square.data;
										switchFlag = true;
										break;
									case (quesEmote, old_quesEmote):
										database = arcanaData.curly.data;
										switchFlag = true;
										break;
								}
								let embedBuild = function(thisPage) {return arcana.buildSearchEmbed(searchTurn[2], database, thisPage, imageFlag, textFlag)[0]};
								if(pageFlag)
									embedBuild = function() {return arcana.buildSearchEmbed(searchTurn[2], database, -1, imageFlag, textFlag)[0]};
								eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
							}
							else if(hangCheck && !embedData.footer.text.match(/^Game over/)) { //hangman games
								games.hangmanParser(msg, embedData, emittedEmote, textFlag)
							}
							else if(scodeCheck) {  //flip setcode pages
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
								let database = arcana.libFromBig(scodeCheck[1]);
								let embedBuild = function(thisPage) {return arcana.buildSetsEmbed(database, thisPage, textFlag)[0]};
								//if(pageFlag)
								//	embedBuild = function() {return arcana.buildSetsEmbed(database, -1, textFlag)[0]};
								eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
							}
							else if(embedData.description.match(/^Need more time/)){
								let messSplit = msg.content.match(/(\d+) ([^ ]+) ago <@!?([0-9]+)> set a reminder: ?([\s\S]*)/);
								let number = parseInt(messSplit[1]);
								let distance = messSplit[2];
								let thisID = messSplit[3];
								let thisMessage = "";
								if(messSplit[4])
									thisMessage = messSplit[4];
								thisMessage = thisMessage.replace(/\nPing me too: (<@!?[0-9]+> ?)*$/, "");
								if(thisID == user.id) {
									switch(emittedEmote) {
										case hourEmote:
											number = 1;
											distance = "hour";
											break;
										case dayEmote:
											number = 1;
											distance = "day";
											break;
										case weekEmote:
											number = 1;
											distance = "week";
											break;
										case repeatEmote:
											break;
										default:
											number = null;
											break;
									}
									if(number != null) {
										let pingTime = toolbox.setTimeDistance(number, distance)
										remindScripts.remindAdder(msg.channel.id, thisID, thisMessage, number + " " + distance, pingTime.getTime(), msg.channel.id);
									}
								}else{
									removeThisReact();
								}
							}
						}
						{//embeds that depend on footer data
							if(embedData.footer.text.match(/^Previous/)) {	//cr embed
								let libname = embedData.footer.text.match(/([^\n ]+) Comprehensive Rules/)[1];
								libname = arcana.libFromBig(libname)
								if(emittedEmote == leftArrow) {
									let crCheck = embedData.footer.text.match(/Previous ([^\n]+)/);
									if(crCheck) {
										let embedBuild = arcana.buildCREmbed(crCheck[1], libname, textFlag)
										msg.edit(embedBuild[0], embedBuild[1])
									}
								}else if(emittedEmote == rightArrow) {
									let crCheck = embedData.footer.text.match(/Next ([^\n]+)/);
									if(crCheck) {
										let embedBuild = arcana.buildCREmbed(crCheck[1], libname, textFlag)
										msg.edit(embedBuild[0], embedBuild[1])
									}
								}else if(emittedEmote == plainText && embedData.title != "Comprehensive Rules") {
									let embedBuild = arcana.buildCREmbed(embedData.title, libname, textFlag)
									msg.edit(embedBuild[0], embedBuild[1])
								}
								removeThisReact();
							}
							else if(emittedEmote == plainText && embedData.footer.text == collectToPlainMsg) { //plain text link collections
								let trimmedEmbed = new Discord.MessageEmbed(embedData)
									.setFooter(plainToCollectMsg)
									.setDescription('')
								let embedText = '';
								if(embedData.title)
									embedText += "**" + embedData.title + "**\n";
								embedText += embedData.description.replace(/\(/g, ": <").replace(/\)/g, ">")
								msg.edit(embedText, trimmedEmbed)
							}else if(emittedEmote == plainText && embedData.footer.text == plainToCollectMsg) {
								let embedText = msg.content.replace(/\*\*[^\*]+\*\*\n/, "").replace(/: </g, "(").replace(/>/g, ")")
								let filledEmbed = new Discord.MessageEmbed(embedData)
									.setDescription(embedText)
									.setFooter(collectToPlainMsg)
								msg.edit('', filledEmbed);
							}
							else if(embedData.footer.text.match(/Reminder slot/)){	//ping me too reminders
								if(emittedEmote == pingStar) {
									let reminderslot = embedData.footer.text.match(/Reminder slot (\d+)\[(\d+)/);
									let remTime = reminderslot[1];
									let remSlot = reminderslot[2];
									remindScripts.addCC(remTime, remSlot, user, msg)
								}else{
									removeThisReact();
								}
							}
							else if(embedData.footer.text.match(/Reminders/)) {		//reminderlist
								let numData = embedData.footer.text.match(/(\d+) - (\d+)\/(\d+) for (\d+)/);
								if(numData) {
									let oldStart = numData[1];
									let oldEnd = parseInt(numData[2]);
									let remLength = parseInt(numData[3]);
									let userID = numData[4];
									if(userID == user.id) {
										let embedded = remindScripts.buildReminderListEmbed(userID, (oldEnd+1)%(remLength+1), true)
										msg.edit(embedded[0], embedded[1]);
									}else{
										removeThisReact();
									}
								}
							}
							else if(embedData.footer.text.match(/leaderboard/)) { //leaderboard
								let pageCheck = embedData.footer.text.match(/^(\d+)\/(\d+) ([^\n]+) leaderboard/);
								let breakers = false;
								if(msg.content.match(/with tiebreakers/))
									breakers = true;
								if(emittedEmote == tieEmote) {
									breakers = !breakers;
									removeThisReact();
								}
								let embedBuild = function(thisPage) {return matchDexScripts.renderGPLeaderBoard(pageCheck[3], breakers, thisPage)};
								eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, true);
							}
							else if(embedData.footer.text.match(/Role Reactor/)) {
								let reactMatch = toolbox.globalCapture("^React ?([^ ]+)[^<]+<?@?&?([0-9]+)", msg.content);
								if(reactMatch) {
									for(let c in reactMatch) {
										let thisReact = reactMatch[c];
										let emote = thisReact[1];
										if(emote.match(/[0-9]+>/))
											emote = emote.match(/([0-9]+)>/)[1];
										if(emittedEmote == emote) {
											let role = thisReact[2];
											Client.guilds.cache.get(msg.guild.id).members.cache.find(val => val.id == user.id).roles.add(role).catch(console.error);
											break;
										}
									}
								}
							}
						}
					}
					else if(switcherooCache[msg.channel.id] && switcherooCache[msg.channel.id][msg.id]) { //switheroo "embed"
						let searchString = switcherooCache[msg.channel.id][msg.id];
						let currentMatch = searchString.match(/([^ ]+) search for/)
						let currentLib = (currentMatch ? currentMatch[1] : "MSEM")
						if(emittedEmote == xEmote) { 	//first check for delete
							msg.delete();
							return;
						}
						else{							//or do the updates
							if(emittedEmote == mag) {	//switches were dumb, if/else the mag and ruler
								if(searchString.match(/(!|\$|\?|ϕ)img/)){
									searchString = searchString.replace(/(!|\$|\?|ϕ)img/, "")
								}else{
									searchString += "ϕimg"
								}
							}else if(emittedEmote == ruler) {
								if(searchString.match(/(!|\$|\?|ϕ)rul/)){
									searchString = searchString.replace(/(!|\$|\?|ϕ)rul(e|ing)?/, "")
								}else{
									searchString += "ϕrul"
								}
							} //then check the library and matches
							let library, name, oldPre, newPre, emoteOrder = [], wraps = [];
							library = arcana.libFromBig(currentLib, arcana);
							for(let shape in arcanaData) {
								if(arcanaData[shape].data && arcanaData[shape].data.name != "ps")
									emoteOrder.push(arcanaData[shape].emote)
								if(arcanaData[shape].emote == emittedEmote || arcanaData[shape].data == library) {
									library = arcanaData[shape].data;
									name = shape;
									newPre = arcanaData[shape].prefix;
								}
								if(arcanaData[shape].data && arcanaData[shape].data.bigname == currentLib)
									oldPre = arcanaData[shape].prefix;
							}
							if(!name) //if its not saved, it's a swapped square
								name = "square";
							let swapSquares = searchString.match(arcana.refSheet.anySwapRegex)
							if(name == "square" && swapSquares) {
								library = arcana[arcana.refSheet.swapCommands[swapSquares[1]]]
								if(oldPre != "$")
									newPre = "$";
							}
							//check if on $ and swap to $msem/$myriad if it's cached too
							if(oldPre && newPre)
								searchString = searchString.replace(new RegExp('(ϕ|'+oldPre+')', 'g'), newPre.replace(/\\+/,""))
							let matches = toolbox.globalCapture("(?:\\{|\\[|<)(?:\\{|\\[|<)([^\\]\\}>]+)(?:\\]|\\}|>)(?:\\]|\\}|>)", searchString);
							let extract = extractFetches(matches, library, msg)
							output = priceCheck(extract[0], library, {content:searchString})		//format the cards
							if(output != "") {														//post the message if not empty
								let pageCheck = searchString.match(/Page (\d+)/);
								let page = 0;
								if(pageCheck)
									page = parseInt(pageCheck[1]-1)
								if(emittedEmote == rightArrow)
									page++;
								if(emittedEmote == leftArrow)
									page--;
								let embedded = buildCardFetchEmbed(output, arcanaData, name, extract[1], searchString, page);//add a snazzy embed
								msg.edit(embedded[0])													//send it off
								cacheImages(msg.channel.id, extract[0], library.name)					//and save the names for card commands
								switcherooCache[msg.channel.id][msg.id] = embedded[1]; 					//update the page number
							}
							removeThisReact();
						}
					}
				}
			}else{ //LackeyBot assistance commands
				if(msg.channel && convars.selfPins.includes(msg.channel.id) && pinEmotes.includes(emittedEmote) && user.id == msg.author.id) { //self pins
					if(msg.pinned) {
						msg.unpin();
					}else{
						dysnomia.asyncSwapPins(msg, {author:msg.author.id}, 1)
					}
				}
				else{
					if(emittedEmote == "wormhole" || emittedEmote == "835911106027061318") { //ultra wormhole
						if(msg.channel.id == "511306494592024583") {
							Client.guilds.cache.get("317373924096868353").members.cache.get(user.id).roles.add("835909801057714177");
						}
						else if(msg.channel.id == "835910152845918259") { //into the ultra wormhole
							Client.guilds.cache.get("317373924096868353").members.cache.get(user.id).roles.add("835909974969548880");
						}
						else if(msg.channel.id == "835910252187746365"){ //leave ultra space
							Client.guilds.cache.get("317373924096868353").members.cache.get(user.id).roles.remove("835909801057714177");
							Client.guilds.cache.get("317373924096868353").members.cache.get(user.id).roles.remove("835909974969548880");
						}
					}
				}
			}
		}catch(e) {
			console.log("Error: Reaction emits.")
			console.log(e);
		}
	}
});
Client.on('messageReactionRemove', async (message, user) =>{//functions when posts are un-reacted to
	if (message.message.partial) {
		try{
			await message.message.fetch();
		}catch(e){
			console.error('Something went wrong when fetching the message: ', e);
		}
	}
	let msg = message.message;
	let removedEmote = message._emoji.name;
	let emittedEmote = message.emoji.name;
	let emitData = {message: message, user: user}
	let arcanaData = arcana.configureArcana(msg);
	let embedData = msg.embeds[0];
	let override = false;
	if(embedData && embedData.footer && embedData.footer.text.match(/Role Reactor/))
		override = true;
	if(msg.author.id == Client.user.id && (msg.channel.type == "dm" || override)) { //can't delete reacts in DMs, so count removals as ticks instead of double clicking
		let textFlag = false, update = true;
		if((emittedEmote == plainText && message.users.cache.find(val => val.id != Client.user.id) || (emittedEmote != plainText && msg.content != "")))
			textFlag = true; //someone reacts w/PT, or with something else in PTmode
		if(msg.content != "" && emittedEmote == plainText) { //someone reacts w/PT in PT mode
			textFlag = false, update = true;
		}
		if(update) {
			if((embedData && embedData.footer)) { //all reactable embeds will have a footer or switcheroo data, all unreactable embeds will not
				if(embedData.title) { //embeds that depend on title data 
					let inroleTurn = embedData.title.match(/List of users in ([^\n]+) role/i);
					let draftedmatch = embedData.title.match(/(drafted|passed) a pack/i);
					let pickMatch = embedData.title.match(/^Pack 1, Pick 1: ([^\n]+)/)
					let psBotTurn = embedData.title.match(/Planesculptors search results for: ([^\n]+)/i);
					let leagueTurn = embedData.title.match(/^(.*) League Info/);
					if(embedData.title.match(/self-assignable/i) && msg.guild && roleDex.guilds.hasOwnProperty(msg.guild.id)) { //self-assignable role pages
						let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
						let embedBuild = function(thisPage) {return roleDexScripts.buildRoleEmbed(msg.guild.id, thisPage, textFlag)[0]};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
					}
					else if(inroleTurn && msg.guild && roleDex.guilds.hasOwnProperty(msg.guild.id)) { //inrole pages
						let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
						let embedBuild = function(thisPage) {return roleDexScripts.buildInRoleEmbed(msg.guild, inroleTurn[1], thisPage, textFlag)[0]};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
					}
					else if(embedData.title.match(/packSlots Documentation/i)){
						let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);							
						let embedBuild = function(thisPage) {return devDexScripts.buildPackDocs(thisPage, textFlag)[0]};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
					}
					else if(embedData.title.match(/opened a pack/i)) { //pack pages
						if(draftDexScripts.packCache().hasOwnProperty(user.id) && msg.id == draftDexScripts.packCache()[user.id].msg){
							let pageCheck = embedData.footer.text.match(/Card ([0-9]+)\/([0-9]+)/)
							let database = arcana[draftDexScripts.packCache()[user.id].database];
							let embedBuild = function(thisPage) {return draftDexScripts.buildPackEmbed(database, draftDexScripts.packCache()[user.id].cards, draftDexScripts.packCache()[user.id].set, user.id, thisPage, textFlag)[0]};
							eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
						}
					}
					else if(draftedmatch) { //draft pages
						if(draftDexScripts.packCache().hasOwnProperty(user.id) && msg.id == draftDexScripts.packCache()[user.id].msg){
							let firstFlag = draftedmatch[1] == "drafted";
							let pageCheck = embedData.footer.text.match(/([0-9]+)\/([0-9]+)/)
							let database = arcana[draftDexScripts.packCache()[user.id].database];
							let embedBuild = function(thisPage) {return draftDexScripts.buildDraftEmbed(database, draftDexScripts.packCache()[user.id].cards, draftDexScripts.packCache()[user.id].set, user.id, thisPage, textFlag, firstFlag)[0]};
							eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
						}
					}
					else if(embedData.title.match(/^Supreme Draft/i)) { //pack pages
						if(draftDexScripts.packCache().hasOwnProperty(user.id) && msg.id == draftDexScripts.packCache()[user.id].msg){
							let pageCheck = embedData.footer.text.match(/([0-9]+)\/([0-9]+)/);
							let pickNos = embedData.title.match(/Pack (\d+), Pick (\d+): ([^\n]+)/);
							let newPack = parseInt(pickNos[1]);
							let newPick = parseInt(pickNos[2]);
							let newFlag;
							let database = arcana[draftDexScripts.packCache()[user.id].database];
							let pickData = {
								pack: newPack,
								pick: newPick,
								picks: draftDexScripts.packCache()[user.id].picks,
								picked: removedEmote,
								user: user.id,
							}
							let embedBuild = function(thisPage) {return draftDexScripts.buildSupremeEmbed(database, draftDexScripts.packCache()[user.id].cards, draftDexScripts.packCache()[user.id].set, pickData, thisPage, textFlag)[0]};
							eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag, false, newFlag);
						}
					}
					else if(psBotTurn) { //flips pages for PSBot searches
						let pageCheck = embedData.footer.text.match(/Card ([0-9]+)\/([0-9]+)/);
						let closestCanon = false;
						let ccMatch = embedData.footer.text.match(/Looking for ([^\n]+)\?/);
						if(ccMatch)
							closestCanon = ccMatch[1];
						let imageFlag = false;
						let delFlag = false;
						if(embedData.image)
							imageFlag = true;
						if(removedEmote == mag)
							imageFlag = !imageFlag
						let namesPull = embedData.footer.text.match(/hits: ([^\n]+)/);
						let nameArray = namesPull[1].split(", ");
						let embedBuild = function(thisPage) {return buildPSEmbed(nameArray, thisPage, psBotTurn[1], closestCanon, textFlag, imageFlag)[0]};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
					}
					else if(leagueTurn) { //flips pages for league data embed
						let thisUser = leagueTurn[1];
						let userID = Client.users.cache.find(val => val.username == thisUser).id;
						if(thisUser == user.id) {
							let pageCheck = embedData.footer.text.match(/run data (\d+)\/(\d+)/);
							let tourney = embedData.footer.text.match(/^(.*) run data/)[1];
							let embedBuild = function(thisPage) {return matchDexScripts.reportRecord(tourney, userID, thisPage, textFlag)[0]}
							eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag, 1)
						}
					}
				}
				if(embedData.description) { //embeds that depend on description data
					let searchTurn = embedData.description.match(arcana.refSheet.searchRegex)
					let hangCheck = embedData.description.match(/(Guess the card|Hangman is in plaintext mode.)/);
					let scodeCheck = embedData.description.match(/(Magic|MSEM|devDex) Set Codes/);
					if(searchTurn) { //flips pages for Instigator/Scryfall searches
						let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
						let database = arcana.magic;
						let dataName = arcana.decodeTitle(searchTurn[1])
						if(dataName)
							database = arcana[dataName];
						let imageFlag = false;
						if(embedData.image)
							imageFlag = true;
						let pageFlag = false;
						switch(removedEmote) {
							case mag:
								imageFlag = !imageFlag;
								break;
							case xEmote:
								pageFlag = true;
								break;
							case (excEmote, old_excEmote):
								database = arcanaData.angle.data;
								switchFlag = true;
								break;
							case (dollarEmote, old_dollarEmote):
								database = arcanaData.square.data;
								switchFlag = true;
								break;
							case (quesEmote, old_quesEmote):
								database = arcanaData.curly.data;
								switchFlag = true;
								break;
						}
						let embedBuild = function(thisPage) {return arcana.buildSearchEmbed(searchTurn[2], database, thisPage, imageFlag, textFlag)[0]};
						if(pageFlag)
							embedBuild = function() {return arcana.buildSearchEmbed(searchTurn[2], database, -1, imageFlag, textFlag)[0]};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
					}
					else if(hangCheck && !embedData.footer.text.match(/^Game over/)) { //hangman games
						games.hangmanParser(msg, embedData, removedEmote, textFlag)
					}
					else if(scodeCheck) {  //flip setcode pages
						let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
						let database = arcana.libFromBig(scodeCheck[1]);
						let embedBuild = function(thisPage) {return arcana.buildSetsEmbed(database, thisPage, textFlag)[0]};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, textFlag);
					}
				}
				{//embeds that depend on footer data
					if(embedData.footer.text.match(/^Previous/)) {	//cr embed
						let libname = embedData.footer.text.match(/([^ ]+) Comprehensive Rules/)[1];
						libname = arcana.libFromBig(libname)
						if(removedEmote == leftArrow) {
							let crCheck = embedData.footer.text.match(/Previous ([^\n]+)/);
							if(crCheck) {
								let embedBuild = arcana.buildCREmbed(crCheck[1], libname, textFlag)
								msg.edit(embedBuild[0], embedBuild[1])
							}
						}else if(removedEmote == rightArrow) {
							let crCheck = embedData.footer.text.match(/Next ([^\n]+)/);
							if(crCheck) {
								let embedBuild = arcana.buildCREmbed(crCheck[1], libname, textFlag)
								msg.edit(embedBuild[0], embedBuild[1])
							}
						}else if(removedEmote == plainText && embedData.title != "Comprehensive Rules") {
							let embedBuild = arcana.buildCREmbed(embedData.title, libname, textFlag)
							msg.edit(embedBuild[0], embedBuild[1])
						}
					}
					else if(removedEmote == plainText && embedData.footer.text == collectToPlainMsg) { //plain text link collections
						let trimmedEmbed = new Discord.MessageEmbed(embedData)
							.setFooter(plainToCollectMsg)
							.setDescription('')
						let embedText = '';
						if(embedData.title)
							embedText += "**" + embedData.title + "**\n";
						embedText += embedData.description.replace(/\(/g, ": <").replace(/\)/g, ">")
						msg.edit(embedText, trimmedEmbed)
					}else if(removedEmote == plainText && embedData.footer.text == plainToCollectMsg) {
						let embedText = msg.content.replace(/\*\*[^\*]+\*\*\n/, "").replace(/: </g, "(").replace(/>/g, ")")
						let filledEmbed = new Discord.MessageEmbed(embedData)
							.setDescription(embedText)
							.setFooter(collectToPlainMsg)
						msg.edit('', filledEmbed);
					}
					else if(embedData.footer.text.match(/Reminders/)) {		//reminderlist
						let numData = embedData.footer.text.match(/(\d+) - (\d+)\/(\d+) for (\d+)/);
						if(numData) {
							let oldStart = numData[1];
							let oldEnd = parseInt(numData[2]);
							let remLength = parseInt(numData[3]);
							let userID = numData[4];
							if(userID == user.id) {
								let embedded = buildReminderListEmbed(userID, (oldEnd+1)%(remLength+1), true)
								msg.edit(embedded[0], embedded[1]);
							}
						}
					}
					else if(embedData.footer.text.match(/leaderboard/)) { //leaderboard
						let pageCheck = embedData.footer.text.match(/^(\d+)\/(\d+) ([^\n]+) leaderboard/);
						let breakers = false;
						if(msg.content.match(/with tiebreakers/))
							breakers = true;
						if(removedEmote == tieEmote) {
							breakers = !breakers;
						}
						let embedBuild = function(thisPage) {return matchDexScripts.renderGPLeaderBoard(pageCheck[3], breakers, thisPage)};
						eris.turnEmbedPage(emitData, pageCheck, embedBuild, update, true);
					}
					else if(embedData.footer.text.match(/Role Reactor/)) {
						let reactMatch = toolbox.globalCapture("^React ?([^ ]+) [^<]+ ?<?@?&?([0-9]+)", msg.content);
						if(reactMatch) {
							for(let c in reactMatch) {
								let thisReact = reactMatch[c];
								let emote = thisReact[1];
								if(emote.match(/[0-9]+>/))
									emote = emote.match(/<:([^ ]+):([0-9]+)>/)[1];
								if(removedEmote == emote) {
									let role = thisReact[2];
									Client.guilds.cache.get(msg.guild.id).members.cache.find(val => val.id == user.id).roles.remove(role).catch(console.error);
									break;
								}
							}
						}
					}
				}
			}
		}
	}
	else if(msg.channel && convars.selfPins.includes(msg.channel.id) && pinEmotes.includes(removedEmote)) { //self pins
		if(msg.author.id == user.id && msg.pinned)
			msg.unpin();
	}
});
Client.on("ready", () => {									//performed when the bot logs in
	console.log("Ready as "+Client.user.username);
	startUpFunctions();
});
Client.on("disconnect", (event) => {						//performed when bot disconnects to prevent data loss
	version.logDraft();
});
process.on('unhandledRejection', (reason, p) => {			//source unhandledRejections
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
process.on('SIGTERM', function(){							//heroku restarts us every 24-27 hours, make sure we've got everything saved when that happens
	sigtermOperations();
})
