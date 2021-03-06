﻿/* LackeyBot
 Primary LackeyBot script
 Working on splitting up modules as appropriate
 Potential Modules to break off:
 Roles, Reminders, matchDex, "games"
*/
//Live and Test Bot login
const config = require("./config/lackeyconfig.json");
var login = config.live;
var botname = "LackeyBot";
var offline = false, queueing = false, writing = [];
var versionCheck = {stats:0, remind:0, roles:0, gpbase:0, draft:0, matchDex:0, devDex:0};
//if run as 'node lackeybot test', login as TestBot
if(process.argv[2] != undefined && process.argv[2].match(/test/i)) {
	login = config.test;
	test = 1;
	botname = "TestBot";
}
if(process.argv[2] != undefined && process.argv[2].match(/offline/i)) {
	offline = true;
}
const logintoken = login.token;
const statsID = login.stats;
const draftID = login.draft;
//this sets up the libraries that simplify a lot of code
const Discord = require("discord.js");
var Dropbox = require("dropbox").Dropbox;
var fetch = require('isomorphic-fetch');
const dbx = new Dropbox({ accessToken: config.dropbox, fetch:fetch});
const http = require("http");
const fs = require("fs");
const express = require('express');
const request = require("request");
const download = require('download-file');
const htmlEle = require('he');
const sizeOf = require('image-size');

const server = express();
const port = process.env.PORT || 4000;
const INDEX = '/index.html'
//playing around with lackeybot.herokuapp, takes out the bot if it isn't active though
/*server.use((req, res) => res.sendFile(INDEX, { root: __dirname }))
server.listen(port, () => console.log(`Listening on ${port}`));
var Server = require('ws').Server;
const wss = new Server({ server });*/

const rp = require("request-promise-native");
var disarm = null, smsNo = 0, errorNo = 0, downloadCount = 0
let downloadLoop = {devDex: 0, reminderBase: 0};
var pinDisarm = [false, null, null] //pin info for desgingames; disarmed?, last pinned, last unpinned
var logLater = { //some files may be updated several times very quickly, this puts a delay on them
	'reminder': false,
	'match': false,
	'draft': false
}
const disableGuild = ["205457071380889601","643349514203168779", "481200347189084170", "413055835179057173"]; //channels with msem disabled
const statDexEnabled = ["765687542036561930", "755707492947722301", "765707235434823730"]
const selfPins = ["358302654847385610", "367816828287975425", "771127405946601512"];
const bye = "343475440083664896"; //bye player id for matchDex
const cajun = '190309440069697536'; //cajun id
var tournamentNames = '(gp|league)', organizers = [cajun, login.TO], tournamentChannels = [login.comp, login.league, login.cnm, login.sealed];
var tournamentReges = ['GP[A-Z]', 'league'];

//emote identifiers for reaction tech
//arrays to turn letters to regional letter emotes
const azArray = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"]
const azEmoteArray = ["🇦","🇧","🇨","🇩","🇪","🇫","🇬","🇭","🇮","🇯","🇰","🇱","🇲","🇳","🇴","🇵","🇶","🇷","🇸","🇹","🇺","🇻","🇼","🇽","🇾","🇿"]
const blank = "⬚", resetList = "📄"; //blank square emote
const leftArrow = "⬅️", rightArrow = "➡️", old_dollarEmote = "💲", old_excEmote = "❗", old_quesEmote = "❓", old_plainText = "💬", old_mag = "🔍", old_ruler = "📏", old_xEmote = "❌"
const old_hourEmote = "🕐", old_dayEmote = "🌞", old_weekEmote = "📆", old_repeatEmote = "🔄";
const pinEmotes = ["📌","📍"]
const plainText = "711733693542039562", mag = "711732431472033852", ruler = "711732431614378004", xEmote = "711732430549286912", dollarEmote = "711733693336518738", excEmote = "711732431278833665", quesEmote = "711732431408988230", tieEmote = "753837098771021877";
const hourEmote = "711732430461075527", dayEmote = "711732430658207864", weekEmote = "711732430532378677", repeatEmote = "711732431362850876", pingStar = "712533734687244321";
const collectToPlainMsg = 'This is a link collection embed. You can react ' + old_plainText + ' to convert to plaintext, but it will lose its formatting.';
const plainToCollectMsg = 'This was a link collection embed. You can react ' + old_plainText + ' to convert it back to an embed.';

var yeet = console.log; //use for temp logs to make them easy to differentiate from permanent ones
const boop = "boop"; //boop

//load modules
var discClient = require('./discClient.js')		//handles discord client
var arcana = require('./arcana.js');			//handles all the card databases
arcana.buildReference(arcana);
const fuzzy = require('./fuzzy.js');			//handles the general search engine
const mod_magic = require('./magic.js');		//handles Magic-specific coding
var matchDexScripts = require('./matchDex.js');	//handles matchDex scripts
const toolbox = require('./toolbox.js');		//personal toolbox scripts
var embedStash = fuzzy.embedCache;				//stores extra data for some embeds
var clearEmbedCache = fuzzy.clearEmbedCache;	//regularly deletes old extra data
const myriadFix = require('./myriadfix.js');	//some adjustments for myriad data
const packgen = require('./packgen.js');		//scripts for generating packs
var psScrape = require('./psScrape.js');		//scripts for searching PS
let quote = require('./quotedex.js')			//testing scripts for $q command
var statDexHandler = require('./statDex.js');	//handles the statDex analysis
statDexHandler.initialize({arcana:arcana});
var zipTech = require('./zipTech.js');			//handles zip editing
var setParser = require('./setParser.js');		//handles set editing
var imgManip = require('./imgManip.js');		//handles image editing
//var website = require('./web.js');				//lackeybot.herokuapp.com
//var pkHold;
discClient.initialize();
const Client = discClient.sendClient();

//Startup
//global variables and defaults
var cards = {}, legal = {}, oracle = {}, msemSetData = {}
var canon = {}, canonOracle = {}, magicSetData = {};
var devDex = {};
var stats = {}, countingCards = null, bribes = null, explosions = null, draftStarts = null, crackedPacks = null, reminderSet = null, reminderDone = null;
var allRoles = {}, roleCall = {}, fightGuilds = {}, roleRegex = {};
var reminderData = {}, reminderBase = {}, reminderCell = {};
var packInfo = {}, packStash = {};
var admincheck = [7];
var allpacks = {}, draft = {}
var arttemp = {};
var creatureTypeArray = [];
var decklist = {};
var extras = {}, mechanics = {}, nicks = {}, prompts = {}, sms = [];
var imgCache = {lastString: []};
for(let l in arcana.libraries) {
	imgCache[arcana.libraries[l]] = {};
}
var instData = {};
var matchDex = {}, gpbase = {}, gpCell = [];
var playerArray = [];
var playtime = 0;
var ruleJson = {};
var scryRegex = [];
var switcherooCache = {};
var tempSetsArray = {};
var bribeBoost = 0, cardBoost = 0;
var lastID = 0;
var looping = 0;
var holdingCell = {}, bankedChannel = [];
var arcanaSettings = {};
var scratchPad = {};
loadArcanaSettings();

/*website test
server.set('view engine', 'ejs');
server.use(express.static(__dirname));
server.get('/', (request, response) => {
    //ejs render automatically looks in the views folder
    response.render('index');
});

server.get('/public', function (req, res) {
	res.send('Hello world')
})
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 1000);
*/

setInterval(() => { //this will try to log the stats every 10 minutes
  try{
	  logStats();
	  channelReminders();
  }catch(e){console.log(e);}
}, 600000);
setInterval(() => { //this will reset the self-destruct switch and current game every hour
	if(disarm != "verydisarmed")
		disarm = null;
	if(playtime == 0){
		let mun = Math.floor(Math.random()*extras.games.length);
		let newGame = extras.games[mun];
		Client.user.setPresence( { activity: {name: newGame}});
	}
  if(playtime == 1)
	  playtime = 0;
  clearEmbedCache(); //clear out old scry caches;
}, 3600000);
setInterval(() => { //this will check the reminderBase every minute
	if(botname != "TestBot" && !offline) {
		let refDate = new Date().getTime();
		refDate = Math.trunc(refDate / 60000) * 60000;
		let logFlag = 0;
		for(let remindTime in reminderBase) {
			if(remindTime <= refDate) {
				try{
					remindScript(reminderBase[remindTime], refDate, remindTime);
					delete reminderBase[remindTime];
					logFlag = 1;
				}catch(e){console.log(e)}
			}else{
				//break; //things were getting sorted to the end and js wouldn't fix it, so no longer assume its in order sadly
			}
		}
		if(logFlag == 1 || logLater['reminder'])
			logReminders();
		logLater['reminder'] = false;
	}
}, 60000);	
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
async function sendPSEmbed (outputArray, msg, arcanaData, stringMatchesArray, emoteOrder, name, matches) { //async acquires data from PS to build its embed
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
function buildPSEmbed(nameArray, page, searchString, closestCanon, textFlag, imgFlag) { //builds the PS embed
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
function reactLRArrows(msg) { 								//callback that adds the left/right arrow reacts
	msg.react(leftArrow)
		.then(msg.react(rightArrow))
}
function buildCardFetchEmbed(outputArray, arcanaData, mainArcanaName, strings, msg, page) { //writes fetched cards and switcheroo embed
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
function postBigArray (outputArray, channel, callback) { 	//breaks up big arrays into discord-sized messages
	let output = outputArray[0];
	let sendPart = function(output) {
		if(callback) {
			channel.send(output)
				.then(mess => callback(mess))
				.catch(e => console.log(e))
		}else{
			channel.send(output);
		}
	}
	if(outputArray.length == 1){
		postBigRule(output,channel, callback);
		return;
	}
	if(output.length > 1990){
		postBigRule(output,channel, callback);
		output = "";
	}
	for(var i=1;i<outputArray.length;i++) {
		if(outputArray[i].length > 1990) {
			sendPart(output);
			output = "";
			postBigRule(outputArray[i],channel, callback);
		}else{
			let checkLength = output.length + outputArray[i].length;
			if(checkLength > 1950) {
				sendPart(output);
				output = outputArray[i];
			}else{
				output += "\n" + outputArray[i];
			}
			if(i==outputArray.length-1)
				sendPart(output);
		}
	}
}
function arrayifyBigMessage(input) { 						//breaks up big strings into discord-sized messages
	if(input.length < 1990) {
		return [input];
	}
	let outputArray = [];
	let rulSplit = input.split(/\n/i);
	let output = rulSplit[0];
	for(var i=1;i<rulSplit.length;i++) {
		let checkLength = output.length + rulSplit[i].length;
		if(checkLength > 1990){
			outputArray.push(output);
			output = rulSplit[i]
		}else{
			output += "\n" + rulSplit[i]
		}
		if(i==rulSplit.length-1)
			outputArray.push(output);
	}
	return outputArray;
}
function postBigRule(input,channel, callback) { 			//breaks up big strings into discord-sized messages
	let sendPart = function(output) {
		if(callback) {
			channel.send(output)
				.then(mess => callback(mess))
				.catch(e => console.log(e))
		}else{
			channel.send(output);
		}
	}
	if(input.length < 1990) {
		sendPart(input);
		return;
	}
	let rulSplit = input.match(/([\s\S]*?)(\n•[\s\S]*)/);
	let splitCard = rulSplit[1];
	let splitRules = rulSplit[2];
	sendPart(splitCard);
	if(splitRules.length < 1990) {
		sendPart(splitRules);
	}else{
		let resplit = splitRules.match(/(\n•[^\n]*)/g)
		let output = resplit[0];
		for(var i=1;i<resplit.length;i++) {
			let checkLength = output.length + resplit[i].length;
			if(checkLength > 1990){
				sendPart(output);
				output = resplit[i]
			}else{
				output += resplit[i]
			}
			if(i==resplit.length-1)
			sendPart(output);
		}
	}
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
function buildSearchLink(library, searchString) { 			//generates search link from proper site
	let output = "";
	if(library.searchData.site) {
		output += "<" + library.searchData.site;
		//generate the link
		output += encodeURIComponent(searchString);
		output += library.searchData.end + ">";
		output = output.replace(/ /g, "+");
		output = output.replace(/["“”]/g, "%22");
	}
	return output;
}
function buildSearchEmbed(searchString, library, page, imgFlag, textFlag) { //builds $search embeds
	searchString = fuzzy.formatScryfallKeys(searchString);
	let searchLink = buildSearchLink(library, searchString);
	let site = library.searchData.title + " search";
	let database = library.cards;
	let valids = fuzzy.scryDatabase(library, searchString);
	if(valids[1] && library.searchData.title == "Scryfall")
		searchLink = searchLink.replace(">","&unique=prints>");
	let bumpedPage = parseInt(page+1);
	let hits = valids[0].length;
	let count = '1 hit found:';
	if(hits == 0) {
		let nohits = ['LackeyBot detected 0 hits.','This may be because you used a key LackeyBot doesn\'t support or a difference in databases. If this is an error, please tell Cajun.'];
		if(valids[2] == true)
			nohits = ['LackeyBot timed out.','Your search terms were too much for the little guy. Please use the Scryfall link instead.'];
		var embedded = new Discord.MessageEmbed()
			.setDescription("["+site+"]("+searchLink+" '"+searchString+"')")
			.addField(nohits[0], nohits[1])
		return [embedded, hits];
	}
	if(hits > 1)
		count = hits + ' hits found, showing the '+toolbox.ordinalize(bumpedPage)+':'
	if(page == -1) {
		count = count.replace(/found[^\n]+/i, "found. Check the link, or react to preview.")
	}
	if(valids[2] == true)
		count = 'LackeyBot timed out, only partial results will be shown: ' + count;
	if(textFlag) {
		let embedText = "";
		if(valids[2] == true)
			embedText += 'LackeyBot timed out, only partial results will be shown: ';
		embedText += hits + " hits found: " + searchLink;
		if(page != -1)
			embedText += "\n" + library.writeCard(valids[0][page], true);
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('Page ' + bumpedPage + '/' + hits + ". 🔍 for image, ❌ to collapse, 💬 for plaintext.")
			.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')")
		return [[embedText, nullEmbed]]
	}
	//build the embed
	var embedded = new Discord.MessageEmbed()
		.setFooter('Page ' + bumpedPage + '/' + hits + ". 🔍 for image, ❌ to collapse, 💬 for plaintext.")
	if(page != -1) {
		if(imgFlag) {
			embedded.addField(count, database[valids[0][page]].fullName)
			embedded.setImage(printImages([valids[0][page]], library, true))
		}else{
			embedded.addField(count, library.writeCard(valids[0][page], true))
			embedded.setThumbnail(printImages([valids[0][page]], library, true))
		}
		embedded.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')")
	}else{
		embedded.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')\n"+count)
	}
	return [embedded, hits];
}
function generateStats(library, thisSet) { 					//generates $stats messages
	let setInfo;
	if(thisSet == "MSEM" && library == arcana.msem) {
		setInfo = {longname: "MSE Modern", masterpiece: false, msem: true};
	}else{
		setInfo = library.setData[thisSet];
	}
	let statput = `${setInfo.longname} has $SETCARDS cards `
	let mastermatch = thisSet.match(/MPS_/);
	if(mastermatch == null) {
		statput += "($SETRARITY), "
	}else{
		statput += "and "
	}
	statput += "$SETTOKENS tokens, and $SETPROMOS."
	statput += `\nThe set's most common mana cost is $SETCOMMON.\n${setInfo.longname}'s converted mana cost is $SETMANA.\nIf ${setInfo.longname} was animated, it would be a $SETPT $SETTYPE.`
	if(setInfo.hasOwnProperty('Design') && setInfo.Design) {
		statput += `\nSet Design: ${setInfo.Design}`;
	}
	if(setInfo.hasOwnProperty('leadID') && setInfo.leadID) {
		statput += `\nSet Design: ${pullUsername(setInfo.leadID)}`;
	}
	if(setInfo.hasOwnProperty('psSet') && setInfo.psSet) {
		statput += `\nPlanesculptors Page: http://www.planesculptors.net/set/${setInfo.psSet}`;
	}
	if(extras.hasOwnProperty(thisSet))
		statput = extras[thisSet]
	if(setInfo.hasOwnProperty("Link") && setInfo.Link)
		statput += `\nSet Download: <${setInfo.Link}>`;

	let setCardCount = 0;
	let setRareDist = {common:0, uncommon:0, rare:0, "mythic rare":0, bonus:0, "basic land":0, special:0, masterpiece:0, token:0};
	let setManaCost = {};
	let setCMC = 0;
	let setPower = 0;
	let setToughness = 0;
	let setType = {};
	let thisType = "";
	for(var thisCard in library.cards) {
		if(setInfo.hasOwnProperty('msem') || library.cards[thisCard].setID == thisSet || library.cards[thisCard].setID == setInfo.masterpiece || (library.cards[thisCard].setID == "tokens" && library.cards[thisCard].cardID.match(thisSet))) {
			setRareDist[library.cards[thisCard].rarity]++;
			if(library.cards[thisCard].rarity.match(/(common|uncommon|rare|mythic rare|basic land|bonus)/) || mastermatch) {
				setCardCount++;
				let testPow = parseInt(library.cards[thisCard].power);
				if(!isNaN(testPow))
					setPower += testPow;
				if(library.cards[thisCard].hasOwnProperty('power2')){
					testPow = parseInt(library.cards[thisCard].power2);
					if(!isNaN(testPow))
						setPower += testPow;
				}
				testPow = parseInt(library.cards[thisCard].toughness);
				if(!isNaN(testPow))
					setToughness += testPow;
				if(library.cards[thisCard].hasOwnProperty('toughness2')){
					testPow = parseInt(library.cards[thisCard].toughness2);
					if(!isNaN(testPow))
						setToughness += testPow;
				}

				if(library.cards[thisCard].cmc != "")
					setCMC += parseInt(library.cards[thisCard].cmc);
				if(library.cards[thisCard].hasOwnProperty('cmc2') && library.cards[thisCard].cmc2 != "")
					setCMC += parseInt(library.cards[thisCard].cmc2);
				if(library.cards[thisCard].cardType.match(/Creature/)) {
					let thisType = library.cards[thisCard].typeLine.split(" — ")[1];
					if(!setType.hasOwnProperty(thisType)) {
						setType[thisType] = {};
						setType[thisType].count = 0;
					}
					setType[thisType].count++;
				}
				if(library.cards[thisCard].hasOwnProperty('cardType2') && library.cards[thisCard].cardType.match(/Creature/)) {
					let thisType = library.cards[thisCard].typeLine2.split(" — ")[1];
					if(!setType.hasOwnProperty(thisType)) {
						setType[thisType] = {};
						setType[thisType].count = 0;
					}
					setType[thisType].count++;
				}
				if(library.cards[thisCard].manaCost != "") {
					let thisCost = library.cards[thisCard].manaCost;
					if(!setManaCost.hasOwnProperty(thisCost)) {
						setManaCost[thisCost] = {};
						setManaCost[thisCost].count = 0;
					}
					setManaCost[thisCost].count++;
				}
			}
		}
	}
	let bestType = ["",0];
	let bestCost = ["",0];
	for(let type in setType) {
		if(setType[type].count > bestType[1])
			bestType = [type,setType[type].count];
	}
	for(let cost in setManaCost) {
		if(setManaCost[cost].count > bestCost[1])
			bestCost = [cost,setManaCost[cost].count];
	}
	let RarityDist = "";
	if(setRareDist.common > 0)
		RarityDist += setRareDist.common + "C, ";
	if(setRareDist.uncommon > 0)
		RarityDist += setRareDist.uncommon + "U, ";
	if(setRareDist.rare > 0)
		RarityDist += setRareDist.rare + "R";
	if(setRareDist["mythic rare"] > 0)
		RarityDist += ", " + setRareDist["mythic rare"] + "M";
	if(setRareDist["basic land"] > 0)
		RarityDist += ", " + setRareDist["basic land"] + "L";
	if(setRareDist.bonus > 0)
		RarityDist += ", " + setRareDist.bonus + "B";
	let setPromos = setRareDist.special +" promos";
	if(setRareDist.special == 1)
		setPromos = "1 promo";
	if(setRareDist.special == 0)
		setPromos = "no promos";
	let setPT = setPower + "/" + setToughness;
	statput = statput.replace("$SETCARDS",setCardCount);
	statput = statput.replace("$SETRARITY", RarityDist);
	statput = statput.replace("$SETTOKENS", setRareDist.token);
	statput = statput.replace("$SETPROMOS", setPromos);
	statput = statput.replace("$SETCOMMON", bestCost[0]);
	statput = statput.replace("$SETMANA", setCMC);
	statput = statput.replace("$SETPT", setPT);
	statput = statput.replace("$SETTYPE", bestType[0].replace(/ $/,""));
	statput = statput.replace("$SETMASTER", setRareDist.masterpiece);
	statput = statput.replace(", and no promos", "");
	statput = statput.replace(" and 0 tokens", "");
	statput = statput.replace(", 0 tokens", "");
	
	return statput;
}
//Custom Cards
function bribeLackeyBot(cardName,msg){ 						//card-specific bribes for the custom database
	countingCards++;
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i) && thisCard.setID != "BOT") {
		fullCard = cardLink; //replaces the text with a link
		bribes++;
	}
	//append ban notices when applicable
	if(this.legal.preview.includes(thisCard.setID))
		fullCard += "\n*(" + thisCard.fullName + " is not yet in MSEModern and may change before release.)*\n";
	let bans = [{list:this.legal.modernBan, name:"MSEM"}, {list:this.legal.edhBan, name:"MSEDH"}];
	let banMessage = "";
	for(let list in bans) {
		if(bans[list].list.includes(thisCard.fullName) || thisCard.typeLine.match(/Conspiracy/))
			banMessage += bans[list].name + ", ";
	}
	if(banMessage != "") {
		banMessage = banMessage.replace(/, $/, ")__");
		banMessage = "__Banned (" + banMessage;
		if(!fullCard.match(/\n$/))
			fullCard += "\n";
		fullCard += banMessage;
	}
	if(this.legal.masterpiece.includes(thisCard.fullName))
		fullCard += "\n*" + thisCard.fullName + " is Masterpiece only and not legal in MSEModern.*\n";
	if(thisCard.fullName == "LackeyBot")
		fullCard += "\n*LackeyBot is busy doing his job and is not legal in MSEModern.*\n";
	//append rulings when applicable
	if(msg.content.match(/(\$|ϕ)rul/i) && thisCard.setID != "BOT"){
		let ruling = "Can't find anything on that one, boss.\n";
		if(this.oracle.hasOwnProperty(thisCard.fullName)){
			ruling = this.oracle[thisCard.fullName];
		}
		bribes++;
		fullCard += "\n• ";
		fullCard += ruling.replace(/_/g, "•");
		Client.channels.cache.get(config.rulingsChannel).send(thisCard.fullName);
	}
	return fullCard;
};
//Canon Cards
function bribeLackeyCanon(cardName,msg){ 					//card-specific bribes for the canon database
	countingCards++;
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(!|ϕ)ima?ge?/i) || (msg.content.match(/\$canon/i) && msg.content.match(/\$ima?ge?/i))) {
		fullCard = cardLink; //replaces the text with a link
		bribes++;
	}
	let banArray = [];
	let banMessage = "";
	for(let format in this.legal) {
		if(this.legal[format].includes(thisCard.fullName)) {
			if(format == "conspiracy") {
				banArray.push("commander")
				banArray.push("legacy")
				banArray.push("vintage")
			}else if(format != "vintageRest") {
				banArray.push(format);
			}else{
				banMessage += "Restricted (Vintage)";
				if(banArray != "")
					banMessage += ", ";
			}
		}
	}
	if(banArray.length > 0)
		banMessage += "Banned (";
	for(var i = 0; i<banArray.length; i++) {
		banMessage += toolbox.toTitleCase(banArray[i]);
		if(i != banArray.length-1)
			banMessage += ", ";
		if(i == banArray.length-1)
			banMessage += ")";
	}
	if(banMessage != "") {
		if(fullCard == cardLink)
			fullCard += "\n"
		fullCard += "__" + banMessage + "__";
	}
	if(msg.content.match(/(!|ϕ)rul/i)){
		let ruling = "Can't find anything on that one, boss.\n";
		if(this.oracle.hasOwnProperty(thisCard.fullName)){
			ruling = this.oracle[thisCard.fullName];
		}
		bribes++;
		fullCard += "\n• ";
		fullCard += ruling.replace(/_/g, "•");
	}
	return fullCard;
};
//Dev Cards
function bribeLackeyDev(cardName, msg) { 					//card-specific bribes for the project database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\?|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		bribes++;
	}
	return fullCard;
}
function psLinker(cardName) { 								//links from planesculptors
	let thisCard = this.cards[cardName];
	return "http://www.planesculptors.net/upload/" + arcana.devDex.setData[thisCard.setID].psLink + "/" + encodeURIComponent(thisCard.cardName.replace(/[',!\?’“”]/g,"")) + arcana.devDex.setData[thisCard.setID].psSuffix;
}
//Myriad Cards
function bribeLackeyMyriad(cardName, msg) { 				//card-specific bribes for the project database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		bribes++;
	}
	for(let points in this.legal) {
		if(this.legal[points].includes(thisCard.fullName))
			fullCard += "\n__" + thisCard.fullName + " is **" + points + "**.__";
	}
	fullCard = fullCard.replace("\n\n__", "\n__");
	return fullCard;
}
//cstandard
function bribeLackeyCS(cardName, msg) { 					//card-specific bribes for the cajun-standard database
	let thisCard = this.cards[cardName];
	let fullCard = this.writeCard(cardName);
	if(fullCard == mod_magic.writeCardError)
		return fullCard;
	let cardLink = this.printImage(cardName);
	if(msg.content.match(/(\$|ϕ)ima?ge?/i)) {
		fullCard = cardLink; //replaces the text with a link
		bribes++;
	}
	return fullCard;
}
function csLinker(cardName) { 								//links from planesculptors/msem
	let thisCard = this.cards[cardName];
	if(thisCard.hasOwnProperty('prints') && thisCard.prints.includes("L"))
		return `http://mse-modern.com/msem2/images/L/${thisCard.cardID}.jpg`;
	return "http://www.planesculptors.net/upload/" + arcana.cajun_standard.setData[thisCard.setID].psLink + "/" + encodeURIComponent(thisCard.cardName.replace(/[',!\?’“”]/g,"")) + arcana.cajun_standard.setData[thisCard.setID].psSuffix;
}
//Convert databases
function convertCardTo(library, searchString, msg) { 		//TODO using last string in channel
	let card_name = searchCards(library, searchString, msg)
	msg.edit(showCard);
}
//random card
function anyRandom(randBase) {								//gets a random card from the given database
	let cull = 0;
	if(randBase == arcana.msem)
		cull = 1; //don't let it roll LackeyBot
	let cardnames =  Object.keys(randBase.cards)
	let cardCount = cardnames.length;
	cardCount = cardCount - cull;
	let num = Math.floor(Math.random()*cardCount) + cull;
	let rando = cardnames[num];
	return rando;
}

function findExclusive(boolArray) {							//checks array for boolean true, returns [boolean, [indexes of trues]]
	let index1 = boolArray.indexOf(true);
	let index2 = boolArray.lastIndexOf(true);
	if(index1 == -1)
		return [false, [null]];
	if(index1 == index2)
		return [true, [index1]];
	let boolOutput = [];
	for(let bool in boolArray) {
		if(boolArray[bool])
			boolOutput.push(bool);
	}
	return [false, boolOutput];
}
//Bot Management
function editVersions() {									//version control post
	if(botname == "TestBot" || offline)
		return;
	if(reminderData.version === undefined || matchDex.version === undefined || allRoles.version === undefined || gpbase.version === undefined || draft.version === undefined || (devDex.version === undefined && versionCheck.devDex === undefined)){
		readVersionControl();
		if(reminderData.verions === undefined)
			reminderData.versions = versionCheck.remind;
		if(matchDex.verions === undefined)
			matchDex.versions = versionCheck.matchDex;
		if(allRoles.verions === undefined)
			allRoles.versions = versionCheck.allRoles;
		if(gpbase.verions === undefined)
			gpbase.versions = versionCheck.gpbase;
		if(draft.verions === undefined)
			draft.versions = versionCheck.draft;
		if(devDex.verions === undefined)
			devDex.versions = versionCheck.devDex;
		if(reminderData.version === undefined || matchDex.version === undefined || allRoles.version === undefined || gpbase.version === undefined || draft.version === undefined || (devDex.version === undefined && versionCheck.devDex === undefined)){
			Client.users.cache.get(cajun).send("Version control is seriously effed.")
			Client.users.cache.get(cajun).send(JSON.stringify(versionCheck))
			return;
		}
	}
	let newwords = "";
	newwords += "\nremind: " + reminderData.version;
	newwords += "\nmatchDex: " + matchDex.version;
	newwords += "\ndevDex: " + (devDex.version || versionCheck.devDex);
	newwords += "\nroles: " + allRoles.version;
	newwords += "\ngpbase: " + gpbase.version;
	newwords += "\ndraft: " + draft.version;
	editMsg(config.versionControlChannel, config.versionControlPost, newwords);
}
function logStats() {										//updates stats.json
	if(botname == "TestBot")
		return;
	startWriting("stats");
	let statPost = "";
	statPost += "cards: " + countingCards;
	statPost += "\nbribes: " + bribes;
	statPost += "\ndrafts: " + draftStarts;
	statPost += "\npacks: " + crackedPacks;
	statPost += "\nreminder1: " + reminderSet;
	statPost += "\nreminder2: " + reminderDone;
	statPost += "\nexplode: " + explosions;
	if(!countingCards || !bribes || !draftStarts || !crackedPacks || !reminderSet || !reminderDone || !explosions) {
		Client.users.cache.get(cajun).send("stats have nulled");
	}else{
		editMsg(config.versionControlChannel, "747541293219184700", statPost);
	}
	Client.channels.cache.get(login.stats).send(statPost);
	doneWriting("stats");
}
function logInst() {										//updates instdata.json
	if(botname == "TestBot")
		return;
	fs.writeFile('msem/instdata.json', JSON.stringify(instData), (err) => {
		if (err) throw err;
		});
}
function logReminders() {									//updates reminderlist.json
	if(botname == "TestBot")
		return;
	reminderData.version++;
	reminderData.reminders = reminderBase;
	editVersions();
	let words = JSON.stringify(reminderData);
	dropboxUpload('/lackeybot stuff/reminderBase.json', words, function(){doneWriting("reminder")});
	let num = toolbox.rand(0,100);
	fs.writeFile('reminderBase'+num+'.json', words, (err) => {
		if(err)
			throw err;
		Client.channels.cache.get("750873235079430204").send("reminder log", {
			files:[{attachment:'reminderBase'+num+'.json'}]
		})
		.then(mess => fs.unlink('reminderBase'+num+'.json', (err) => {if (err) throw err;}))
		.catch(e => console.log(e))
	});
}
function echoReminders() {									//stop breaking for the love of 
	console.log(JSON.stringify(reminderBase));
}
function logMatch() {										//updates matchDex.json
	if(botname == "TestBot")
		return;
	matchDex.version++;
	editVersions();
	let matchWords = JSON.stringify(matchDex);
	matchWords = matchWords.replace('"version":', '\r\n\t"version":')
	matchWords = matchWords.replace(/\}$/, "\r\n}")
	let tourns = Object.keys(matchDex);
	for(let key in tourns) {
		matchWords = matchWords.replace(',"'+tourns[key]+'":{', ',\r\n\t"'+tourns[key]+'":{\r\n\t\t');
		matchWords = matchWords.replace('],"players":{', '],\r\n\t\t"players":{')
		matchWords = matchWords.replace(',"data":{', ',\r\n\t\t"data":{')
	}
	if(botname == "TestBot") {
		fs.writeFile('msem/matchDex.json', matchWords, (err) => {
			if (err) throw err;
			});
		return;
	}else{
		dropboxUpload('/lackeybot stuff/matchDex.json',matchWords, function(){doneWriting("match")});
	}
}
function logDev(id) {										//updates devDex.json
	console.log("Change to project database by " + pullUsername(id));
	devDex.version++;
	editVersions();
	let partialDex = {};
	partialDex.version = devDex.version;
	partialDex.cards = devDex.cards;
	partialDex.setData = devDex.setData;
	partialDex.devData = devDex.devData;
	if(botname == "TestBot") {
		fs.writeFile('dev/devDex.json', JSON.stringify(partialDex).replace(/},"/g,"},\r\n\""), (err) => {
			if (err) throw err;
			});
		return;
	}
	loadArcanaSettings();
	dropboxUpload('/lackeybot stuff/devDex.json',JSON.stringify(partialDex).replace(/},"/g,"},\r\n\""), function(){doneWriting("dev")});
}
function logRole(guildID) {									//updates roles.json
	allRoles.version++;
	for(let guild in allRoles.guilds)
		if(!allRoles.guilds[guild].hasOwnProperty('excluded'))
			allRoles.guilds[guild].excluded = {};
	editVersions();
	dropboxUpload('/lackeybot stuff/roles.json',JSON.stringify(allRoles, null, 3), function(){doneWriting("role")});
}
function logScratchpad() {									//updates scratchPad.json
	dropboxUpload('/lackeybot stuff/scratchPad.json',JSON.stringify(scratchPad, null, 3), function(){doneWriting("scratchPad")});
}
function startWriting(op) {									//tracks which sensitive operations are occuring
	return writing.push(op);
}
function doneWriting(op) {									//tracks which sensitive operations are occuring
	return writing.splice(writing.indexOf(op), 1);
}
function speech(msg) {										//handles the LackeyBot AI
	let channelMatch = msg.content.match(/channel: ?<?#?([0-9]+)/i);
	let messageMatch = msg.content.match(/message: ?([\s\S]+)/i);
	Client.channels.cache.get(channelMatch[1]).send(messageMatch[1]);
}
function deleteMsg(channel,message) {						//deletes a given LackeyBot post
	Client.channels.cache.get(channel).messages.fetch(message)
		.then(message => message.delete())
		.catch(console.error)
}
function editMsg(channel,message,newwords) {				//edits a given LackeyBot post
	Client.channels.cache.get(channel).messages.fetch(message)
		.then(msg => msg.edit(newwords))
		.catch(console.error);
}
function reactMsg(msg) {									//reacts to a given post
	let reactCheck = msg.content.match(/!react https:\/\/discorda?p?p?.com\/channels\/[0-9]+\/([0-9]+)\/([0-9]+)/i);
	let emotesCheck = msg.content.match(/\n([^ ]+)/g);
	let channel = reactCheck[1];
	let message = reactCheck[2];
	for(var i=0; i<emotesCheck.length;i++) {
		let emote = emotesCheck[i];
		emote = emote.match(/\n([^ ]+)/);
		emote = emote[1];
		if(emote.match(/</)){
			emote = emote.match(/([0-9]+)>/);
			emote = emote[1];
		}
		Client.channels.cache.get(channel).messages.fetch(message)
			.then(message => message.react(emote))
			.catch(console.error);
	}
}
function checkRank(msg) {									//checks the rank of a poster
	let user = msg.author.id;
	let rank = [7]; //general
	if(config.admin.hasOwnProperty(user)) { //admin permissions
		for(let perm in config.admin[user])
			rank.push(config.admin[user][perm]); //0 for admin, 1 for T0, 2 for draft mod, 5 for statDex permissions
	}
	if(organizers.includes(user))
			rank.push(1); //TO permissions
	if(!msg.guild.id) // pms are always open and have no moderators
		return rank;
	let guildID = msg.guild.id;
	if(msg.member.permissions.has("ADMINISTRATOR")){ //server admin
		rank.push(3); //3 for server admin, 4 for server mod
		rank.push(4); 
	}
	if(allRoles.guilds.hasOwnProperty(guildID)) {
		if(!rank.includes(0) && !rank.includes(3) && allRoles.guilds[guildID].banned.includes(user)) { //admins can't be banned
			rank.push(9); //9 for banned
		}
		let modRole = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name === allRoles.guilds[guildID].modRole)
		if(modRole && msg.member.roles.cache.find(val => val.id == modRole.id))
			rank.push(4);
	}
	return rank; 
}

function matchDexTesting() {								//testing matchDex things, currently blank
	for(let player in matchDex.tuc.players) {
		if(matchDex.tuc.players[player].hasOwnProperty('deckObj'))
			delete matchDex.tuc.players[player].deckObj;
	}
}
async function readVersionControl(){						//read versions from Discord
	let vc = await Client.channels.cache.get(config.versionControlChannel).messages.fetch(config.versionControlPost)
	vc = vc.content;
	versionCheck.remind = parseInt(vc.match(/remind: (\d+)/)[1]);
	versionCheck.matchDex = parseInt(vc.match(/matchDex: (\d+)/)[1]);
	versionCheck.devDex = parseInt(vc.match(/devDex: (\d+)/)[1]);
	versionCheck.roles = parseInt(vc.match(/roles: (\d+)/)[1]);
	versionCheck.gpbase = parseInt(vc.match(/gpbase: (\d+)/)[1]);
	versionCheck.draft = parseInt(vc.match(/draft: (\d+)/)[1]);
	return "Done";
}
async function startUpFunctions() {							//all the start up functions for nicer async
	let mun = Math.floor(Math.random()*extras.games.length); //sets a random game
	let newGame = extras.games[mun];
	Client.user.setPresence( { activity: {name: newGame}});
	
	//check versions
	try {
		let wait = await readVersionControl();
	}catch(e){
		console.log(e);
		Client.users.cache.get(cajun).send("Version control has failed.");
	}
	//dropboxDownload('stats/stats.json','https://www.dropbox.com/s/nug4q26u6ft44mp/stats.json?dl=0',reloadStats);
	//reportGuilds();
	reloadStats();
	dropboxDownload('roles.json','https://www.dropbox.com/s/94ltqp66mmo1ko0/roles.json?dl=0',reloadRoles);
	dropboxDownload('reminderBase.json','https://www.dropbox.com/s/p69q3kvmfu2lvj2/reminderBase.json?dl=0',reloadRemind);
	/*Client.channels.cache.get("750873235079430204").messages.fetch({limit:1}) //reminderfix
		.then(function(messages) {
			let msgarray = messages.array();
			if(msgarray[0]) {
				let attachURL = msgarray[0].attachments.array()[0].url;
				downloadReminders(attachURL);
			}else{
				console.log("aaaaaaaaaaaaaaaa");
			}
		})
		.catch(console.error);
	*/
	if(botname == "TestBot") {
		dropboxDownload('matchTest.json','https://www.dropbox.com/s/3rn1zu8qly0z52o/matchDex.json?dl=0',reloadMatchBase);
	}else{
		dropboxDownload('msem/matchDex.json','https://www.dropbox.com/s/3rn1zu8qly0z52o/matchDex.json?dl=0',reloadMatchBase);
	}
	//dropboxDownload('dev/devDex.json','https://www.dropbox.com/s/hzcb14qeovfin3e/devDex.json?dl=0',reloadDevDex, true);
	dropboxDownload('msem/gpbase.json','https://www.dropbox.com/s/t9hdhad8ol1c7cu/gpbase.json?dl=0',reloadGPBase)
	dropboxDownload('draft/draft.json','https://www.dropbox.com/s/i91wp73lshtorir/draft.json?dl=0',reloadDraft);
	dropboxDownload('dev/devDex.json','/lackeybot stuff/devDex.json',reloadDevDex, true);
	dropboxDownload('scratchPad.json','/lackeybot stuff/scratchPad.json',reloadScratchpad);
	try{
		Client.channels.cache.get(config.signinChannel).send(botname+" has connected.");
	}catch(e){
		console.log("HQ server disconnected. " + botname + " has connected.");
	}
}
function downloadReminders(attachURL) {						//downloads reminderBase after Dropbox betrayed us
	download(attachURL, {directory:"./", filename:"reminderBase.json"}, function(err) {
		if(err) {
			Client.users.cache.get(cajun).send("reminderBase failed to reload.");
		}else{
			reloadRemind(attachURL);
		}
	});
}
function reloadDraft() {									//loads draft after downloading
	console.log('Reloading draft');
	let test = require('./draft/draft.json');
	if(test.version < versionCheck.draft)
	console.log("Version error in draft.");
	draft = test;
}
function reloadGPBase() {									//loads gpbase after downloading
	console.log('Reloading gpbase');
	let test = require("./msem/gpbase.json");
	if(test.version < versionCheck.gpbase)
	console.log("Version error in gpbase.");
	gpbase = test;
}
function reloadRemind(attachURL) {							//loads reminderBase after downloading
	console.log('Reloading reminderBase');
	setTimeout(function(){ //won't stop firing early, try/catch isn't helping, time for aggressive measures
		try{
			let test = require("./reminderBase.json");
			let list = Object.keys(test.reminders);
			if(test.version < versionCheck.remind)
				throw "Version error in reminders.";
			reminderData = test;
			reminderBase = reminderData.reminders;
		}catch(e){ //firing before it's supposed to? 
			console.log(e);
			downloadLoop.reminderBase++
			console.log("reminderBase download failed, reattempt " + downloadLoop.reminderBase);
			if(downloadLoop.reminderBase < 5){
					//dropboxDownload('reminderBase.json','https://www.dropbox.com/s/p69q3kvmfu2lvj2/reminderBase.json?dl=0',reloadRemind);
					downloadReminders(attachURL);
			}else{
				Client.users.cache.get(cajun).send("reminderBase failed to reload.");
			}
		}
	},500*(2*downloadLoop.reminderBase));
}
function reloadMatchBase() {								//loads matchdex after downloading
	console.log('Reloading matchDex');
	let test;
	if(botname == "TestBot") {
		test = require("./matchTest.json");
	}else{
		test = require("./msem/matchDex.json");
	}
	if(test.version < versionCheck.matchDex)
	console.log("Version error in matchDex.");
	matchDex = test;
	let matchString = '(';
	let tempReges = [];
	tournamentChannels = [];
	for(let tourney in matchDex) {
		if(tourney != "version") {
			if(!matchDex[tourney].data.submitRegex) {
				if(tourney == "gp")
					matchDex[tourney].data.submitRegex = "gpm?";
				if(tourney == "league")
					matchDex[tourney].data.submitRegex = "league";
				if(tourney == "cnm")
					matchDex[tourney].data.submitRegex = "cnm|cmn";
				if(tourney == "sealed")
					matchDex[tourney].data.submitRegex = "sealed";
				if(tourney == "tuc")
					matchDex[tourney].data.submitRegex = "tuc";
				if(tourney == "primordial")
					matchDex[tourney].data.submitRegex = "primordial [A-Z0-9_]+";
			}
			matchString += tourney + '|'
			if(!organizers.includes(matchDex[tourney].data.TO))
				organizers.push(matchDex[tourney].data.TO)
			if(!tournamentChannels.includes(matchDex[tourney].data.channel)) {
				tournamentChannels.push(matchDex[tourney].data.channel)
			}else{
				Client.users.cache.get(cajun).send(`Duplicated match channel at ${tourney}.`)
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
	matchDexTesting();
}
function reloadDevDex() {									//loads matchdex after downloading
	console.log('Reloading devDex');
	try{
		let test = require("./dev/devDex.json");		
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
		loadArcanaSettings();
	}catch(e){ //firing before it's supposed to? 
		console.log(e)
		downloadLoop.devDex++
		console.log("devDex download failed, reattempt " + downloadLoop.devDex);
		if(botname != "TestBot" && !offline && downloadLoop.devDex < 5){
			//https://www.dropbox.com/s/hzcb14qeovfin3e/devDex.json?dl=0
			dropboxDownload('dev/devDex.json','/lackeybot stuff/devDex.json',reloadDevDex, true)
		}else{
			Client.users.cache.get(cajun).send("devDex failed to reload.");
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
				loadArcanaSettings();
			}catch(e){}
		}
	}
}
function reloadRoles() {									//loads roles and roleRegex after downloading
	console.log('Reloading roles');
	let test = require("./roles.json");
	if(test.version < versionCheck.roles)
	console.log("Version error in roles.");
	allRoles = test;
	roleCall = allRoles.guilds;
	fightGuilds = allRoles.fightGuilds;
	roleRegex = buildRoleRegex();
}
function reloadScratchpad() {
	console.log('Reloading scratchPad');
	scratchPad = require('./scratchPad.json');
}
async function reloadStats() {								//loads stats after downloading
	console.log('Reloading stats');
	/*let test = require("./stats/stats.json");
	if(test.version < versionCheck.stats)
	console.log("Version error in stats.");
	stats = test;
	*/
	stats = {cardCount:0, bribes:0, drafts:0, packs:0, reminderSet:0, reminderDone:0, explosions:0}
	try {
		let sp = await Client.channels.cache.get(config.versionControlChannel).messages.fetch("747541293219184700")
		sp = sp.content;
		stats.cardCount = parseInt(sp.match(/cards: (\d+)/)[1]);
		stats.bribes = parseInt(sp.match(/bribes: (\d+)/)[1]);
		stats.drafts = parseInt(sp.match(/drafts: (\d+)/)[1]);
		stats.packs = parseInt(sp.match(/packs: (\d+)/)[1]);
		stats.reminderSet = parseInt(sp.match(/reminder1: (\d+)/)[1]);
		stats.reminderDone = parseInt(sp.match(/reminder2: (\d+)/)[1]);
		stats.explosions = parseInt(sp.match(/explode: (\d+)/)[1]);
	}catch(e){
		console.log(e)
		Client.users.cache.get(cajun).send("Stats version control has failed.");
	}
	countingCards = stats.cardCount;
	explosions = stats.explosions;
	bribes = stats.bribes;
	draftStarts = stats.drafts;
	crackedPacks = stats.packs;
	reminderSet = stats.reminderSet;
	reminderDone = stats.reminderDone;
	stats.dailyPrompt = "Pact";
}
function loadArcanaSettings() {								//loads the arcana settings for the card databases
	arcanaSettings = {
		defaults: {
			square: {
				data: arcana.msem,
				prefix: "\\$",
				emote: dollarEmote,
			},
			angle: {
				data: arcana.magic,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"205457071380889601": { //CM server
			square: {
				data: {cards:psScrape.psCache, name:"ps", bigname:"Planesculptors"},
				prefix: "\\$",
				emote: dollarEmote,
			},
			angle: {
				data: arcana.magic,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"671072859149566003": { //Custom Labs server
			square: {
				data: null,
				prefix: null,
				emote: null,
			},
			angle: {
				data: arcana.magic,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"413055835179057173": { //Primordial server
			square: {
				data: null,
				prefix: null,
				emote: null,
			},
			angle: {
				data: null,
				prefix: null,
				emote: null,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"584406357017493504": { //Beacon of Creation server
			square: {
				data: null,
				prefix: null,
				emote: null,
			},
			angle: {
				data: null,
				prefix: null,
				emote: null,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"481200347189084170": { //Custard server
			square: {
				data: null,
				prefix: null,
				emote: null,
			},
			angle: {
				data: arcana.magic,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"643349514203168779": { //Myriad server
			square: {
				data: arcana.myriad,
				prefix: "\\$",
				emote: dollarEmote,
			},
			angle: {
				data: arcana.magic,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"733313820499640322": { //NN server
			square: {
				data: null,
				prefix: null,
				emote: null,
			},
			angle: {
				data: arcana.msem,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		},
		"190309853296590848": { //test server
			square: {
				data: arcana.msem,
				prefix: "\\$",
				emote: dollarEmote,
			},
			angle: {
				data: arcana.magic,
				prefix: "!",
				emote: excEmote,
			},
			curly: {
				data: arcana.devDex,
				prefix: "\\?",
				emote: quesEmote,
			}
		}
	}
}
function reloadData() {										//loads all the other .jsons on startup
	//arttemp = require("./msem/arttemp.json");
	arcana.msem.formatBribes = bribeLackeyBot;
	cards = arcana.msem.cards;
	legal = arcana.msem.legal;
	oracle = arcana.msem.oracle;
	msemSetData = arcana.msem.setData;

	canon = arcana.magic.cards;
	canonOracle = arcana.magic.oracle;
	magicSetData = arcana.magic.setData;
	arcana.magic.formatBribes = bribeLackeyCanon;

	arcana.myriad.formatBribes = bribeLackeyMyriad;
	arcana.cajun_standard.formatBribes = bribeLackeyCS;
	arcana.cajun_standard.printImage = csLinker;
	
	allpacks = require("./draft/allpacks.json");
	
	creatureTypeArray = require('./canon/creatureTypesArray.json');
	extras = require("./msem/extras.json");
	instData = require("./msem/instdata.json");
	mechanics = require("./msem/mechs.json");
	nicks = require("./nicks.json");
	prompts = require("./prompts.json");
	ruleJson = require("./canon/cr.json");
	sms = require("./sms.json");
	sms = shuffleArray(sms);
	smsbackup = require("./sms.json");
	scryRegex = fuzzy.scryRegex;
	packInfo = require('./packbuddy.json');
	//statDex = require('./statDex.json');
	clearEmbedCache();
}

//server/user stuff
function pullRoles(guildID) {								//grabs list of roles of a server
	let theRoles = Client.guilds.cache.find(val => val.id == guildID).roles.array();
	for(let role in theRoles) {
		if(!allRoles.guilds[guildID].roles.hasOwnProperty(theRoles[role].name))
			console.log(theRoles[role].name)
	}
}
function nameGuilds() {										//grabs list of servers LB is on
	let theGuilds = Client.guilds.array();
	for(let guild in theGuilds)
		console.log(theGuilds[guild].name);
}
function buildUserEmbed(guildID, userID, textFlag, avLink) {//$userinfo
	let user = Client.guilds.cache.find(val => val.id == guildID).members.cache.find(val => val.id == userID);
	if(textFlag) {
		let servDate = new Date(user.joinedTimestamp);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let discDate = new Date(user.user.createdTimestamp);
		let discDateFull = `${discDate.getFullYear()}/${discDate.getMonth()+1}/${discDate.getDate()} ${discDate.getHours()}:${toolbox.fillLength(discDate.getMinutes(), 2, "0")}`;
		let output = "__Name:__ " + "**" + user.user.username + "**#" + user.user.discriminator;
		output += "\n__Nickname:__ " + (user.nickname != null ? user.nickname:user.user.username);
		output += "\n__ID:__ " + user.id;
		output += "\n__Roles:__ " + user.roles.cache.array().length-1;
		output += "\n__Joined server:__ " + servDateFull;
		output += "\n__Joined Discord:__ " + discDateFull;
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('$userinfoplain for plaintext.')
			.setColor(user.roles.cache.find(val => val.color != 0).color)
		if(avLink)
			nullEmbed.setThumbnail(avLink);
		let color = user.roles.cache.find(val => val.color != 0)
		if(color)
			userEmbed.setColor(color.color)
		return [output, nullEmbed]
	}else{
		let avLink = user.user.avatarURL({format: 'png', dynamic: true})
		let servDate = new Date(user.joinedTimestamp);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let discDate = new Date(user.user.createdTimestamp);
		let discDateFull = `${discDate.getFullYear()}/${discDate.getMonth()+1}/${discDate.getDate()} ${discDate.getHours()}:${toolbox.fillLength(discDate.getMinutes(), 2, "0")}`;
		let userEmbed = new Discord.MessageEmbed()
			.addField('Name', "**" + user.user.username + "**#" + user.user.discriminator, true)
			.addField('Nickname', (user.nickname != null ? user.nickname:user.user.username), true)
			.addField('ID', user.id, true)
			.addField('Roles', user.roles.cache.array().length-1, true)
			.addField('Joined server', servDateFull, true)
			.addField('Joined Discord', discDateFull, true)
			.setThumbnail(avLink)
			.setFooter('$userinfoplain for plaintext.')
		let color = user.roles.cache.find(val => val.color != 0)
		if(color)
			userEmbed.setColor(color.color)
		return userEmbed;
	}
}
function buildServerEmbed(server, textFlag, avLink) {		//$serverinfo
	if(textFlag) {
		let servDate = new Date(server.createdAt);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let user = server.members.cache.find(val => val.id == server.ownerID).user;
		let output = "**" + server.name + "**";
		output += "\n__ID:__ " + server.id;
		output += "\n__Owner:__ " + "**" + user.username + "**#" + user.discriminator;
		output += "\n__Members:__ " + server.memberCount;
		output += "\n__Text channels:__ " + server.channels.cache.filter(val => val.type == "text").array().length;
		output += "\n__Voice channels:__ " + server.channels.cache.filter(val => val.type == "voice").array().length;
		output += "\n__Created:__ " + servDateFull;
		output += "\n__Region:__ " + server.region;
		output += "\n__Roles:__ " + server.roles.cache.array().length;
		output += "\n__Emojis:__ " + server.emojis.cache.array().length;
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('$serverinfoplain for plaintext.')
		if(avLink)
			nullEmbed.setThumbnail(avLink);
		return [output, nullEmbed];
	}else{
		let avLink = server.iconURL({format: 'png', dynamic: true})
		let servDate = new Date(server.createdAt);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let user = server.members.cache.find(val => val.id == server.ownerID).user;
		let emoteLine = "";
		let serverEmbed = new Discord.MessageEmbed()
			.setTitle(server.name)
			.addField('ID', server.id, true)
			.addField('Owner', "**" + user.username + "**#" + user.discriminator, true)
			.addField('Members', server.memberCount, true)
			.addField('Text channels', server.channels.cache.filter(val => val.type == "text").array().length, true)
			.addField('Voice channels', server.channels.cache.filter(val => val.type == "voice").array().length, true)
			.addField('Created', servDateFull, true)
			.addField('Region', server.region, true)
			.addField('Roles', server.roles.cache.array().length, true)
			.addField('Emojis', server.emojis.cache.array().length, true)
			.setThumbnail(avLink)
			.setFooter('$serverinfoplain for plaintext.')
		return serverEmbed;
	}
}
function postAvatar(msg, otherid) {							//$avatar
	let id = msg.author.id;
	let avid = msg.author.avatar;
	if(otherid) {
		let user = Client.users.cache.get(otherid);
		id = user.id;
		avid = user.avatar;
	}
	let attachURL = `https://cdn.discordapp.com/avatars/${id}/${avid}.gif`
	download(attachURL, {directory:"./examples/", filename:"avatar.gif"}, function(err) {
		if(err) {
			msg.channel.send(attachURL.replace(".gif", ".png"));
		}else{
			msg.channel.send(attachURL);
		}
	});
}
function postEmote(msg, emoteSnag, bigFlag) {				//$emote and $bigemote
	let bigCheck = emoteSnag.match(/<:[^:]+:[0-9]+>/)
	if(bigCheck)
		bigFlag = true;
	emoteSnag = emoteSnag.match(/(^|:[^:]+:|<)([0-9]+)/)[2];
	let emoteStuff = Client.emojis.cache.array().find(val => val.id == emoteSnag);
	
	if(!bigFlag && emoteStuff) {
		msg.channel.send(`<:${emoteStuff.name}:${emoteStuff.id}>`)
	}else{
		let attachURL = `https://cdn.discordapp.com/emojis/${emoteSnag}.gif`;
		download(attachURL, {directory:"./examples/", filename:"emote.gif"}, function(err) {
			if(err) {
				msg.channel.send(attachURL.replace(".gif", ".png"));
			}else{
				msg.channel.send(attachURL);
			}
		});
	}
}
function generateHangman (diff) {							//generate canon hangman
	let cardNames = Object.keys(canon);
	let rando = Math.floor(Math.random()*cardNames.length-1)+1;
	//rando = 5439; //Man-o'-war for debugging purposes
	let chosenName = cardNames[rando];
	let card = canon[chosenName];
	chosenName = card.cardName;
	chosenName = chosenName.replace(/_[^\n]+/g, "");
	let nameMatch = new RegExp('guess: ' + chosenName, 'i')
	let blankName = chosenName.toLowerCase();
	let count = 0;
	for(let letter in azArray) {
		if(blankName.match(azArray[letter])) {
			count++;
			let letterReg = new RegExp (azArray[letter], 'ig')
			blankName = blankName.replace(letterReg, blank)
		}
	}
	if(!diff)
		diff = "medium";
	diff = diff.toLowerCase();
	let medMana = "";
	let ezType = "";
	if(diff != "hard")
		medMana = "  " + mod_magic.symbolize(card.manaCost)
	if(diff == "easy")
		ezType = "\n" + card.typeLine;
	let hangText = "Guess the card:\n" + blankName + medMana + ezType + "\n```" + rando + "\n";
	hangText += "   ____    \n"; 
	hangText += "  |    |    Missing: " + count + " letter(s)\n";
	hangText += "  |         Guessed: -\n";
	hangText += "  |         Correct: -%\n";
	hangText += "  |         \n";
	hangText += " _|_______";
	hangText += "```";
	hangText += "\nReact with 🇦 🇧 ... 🇿 to guess letters.";
	hangText += "\nOr guess an answer with `guess: Card Name`.";
	let embedded = new Discord.MessageEmbed()
		.setDescription(hangText)
		.setFooter("Game in progress. React with 💬 to change to plaintext mode.")
		.setColor('000001')
	if(diff == "easy")
		embedded.setColor('000000')
	if(diff == "hard")
		embedded.setColor('000002')
	return embedded;
}
function hangmanCallback (msg, channel) {					//sets up hangman collector for name guesses
	msg.react(plainText)
	const collFilter = m => m.content.match(/guess:/i)
	const collector = channel.createMessageCollector(collFilter, {time:5*60*1000});
	collector.on('collect', m => {
		hangmanParser(msg, msg.embeds[0], null, msg.content != "", m.content, collector);
	});
	/*collector.on('end', collected => {
		console.log(`Collected ${collected.size}`);
	});*/

}
function hangmanParser(msg, embedData, emittedEmote, textFlag, guess, collector){ //translates guess or react into hangman data
	let hangText = msg.content;
	if(hangText == "")
		hangText = embedData.description
	let guessedLetters = hangText.match(/Guessed: ([A-Z]+)/);
	if(guessedLetters) {
		guessedLetters = guessedLetters[1].match(/([A-Z])/g);
	}else{
		guessedLetters = [];
	}
	let newLetter = "";
	let update = false;
	if(emittedEmote) { //reaction
		var azIndex = azEmoteArray.indexOf(emittedEmote);
		if(azIndex != -1) { //letter react
			newLetter = azArray[azIndex].toUpperCase();
			if(!guessedLetters.includes(newLetter)) {
				guessedLetters.push(newLetter);
				update = true;
			}
		}else if(textFlag) { //convert to plaintext
			let diff = "medium"
			if(embedData.color == 0)
				diff = "easy";
			if(embedData.color == 2)
				diff = "hard";
			let embedded = updateHangman(hangText, "", guessedLetters, diff, textFlag, guess, msg, collector)
			msg.edit(embedded[0], embedded[1])
		}
	}
	if(update || guess) {
		let diff = "medium"
		if(embedData.color == 0)
			diff = "easy";
		if(embedData.color == 2)
			diff = "hard";
		let embedded = updateHangman(hangText, newLetter, guessedLetters, diff, textFlag, guess, msg, collector)
		if(textFlag) {
			msg.edit(embedded[0], embedded[1])
		}else{
			msg.edit("", embedded);
		}
	}
}
function updateHangman (hangMan, newLetter, guessedLetters, diff, textFlag, guess, msg, collector) { //update canon hangman
	let gameOver = 0;
	let count = parseInt(hangMan.match(/Missing: ([0-9]+)/)[1]);
	let misses = 0;
	let guessedRight = 0;
	let rando = hangMan.match(/```([^\n]+)/)[1];
	let cardList = Object.keys(canon);
	let cardName = cardList[rando]
	let card = canon[cardName];
	let chosenName = fuzzy.anglicizeLetters(card.cardName);
	if(!diff)
		diff = "medium";
	let medMana = "";
	let ezType = "";
	if(diff != "hard")
		medMana = "  " + mod_magic.symbolize(card.manaCost)
	if(diff == "easy")
		ezType = "\n" + card.typeLine;
	let blankName = "";
	
	let guessString = guessedLetters.join('');
	let missedCards = hangMan.match(/Guessed cards:\n([^`]+)```/i);
	if(missedCards)
		missedCards = missedCards[1].match(/([^\n`]+)/g);
	if(missedCards == null)
		missedCards = [];
	if(newLetter != "") {
		let counReg = new RegExp(newLetter, 'i')
		if(chosenName.match(counReg))
			count--;
	}else{ //guessed name
		let collMatch = new RegExp('guess: ?'+chosenName, 'i');
		if(guess.match(collMatch)) { //they got it right
			count = 0;
			guessedRight = 1;
			collector.stop();
		}else{ //they guessed wrong
			missedCards.push(guess.replace(/guess: ?/i, ""));
		}
	}
	if(count == 0)
		gameOver = 2;
	for(let letter in guessedLetters) {
		let letReg = new RegExp(guessedLetters[letter], 'i');
		if(!chosenName.match(letReg))
			misses++;
	}
	for(let card in missedCards)
		misses++;
	let correctPer = parseFloat((1 - misses / (guessedLetters.length+missedCards.length+guessedRight))*100).toFixed(0);
	let headText = (misses > 0 ? "o" : " ");
	let bodText = (misses > 1 ? "|" : " ");
	let lArmText = (misses > 2 ? "/" : " ");
	let rArmText = (misses > 3 ? "\\" : " ");
	let lLegText = (misses > 4 ? "/" : " ");
	let rLegText = (misses > 5 ? "\\" : " ");
	if(misses > 5)
		gameOver = 1;
	if(gameOver > 0) {
		blankName = chosenName;
	}else{
		for(let i = 0; i < chosenName.length; i++) {
			let thisLetter = chosenName.charAt(i).toUpperCase();
			if(guessedLetters.includes(thisLetter)) {
				blankName += chosenName.charAt(i);
			}else if(azArray.includes(thisLetter.toLowerCase())) {
				blankName += blank;
			}else{
				blankName += chosenName.charAt(i);
			}
		}
	}
	chosenName = fuzzy.anglicizeLetters(chosenName.replace(/[’'"\(\)\/\-,]/g, "").replace(/ /g, "_"));
	let hangText = "Guess the card:\n" + blankName + medMana + ezType + "\n```" + rando + "\n";
	hangText += "   ____    \n"; 
	hangText += "  |    |    Missing: " + count + " letter(s)\n";
	hangText += "  |    " + headText + "    Guessed: " + guessString + "\n";
	hangText += "  |   " + lArmText + bodText + rArmText + "   Correct: " + correctPer + "%\n";
	hangText += "  |   " + lLegText + " " + rLegText + "   \n";
	hangText += " _|_______";
	if(missedCards) {
		hangText += "\nGuessed cards:\n";
		for(let card in missedCards){
			hangText += missedCards[card] + "\n";
		}
	}
	hangText += "```";
	hangText += "\nReact with 🇦 🇧 ... 🇿 to guess letters.";
	hangText += "\nOr guess an answer with `guess: Card Name`.";
	if(textFlag) {
		let embedText = "";
		embedText += hangText;
		let nullEmbed = new Discord.MessageEmbed()
			.setDescription("Hangman is in plaintext mode.")
			.setFooter("Game in progress.")
		if(diff == "easy")
			nullEmbed.setColor('000000')
		if(diff == "hard")
			nullEmbed.setColor('000002')
		if(gameOver == 1) {
			embedText += "\nGame over! You didn't guess the card!";
			nullEmbed.setImage(arcana.magic.printImage(cardName, true));
			nullEmbed.setColor('ff0000');
		}
		if(gameOver == 2) {
			embedText += "\nGame over! You guessed the card!";
			nullEmbed.setImage(printImages([cardName], arcana.magic, true));
			nullEmbed.setColor('00ff44');
		}
		return[embedText, nullEmbed];
	}
	let embedded = new Discord.MessageEmbed()
		.setDescription(hangText)
		.setFooter("Game in progress. React with 💬 to change to plaintext mode.")
	if(diff == "easy")
		embedded.setColor('000000')
	if(diff == "hard")
		embedded.setColor('000002')
	if(gameOver == 1) {
		embedded.setFooter("Game over! You didn't guess the card.");
		embedded.setImage(printImages([cardName], arcana.magic, true));
		embedded.setColor('ff0000');
	}
	if(gameOver == 2) {
		embedded.setFooter("Game over! You guessed the card.");
		embedded.setImage(printImages([cardName], arcana.magic, true));
		embedded.setColor('00ff44');
	}
	return embedded;
}
//price scripts
function scryCard(cardName) { 								//get scryfall data for a card
	let cardStuff = arcana.magic.cards[cardName];
	let testurl = "https://api.scryfall.com/cards/" + cardStuff.scryID;
	let requestPromise;
	requestPromise = new Promise((resolve, reject) => {
		rp({url: testurl, json: true}).then(body => {
			resolve(body);
		}, () => {
			console.log('Falling back to fuzzy search for '+cardName);
			rp({url: testurl, json: true})
				.then(response => resolve({data: [response]}), reject);
		});
	});
	return requestPromise;
}
async function priceCanon (name) {							//get the price data
	//name = "Fold into Aether_5DN";
	let priceStuff = '';
	let callback = function (data) {
		priceStuff = data.prices;
	}
	let beep = scryCard(name)
		.then(data => callback(data))
		.catch(e => console.log(e))
	let pricewait = await beep;
	return priceStuff;
}
async function asyncPriceData (cardName, page) {			//convert price to string
	if(embedStash.prices.hasOwnProperty(cardName)) {
		buildPriceEmbed(cardName, page)
	}else{
		let priceObj = await priceCanon(cardName); //"usd":"0.19","usd_foil":"1.12","eur":"0.05","tix":"0.03"
		let priceString = "";
		if(priceObj.usd != null) {
			priceString += "$" + priceObj.usd;
			if(priceObj.usd_foil != null)
				priceString += " ($" + priceObj.usd_foil + " Foil)"
			priceString += " | "
		}
		if(priceObj.eur != null)
			priceString += priceObj.eur + "€ | "
		if(priceObj.tix != null)
			priceString +=	priceObj.tix + " Tix";
		priceString = priceString.replace(" | | ", " | ")
		priceString = priceString.replace(/ \| $/, "")
		return priceString;
	}
}
function priceCard (test, prints) {							//testing msem price engine
	let card = arcana.msem.cards[searchCards(arcana.msem, test)];
	let base = packInfo.bases[card.rarity];
	let prm = 1;
	let prmc = 1;
	let wr = 0.3;
	statDex = require('./statDex.json');;
	if(statDex.cards.hasOwnProperty(card.fullName) && !card.typeLine.match("Basic")) {
		let stats = statDex.cards[card.fullName];
		prmc = stats.mainCount + stats.sideCount;
		prm = Math.max(1.5,(-0.0001*Math.pow(prmc, 2)) + (0.087*prmc) + 1.25);
		if(card.rarity == "common")
			prm = Math.min(2, prm);
		if(card.rarity == "uncommon")
			prm = Math.min(3.5, prm);
		if(card.rarity == "rare")
			prm = Math.min(4.5, prm);
		if(card.setID != "101") {
			if(prmc > 4)
				base = packInfo.lightbases[card.rarity];
			if(prmc > 29)
				base = packInfo.modbases[card.rarity];
			if(prmc > 60)
				base = packInfo.heavybases[card.rarity];
		}
		
		wr = stats.matchWins / (stats.matchWins + stats.matchLoss);
	}
	let wrm = Math.pow((wr + 0.7), 3);
	//let wrm = Math.pow((2.3*wr), 2);
	if(wrm == 0)
		wrm = 0.3;
	wrm = Math.min(wrm, 0.0064*prmc + 1.625)
	let spm = packInfo.counts.Standard / packInfo.counts[card.setID];
	let masterArray = ["MS1","MS2"];
	if(masterArray.includes(card.setID))
		spm = spm*2;
	spm = Math.min(30, spm);
	let rpm = 1 / Math.sqrt(prints.length);

	let price = base * wrm * prm * spm * rpm;
	let show = true;
	if(show) {
		console.log(test)
		console.log(price);
		console.log("base: " + base);
		console.log("wrm: " + wrm);
		console.log("prm: " + prm);
		console.log("spm: " + spm);
		console.log("rpm: " + rpm);
	}
	if(legal.modernBan.includes(card.fullName))
		price = 0.1 * price;
	return price;
}
function priceCustom(test) {								//testing msem price engine
	let card = arcana.msem.cards[searchCards(arcana.msem, test)];
	//let prints = mod_magic.findReprints(card.fullName, card.setID, arcana.msem.cards);
	let thisPrice = 0;
	let cheapest = [9999999]
	for(let print in prints) {
		let price = priceCard(card.fullName + "_" + prints[print], prints);
		if(price < cheapest[0])
			cheapest[0] = price;
		if(prints[print] == card.setID)
			thisPrice = price;
	}
	let priceHack = cheapest[0] / thisPrice;
	let oldMulti = 1.4
	let rpm2 = Math.max(0.2, oldMulti*priceHack);
	if(rpm2 == oldMulti)
		rpm2 = 1;
	thisPrice = thisPrice * rpm2;
	thisPrice = parseFloat(thisPrice).toFixed(2);
	return thisPrice;
}
//Misc Embeds
function buildSetsEmbed (library, page, textFlag) {	//build $codes embed
	let helpout = "";
	let desc = library.bigname + " Set Codes";
	let setsDatabase = library.setData;
	let setCount = 0;
	for(let thisSet in setsDatabase) {
		helpout += "**" + thisSet + "**: " + setsDatabase[thisSet].longname + "\n";
		setCount++;
	}
	let lines = helpout.split('\n');
	if(textFlag) {
		let start = 0 + 20*page;
		let end = Math.min(lines.length, start+20);
		let pages = Math.ceil(lines.length / 20)
		let output = desc + ":";
		for(let i=start;i<end;i++) {
			output += "\n" + lines[i];
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setDescription('**' + desc + '**')
			.setFooter('Page ' + parseInt(page+1) + '/' + pages)
			return [[output, nullEmbed]];
	}
	let inlines = [[],[],[]]
	let thirds = Math.ceil(Math.min(60,lines.length) / 3);
	let start = 0 + 60*page;
	let end = start + thirds;
	let pages = Math.ceil(lines.length / 60)
	for(let i=start; i<end; i++) {
		let first = i;
		let second = i+thirds;
		let third = i+thirds+thirds;
		if(third >= lines.length)
			third = null;
		if(lines[first])
			inlines[0].push(lines[first])
		if(lines[second])
			inlines[1].push(lines[second])
		if(lines[third])
			inlines[2].push(lines[third])
	}
	end = Math.min(setCount, end);
	let embedded = new Discord.MessageEmbed()
		.setDescription('**' + desc + '**')
		.setFooter('Page ' + parseInt(page+1) + '/' + pages)
	if(inlines[0].length > 0 && inlines[0][0] != "")
		embedded.addField('Codes ' + parseInt(1+start) + '-' + end + ":", inlines[0], true)
	if(inlines[1].length > 0 && inlines[1][0] != "")
		embedded.addField('Codes ' + parseInt(start+thirds+1) + "-" + parseInt(start+2*thirds) + ":", inlines[1], true)
	if(inlines[2].length > 0 && inlines[2][0] != "")
		embedded.addField('Codes ' + parseInt(start+2*thirds+1) + "-" + parseInt(Math.min(start+3*thirds, lines.length)) + ":", inlines[2], true)
	let reportPages = Math.ceil(lines.length / 20); //set the arrows in case of plaintexting
	return [embedded, reportPages];
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
function buildPatchEmbed(textFlag, thisPage) {				//builds the embed for MSEM patches
	let linksArray = [
		{name: "Lackey Beta Plugin", link:"https://www.dropbox.com/s/nuzm4268v87vylg/msebeta.zip?dl=0"},
		{name: "Cockatrice Beta Allcards", link:"https://cdn.discordapp.com/attachments/500175869084565525/701633901897973761/AllSets.json"},
		{name: "Cockatrice Beta Tokens", link:"https://cdn.discordapp.com/attachments/500175869084565525/701632433337925793/tokens.xml"}
	]
	if(textFlag) {
		let output = "";
		for(let each in linksArray)
			output += `${linksArray[each].name}:\n<${linksArray[each].link}>\n`;
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter("MSEM Patch Info")
		return [[output, nullEmbed]];
	}
	let output = ""; //"["+site+"]("+searchLink+"
	for(let each in linksArray)
		output += `[${linksArray[each].name}](<${linksArray[each].link})\n`;
	let embedInfo = new Discord.MessageEmbed()
		.setDescription(output)
		.setFooter('MSEM Patch Info')
	return [embedInfo]
}
function cullReacts (msg, legalIDs) {						//removes reactions from everyone not in legalIDs
	let emoteArray = msg.reactions.cache.array();
	let userIDs = [];
	let removals = [];
	for(let anEmote in emoteArray) {
		for(let user in emoteArray[anEmote].users.cache.array()) {
			if(!legalIDs.includes(emoteArray[anEmote].users.cache.array()[user].id))
				userIDs.push(emoteArray[anEmote].users.cache.array()[user].id);
		}
		let emote = emoteArray[anEmote]._emoji.name;
		for(let id in userIDs) {
			if(userIDs[id] != "" && userIDs[id] != Client.user.id) {
				emoteArray[anEmote].users.remove(userIDs[id]);
				removals.push(userIDs[id]);
			}
		}
	}
	return removals;
}
function buildGeneralEmbed(array, header, page, perPage, textFlag) { //converts an array into a basic paginated embed
	let pages = Math.ceil(array.length / perPage);
	let start = page * perPage;
	let end = Math.min(array.length, start + perPage);
	let output = "";
	for(let i=start; i<end; i++) 
		output += array[i] + "\n";
	if(textFlag) {
		output = "__" + header + "__\n" + output;
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter("Page " + parseInt(page+1) + "/" + pages)
			return [[output, nullEmbed]];
	}
	var embedInfo = new Discord.MessageEmbed()
		.setFooter("Page " + parseInt(page+1) + "/" + pages)
		.addField(header, output)

	return [embedInfo, pages];
}
function turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag, altIndex, newPost) { //moves to the left or right page of a 1d embed
	let emoteArray = msg.reactions.cache.array();
	let thisPage = parseInt(pageCheck[1]);
	let lastPage = parseInt(pageCheck[2]);
	if(!altIndex){
		thisPage--;
		lastPage--;
	}
	let userIDs = [];
	let saveArray = [];
	let go = false;
	for(let anEmote in emoteArray) {
		if(emoteArray[anEmote].users.cache.array().length != 1 || emoteArray[anEmote]._emoji.name == plainText || emoteArray[anEmote]._emoji.name == resetList) {
			go = true;
			for(let user in emoteArray[anEmote].users.cache.array()) {
				if(emoteArray[anEmote].users.cache.array()[user].id != Client.user.id)
					userIDs.push(emoteArray[anEmote].users.cache.array()[user].id);
			}
			let emote = emoteArray[anEmote]._emoji.name;
			if(emote == rightArrow || emote == leftArrow || emote == resetList ||update) {
				if(emote == rightArrow) { //right
					thisPage++;
					if(thisPage > lastPage)
						thisPage = 0;
				}
				if(emote == leftArrow) {//left
					thisPage -= 1;
					if(thisPage < 0)
						thisPage = lastPage;
				}
				if(emote == resetList)
					thisPage = 0;
				if(altIndex && thisPage == 0)
					thisPage = altIndex;
				for(let id in userIDs) {
					if(!saveArray.includes(emote) && userIDs[id] != Client.user.id)
						emoteArray[anEmote].users.remove(userIDs[id]);
				}
			}
		}
	}
	let exampleEmbed = embedBuild(thisPage);
	if(textFlag) {
		let deadEmbed = exampleEmbed[1];
		if(newPost != undefined) {
			msg.channel.send(exampleEmbed[0],deadEmbed)
				.then(mess => newPost(mess))
				.catch()
		}else{
			msg.edit(exampleEmbed[0],deadEmbed)
		}
	}else{
		if(newPost != undefined) {
			msg.channel.send("",exampleEmbed)
				.then(mess => newPost(mess))
				.catch()
		}else{
			msg.edit("",exampleEmbed)
		}
	}
}


//Draft Engine
function startDraft(owner, roundArray, playerArray) {		//initializes the draft object
	draftStarts++;
	roundArray[0] = 1;
	var status = "progress";
	var numPlayers = playerArray.length;
	var players = getSeating(playerArray);
	var packs = null;
	var packsEmpty = 0;
	var draft1 = {status, owner, numPlayers, roundArray, players, packs, packsEmpty};
	writeDraftData(draft1);
	draft = draft1
	beginRound();
}
function getSeating(playerArray) {							//sets random seating for players
	var players = {};
	var firstPlayer = playerArray.pop();
	var lastPlayer = firstPlayer;
	shuffleArray(playerArray);
	var thisPlayer = playerArray.pop();
	players[firstPlayer] = {};
	players[firstPlayer].passTo = thisPlayer;
	players[firstPlayer].cardpool = [];
	players[firstPlayer].round = [];
	players[firstPlayer].notes = [];
	players[firstPlayer].currentPack = null;
	while (playerArray.length > 0) {
		shuffleArray(playerArray);
		var nextPlayer = playerArray.pop();
		players[thisPlayer] = {};
		players[thisPlayer].passFrom = lastPlayer;
		players[thisPlayer].passTo = nextPlayer;
		players[thisPlayer].cardpool = [];
		players[thisPlayer].round = [];
		players[thisPlayer].notes = [];
		players[thisPlayer].currentPack = null;
		lastPlayer = thisPlayer;
		thisPlayer = nextPlayer;
	}
	players[thisPlayer] = {};
	players[thisPlayer].passFrom = lastPlayer;
	players[thisPlayer].passTo = firstPlayer;
	players[thisPlayer].cardpool = [];
	players[thisPlayer].round = [];
	players[thisPlayer].notes = [];
	players[thisPlayer].currentPack = null;
	players[firstPlayer].passFrom = thisPlayer;
	return players
}
function beginRound() {										//adds new packs and advances round
	let draft1 = draft;
	draft1.numPlayers = 0;
	for(let user in draft1.players) {
		draft1.numPlayers++;
	}
	draft1.status = "progress";
	var round = draft1.roundArray[0];
	let expansion = draft1.roundArray[round];		
	draft1.packs = {};
	for (var player in draft1.players) {
		if(draft1.players[player] !== null) {
			//cacheOut(player, draft1);
			draft1.packs[player] = {};
			if(draft1.roundArray[round] === "CHAOS") {
				let setCount = Object.keys(allpacks).length-2;
				let num = Math.floor(Math.random()*setCount);
				expansion = Object.keys(allpacks)[num];
			}
			let database = arcana.msem;
			draft1.packs[player].cards = generatePack(expansion, database, " -is:bonus");
			crackedPacks++;
			//cacheIn(player, draft1)
			draft1.packs[player].playerFor = player;
			draft1.packs[player].packBehind = draft1.players[player].passFrom;
			draft1.players[player].currentPack = player;
		}
	}
	draft1.packsEmpty = 0;
	writeDraftData(draft1);
	for (var player in draft1.players) {
		givePack(player);
	}
}
function draftPick(user, pack, cardname) {					//moves picked card from pack to pool
	let draft1 = draft;
	let toggle = "";
	draft1.players[user].cardpool.push(cardname);
	let index = draft1.packs[pack].cards.indexOf(cardname);
	if(index > -1)
		draft1.packs[pack].cards.splice(index, 1);
	Client.users.cache.get(user).send(cardname.replace(/_[A-Z0-9_]+/, "") + " successfully added to your cardpool.");
	if (draft1.packs[pack].cards == "") {
		draft1.packs[pack].playerFor = null;
		draft1.packsEmpty++;
		toggle = 1
	}
	if (draft1.packs[pack].cards != "") {
		var nextDrafter = draft1.players[user].passTo;
		draft1.packs[pack].playerFor = nextDrafter;
		if (draft1.players[nextDrafter].currentPack === null) {
			draft1.players[nextDrafter].currentPack = pack;
			givePack(nextDrafter);
		}
	}
	var nextPack = draft1.packs[pack].packBehind;
	if (draft1.packs[nextPack].playerFor === user) {
		draft1.players[user].currentPack = nextPack;
		givePack(user);
	}
	else
	if (draft1.packs[nextPack].playerFor !== user)	{
		draft1.players[user].currentPack = null;
		Client.users.cache.get(user).send("I'll let you know when your next pack is ready.");
		}
	writeDraftData(draft1);
	if(toggle != "")
		endCheck();
}
function endCheck() {										//checks if round needs started
	if (draft.packsEmpty === draft.numPlayers) {
		if (draft.roundArray[0] + 1 === draft.roundArray.length) {
			endDraft();
		}
		//Obligate
		if (draft.roundArray[0] + 1 < draft.roundArray.length) {
			draft1 = draft;
			for (var player in draft1.players) {
				if(draft1.players[player] !== null) {
					var temp = draft1.players[player].passTo;
					draft1.players[player].passTo = draft1.players[player].passFrom;
					draft1.players[player].passFrom = temp;
				}
			}
			draft1.roundArray[0] = draft1.roundArray[0] + 1;
			writeDraftData(draft1);
			draft = draft1
			beginRound();
		}
	}
}
function endDraft() {										//final message
	//Blaze Devastator
	for (var player in draft.players) {
		pullPing(player).send("The draft has ended. Nice work!");
		showPool(player);
		writePool(player);
		pullPing(player).send("Head over to Lackey to build your deck and play some games!");
	}
	finishDraftData(draft)
}
//Draft Interface
function writePool(user) {									//prints final pool
	let pool = draft.players[user].cardpool;
	if(pool !== null) {
		let poolText = "<deck version=\"0.8\">\n";
		poolText += "	<meta>\n";
		poolText += "		<game>msemagic</game>\n";
		poolText += "	</meta>\n";
		poolText += "	<superzone name=\"Deck\">\n";
		for(var card in pool) {
			let thisCard = arcana.msem.cards[searchCards(arcana.msem,pool[card])];
			let lackeyName = thisCard.cardName;
			if(thisCard.shape == "split")
				lackeyName += " // " + thisCard.name2;
			poolText += "		<card><name id=\"" + thisCard.cardID;
			poolText += "\">" + lackeyName.replace(/('|’)/g, "&apos;") + "</name><set>" + thisCard.setID + "</set></card>\n\n";
		}
		poolText += "	</superzone>\n";
		poolText += "</deck>"
		let jsonname = pullUsername(user) + " pool - draft " + draftStarts + ".dek";
		fs.writeFile(jsonname, poolText, (err) => {
			if (err) throw err;
			});
		setTimeout(function(){
			pullPing(user).send("Here is your cardpool.dek, rename it as you like and move it to LackeyCCG/plugins/msemagic/cardpools/", {
					files:[{attachment:jsonname}]
				});
		}, 3000);		
		Client.channels.cache.get(config.signinChannel).send("cardpool for " + pullUsername(user) + " logged", {
				files:[{attachment:jsonname}]
			});
	}
}
function writeDraftData (draftbase) {						//updates draft.json
	draftbase.version++;
	editVersions(); //todo
	let fulltext = JSON.stringify(draftbase)
	fulltext = fulltext.replace(/,"/g,",\n\"");
	fs.writeFile('draft/draft.json', fulltext, (err) => {
			if (err) throw err;
			});	
	draft = draftbase;
	/*Client.channels.cache.get(login.draft).send("Draft log", {
		file: "draft/draft.json" //saves the draft log and posts it
	});*/
	dropboxUpload('/lackeybot stuff/draft.json',fulltext);
}
function finishDraftData(draftbase) {						//write the draft backup and resets draft.json
	let name = "draft" + draftStarts + ".json"
	let fulltext = JSON.stringify(draftbase)
	fulltext = fulltext.replace(/,"/g,",\n\"");
	fs.writeFile(name, fulltext, (err) => {
			if (err) throw err;
			});
	draft = require("./draft/draftnull.json");
	writeDraftData(draft);
}
function showPack(user) {									//shows current pack to given user
	if(draft.players[user] !== null) {
		var pack = draft.players[user].currentPack;
		if (pack !== null) {
			pullPing(user).send("Your pack contains:")
			//Client.users.cache.get(user).send(draft.packs[pack].cards);
			var output = "";
			var newput = "";
			for(var cardName in draft.packs[pack].cards) {
				thisName = draft.packs[pack].cards[cardName];
				newput = arcana.msem.writeCard(thisName);
				if(output.length + newput.length > 1900) {
					Client.users.cache.get(user).send(output);
					output = String.fromCharCode(8203) + "\n" + newput;
					newput = "";
				}
				if(output.length + newput.length < 1900 && newput !== "") {
					output += "\n" + newput;
				}
			}
			pullPing(user).send(output);
			pullPing(user).send("`$pick CARDNAME` to pick a card. This uses LackeyBot's search engine, so partial matches work too!");
		}
	}
	if(pack === null) {
		pullPing(user).send("There are no packs waiting for you right now. I'll let you know when your next pack is ready.");
	}
}
function showPool(user) {									//shows current pool to given user
	let pool = draft.players[user].cardpool;
	whiteCount = 0;
	blueCount = 0;
	blackCount = 0;
	redCount = 0;
	greenCount = 0;
	multiCount = 0;
	artifactCount = 0;
	landCount = 0;
	let landCheck = "";
	if(pool !== null) {
		for(let thisCard in pool) {
			thisCard = arcana.msem.cards[pool[thisCard]];
			landCheck = thisCard.cardType.match(/Land/);
			if(thisCard.color == "{White} ")
				whiteCount++;
			if(thisCard.color == "{Blue} ")
				blueCount++;
			if(thisCard.color == "{Black} ")
				blackCount++;
			if(thisCard.color == "{Red} ")
				redCount++;
			if(thisCard.color == "{Green} ")
				greenCount++;
			if(thisCard.color.match("/"))
				multiCount++;
			if(thisCard.cardType.match(/Artifact/) && thisCard.color == "" && landCheck == null)
				artifactCount++;
			if(thisCard.cardType.match(/Land/))
				landCount++;
		}
		let colorDist = whiteCount + " W | ";
		colorDist += blueCount + " U | ";
		colorDist += blackCount + " B | ";
		colorDist += redCount + " R | ";
		colorDist += greenCount + " G | ";
		colorDist += multiCount + " M | ";
		colorDist += artifactCount + " A | ";
		colorDist += landCount + " L";
		pullPing(user).send("Your pool contains " + colorDist + " cards:\n");
		let tempPool = [];
		for(let thisCard in pool) {
			tempCard = arcana.msem.cards[pool[thisCard]].fullName;
			tempPool.push(tempCard);
		}
		pullPing(user).send(tempPool);
	}
}
function givePack(user) {									//sends new pack to players
	pullPing(user).send("You've got a pack!\nLackeyBot will ask you to pick once all cards are shown.");
	showPack(user);
}
function showTable(user) {									//sends list of players and packs they have
    let draft1 = draft;
    for (let player in draft1.players) {
        draft1.players[player].numPacks = 0;
    }
    for (let pack in draft1.packs) {
		if(draft1.packs[pack].playerFor !== null)
			draft1.players[draft1.packs[pack].playerFor].numPacks++;
    }
    let nextPlayer = draft1.players[user].passTo;
	let packCount = draft1.players[user].numPacks;
	let packWord = " packs ";
	if(packCount === null)
		packCount = 0;
	if(packCount === 1)
		packWord = " pack ";
    let tableString = ("You have " + packCount + packWord + "and are passing to ");
	packCount = draft1.players[nextPlayer].numPacks;
	if(packCount === null || packCount === undefined)
		packCount = 0;
	packWord = " packs ";
	if(packCount === 1)
		packWord = " pack ";
    tableString += (pullUsername(nextPlayer) + ", who has " + packCount + packWord + "and is passing to ");
    nextPlayer = draft1.players[nextPlayer].passTo;
    while (nextPlayer !== user) {
		packCount = draft1.players[nextPlayer].numPacks;
		if(packCount === null || packCount === undefined)
			packCount = 0;
		packWord = " packs ";
		if(packCount === 1)
			packWord = " pack ";
        tableString += (pullUsername(nextPlayer) + ", who has " + packCount + packWord + "and is passing to ");
        nextPlayer = draft1.players[nextPlayer].passTo;
    }
    tableString = tableString + ("you.");
    pullPing(user).send(tableString);
}
//Pack Generator
function shuffleArray(array) {								//shuffles arrays for packs and seating
    let counter = array.length;
    while (counter > 0) { 								// While there are elements in the array
        let index = Math.floor(Math.random() * counter);// Pick a random index
		counter--;										// Decrease counter by 1
        let temp = array[counter]; 						// And swap the last element with it
        array[counter] = array[index];
        array[index] = temp;
    }
    return array;
}
function testPackFilters(packSlots, library, setID) {				//tests pack filters are valid for devDex
	if(setID == "")
		return "packSlots have still been saved, but LackeyBot doesn't have set data, so can't test pack filters.";
	let filterArrays = {};
	let borkLine = "";
	let timeLine = "";
	for(let slot in packSlots) {
		for(let filter in packSlots[slot].filters) {
			let thisFilter = packSlots[slot].filters[filter];
			if(!thisFilter.match(/e:/))
				thisFilter += " e:" + setID //add set filter if it doesn't have a filter
			if(!filterArrays.hasOwnProperty(thisFilter)) {//add new filters to the object
				let scryResults = fuzzy.scryDatabase(library, thisFilter);
				filterArrays[thisFilter] = shuffleArray(scryResults[0]);
				if(scryResults[2]) //lackeybot timed out
					timeLine += thisFilter + '\n';
				if(filterArrays[thisFilter].length == 0)
					borkLine += thisFilter + "\n";
			}
		}
	}
	if(borkLine != "")
		borkLine = "packSlots have still been saved, but the following filters match no cards. This may result in packs missing cards:\n" + borkLine;
	if(timeLine != "")
		borkLine += 'The following filters timed out. For best results, use a simpler filter:\n' + timeLine;
	return borkLine;
}
function generatePack(set, library, extraFilter) {		//generates a pack given a set code
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
					filterArrays[thisFilter] = shuffleArray(fuzzy.scryDatabase(library, thisFilter)[0]);
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
function makeFoil(string){									//adds ★ to a card name
	return "★ " + string;
}
function unFoil(string){									//removes ★ from a card name
	return string.replace("★ ", "");
}
function isFoil(string){									//checks if card name has a ★ 
	return string.match("★ ");
}
function buildPackEmbed(library, packCards, expansion, user, page, textFlag) { //build $open embed
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
		let embedText = pullUsername(user) + " opened a pack of " + expansion;
		for(let i=0; i<packCards.length; i++) {
			embedText += "\n";
			if(isFoil(packCards[i]))
				embedText += "★ ";
			embedText += database[unFoil(packCards[i])].fullName;
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(pullUsername(user) + " opened a pack of " + expansion)
			.setFooter("Card " + parseInt(page+1) + "/" + pages)
		return [[embedText, nullEmbed], packObj];
	}
	var exampleEmbed = new Discord.MessageEmbed()
		.setColor('#00ff00')
		.setThumbnail(printImages([unFoil(packCards[(page+1)%pages])], library, true))
		.setTitle(pullUsername(user) + " opened a pack of " + expansion)
		.setFooter("Card " + parseInt(page+1) + "/" + pages)
		.addField("**" + foil_name + "**", cardText)
		.setImage(printImages([unFoil(card_name)], library, true))
	return [exampleEmbed, packObj];
}
function buildPickEmbed(library, packCards, expansion, textFlag) { //build $p1p1 embed
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
function supremePicker (user, picked) {
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
function buildSupremeEmbed(library, packCards, expansion, pickData, page, textFlag) { //build $supreme embed
	let database = library.cards;
	let packObj = {};
	packObj.cards = packCards;
	packObj.set = expansion;
	packObj.database = library.name;
	packObj.picks = [];
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
		let cardText = database[card_name].typeLine + "\n" + database[card_name].rulesText.replace(/\n$/,"");
		if(database[card_name].power)
			cardText += "\n" + database[card_name].power + "/" + database[card_name].toughness;
		let cardTitle = "**" + foil_name + "**";
		if(pickData.picks.includes(azEmoteArray[ind]))
			cardTitle = "~~" + cardTitle + "~~";
		cardTitle = azEmoteArray[ind] + ": " + cardTitle;
		exampleEmbed.setThumbnail(printImages([unFoil(packCards[(ind+1)%packCards.length])], library, true))
		exampleEmbed.addField(cardTitle, cardText)
		exampleEmbed.setImage(printImages([unFoil(card_name)], library, true));
	}
	embedText += `\nReact with 🇦 🇧 ... 🇿 to pick a card.\nReact with ${leftArrow}${rightArrow} to see card images or ${resetList} to return to the list.\nSend $poolsupreme to see your current pool.`;
	if(textFlag) {
		if(page == 0)
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

//Draft Management
function dropPlayer(droppedPlayer) {						//drops a player during a draft
	let draft1 = draft
	var nextPlayer = draft1.players[droppedPlayer].passTo;
	var prevPlayer = draft1.players[droppedPlayer].passFrom;
	var nextPack = draft1.players[nextPlayer].currentPack
	draft1.players[nextPlayer].passFrom = prevPlayer;
	draft1.players[prevPlayer].passTo = nextPlayer;
	//draft1.numPlayers -= 1;
	//assign all packs for dropped player to next player
	for(let pack in draft1.packs) {
		if(draft1.packs[pack].playerFor === droppedPlayer)
			draft1.packs[pack].playerFor = nextPlayer;
	}
	//check to give pack to next player
	if(nextPack === null) {
		givePack(nextPlayer);
		}
	//delete the dropped player
	delete draft1.players[droppedPlayer];
	writeDraftData(draft1)
	}	
function addPack(setcode) {									//adds a round of a given set
	let draft1 = draft;
	draft1.roundArray.push(setcode);
	writeDraftData(draft1)
	let draftname = generateDraftName();
	pullPing(draft1.owner).send("You have added a round of " + setcode + " to your draft.\nYour draft is now " + draftname)
}
function generateDraftName() {								//uses roundArray to name the draft
	var draftname = "";
	for(var i = 1; i < draft.roundArray.length; i++) {
		draftname += draft.roundArray[i]
		if(i !== draft.roundArray.length -1)
			draftname += "|"
	}
	return draftname
}
function showDraftHelp(user,msg) {							//sends draft help and draft owner help
	let helpout = ""
	if(user === draft.owner) {
		helpout += "Your current draft is " + generateDraftName() + "\n";
		helpout += "`$addpack SET` to add a draft round of that set.\n";
		helpout += "`$resetdraft` to reset the chosen sets. Can only be used before opening the draft.\n";
		helpout += "`$draftcodes` for the SET codes for each set.\n";
		helpout += "`$opendraft` to stop editing the draft and open registration.\n";
		helpout += "`$startdraft` to stop accepting players and begin drafting.\n";
		helpout += "`$kickplayer ID` to drop a player and their cardpool, but not their current pack, from the draft. A user's ID can be copied by right clicking their name with Developer Mode active.\n";
		helpout += "To transfer ownership or other changes, contact Cajun.";
		pullPing(draft.owner).send(helpout);
	}
	helpout = "`$drafting` for information about the current draft.\n";
	helpout += "`$joindraft` to join the current draft.\n";
	helpout += "`$drop` to drop from the draft.\n";
	helpout += "`$pick CARDNAME` to pick CARDNAME from your current pack.\n";
	helpout += "`$viewpack` to review your current pack.\n";
	helpout += "`$viewpool` to review your current pool.\n";
	helpout += "`$viewtable` to view the players and their packs.\n";
	helpout += "`$drafthelp` for this message.\n";
	msg.channel.send(helpout);
}
function generateSetCodes() {								//makes a list of valid drafting set codes
	var output = ""
	for(let set in allpacks) {
		if(allpacks[set].hidden = 0){
			output += "";
		}else{
			output += set;
			output += ": ";
			output += allpacks[set].longname;
			output += "\n"
		}
	}
	return output
}
//TODO Xoltan Draft Code
//This is a very large project that's been getting done bit by bit.
function cacheOut(vicID, draftbase) { //cache breaker scripts
	let victim = draftbase.players[vicID];
	if(victim.flags[17] === 1)
		var cache2 = draftbase.packs[vicID].cards2;
	if(victim.flags[18] === 1)
		var cache3 = draftbase.packs[vicID].cards3;
	if(victim.flags[19] === 1)
		var cache4 = draftbase.packs[vicID].cards4;
	if(victim.flags[20] === 1)
		var cache5 = draftbase.packs[vicID].cards5;
	if(victim.flags[21] === 1)
		var cache6 = draftbase.packs[vicID].cards6;
}
function cacheIn(vicID, draftbase) { //more cache breaker scripts
	let victim = draftbase.players[vicID];
	let crimescene = draftbase.packs[vicID];
	let round = draftbase.roundArray[0];
	if(typeof cache2 == "array" && round == 2) {
		victim.flags[17] = 0;
		crimescene.cards = cache2;
	}
	if(typeof cache3 == "array" && round < 3)
		crimescene.cards3 = cache3;
	if(typeof cache3 == "array" && round == 3) {
		victim.flags[18] = 0;
		crimescene.cards = cache3;
	}
	if(typeof cache4 == "array" && round < 4)
		crimescene.cards4 = cache4;
	if(typeof cache4 == "array" && round == 4) {
		victim.flags[19] = 0;
		crimescene.cards = cache4;
	}
	if(typeof cache5 == "array" && round < 5)
		crimescene.cards5 = cache5;
	if(typeof cache5 == "array" && round == 5) {
		victim.flags[20] = 0;
		crimescene.cards = cache5;
	}
	if(typeof cache6 == "array" && round < 6)
		crimescene.cards6 = cache6;
	if(typeof cache6 == "array" && round == 6) {
		victim.flags[21] = 0;
		crimescene.cards = cache6;
	}
}
function draftAutoEffects(user, pack, cardname) { //handles automatic drafting effects
	//Mariette’s Obtainers
	if(special.faceupCards.hasOwnProperty(cardname))
		draftFaceUp(user, pack, cardname);
	if(special.passCards.hasOwnProperty(cardname))
		draftPass(user, pack, cardname);
	if(special.noteCards.hasOwnProperty(cardname))
		draftNote(user, pack, cardname);
}
function draftExtraEffects(user, pack, cardname) { //handles drafting effects with confirmations 
	if(special.huntCards.hasOwnProperty(cardname))
		draftHunt(user, pack, cardname);
	if(special.revealCards.hasOwnProperty(cardname))
		draftReveal(user, pack, cardname);
	if(special.viewCards.hasOwnProperty(cardname))
		draftViewRound(user, cardname);
	if(cardname === "Cache Breaker")
		generatePack()
	if(draft.players[user].cardpool.hasOwnProperty("Crovoan Storyteller"))
		removeDraft(user, pack, cardname);
	if(draft.players[user].cardpool.hasOwnProperty("Temple Raider") || cardname === "Crovoan Mentalist")
		draftMultiple(user, pack, cardname);
}
function draftSpecialEffects(user, pack, cardname) { //handles draft effects that happen outside of picking
	if(special.turnCards.hasOwnProperty(cardname))
		turnFaceDown(user, pack, cardname);
	if(cardname === "Elusive Chimera")
		draftUnpick(user, pack);
	if(special.multipleCards.hasOwnProperty(cardname)) //Gifter of Lineages, Crovoan Mentalist
		draftMultiple(user, pack, cardname);
}
function draftFaceUp(user, pack, cardname) { // drafts cards face up
}
function draftPass(user, pack, cardname) { //cards that check who passed them
}
function draftNote(user, pack, cardname) { //cards that create notes
}
function draftHunt(user, pack, cardname) { //cards with Hunt
	var i = 0;
	var message = "";
	for(var player in draft.players) {
		i++;
		if(player !== user && player !== user.passFrom) {
			message += "send `!hunt" + i + "` to hunt " + pullUsername(player) + "\n";
		}
	}
	if(message !== "") {
		pullPing(user).send(message);
		draft.players[user].flags[4] = 1; //turns hunting flag on
	}
}
function draftReveal(user, pack, cardname) { //cards that reveal themselves or others
}
function removeDraft(user, pack, cardname) { //cards that remove cards from the draft
}
function turnFaceDown(user, pack, cardname) { //turns a card facedown
	
}
function draftUnpick(user, pack) { //puts Elusive Chimera back in the pack
	
}
function draftRestrict(user) { //prevents some cards from being drafted
	//Gana-Mali Elite
}
function draftViewRound(user) { //looks at all the cards a player has drafted
	
}
function draftMultiple(user, pack, cardname) { //multi drafting function
	
}
function draftRemove(user, pack, cardname) { //removes a card from the draft
}

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
		let pack = generatePack(deckChecking[1], arcana.msem, " -is:bonus");
		for(let card in pack) {
			if(pack[card].match(/^★ (Plains|Island|Swamp|Mountain|Forest)( [a-z]|\d+)_/)) {
				//be nice to sealed players and give them a random foil common instead of foil basic. Snow and Dry basics stay though.
				let randtemp = fuzzy.scryDatabase(randBase, 'e:' + deckChecking[1] + ' r=c', {exact:true})[0];
				if(randtemp.length > 0) {
					let num = Math.floor(Math.random()*randtemp.length);
					pack[card] = "★ " + shuffleArray(randtemp)[0];
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
			let thisName = searchCards(library, promoCheck(number_and_name[2]));
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
		let thisCard = searchCards(library,thisName);
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
					cardInfo = library.cards[searchCards(library, thisCard + "_" + cardInfo.prints[0])]; //use the original print for rarity counts;
				refLegal.push(thisCard) //and call it legal
			}
			let basicCheck = checkBasic(cardInfo);
			let snowBasic = cardInfo.typeLine.match(/Basic Snow/)
			if(!cardInfo.prints.includes(secondaryCheck) && (!basicCheck || snowBasic) && !refLegal.includes(thisCard))	//make sure its in the right set, basic, or referred
				legal.push(trimname + " is not in set " + secondaryCheck + ".");
			//if we're not on the right print, grab that one for the deck check
			if(!refLegal.includes(thisCard) && (cardInfo.setID != secondaryCheck || cardInfo.rarity == "special")) {
				cardInfo = library.cards[searchCards(library, cardInfo.fullName + "_" + secondaryCheck)];
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
			if(library.cards[searchCards(library,thisCard)].typeLine.match("Conspiracy"))
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
	}else if(format == "MSEM" || format == "Gladiator" || format == "Pauper") {
		let maxCount = [4, "four copies"];
		if(format == "Gladiator")
			maxCount = [1, "one copy"];
		for(let thisCard in deckObject){
			cardCount[0] += deckObject[thisCard].decks.main;
			cardCount[1] += deckObject[thisCard].decks.side;
			let trimname = thisCard.replace(/_[^\n]+/i,"");
			if(deckObject[thisCard].count > maxCount[0] && checkBasic(searchCards(library,thisCard)) == 0)
				legal.push(`More than ${maxCount[1]} of ${trimname} detected.`);
			let banned = checkBanned(trimname, "MSEM", library);
			if(banned == 1 || library.cards[searchCards(library,thisCard)].typeLine.match("Conspiracy"))
				legal.push(trimname + " is banned in MSEModern.");
			if(banned == 2)
				legal.push(trimname + " is masterpiece only and not legal in MSEModern.");
			if(format == "Pauper") {
				if(!library.cards[searchCards(library,thisCard)].rarities.includes("common") && !library.cards[searchCards(library,thisCard)].rarities.includes("basic land"))
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
	}
	if(format == "Designer") {
		let testDesigner = "";
		for(let thisCard in deckObject) {
			if(testDesigner == "")
				testDesigner = library.cards[searchCards(library, thisCard)].designer;
			if(!library.cards[searchCards(library, thisCard)].typeLine.match("Basic") && library.cards[searchCards(library, thisCard)].designer != testDesigner) {
				legal.push("Not all cards have the same designer.");
				return legal;
			}
		}
	}
	return [legal, warning];
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
		warnString += warnArray[warn] + " ";
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
		if(legal.modernBan.includes(thisCard))
			banned = 1;
		if(legal.masterpiece.includes(thisCard))
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
function dekBuilder (cardString, thisSet, user) {			//generates a Lackey .dek file
	let poolText = "<deck version=\"0.8\">\r\n";
	poolText += "	<meta>\r\n";
	poolText += "		<game>msemagic</game>\r\n";
	poolText += "	</meta>\r\n";
	cardString = cardString.replace(/\$convert[^\n]*/, "Deck:");
	let blockArray = cardString.match(/([A-Z]+):[ ]*\n(([0-9]+)x?[ ]+([^\n]+)(\n|$))+/ig);
	if(!blockArray) {
		pullPing(user).send("There was an error with this decklist. If you were trying to convert a Cockatrice list, be sure to use unannoted form or remove the linebreaks.");
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
		pullPing(user).send("Here is your converted .dek file, rename it as you like and move it to LackeyCCG/plugins/msemagic/decks/", {
				files:[{attachment:"convertedDeck.dek"}]
			});
	}, 3000);		
}
function dekBlockWriter(thisBlock, thisSet) {				//writes card data
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
				let fullCard = arcana.msem.cards[searchCards(arcana.msem,promoCheck(thisCard))];
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
function dekLineWriter(thisNo,thisName,thisSet) {			//writes lackey readable card data
	let temptext = "		<card><name id=\"" + thisNo;
	temptext += "\">" + thisName.replace(/('|’)/g, "&apos;") + "</name><set>" + thisSet + "</set></card>\r\n";
	return temptext;
}
function promoCheck (thisName) {							//attempts to convert to promo frames
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
}//Ophorio dek Fixer
function opoBlockFixer (cardString) {						//fixes card strings containing defunct OPO cards
	let temptext = "";
	var setsAndNames = cardString.match(/		<card><name id="([0-9a-z]+)">([^\n]+)<\/name><set>([^\n]+)<\/set><\/card>(\r\n|$)/ig);
	var leng = setsAndNames.length;
	for (var i = 0; i < leng; i++) {
		var thisEntry = setsAndNames[i].match(/		<card><name id="([0-9a-z]+)">([^\n]+)<\/name><set>([^\n]+)<\/set><\/card>(\r\n|$)/i);
		let promo = 0;
		if(thisEntry[1].match("s"))
			promo = 1;
		let thisName = thisEntry[2];
		let thisSet = thisEntry[3];
		thisName = thisName.replace(".", "");
		thisName = thisName.replace("&apos;", "'");
		thisName = ophorioCheck(thisName, thisSet, promo);
		thisCard = arcana.msem.cards[thisName];
		let lackeyName = thisCard.cardName;
		if(thisCard.shape == "split")
			lackeyName += " // " + thisCard.name2;
		temptext += dekLineWriter(thisCard.cardID,lackeyName,thisCard.setID);
	}
	return temptext
}
function ophorioCheck (thisCard, thisSet, promo) {			//checks if card is from defunct OPO set
	if(thisSet != "OPO") {
		thisName = thisCard + "_" + thisSet;
		return thisName
	}
	if(promo != 0) {
		if(arcana.msem.cards.hasOwnProperty(thisCard + "_PRO_OPH")){
			thisName = thisCard + "_PRO_OPH";
			return thisName
		}
		if(arcana.msem.cards.hasOwnProperty(thisCard + "_PRO_ORP")){
			thisName = thisCard + "OIR";
			return thisName
		}
	}else{
		if(arcana.msem.cards.hasOwnProperty(thisCard + "_OPH")){
			thisName = thisCard + "_OPH";
			return thisName
		}
		if(arcana.msem.cards.hasOwnProperty(thisCard + "_ORP")){
			thisName = thisCard + "_ORP";
			return thisName
		}
	}
}
function opoFix (cardString, user, filename) {				//fixes decklists containing defunct OPO cards
	let blockString = cardString.match(/	<superzone name="([A-Z]+)">\r\n(		<card><name id="([0-9a-z]+)">([^\n]+)<\/name><set>([^\n]+)<\/set><\/card>(\r\n|$))+/ig);
	let poolText = "<deck version=\"0.8\">\r\n";
	poolText += "	<meta>\r\n";
	poolText += "		<game>msemagic</game>\r\n";
	poolText += "	</meta>\r\n";
	for(i=0; i<blockString.length; i++) {
		thisBlock = blockString[i];
		blockName = thisBlock.match(/	<superzone name="([A-Z]+)">/i);
		blockName = blockName[1];
		let superText = "	<superzone name=\"" + blockName +"\">\r\n";
		poolText += superText;
		thisBlock = thisBlock.replace(superText,"");
		poolText += opoBlockFixer(thisBlock);
		poolText += "	</superzone>\r\n";
	}
	poolText += "</deck>";
	fs.writeFile(filename, poolText, (err) => {
		if (err) throw err;
		});
	setTimeout(function(){
		pullPing(user).send("Here is your corrected .dek file, rename it as you like and move it to LackeyCCG/plugins/msemagic/decks/",{files:[{attachment: filename}]});
	}, 3000);		
}

//Dropbox
function dropboxUpload (path, contents, callback) {			//uploads to dropbox with optional callback
	dbx.filesUpload({ path: path, contents: contents, mode: 'overwrite'})
        .then(function (response) {
			console.log("dropboxUpload(): " + path + " uploaded to Dropbox");
			if(callback)
				callback();
		})
        .catch(function (error) {
			console.error(error);
		});
}
function dropboxDownload(path, downLink, callback, big) {	//downloads from dropbox with optional callback
	if(big) {
		dbx.filesGetTemporaryLink({path:downLink})
			.then(function(result) {
				download(result.link, {directory:"./", filename:path}, function(err) {
					if(err)
						console.log(err);
					if(callback)
						callback();
				});
			})
			.catch(e => console.log(e))
	}else{
		if(downLink.match(/^http/)) {
			dbx.sharingGetSharedLinkFile({url:downLink})
				.then(function(data) {
					if(big) {
						fs.writeFileSync(path, data.fileBinary, 'binary')
						if(callback)
							callback()
					}else{
						fs.writeFile(path, data.fileBinary, 'binary', function(err) {
							if (err) throw err;
							if(callback != undefined && callback != null)
								callback();
						});
					}
				})
				.catch(function(err){console.log(err)})
		}else{
			dbx.filesDownload({path:downLink})
				.then(function(data) {
					fs.writeFile(path, data.fileBinary, 'binary', function(err) {
						if(err) throw err;
						if(callback != undefined && callback != null)
							callback();
					});
				})
				.catch(function(err){console.log(err)})
		}
	}
}
function verifyDeck (path,contents) {						//downloads an uploaded deck and checks if they are the same (we were having issues with unfinished uploads)
	dbx.filesDownload({path:path})
		.then(function(data) {
			fs.writeFile('./decks'+path, data.fileBinary, 'binary', function(err) {
				if(err){
					console.log(err);
				}else{
					setTimeout(function() {
						try{
							fs.readFile('./decks'+path, "utf8", function read(err, data) {
								if(err) throw err;
								if(data != contents && downloadCount < 5) {
									downloadCount++
									dropboxUpload(path, contents, function() {verifyDeck(path, contents)});
								}else if(downloadCount >= 5){
									Client.channels.cache.get(config.signinChannel).send("<@190309440069697536> A deck has failed verification.");
									downloadCount = 0;
									fs.unlink('./decks'+path, (err) => {if (err) throw err;});
								}else{
									downloadCount = 0;
									console.log("Deck verified");
								}
							});
						}catch(e){console.log(e)}
					},12000);
				}
			});
		})
		.catch(function(err){console.log(err)})
}

//Database Builders
//allpacks
//gpbase, stat updates
function gpUpdate(msg) {									//updates the gpbase live
	if(!gpbase.hasOwnProperty('gpa1')) {
		msg.author.send("LackeyBot has just restarted and has not reloaded the GP database yet. Please wait a moment and retry the command.");
		return;
	}
	let thisGP = "skirmish";
	let gpCheck = msg.content.match(/!(gp|pt)(\d|[a-z])/i);
	if(gpCheck != null)
		thisGP = gpCheck[1].toLowerCase() + gpCheck[2].toLowerCase();
	let nameCheck = msg.content.match(/name: ?([^\n]+)/i);
	let statusCheck = msg.content.match(/status: ?(future|open|side|running|closed)/i);
	let linkCheck = msg.content.match(/link: ?([^$\n]+)/i);
	let listCheck = msg.content.match(/d?e?c?k?lists?: ?([^$\n]+)/i);
	let winCheck = msg.content.match(/winner: ?([^\n]+)/i);
	let champCheck = msg.content.match(/champi?o?n?: ?([^\n]+)/i);
	let helpCheck = msg.content.match(/help/i);
	if(helpCheck != null || (nameCheck == null && statusCheck == null && linkCheck == null && listCheck == null && winCheck == null && champCheck == null)) {
		let helpmessage = "!gpX, !ptN, or !skirmish to change the $gpX, $ptN, or $skirmish commands.\n";
		helpmessage += "You can have one or more of the following changes, separated by linebreaks.\n";
		helpmessage += "`name: Example` to set the name. `name: Example by February 29th` to add deck submission deadlines.\n";
		helpmessage += "`status: example` to set the tournament status. Accepts `future`, `open`, `side`, `running`, and `closed`.\n";
		helpmessage += "`link: example` to set the challonge link.\n";
		helpmessage += "`lists: example` to set the decklists link.";
		msg.author.send(helpmessage);
	}else{
		if(!gpbase.hasOwnProperty(thisGP))
			gpbase[thisGP] = {name: "", status: "", link: "", lists: null}
		if(nameCheck != null)
			gpbase[thisGP].name = nameCheck[1];
		if(statusCheck != null)
			gpbase[thisGP].status = statusCheck[1];
		if(linkCheck != null)
			gpbase[thisGP].link = linkCheck[1];
		if(listCheck !== null)
			gpbase[thisGP].lists = listCheck[1];
		if(winCheck !== null)
			gpbase[thisGP].winner = winCheck[1];
		if(champCheck !== null)
			gpbase[thisGP].champion = champCheck[1];
		gpbase.version++;
		editVersions();
		let words = JSON.stringify(gpbase).replace(/","/g, "\",\r\n		\"");
		words = words.replace(/\},"/g, "},\r\n\"");
		dropboxUpload('/lackeybot stuff/gpbase.json',words);
		msg.author.send(thisGP + " updated");
	}
}
function statUpdate(msg) {									//updates the stats live
	if(!stats.hasOwnProperty('cardCount')){
		msg.author.send("LackeyBot has just restarted and has not reloaded the stats database yet. Please wait a moment and retry the command.");
		return;
	}
	let countCheck = msg.content.match(/count: ?([0-9]+)/i);
	let bribeCheck = msg.content.match(/bribes: ?([0-9]+)/i);
	let boomCheck = msg.content.match(/explosions: ?([0-9]+)/i);
	let draftCheck = msg.content.match(/drafts: ?([0-9]+)/i);
	let packCheck = msg.content.match(/packs: ?([0-9]+)/i);
	let patchCheck = msg.content.match(/patch: ?([^\n]+)/i);
	let deadlineCheck = msg.content.match(/deadline: ?([^\n]+)/i);
	let releaseCheck = msg.content.match(/release: ?([^\n]+)/i);
	if(countCheck !== null)
		countingCards = parseInt(countCheck[1]);
	if(bribeCheck !== null)
		bribes = parseInt(bribeCheck[1]);
	if(boomCheck !== null)
		explosions = parseInt(boomCheck[1]);
	if(draftCheck !== null)
		draftStarts = parseInt(draftCheck[1]);
	if(packCheck !== null)
		crackedPacks = parseInt(packCheck[1]);
	if(patchCheck !== null)
		stats.patchLink = patchCheck[1];
	if(deadlineCheck !== null) {
		stats.subDead = deadlineCheck[1];
		msg.channel.send("Deadline changed to " + stats.subDead + "/" + deadlineCheck[1]);
	}
	if(releaseCheck !== null)
		stats.subRelease = releaseCheck[1];
	logStats();
	msg.channel.send("Stats updated.");
}
//plugin
function pullTokenSet(card, setbase) {						//determines what set a token belongs to
	for(let set in setbase) {
		if(card.cardID.match(set))
			return set;
		if(card.setID.match(set))
			return set;
		
	}
	return "MSEMAR";
}
//roles.json
function buildRoleRegex(server) {							//builds roleRegex on startup to reduce computation
	let servArray = [];
	if(server) {
		servArray = [server]
	}else{
		servArray = Object.keys(allRoles.guilds)
	}
	for(let serv in servArray) {
		let regString = "\\$iam(n|not)? (";
		for(let role in allRoles.guilds[servArray[serv]].roles){
			regString += role + "|";
		}
		let guildReg = new RegExp(regString.replace(/\|$/,"")+")",'i')
		roleRegex[servArray[serv]] = guildReg;
	}
	return roleRegex;
}
function newGuild(guildID){									//adds a new role server to LB
	if(!roleCall.hasOwnProperty(guildID)){
		startWriting("role");
		roleCall[guildID] = {banned:[], prefix:"", roles:{}, groups:["General","Colors"], exclusive:[], countable:{}, excluded:{}};
		return "LackeyBot has initialized this server.";
	}
	return "Server is already established."
}
function newGroup(guildID, groupName) {						//adds a new role group
	startWriting("role");
	let len = roleCall[guildID].groups.length;
	if(groupName == "")
		groupName = len;
	if(roleCall[guildID].groups.includes(groupName)){
		doneWriting("role");
		return "Group " + groupName + " already exists.";
	}
	groupName = toolbox.toTitleCase(groupName)
	roleCall[guildID].groups.push(groupName);
	return "Group " + groupName + " added at position " + len + ".";
}
function renameRole(guildID, oldName, newName) {			//renames a role
	startWriting("role");
	oldName = oldName.replace(/ $/, "").toLowerCase();
	newName = newName.toLowerCase();
	let response = ""
	if(roleCall[guildID].roles.hasOwnProperty(oldName)) {
		roleCall[guildID].roles[newName] = roleCall[guildID].roles[oldName];
		delete roleCall[guildID].roles[oldName];
		response += "Renamed role " + oldName + " to " + newName + ". "
	}else if(roleCall[guildID].givable.hasOwnProperty(oldName)) {
		roleCall[guildID].givable[newName] = roleCall[guildID].givable[oldName];
		delete roleCall[guildID].givable[oldName];
		response += "Renamed givable role " + oldName + " to " + newName + ". "
	}else if(roleCall[guildID].countable.hasOwnProperty(oldName)) {
		roleCall[guildID].countable[newName] = roleCall[guildID].countable[oldName];
		delete roleCall[guildID].countable[oldName];
		response += "Renamed countable role " + oldName + " to " + newName + ". "
	}else{
		response = "LackeyBot does not have this role.";
	}
	buildRoleRegex(guildID);
	return response;
}
function renameGroup(guildID, groupIndex, groupName) {		//renames a role group
	startWriting("role");
	if(groupName == "")
		groupName = groupIndex;
	groupName = toolbox.toTitleCase(groupName);
	if(roleCall[guildID].groups.includes(groupName)) {
		doneWriting("role");
		return "Group " + groupName + " already exists.";
	}
	let oldName = roleCall[guildID].groups[groupIndex];
	let exIndex = roleCall[guildID].exclusive.indexOf(oldName);
	if(exIndex != -1)
		roleCall[guildID].exclusive[exIndex] = groupName;
	for(let role in roleCall[guildID].roles) {
		if(roleCall[guildID].roles[role].group == oldName)
			roleCall[guildID].roles[role].group = groupName;
	}
	roleCall[guildID].groups[groupIndex] = groupName;
	return "Renamed group index " + groupIndex + " to " + groupName + ".";
}
function moveGroup(guildID, groupIndex, newGroupIndex) {	//moves a role group
	if(groupIndex == newGroupIndex)
		return "That is the same index.";
	let currentIndex = "Group " + roleCall[guildID].groups[groupIndex]
	roleCall[guildID].groups = toolbox.reassignIndex(roleCall[guildID].groups, groupIndex, newGroupIndex);
	return currentIndex + " moved to index " + newGroupIndex + ".";
}
function removeGroup(guildID, groupIndex) {					//removes a role group
	startWriting("role")
	let currentIndex = "Group " + roleCall[guildID].groups[groupIndex];
	for(let role in allRoles.guilds[guildID].roles){
		if(allRoles.guilds[guildID].roles[role].group == roleCall[guildID].groups[groupIndex])
			allRoles.guilds[guildID].roles[role].group = ""
	}
	roleCall[guildID].groups.splice(groupIndex, 1);
	return currentIndex + " removed.";
}
function makeExclusiveGroup(guildID, groupName) {			//adds an exclusive group, for things like color roles
	startWriting("role")
	groupName = toolbox.toTitleCase(groupName);
	let currentGroups = allRoles.guilds[guildID].groups;
	let currentExclu = allRoles.guilds[guildID].exclusive;
	if(currentGroups.includes(groupName)) {
		if(currentExclu.includes(groupName)) {
			currentExclu.splice(currentExclu.indexOf(groupName), 1);
			return "Group " + groupName + " is no longer exclusive.";
		}else{
			currentExclu.push(groupName);
			return "Group " + groupName + " is now exclusive.";
		}
	}else{
		newGroup(guildID, groupName);
		currentExclu.push(groupName);
		return "Exclusive group " + groupName + " added.";
	}
}
function reGroup(guildID, groupIndex, roleName) {			//resets a role's group
	startWriting("role") //todo should this be here
	if(groupIndex >= allRoles.guilds[guildID].groups.length)
		return "Index not found."
	let groupName = allRoles.guilds[guildID].groups[groupIndex];
	let theseRoles = allRoles.guilds[guildID].roles;
	roleName = roleName.toLowerCase().replace(/ $/, "");
	if(theseRoles.hasOwnProperty(roleName)) {
		theseRoles[roleName].group = groupName;
		return "Role " + roleName + " changed to group " + groupName + ".";
	}else{
		return "Role not found.";
	}
}
function newAssignableRole(guildID, roleName, giveMessage, takeMessage, group) { //adds a new role to LB
	startWriting("role")
	roleName = roleName.replace(/ $/, "")
	group = toolbox.toTitleCase(group);
	if(!allRoles.guilds[guildID].groups.includes(group))
		group = allRoles.guilds[guildID].groups[0];
	let roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	if(roleID == null) {
		roleName = roleName.toLowerCase();
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		roleName = toolbox.toTitleCase(roleName);
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		doneWriting("role")
		return "LackeyBot could not find this role.";
	}
	roleID = roleID.id;
	let roleMini = roleName.toLowerCase();
	allRoles.guilds[guildID].roles[roleMini] = {};
	allRoles.guilds[guildID].roles[roleMini].id = roleID;
	allRoles.guilds[guildID].roles[roleMini].give = giveMessage;
	allRoles.guilds[guildID].roles[roleMini].take = takeMessage;
	allRoles.guilds[guildID].roles[roleMini].group = group;
	if(allRoles.guilds[guildID].roles[roleMini].give == 0)
		allRoles.guilds[guildID].roles[roleMini].give = "You now have the " + roleName + " role.";
	if(allRoles.guilds[guildID].roles[roleMini].take == 0)
		allRoles.guilds[guildID].roles[roleMini].take = "You no longer have the " + roleName + " role.";
	buildRoleRegex(guildID);
	return roleName + " added as self assignable role.";
}
function newCountableRole(guildID, roleName) {									//adds a new countable role to LB
	startWriting("role")
	roleName = roleName.replace(/ $/, "")
	let roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	if(roleID == null) {
		roleName = roleName.toLowerCase();
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		roleName = toolbox.toTitleCase(roleName);
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		doneWriting("role");
		return "LackeyBot could not find this role.";
	}
	roleID = roleID.id;
	let roleMini = roleName.toLowerCase();
	allRoles.guilds[guildID].countable[roleMini] = {};
	allRoles.guilds[guildID].countable[roleMini].id = roleID;
	return roleName + " added as countable role.";
}
function newGivenRole(guildID, roleName, giveMessage, takeMessage, group) {		//adds a new give-only role to LB
	startWriting("role")
	roleName = roleName.replace(/ $/, "")
	group = toolbox.toTitleCase(group);
	let roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	if(roleID == null) {
		roleName = roleName.toLowerCase();
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		roleName = toolbox.toTitleCase(roleName);
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		doneWriting("role")
		return "LackeyBot could not find this role.";
	}
	roleID = roleID.id;
	let roleMini = roleName.toLowerCase();
	allRoles.guilds[guildID].givable[roleMini] = {};
	allRoles.guilds[guildID].givable[roleMini].id = roleID;
	allRoles.guilds[guildID].givable[roleMini].give = giveMessage;
	allRoles.guilds[guildID].givable[roleMini].take = takeMessage;
	allRoles.guilds[guildID].givable[roleMini].group = group;
	if(allRoles.guilds[guildID].givable[roleMini].give == 0)
		allRoles.guilds[guildID].givable[roleMini].give = "You now have the " + roleName + " role.";
	if(allRoles.guilds[guildID].givable[roleMini].take == 0)
		allRoles.guilds[guildID].givable[roleMini].take = "You no longer have the " + roleName + " role.";
	return roleName + " added as mod-givable role.";
}
function unassignRole(guildID, roleName) {										//removes a role from LB
	startWriting("role")
	roleName = roleName.replace(/ $/, "").toLowerCase();
	let response = ""
	if(roleCall[guildID].roles.hasOwnProperty(roleName)) {
		delete roleCall[guildID].roles[roleName];
		response += "Assignable role " + roleName + " deleted. "
	}else if(roleCall[guildID].givable.hasOwnProperty(roleName)) {
		delete roleCall[guildID].givable[roleName];
		response += "Givable role " + roleName + " deleted. "
	}else if(roleCall[guildID].countable.hasOwnProperty(roleName)) {
		delete roleCall[guildID].countable[roleName];
		response += "Countable role " + roleName + " deleted. "
	}else{
		doneWriting("role");
		response = "LackeyBot does not have this role.";
	}
	buildRoleRegex(guildID);
	return response;
}
function excludeRole(guildID, flag, userID, roleName){							//bans a user from having a self-assignabe role
	startWriting("role")
	let thisGuild = roleCall[guildID];
	roleName = roleName.replace(/ $/, "").toLowerCase();
	let thisRole;
	if(thisGuild.roles.hasOwnProperty(roleName)) {
		thisRole = thisGuild.roles[roleName];
	}else{
		roleName = fuzzy.searchArray(roleName.replace(/ /g,""), Object.keys(thisGuild.roles,{percent:0.33}))[0];
		thisRole = thisGuild.roles[roleName];
	}
	if(flag.match(/arenot/)) {
		if(!thisGuild.hasOwnProperty('excluded'))
			thisGuild.excluded = {};
		if(!thisGuild.excluded.hasOwnProperty(thisRole.id))
			thisGuild.excluded[thisRole.id] = [];
		thisGuild.excluded[thisRole.id].push(userID)
		let thatMember = Client.guilds.cache.get(guildID).members.cache.get(userID)
		adjustRoles(roleName, guildID, thatMember, "roles", true); //remove the role
		return `${thatMember.user.username} can no longer assign ${roleName}.`;
	}else{
		let userIndex = thisGuild.excluded[thisRole.id].indexOf(userID)
		thisGuild.excluded[thisRole.id].splice(userIndex, 1)
		let thatMember = Client.guilds.cache.get(guildID).members.cache.get(userID)
		return `${thatMember.user.username} can now assign ${roleName} again.`;
	}
}
function toggleFightRole(guildID, fightID) {									//toggles if a server uses the $fight/$unfight commands
	startWriting("role")
	if(allRoles.fightGuilds.hasOwnProperty(guildID)) {
		delete allRoles.fightGuilds[guildID];
		return "Server no longer has a fight role."
	}
	allRoles.fightGuilds[guildID] = fightID;
	return "Server now has a fight role."
}
function createNewRole(guildID, roleName, roleColor, hoist, mention, group, channel, giveFlag) { //create a new role in the guild
	roleName = roleName.replace(/ $/, "")
	if(!allRoles.guilds[guildID].groups.includes(group))
		group = allRoles.guilds[guildID].groups[0];
	let roleData = {name:roleName, color:roleColor, hoist:hoist, mentionable:mention}
	let callback = function(role) {
		let output = "";
		if(giveFlag == "a") {
			output += newAssignableRole(guildID, roleName, "", "", group);
		}else if(giveFlag == "g") {
			output += newGivenRole(guildID, roleName, "", "", group);
		}else if(giveFlag == "c") {
			output += newCountableRole(guildID, roleName);
		}
		logRole(guildID);
		output = `Created new role with name ${role.name}\n` + output;
		channel.send(output);
	};
	Client.guilds.cache.find(val => val.id == guildID).roles.create({data:roleData, reason:"Created with LackeyBot"})
		.then(role => callback(role))
		.catch(e => console.log(e))
}
function changeRolePrefix(guildID, prefix) {									//TODO doesn't work yet
	allRoles.guilds[guildID].prefix = prefix;
	buildRoleRegex(guildID);
}
function sortGuildRoles(guildRoles) {											//sorts the guilds roles by group number, then alphabetically
	let theseGroups = guildRoles.groups;
	let theseRoles = guildRoles.roles;
	let roleArray = Object.keys(theseRoles);
	roleArray.sort(); //sort alphabetically
	/*roleArray.sort(function(a,b){ //then arrange by group indexes
		let result = theseGroups.indexOf(theseRoles[a].group) - theseGroups.indexOf(theseRoles[b].group)
		return result;
	});
	//wasn't working on live for some reason??? */
	let workAround = {};
	for(let group in theseGroups){ //save them per group
		workAround[theseGroups[group]] = [];
	}
	workAround["Unsorted"] = [];
	for(let role in roleArray){ //push them alphabetically
		let roleGroup = "Unsorted";
		if(theseRoles[roleArray[role]].group != "")
			roleGroup = theseRoles[roleArray[role]].group
		workAround[roleGroup].push(roleArray[role])
	}
	let newroleArray = [];
	for(let group in theseGroups){ //add them to a new array by group alphabetically
		for(let role in workAround[theseGroups[group]])
			newroleArray.push(workAround[theseGroups[group]][role]);
	}
	return newroleArray;
}
function writeRoleStack(guildID, page, textFlag) {								//writes the stack of roles and their group number
	let theseRoles = allRoles.guilds[guildID].roles;
	let theseNames = sortGuildRoles(allRoles.guilds[guildID]);
	let allArray = [[]];
	let j = 0;
	for(let i=0; i<theseNames.length; i++) {
		if(i == 0){
			allArray[j].push(theseNames[i])
		}else if(allArray[j].length < 20 && theseRoles[theseNames[i]].group == theseRoles[theseNames[i-1]].group){
			allArray[j].push(theseNames[i])
		}else{
			j++;
			allArray.push([]);
			allArray[j].push(theseNames[i])	
		}
	}
	let pageArray = [(3*page)%allArray.length];
	let p2 = (3*page+1)%allArray.length
	if(!pageArray.includes(p2))
		pageArray.push(p2)
	let p3 = (3*page+2)%allArray.length
	if(!pageArray.includes(p3))
		pageArray.push(p3)
	let outputArray = []
	for(let page in pageArray)
		outputArray.push(allArray[pageArray[page]])
	return [outputArray, theseNames.length, Math.ceil(allArray.length/3)];
}
function buildRoleEmbed(guildID, page, textFlag) {								//builds a page of the roles embed for a guild
	let rolestuff = writeRoleStack(guildID, page, textFlag);
	let roleArrays = rolestuff[0];
	let pages = rolestuff[2];
	let roleObj = {};
	let i = 0;
	for(let roleArray in roleArrays){
		roleObj[i] = {header:"", string:""};
		roleObj[i].header = allRoles.guilds[guildID].roles[roleArrays[roleArray][0]].group;
		if(roleObj[i].header == "")
			roleObj[i].header = "Unsorted";
		for(let role in roleArrays[roleArray]){
			roleObj[i].string += roleArrays[roleArray][role] + "\n";
		}
		i++;
	}
	if(textFlag) {
		let embedText = "There are " + rolestuff[1] + " self-assignable roles. Use $iam [role] to assign them (e.g. `$iam judge`). Using the command again or `$iamnot [role]` will remove it."
		for(let grouping in roleObj) {
			embedText += "\n**" + roleObj[grouping].header + "**\n" + roleObj[grouping].string
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("There are " + rolestuff[1] + " self-assignable roles.")
			.setFooter("Page " + parseInt(page+1) + "/" + pages + ". 💬 to restore embed.")
		return [[embedText, nullEmbed], pages]
	}
	var exampleEmbed = new Discord.MessageEmbed()
		.setColor('#0099ff')
		.setTitle("There are " + rolestuff[1] + " self-assignable roles.")
		.setDescription("Use $iam [role] to assign them (e.g. `$iam judge`). Using the command again or `$iamnot [role]` will remove it.")
		.setFooter("Page " + parseInt(page+1) + "/" + pages + ". 💬 for plaintext.")
	for(let grouping in roleObj) {
		exampleEmbed.addField(roleObj[grouping].header, roleObj[grouping].string, true)
	}
	return [exampleEmbed, pages];
}
function buildInRoleEmbed(guild, roleName, page, textFlag) {					//build inrole embed
	roleName = roleName.replace(/ $/, "")
	let members;
	let roleColor = "00ff33";
	if(allRoles.guilds[guild.id].roles.hasOwnProperty(roleName)) { //exact role
		let roleData = guild.roles.cache.get(allRoles.guilds[guild.id].roles[roleName].id);
		members = roleData.members.array();
		if(roleData.color)
			roleColor = roleData.color;
	}else if(allRoles.guilds[guild.id].countable.hasOwnProperty(roleName)) { //exact countable
		let roleData = guild.roles.cache.get(allRoles.guilds[guild.id].countable[roleName].id);
		members = roleData.members.array();
		if(roleData.color)
			roleColor = roleData.color;
	}else{ //fuzzy
		let first = fuzzy.searchArray(roleName, Object.keys(allRoles.guilds[guild.id].roles), {percent:0.33});
		let second = fuzzy.searchArray(roleName, Object.keys(allRoles.guilds[guild.id].countable), {percent:0.33});
		if(first[1] == 0 && second[1] == 0)
			return ["Role not found.", null];
		if(first[1] > second[1]) {
			roleName = first[0];
			let roleData = guild.roles.cache.get(allRoles.guilds[guild.id].roles[roleName].id);
			members = roleData.members.array();
			if(roleData.color)
				roleColor = roleData.color;
		}else{
			roleName = second[0];
			let roleData = guild.roles.cache.get(allRoles.guilds[guild.id].countable[roleName].id);
			members = roleData.members.array();
			if(roleData.color)
				roleColor = roleData.color;
			}
	}
	if(members.length == 0) {
		let embedded = new Discord.MessageEmbed()
			.setTitle("List of users in " + roleName + " role - " + members.length)
			.setColor(roleColor)
			.addField("Users", "No one has the " + roleName + " role.")
			.setFooter("Page 1/1")
		if(textFlag)
			return [["No one has the " + roleName + " role.", embedded], null]
		return [embedded, 1];
	}
	let memberArray = [];
	for(let mem in members)
		memberArray.push(members[mem].user.username);
	if(textFlag) {
		let pages = Math.ceil(memberArray.length/20);
		let embedText = "**List of users in " + roleName + " role - " + members.length + "**";
		let start = page*20;
		let end = Math.min(start+20, members.length);
		for(let i = start; i<end; i++) {
			embedText += "\n" + memberArray[i];
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("List of users in " + roleName + " role - " + members.length)
			.setFooter("Page " + parseInt(page+1) + "/" + pages)

		return [[embedText, nullEmbed], pages]
	}
	let embedInfo = buildGeneralEmbed(memberArray, "Users", page, 20)
	let embedded = embedInfo[0];
	embedded.setColor(roleColor);
	embedded.setTitle("List of users in " + roleName + " role - " + members.length);
	return [embedded, embedInfo[1]];
}
function isExcluded(guild, role, user) {										//checks if a user has been excluded from assigning a role
	if(guild.excluded.hasOwnProperty(role)) {
		if(guild.excluded[role].includes(user))
			return true;
	}
	return false;
}
function adjustRoles(littleName, thisGuild, member, base, forceRemove){			//adds/removes/toggles roles
	if(littleName && roleCall[thisGuild][base].hasOwnProperty(littleName.toLowerCase())) {
		bribes++;
		let type = null;
		let userRoles = member.roles.cache;
		let userRolesArray = userRoles.array();
		let thisRole = roleCall[thisGuild][base][littleName];
		if(userRoles.find(val => val.id == thisRole.id)){
			member.roles.remove(thisRole.id).catch(console.error);
			return thisRole.take;
		}else if(forceRemove || isExcluded(roleCall[thisGuild], thisRole.id, member.id)) {
			return "";
		}else{
			if(roleCall[thisGuild].exclusive.includes(thisRole.group)){
				let exclusiveIDs = objectFindAll(roleCall[thisGuild][base], "group", new RegExp('^'+thisRole.group+'$', 'i'), "id")
				for(let role in userRolesArray) {
					if(exclusiveIDs.includes(userRolesArray[role].id))
						member.roles.remove(userRolesArray[role].id).catch(console.error);
				}
				/*for(let role in roleCall[thisGuild][base]) {
					if(roleCall[thisGuild][base][role].group == thisRole.group)
						member.roles.remove(roleCall[thisGuild][base][role].id).catch(console.error);
				}*/
			}
		}
		member.roles.add(thisRole.id).catch(console.error);
		return thisRole.give;
	}
}
function objectFindAll(obj, key, match, returnKey) {							//returns array of object keys that match a particular key
	let output = [];
	for(let k in obj) {
		if(obj[k][key].match(match)) {
			if(returnKey) {
				output.push(obj[k][returnKey])
			}else{
				output.push(k);
			}
		}
	}
	return output;
}
//mtgjson/instigator
function mtgjsonSetsBuilder(user, library) {							//build jsons for instigator or trice
	let ASA = {};//require('./triceFiles/AllCanonSets.json');
	for(let set in library.setData) {
		ASA[set] = mtgjsonBuilder(set,user,1,library)
	}
	let v5ASA = {meta:{}, data:ASA};
	let words = JSON.stringify(v5ASA).replace(/’/g, "'");
	fs.writeFile('jsons/AllSets.json', words, (err) => {
		if (err) throw err;
		console.log('AllSets.json written');
	});
	/*user.send("AllSets jsonified:", {
	file: 'jsons/AllSets.json'
		});
	fs.readFile('./triceFiles/tokens.xml', "utf8", function read(err, data1) {
		if (err) throw err;
		fs.readFile('./triceFiles/canonTokens.xml', "utf8", function read(err, data2) {
			if (err) throw err;
			let tokenStuff = data1.replace("</cards>\r\n</cockatrice_carddatabase>","");
			tokenStuff += data2.replace(/[\s\S]*<cards>/, "");
			fs.writeFile(filename, tokenStuff, (err) => {
				if (err) throw err;
			});
		});
	});*/
}
function mtgjsonBuilder (thisSet, user, skip, library) {	//builds an mtgjson file for the given set
	let cardsArray = [];
	let leng = 0;
	if(!library)
		library = arcana.msem;
	//create an array of sets and an object of sets with name arrays
	//goal is object of unkeyed objects, ie {{stuff},{stuff},{stuff}}
	let database = library.cards
	for(let thisCard in database) {
		if(database[thisCard].setID != "BOT") {
			if(library.name == "msem" && legal.masterpiece.includes(database[thisCard].fullName)) {
				//skip masterpieces
			}else if(!skip && database[thisCard].setID == thisSet) { //if its instigator, send them all
				cardsArray.push(thisCard);
				leng++;
			}else if(skip && database[thisCard].setID == thisSet && checkPromo(thisCard, database[thisCard])){ //if its trice, skip promos
				cardsArray.push(thisCard);
				leng++;
			}
		}
	}
	//create the set object for each set
	//pass along the array of names to create the cards array
	let thisEntry = {};
	thisEntry.name = library.setData[thisSet].longname;
	thisEntry.code = thisSet;
	thisEntry.gathererCode = thisSet;
	thisEntry.magicCardsInfoCode = thisSet;
	thisEntry.releaseDate = library.setData[thisSet].releaseDate;
	thisEntry.border = "black";
	thisEntry.type = "expert";
	thisEntry.booster = [];
	thisEntry.mkm_name = library.setData[thisSet].longname;
	thisEntry.mkm_id = library.setData[thisSet].releaseNo;
	thisEntry.cards = mtgjsonCardsBuilder(cardsArray, skip, library);
	if(skip) {
		return thisEntry;
	}else{
		let words = JSON.stringify(thisEntry).replace(/’/g, "'");
		fs.writeFile('jsons/'+thisSet + '.json', words, (err) => {
			if (err) throw err;
			console.log(thisSet + '.json written');
			});
		user.send(thisSet + " jsonified:", {
			files: [{attachment:'jsons/' + thisSet + '.json'}]
		});
	}

}
function mtgjsonCardsBuilder(nameArray, skip, library) {	//creates the cards array for a set's mtgjson file
	let leng = nameArray.length;
	let thisCardArray = [];
	nameArray.sort();
	for(let thisName in nameArray){
		let thisCard = library.cards[nameArray[thisName]];
		let thisEntry = {};
		let reprint = library.name == "msem" && thisCard.notes.includes("reprint") && thisCard.setID != "SHRINE" && thisCard.setID != "LAIR";
		let cardNames = [thisCard.cardName, ""];
		if(thisCard.hasOwnProperty("cardName2"))
			cardNames[1] = thisCard.cardName2;
		if(thisCard.hasOwnProperty("hidden")) {
			cardNames = thisCard.hidden.split("//")
			cardNames.push("");
		}

		//TODO redo this
		thisEntry.artist = thisCard.artist.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
		thisEntry.convertedManaCost = thisCard.cmc;
		thisEntry.cmc = thisCard.cmc;
		thisEntry.colors = arrayifyColors(thisCard.color);
		if(skip) {
			for(let color in thisEntry.colors)
				thisEntry.colors[color] = flipColors(thisEntry.colors[color]);
		}
		thisEntry.color_identity = thisEntry.colors;
		thisEntry.colorIdentity = thisEntry.colors;
		thisEntry.designer = "";
		if(thisCard.designer != "") {
			thisEntry.designer = thisCard.designer;
		}else{
			//console.log(thisCard);
		}
		if(thisCard.flavorText != "")
			thisEntry.flavor = thisCard.flavorText.replace(/[*]/g, "");
		thisEntry.id = nameArray[thisName];
		thisEntry.imageName = cardNames[0].toLowerCase().replace(/’/g,"'");
		thisEntry.layout = thisCard.shape.replace("doubleface", "double-faced").replace("adventure", "normal");
		if(skip && thisCard.shape == "doubleface")
			thisEntry.layout = "transform";
		thisEntry.legalities = arrayifyLegal(cardNames[0].replace(/’/g,"'"), library);
		if(thisCard.loyalty !== "")
			thisEntry.loyalty = thisCard.loyalty;
		thisEntry.manaCost = thisCard.manaCost;
		if(thisCard.shape == "doubleface") {
			thisEntry.mciNumber = thisCard.cardID + "a";
		}else{
			thisEntry.mciNumber = thisCard.cardID;
		}
		if(thisCard.hasOwnProperty('instigatorID')){
			thisEntry.multiverseid = thisCard.instigatorID;
		}else if(thisCard.hasOwnProperty('multiverseid')){
			thisEntry.multiverseid = thisCard.multiverseid;
		}
		thisEntry.name = cardNames[0].replace(/’/g,"'");
		if(skip) {
			if(thisCard.shape == "split")
				thisEntry.name = thisCard.fullName.replace(/’/g,"'").replace("//", " // ");
			(thisCard.shape == "doubleface")
				thisEntry.name = cardNames[0].replace(/’/g,"'")
			if(reprint) {
				thisEntry.name += "_" + thisCard.setID;
			}
		}
		let two_names = [];
		two_names.push(thisEntry.name)
		if(thisCard.shape == "doubleface" || thisCard.shape == "split") {
			thisEntry.names = [thisEntry.name, thisEntry.name.replace(cardNames[0].replace("’","'"), cardNames[1].replace("’","'"))];
			if(skip && thisCard.shape == "doubleface")
				thisEntry.name = cardNames[0] + (reprint ? "_" + thisCard.setID:"") + " // " + cardNames[1] + (reprint ? "_" + thisCard.setID:"")
			thisEntry.id = cardNames[0] + "_" + thisCard.setID;
			thisEntry.uuid = cardNames[0] + "_" + thisCard.setID;
			thisEntry.otherFaceIds = [cardNames[1] + "_" + thisCard.setID];
			thisEntry.side = "a";
			thisEntry.faceName = cardNames[0] + (reprint ? "_" + thisCard.setID:"");
		}
		if(thisCard.shape == "doubleface") { //|| thisCard.shape == "split") { //instigatorchange
			thisEntry.number = thisCard.cardID + "a";
			if(skip && thisCard.setID == "FLP")
				thisEntry.number = thisCard.cardID + "sa";
		}else{
			thisEntry.number = thisCard.cardID;
		}
		if(skip)
			thisEntry.number = thisEntry.number.replace(/s/g, "");
		if(!skip) {
			if(thisCard.rulesText != "\n")
				thisEntry.originalText = thisCard.rulesText.replace(/[*]/g, "");
			thisEntry.originalType = thisCard.typeLine.replace(/ $/, "");
		}
		if(thisCard.power !== "")
			thisEntry.power = thisCard.power.toString();
		thisEntry.rarity = thisCard.rarity.replace(/(masterpiece|bonus)/, "special");
		if(skip && thisEntry.rarity == "special")
			thisEntry.rarity = "s";
		if(thisCard.setID == "MPS_MSE")
			thisEntry.rarity = "special";
		if(!skip) {
			if(oracle.hasOwnProperty(cardNames[0].replace(/’/g,"'")))
				thisEntry.rulings = arrayifyRulings(cardNames[0].replace(/’/g,"'"));
		}
		if(thisCard.typeLine.match("—"))
			thisEntry.subtypes = arrayifyTypes(thisCard.typeLine.replace(/[A-Z ]+—/i, ""));
		let supertypes = thisCard.typeLine.split(" — ")[0];
		supertypes = supertypes.replace(thisCard.cardType, "");
		if(supertypes != "")
			thisEntry.supertypes = arrayifyTypes(supertypes);
		if(thisCard.rulesText != "\n")
			thisEntry.text = thisCard.rulesText.replace(/[*]/g, "");
		if(thisCard.toughness !== "")
			thisEntry.toughness = thisCard.toughness.toString();
		thisEntry.type = thisCard.typeLine.replace(/ $/, "");
		thisEntry.types = arrayifyTypes(thisCard.cardType);
		thisCardArray.push(thisEntry);
		
		if(thisCard.shape == "doubleface" || thisCard.shape == "split") {
			let thisEntry = {};
			if(thisCard.artist2 != undefined) {
				thisEntry.artist = thisCard.artist2.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
			}else{
				thisEntry.artist = thisCard.artist.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
			}
			if(thisCard.shape == "doubleface") {
				thisEntry.convertedManaCost = thisCard.cmc;
			}else{
				thisEntry.convertedManaCost = thisCard.cmc2;
			}
			thisEntry.colors = arrayifyColors(thisCard.color2);
			if(skip) {
				for(let color in thisEntry.colors)
					thisEntry.colors[color] = flipColors(thisEntry.colors[color]);
			}
			thisEntry.color_identity = thisEntry.colors;
			thisEntry.colorIdentity = thisEntry.colors;
			thisEntry.designer = "";
			if(thisCard.designer != undefined)
				thisEntry.designer = thisCard.designer;
			if(thisCard.flavorText2 != "")
				thisEntry.flavor = thisCard.flavorText2.replace(/[*]/g, "");
			thisEntry.id = cardNames[0] + "_" + thisCard.setID + "b";
			thisEntry.imageName = cardNames[1].toLowerCase().replace(/’/g,"'");
			thisEntry.layout = thisCard.shape.replace("doubleface", "double-faced");
			thisEntry.legalities = arrayifyLegal(thisCard.cardName.replace(/’/g,"'"), library);
			if(thisCard.loyalty !== "")
				thisEntry.loyalty = thisCard.loyalty2;
			thisEntry.manaCost = thisCard.manaCost2;
			thisEntry.mciNumber = thisCard.cardID + "b";
			if(thisCard.shape == "split") //instigatorchange
				thisEntry.mciNumber = thisCard.cardID;
			if(thisCard.hasOwnProperty('instigatorID')){
				thisEntry.multiverseid = thisCard.instigatorID;
			}else if(thisCard.hasOwnProperty('multiverseid')){
				thisEntry.multiverseid = thisCard.multiverseid;
			}
			
			thisEntry.name = cardNames[1].replace(/’/g,"'");
			if(skip) {//cockatrice
				if(thisCard.shape == "split")
					thisEntry.name = thisCard.fullName.replace(/’/g,"'").replace("//", " // ");
				if(thisCard.shape == "doubleface") {
					thisEntry.name = cardNames[1].replace(/’/g,"'");
					thisEntry.layout = "transform";
				}
				if(reprint) {
					thisEntry.name += "_" + thisCard.setID;
				}
				thisEntry.side = "b";
				if(thisCard.shape == "doubleface") {//cockatrice
					if(thisCard.shape == "doubleface")
						thisEntry.name = cardNames[0] + (reprint ? "_" + thisCard.setID:"") + " // " + cardNames[0] + (reprint ? "_" + thisCard.setID:"")
				}
			}
			two_names.push(thisEntry.name)
			thisEntry.names = two_names;
			thisEntry.number = thisCard.cardID + "b";
			if(skip && thisCard.setID == "FLP")
				thisEntry.number = thisCard.cardID + "sb";
			if(thisCard.shape == "split") //instigatorchange
				thisEntry.number = thisCard.cardID;
			if(skip) {
				thisEntry.number = thisEntry.number.replace(/s/g, "");
				thisEntry.id = cardNames[1] + "_" + thisCard.setID;
				thisEntry.uuid = cardNames[1] + "_" + thisCard.setID;
				thisEntry.otherFaceIds = [cardNames[0] + "_" + thisCard.setID];
				thisEntry.faceName = cardNames[1] + (reprint ? "_" + thisCard.setID : "");
			}
			if(!skip) {
				if(thisCard.rulesText2 != "\n")
					thisEntry.originalText = thisCard.rulesText2.replace(/[*]/g, "");
				thisEntry.originalType = thisCard.typeLine2.replace(/ $/, "");
			}
			if(thisCard.power2 !== "")
				thisEntry.power = thisCard.power2.toString();
			
			thisEntry.rarity = thisCard.rarity.replace(/(masterpiece|bonus)/, "special");
			if(skip && thisEntry.rarity == "special")
				thisEntry.rarity = "s"
			if(thisCard.setID == "MPS_MSE")
				thisEntry.rarity = "special";
			if(!skip) {
				if(oracle.hasOwnProperty(thisCard.cardName.replace(/’/g,"'")))
					thisEntry.rulings = arrayifyRulings(thisCard.cardName.replace(/’/g,"'"));
			}
			if(thisCard.typeLine2.match("—"))
				thisEntry.subtypes = arrayifyTypes(thisCard.typeLine2.replace(/[A-Z ]+—/i, ""));
			supertypes = thisCard.typeLine2.split(" — ")[0];
			supertypes = supertypes.replace(thisCard.cardType2, "");
			if(supertypes != "")
				thisEntry.supertypes = arrayifyTypes(supertypes);
			if(thisCard.rulesText2 != "\n")
				thisEntry.text = thisCard.rulesText2.replace(/[*]/g, "");;
			if(thisCard.toughness2 !== "")
				thisEntry.toughness = thisCard.toughness2.toString();
			thisEntry.type = thisCard.typeLine2.replace(/ $/, "");
			thisEntry.types = arrayifyTypes(thisCard.cardType2);

			thisCardArray.push(thisEntry);
		}
	}
	return thisCardArray;
}
function arrayifyColors(theseColors) {						//creates the color array for mtgjson
	let colormatch = theseColors.match(/[{]([A-Z]+)\/?([A-Z]+)?\/?([A-Z]+)?\/?([A-Z]+)?\/?([A-Z]+)?\/?[}]/i);
	let colorArray = [];
	for(var c = 1; c < 6; c++) {
		if(colormatch !== null && colormatch[c] !== undefined)
			colorArray.push(colormatch[c]);
	}
	return colorArray;
}
function flipColors(thisColor) {							//converts Blue <-> U etc
	let refArray = ["W", "U", "B", "R", "G"];
	let nameArray = ["White", "Blue", "Black", "Red", "Green"];
	let index = refArray.indexOf(thisColor); //check if WUBRG
	if(index != -1) { 						 //if it is
		return nameArray[index];			 //send its name
	}else{
		index = nameArray.indexOf(thisColor); //check if name
		if(index == -1)						  //if it's not
			return "";						  //send ""
		return refArray[index];		  //otherwise send its letter
	}
}
function calculateColorIdentity(card) {						//creates the color identity array from card data
	let refArray = ["W", "U", "B", "R", "G"];
	let nameArray = ["White", "Blue", "Black", "Red", "Green"];
	let baseColors = arrayifyColors(card.color);
	let backColors = []
	if(card.hasOwnProperty('color2'))
		backColors = arrayifyColors(card.color2)
	for(let color in backColors) {
		if(!baseColors.includes(backColors[color]))
			baseColors.push(backColors[color])
	}
	let textLine = card.rulesText;
	if(card.hasOwnProperty('rulesText2'))
		textLine += card.rulesText2;
	let colorTest = textLine.match(/\{[WUBRG]\}/g);
	if(colorTest) {
		for(let color in colorTest) {
			let colorLetter = colorTest[color].match(/[WUBRG]/);
			let colorName = nameArray[refArray.indexOf(colorLetter[0])]
			if(!baseColors.includes(colorName))
				baseColors.push(colorName);
		}
	}
	return baseColors;
}
function arrayifyLegal (thisName, library) {				//creates the legality array for mtgjson
	let legalArray = [];
	let legalEntry = {};
	if(library == arcana.myriad){
		return [{format: "Myriad", legality: "Legal"}];
	}
	if(legal.masterpiece.includes(thisName)) {
		legalEntry.format = "MSEDH";
		if(legal.edhBan.includes(thisName)){
			legalEntry.legality = "Banned";
		}else{
			legalEntry.legality = "Legal";
		}
		legalArray.push(legalEntry);
	}else{
		legalEntry.format = "MSEM2";
		if(legal.modernBan.includes(thisName)) {
			legalEntry.legality = "Banned";
		}else{
			legalEntry.legality = "Legal";
		}
		legalArray.push(legalEntry);
		legalEntry = {};
		legalEntry.format = "MSEDH";
		if(legal.edhBan.includes(thisName)){
			legalEntry.legality = "Banned";
		}else{
			legalEntry.legality = "Legal";
		}
		legalArray.push(legalEntry);
	}
	return legalArray;
}
function arrayifyRulings (thisName) { 						//creates the legality array for mtgjson
	let theseRules = oracle[thisName];
	let rulMatch = theseRules.match(/([^_]+)(_ |$)/ig);
	let leng = rulMatch.length;
	let ruleArray = [];
	for(var i = 0; i < leng; i++) {
		let thisRule = {};
		thisRule.date = "2018-09-03";
		let thisRulMatch = rulMatch[i].match(/([^_]+)(_ |$)/i);
		thisRule.text = thisRulMatch[1].replace("\n", "");
		ruleArray.push(thisRule);
	}
	return ruleArray;
}
function arrayifyTypes (theseTypes) {						//creates type arrays for mtgjson
	let subtypeMatch = theseTypes.match(/([A-Z][a-z]+)( |$)/g)
	let subtypeArray = [];
	if(subtypeMatch !== null) {
		let leng = subtypeMatch.length;
		for(let type in subtypeMatch) {
			subtypeMatch[type] = subtypeMatch[type].replace(/ $/, "");
			subtypeArray.push(subtypeMatch[type]);
		}
	}
	return subtypeArray;
}
function checkPromo(dataName, cardData) {					//checks if a card is a skipped promo
	if(dataName.match(/_PRO/) && !cardData.typeLine.match(/Basic/))
		return false;
	return true;
}
function makeMultiverse() {									//creates an instigatorID for each card in cards
	let releaseArray = [];
	let allSets = {};
	let allPromos = {};
	let allTokens = {};
	let leng = 1;
	for(let thisSet in msemSetData)
		leng++;
	let instigatorNumber = instData.nextInstigatorID;
	for(var i = 1; i < leng; i++) {
		for(let thisSet in msemSetData) {
			if(msemSetData[thisSet].releaseNo == i)
				releaseArray.push(thisSet);
		}
	}
	let database = arcana.msem.cards
	for(let thisCard in database) {
		let thisSet = database[thisCard].setID;
		if(thisSet != "BOT") {
			if(thisSet == "tokens") {
				let setmatch = thisCard.match(/_(TKN|PRO)_([A-Z1-9_]+)/i);
				thisSet = setmatch[2];
				if(allTokens[thisSet] == undefined)
					allTokens[thisSet] = [];
				allTokens[thisSet].push(thisCard);
			}else{
				if(database[thisCard].rarity == "special") {
					let setmatch = thisCard.match(/_PRO_([A-Z1-9_]+)/i);
					thisSet = setmatch[1];
					if(allPromos[thisSet] == undefined)
						allPromos[thisSet] = [];
					allPromos[thisSet].push(thisCard);
				}else{
					if(allSets[thisSet] == undefined)
						allSets[thisSet] = [];
					allSets[thisSet].push(thisCard);
				}
			}
		}
	}
	let thatCard = "";
	for(let thisSet in releaseArray) {
		let thatSet = releaseArray[thisSet];
		allSets[thatSet].sort();
		for(let thisCard in allSets[thatSet]) {
			thatCard = allSets[thatSet][thisCard];
			database[thatCard].instigatorID = instigatorNumber;
			instigatorNumber++;
		}
		instigatorNumber += 5;
		if(allPromos[thatSet] != undefined) {
			allPromos[thatSet].sort();
			for(let thisCard in allPromos[thatSet]) {
				thatCard = allPromos[thatSet][thisCard];
				database[thatCard].instigatorID = instigatorNumber;
				instigatorNumber++;
			}
			instigatorNumber += 5;
		}
		if(allTokens[thatSet] != undefined) {
			allTokens[thatSet].sort();
			for(let thisCard in allTokens[thatSet]) {
				thatCard = allTokens[thatSet][thisCard];
				database[thatCard].instigatorID = instigatorNumber;
				instigatorNumber++;
			}
		}
		instigatorNumber += 10;
		instData.nextInstigatorID = instigatorNumber;
		console.log(thatSet + " instigated, current number: " + instigatorNumber);
	}
	let words = JSON.stringify(database).replace(/[}],"/g,"},\n	\"");
	fs.writeFile('msem/cardstest.json', words, (err) => {
		if (err) throw err;
		console.log('makeMultiverse(): msem/cardstest.json written');
		});

}
function instigate(thisSet) {								//creates an instigatorID for each card in a given set
	let allCards = [];
	let allPromos = [];
	let allTokens = [];
	let instigatorNumber = instData.nextInstigatorID;
	for(let thisCard in arcana.msem.cards) {
		let thatSet = arcana.msem.cards[thisCard].setID;
		if(thatSet != "BOT") {
			if(thatSet == "tokens") {
				let setmatch = thisCard.match(/_(TKN|PRO)_([A-Z1-9_]+)/i);
				thatSet = setmatch[2];
				if(thisSet == thatSet)
					allTokens.push(thisCard);
			}
			if(thisSet == thatSet){
				if(arcana.msem.cards[thisCard].rarity == "special") {
					allPromos.push(thisCard);
				}else{
					allCards.push(thisCard);
				}
			}
		}
	}
	let thatCard = "";
	
	allCards.sort();
	for(let thisCard in allCards) {
		thatCard = allSets[thisCard];
		arcana.msem.cards[thatCard].instigatorID = instigatorNumber;
		instigatorNumber++;
	}
	instigatorNumber += 5;
	if(allPromos != undefined) {
		allPromos.sort();
		for(let thisCard in allPromos) {
			thatCard = allPromos[thisCard];
			arcana.msem.cards[thatCard].instigatorID = instigatorNumber;
			instigatorNumber++;
		}
		instigatorNumber += 5;
	}
	if(allTokens != undefined) {
		allTokens.sort();
		for(let thisCard in allTokens) {
			thatCard = allTokens[thisCard];
			arcana.msem.cards[thatCard].instigatorID = instigatorNumber;
			instigatorNumber++;
		}
	}
	instigatorNumber += 10;
	instData.nextInstigatorID = instigatorNumber;
	console.log(thatSet + " instigated, current number: " + instigatorNumber);
	
	let words = JSON.stringify(arcana.msem.cards).replace(/[}],"/g,"},\n	\"");
	fs.writeFile('msem/cardstest.json', words, (err) => {
		if (err) throw err;
		console.log('msem/cardstest.json written');
		});
}
//MSE
function namelistBuilder(database, user) {					//creates a list of names for the Name Exporter
	let namelistArray = [];
	let nameString = "";
	for(let thisCard in database) {
		if(namelistArray.includes(database[thisCard].cardName) || database[thisCard].rarity == "basic land" || database[thisCard].setID == "CMB1" || database[thisCard].setID == "tokens" || database[thisCard].shape == "command"){
			//console.log(database[thisCard].cardName.replace(/\*/g,""))
		}else{
			namelistArray.push(database[thisCard].cardName);
			if(database[thisCard].cardName2 !== undefined)
				namelistArray.push(database[thisCard].cardName2);
		}
	}
	for(var i=0; i<namelistArray.length; i++) {
		nameString += namelistArray[i];
		if(i !== namelistArray.length-1)
			nameString += "|";
	}
	let nearnameString = nameString.replace(/(and|or|in|into|to|upon|the|of|from|at|through|with) /ig, "");
	nameString = "	#The name list\n	name_list := { \"(" + nameString + ")\"}\n\n";
	nameString += "	near_name_list := { \"(" + nearnameString + ")\"}\n";
	fs.writeFile('namelist.txt', nameString, (err) => {
		if (err) throw err;
		});
	user.send({
		files: [{attachment:"./namelist.txt", name:"namelist.txt"}]
		});
}

//Old Database functions that have been left for reference/backup
function checkNewStuff() {									//checks if each card has an artist and an instigatorID
	for(let thisCard in arcana.msem.cards) {
		if(arcana.msem.cards[thisCard].setID != "BOT") {
			if(arcana.msem.cards[thisCard].artist == undefined)
				console.log(thisCard + " has no artist.");
			if(arcana.msem.cards[thisCard].instigatorID == undefined)
				console.log(thisCard + " has no ID");
		}
	}
	console.log("Done checking new stuff");
}
function addArtists() {										//adds artist characteristic to existing cards
	for(let thisCard in arttemp) {
		console.log(thisCard);
		arcana.msem.cards[thisCard].artist = arttemp[thisCard].artist;
		console.log(thisCard + " credited");
	}
	let words = JSON.stringify(arcana.msem.cards).replace(/[}],"/g,"},\n	\"");
	fs.writeFile('msem/cardstest.json', words, (err) => {
		if (err) throw err;
		console.log('msem/cardstest.json written');
		});

}

//toy mechanics
//Timeline
function buildTime (year, starting, ending) {				//the timeline handler
	let output = year + starting;
	if(year == "0" && (starting == "NKY" || starting == "OKY"))
		year = "-1"
	year = convertAR(Number.parseFloat(year), starting);
	let holding = ""
	let floatNo = 0;
	if(ending == "")
		ending = ["AR", "PM", "NKY", "VY", "WE", "DAT", "AC", "CE"];
	if(starting == "DAT")
		floatNo = 2;
	for(var i = 0; i < ending.length; i++) {
		if(ending[i] != starting) {
			holding = convertCalendar(year, ending[i],floatNo);
			if(starting != "EY" && holding[1] == "VY" && parseInt(holding[0]) > 512) {
				holding[1] = "EY";
				holding[0] -= 512;
			}
			output += " = " + holding[0] + holding[1];
		}
	}
	output += "\n(AR: Argivian Reckoning, PM: Post-Mending, NKY: New Khalizor Year, VY: Volarian Year, EY: Eternity Years, WE: War's End, DAT: Dilated Adiran Time, AC: After Custom)";
	let nky = output.match(/-([0-9]+)NKY/);
	if(nky) {
		let year2 = parseInt(nky[1])
		output = output.replace(/-([0-9]+)NKY/, (1993+year2) + "OKY");
		output = output.replace(/NKY: New/, "OKY: Old");
	}
	let oky = output.match(/([0-9]+)OKY/)
	if(oky) {
		let year3 = parseInt(oky[1]);
		if(year3 > 1992) {
			output = output.replace(/([0-9]+)OKY/, (year3-1992) + "OKY");
			output = output.replace(/NKY: New/, "OKY: Old");
		}
	}
	return output;
}
function convertAR (year, starting) {						//first convert to AR
	//convert to AR
	switch(starting) {
		case "VY":
			year += 4201;
			break;
		case "EY":
			year += 4713;
			break;
		case "PM":
			year += 4500;
			break;
		case "CE":
			year += 2550;
			break;
		case "NKY":
			if(year < 0)
				year++;
			year += 2932;
			break;
		case "OKY":
			if(year < 0)
				year++;
			year += 940
			break;
		case "WE":
			year += 4900;
			break;
		case "AC":
			year += 4558;
			break;
		case "DAT":
			let overflowYear = 0;
			if(year > 7001.4)
				overflowYear = year - 7001.4;
			if(year >= 0) {
				let a = 0.0022/3;
				let b = 0;
				let c = 1;
				let d =  -1*Math.max(0,Math.min(7001.4,year));

				let delta0 = Math.pow(b,2) - 3*a*c;
				let delta1 = 2*Math.pow(b,3) - 9*a*b*c + 27*Math.pow(a,2)*d;
				let calc = Math.pow((delta1 + Math.pow(Math.pow(delta1,2)-4*Math.pow(delta0,3), 1/2))/2 , 1/3);
				year = (-1/(3*a))*(b+calc+(delta0/calc));
				year += 4354;
				year +=	(overflowYear/98.02);
			}else{
				year += 4354;
			}
			year = Number.parseFloat(year).toFixed(2);
	}
	return year;
}
function convertCalendar (year, ending, floatNo) {			//then convert to other calendar
	switch(ending) {
		case "DAT":
			year -= 4354;
			if(year >= 0) {
				let theYear = Math.min(210,year);
				let theOverflow = Math.max(0,year-210);
				year = (0.0022/3)*Math.pow(theYear,3) + year + (97.02*theOverflow);
				year = Number.parseFloat(year).toFixed(3);
				year = year.replace(/000?$/,"0");
			}
			break;
		case "VY":
			year -= 4201;
			break;
		case "EY":
			year -= 4713;
			break;
		case "PM":
			year -= 4500;
			ending = " post-Mending";
			if(year < 0) {
				year = -1 * year;
				ending = " pre-Mending"
			}
			break;
		case "CE":
			year -= 2550;
			//convert negative years to BCE, no Year 0
			if(year <= 0) {
				year = -1 * year +1;
				ending = "BCE"
			}
			break;
		case "NKY":
			year -= 2932;
			if(year <= 0)
				year -= 1;
			break;
		case "OKY":
			year -= 940;
			if(year <= 0)
				year -= 1;
			break;
		case "WE":
			year -= 4900;
			break;
		case "AC":
			year -= 4558;
		year = Number.parseFloat(year).toFixed(floatNo);
	}
	return [year, ending];
}
//Dice
function roll(faces) {										//roll die with N faces
	let myNumber = Math.floor(Math.random()*Math.min(faces, 100))+1;
	return myNumber;
}
function rollMaster (diceString) {							//writes the results
	let results = rollout(diceString);
	let mathmatch = results.match(/(-?[0-9]+)/g);
	let math = 0;
	for(var i = 0; i < mathmatch.length; i++)
		math += parseInt(mathmatch[i]);
	let message = math
	if(mathmatch.length > 1){
		if(results.length >= 1000)
			results = results.substring(0,999) + "..."
		message += " (" + results + ")";
		message = message.replace(" + )",")");
		message = message.replace(/\+  ?-/g, "- ");
		message = message.replace(/\+  \+/g, "+");
	}
	return message;
}
function rollout(diceCommand) {								//the $roll handler
	let thisDie = diceCommand.match(/(- ?)?([0-9]*)d([0-9]+)(kh\d+|kl\d+|e)?( ?- ?\d+($|[^d])| ?\+ ?\d+($|[^d]))?/i);
	let quant = 1;
	let faces = 20;
	let flags = "";
	let dieName = "";
	if(thisDie !== null) {
		if(thisDie[3] !== undefined) {
			faces = Math.min(parseInt(thisDie[3]),100);
			dieName = thisDie[2] + "d" + thisDie[3];
		}
		if(thisDie[2] !== undefined) {
			if(thisDie[3] == undefined) {
				faces = Math.min(thisDie[2],100);
				dieName = thisDie[2];
			}else{
				quant = Math.min(thisDie[2],100);
			}
		}
		flags = thisDie[4];
	}
	let rollArray = [];
	for(var i = 0; i < quant; i++)
		rollArray.push(roll(faces));
	if(flags !== undefined && flags !== "") {
		let khMatch = flags.match(/kh([0-9]+)+/i);
		let klMatch = flags.match(/kl([0-9]+)+/i);
		if(khMatch !== null){
			dieName += "kh" + khMatch[1];
			let dieMatch = Math.min(parseInt(khMatch[1]),rollArray.length);
			rollArray = toolbox.maxArray(rollArray,dieMatch);
		}
		if(klMatch !== null){
			dieName += "kl" + klMatch[1];
			let dieMatch = Math.min(parseInt(klMatch[1]),rollArray.length);
			rollArray = toolbox.minArray(rollArray,dieMatch);
		}
		if(flags.match(/e/i)) {
			dieName += "e"
			for(var m = 0; m < rollArray.length; m++) {
				if(rollArray[m] == faces)
					rollArray[m] += rollExplode(faces,1);
			}
		}
	}
	let message = "";
	let sum = 0;
	let dualdie = diceCommand.match(dieName+"d");
	for(var n = 0; n < rollArray.length; n++) {
		sum += rollArray[n];
		if(dualdie == null) {
			if(thisDie[1] !== undefined)
				message += "-";
			message += rollArray[n] + " + ";
		}
	}
	if(thisDie[5] !== undefined)
		message += thisDie[5].replace(/- /g, "-") + " + ";
	diceCommand = diceCommand.replace(dieName, sum);
	thisDie = diceCommand.match(/([0-9]*)d([0-9]+)([^ \n]+)?/i);
	if(thisDie !== null){
		message += rollout(diceCommand);
	}
	return message;
}
function rollExplode (faces, i) {							//the explode function
	if(faces < 2)
		return faces;
	if(faces * i > 9000)
		return (9001 - faces*i);
	let rolledNumber = roll(faces);
	if(rolledNumber == faces)
		rolledNumber += rollExplode(faces);
	return rolledNumber;
}
//Minesweeper
function sweeper(width, bombs) {							//minesweeper generator
	let total = width * width;
	let rows = [];
	let board = [];
	let pieceWhite = "⬜";
	let pieceBomb = "<:mole:768264539170537482>"//"💣";
	let str = "||" + bombs + "|| bombs placed.\n";
	let numbers = [":one:",":two:",":three:",":four:",":five:",":six:",":seven:",":eight:",":nine:"];
	// Place board
	let placed = 0;
	while (placed < total) {
		board[placed] = pieceWhite;
		placed++;
	}
	// Place bombs
	let bombsPlaced = 0;
	let placement = () => {
		let index = Math.floor(Math.random() * (total));
		if (board[index] == pieceBomb){
			placement();
		}else{
			board[index] = pieceBomb;
			bombsPlaced++;
		}
	}
	while (bombsPlaced < bombs) {
		placement();
	}
	// Create rows
	let currow = 1;
	board.forEach((item, index) => {
		i = index+1;
		if (!rows[currow-1]) rows[currow-1] = [];
		rows[currow-1].push(item);
		if (i%width == 0) currow++;
	});
	// Generate numbers
	rows.forEach((row, index) => {
		row.forEach((item, iindex) => {
			if (item == pieceBomb) {
				let uprow = rows[index-1];
				let downrow = rows[index+1];
				let num = (it) => { if (it != undefined && typeof it == "number") return true; else return false; };
				let unknownSquare = (it) => { if(it == pieceBomb) return true; else return it == undefined };
				if (uprow) {
					if (num(uprow[iindex-1])) uprow[iindex-1]++;
					else if (!unknownSquare(uprow[iindex-1])) uprow[iindex-1] = 1;

					if (num(uprow[iindex])) uprow[iindex]++;
					else if (!unknownSquare(uprow[iindex])) uprow[iindex] = 1;

					if (num(uprow[iindex+1])) uprow[iindex+1]++;
					else if (!unknownSquare(uprow[iindex+1])) uprow[iindex+1] = 1;
				}

				if (num(row[iindex-1])) row[iindex-1]++;
				else if (!unknownSquare(row[iindex-1])) row[iindex-1] = 1;

				if (num(row[iindex+1])) row[iindex+1]++;
				else if (!unknownSquare(row[iindex+1])) row[iindex+1] = 1;

				if (downrow) {
					if (num(downrow[iindex-1])) downrow[iindex-1]++;
					else if (!unknownSquare(downrow[iindex-1])) downrow[iindex-1] = 1;

					if (num(downrow[iindex])) downrow[iindex]++;
					else if (!unknownSquare(downrow[iindex])) downrow[iindex] = 1;

					if (num(downrow[iindex+1])) downrow[iindex+1]++;
					else if (!unknownSquare(downrow[iindex+1])) downrow[iindex+1] = 1;
				}
			}
		});
	});
	// Create a string to send
	rows.forEach(row => {
		row.forEach(item => {
			if (typeof item == "number") it = numbers[item-1];
			else it = item;
			str += `||${it}||`;
		});
		str += "\n";
	});
	str = str.replace(/\|\|⬜\|\|/, "⬜");
	return str;
}
//cipher
function rotCrypt (message, rotNo) {						//ciphers messages using ROTX or the lackeybot rotation
	let alphaArray = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
	let miniAlphaArray = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
	let lackeycypher = ["l","a","c","k","e","y","b","o","t","s","i","p","h","r","u","w","v","m","q","x","n","z","j","f","g","d"];
	let rotMessage = "";
	if(rotNo == "LB") {
		let temp = message.toLowerCase();
		if(miniAlphaArray.includes(temp[0])) {
			rotNo = lackeycypher.indexOf(temp[0]);
			let tempRotNo = lackeycypher[25-rotNo];
			rotNo = miniAlphaArray.indexOf(temp[0].toLowerCase());
			tempRotNo = miniAlphaArray.indexOf(tempRotNo);
			if(rotNo < tempRotNo){
				rotNo = Math.abs(rotNo-tempRotNo);
			}else{
				rotNo = (26-rotNo) + tempRotNo;
			}
		}else{
			rotNo = 13;
		}
	}
	for(var i=0; i<message.length; i++) {
		let isNon = 1;
		let thisChar = message[i];
		if(alphaArray.includes(thisChar)) {
			let num = alphaArray.indexOf(thisChar)+rotNo;
			num = Math.round(((num/26)-Math.floor(num/26))*26);
			rotMessage += alphaArray[num]
			isNon = 0;
		}
		if(miniAlphaArray.includes(thisChar)) {
			let num = miniAlphaArray.indexOf(thisChar)+rotNo;
			num = Math.round(((num/26)-Math.floor(num/26))*26);
			rotMessage += miniAlphaArray[num]
			isNon = 0;
		}
		if(isNon == 1)
			rotMessage += thisChar;
	}
	return rotMessage
}
//namegen
function pickRandomCharacter(seed,last) {					//picks random characters for namegen
	let vowelArray = ["a","e","i","o","u","a","e"];
	let consArray = ["b","c","d","f","g","h","k","l","m","n","p","r","s","t","b","c","d","f","h","l","m","n","p","r","s","t","m","n","t","r","s","st","ch","th","sh","tr","j","q","x","y","z","v","w"];
	let specArray = [" ","'","-"," "," "];
	let letters = "";
	let num = Math.random();
	let newseed = 0.5;
	if(num > seed) { //vowel
		let char1 = shuffleArray(vowelArray);
		letters += char1[0];
		num = Math.random()*2.5;
		if(num < 1) {
			let char1 = shuffleArray(vowelArray);
			let char2 = shuffleArray(consArray);
			letters += char1[0] + char2[0];
		}
		if(num >= 1 && num < 2) {
			let char1 = shuffleArray(consArray);
			letters += char1[0] + char1[1];
			newseed = 0;
		}
		if(num >= 2) {
			let char1 = shuffleArray(vowelArray);
			letters += char1[0];
			newseed = 0.95;
		}
	}else{ //cons
		let char1 = shuffleArray(consArray);
		let char2 = shuffleArray(vowelArray);
		letters += char1[0] + char2[0];		
	}
	if(last != 'last') {
		num = Math.random();
		if(num <= 0.3)
			letters += shuffleArray(specArray)[0];
	}
	return [letters, newseed];
}

//Reminder engine
function reminderEmotes(msg) {								//adds the snooze emotes
	msg.react(hourEmote)
		.then(() => msg.react(dayEmote)
			.then(() => msg.react(weekEmote)
				.then(() => msg.react(repeatEmote))
			)
		)
}
function remindScript (ent, refDate, intendDate) {			//sends reminders
	//if(botname == "TestBot")
	//	return
	for(let ping in ent) {
		if(ent[ping].message != "" && ent[ping].id != "cluster") {
			let date = ent[ping].time;
			if(refDate - intendDate > 600000) {
				date += " (and " + timeConversion(refDate - intendDate,2) + ")";
			}
			let initUser = "someone";
			if(ent[ping].id != "")
				initUser = "<@" + ent[ping].id + ">"
			let aReminder = `${date} ago ${initUser} set a reminder: ${ent[ping].message}`;
			if(ent[ping].hasOwnProperty('cc')) {
				aReminder += "\nPing me too: ";
				for(let user in ent[ping].cc) {
					aReminder += "<@" + ent[ping].cc[user] + "> "
				}
			}
			let remEmbed = new Discord.MessageEmbed()
				.setDescription(`Need more time? React ${old_hourEmote} to add another hour, ${old_dayEmote} to add another day, ${old_weekEmote} to add another week, or ${old_repeatEmote} to do the same duration again.`)
				.setFooter('Reminder snooze')
			try{
				if(initUser == "someone" || ent[ping].event) { //if the original user is gone, don't add the embed because it keys off them
					Client.channels.cache.get(ent[ping].channel).send(aReminder)
				}else{
					Client.channels.cache.get(ent[ping].channel).send(aReminder, remEmbed)
						.then(mess => reminderEmotes(mess))
						.catch(e => console.log(e))
				}
			}catch(e){
				pullPing(ent[ping].id).send(aReminder, remEmbed)
					.then(mess => reminderEmotes(mess))
					.catch(e => console.log(e))
			}
			reminderDone++;
		}
		if(ent[ping].id == "cluster") {
			let ammoDex = ["562086260999454722","349406692317986837","350458217014231050","500175869084565525","471516814589952011","406843216911138816","477501164401852417","633431159627448340","250273029920129025","455868205181698058","393124455531937795","373665770149904385","347767608075878401","429765638182141952","358302654847385610","347814593898348545","363634633742483457","597269543290667008","324638614611034112","511306494592024583","596048727236673541","360601330622136320","352634063980593153","317415989522464778","636670779693727754","317409649215406090","599748477471162368"];
			let mark = 126785105556537344;
			let skip = 1000;
			let date = ent[ping].time;
			for(let channel in ammoDex) {
				bombard(mark, ammoDex[channel], date, ent[ping].message, skip);
				skip += 2000;
			}
		}
	}
}
function remindAdder (channel, id, message, date, time, sendChannel, eventFlag) { //adds reminders to database
	let slot = 0;
	if(message == "")
		message = " ";
	if(!sendChannel)
		sendChannel = channel;
	if(time > 0) {
		if(reminderBase[time]) {
			slot = Object.keys(reminderBase[time]).length;
		}else{
			reminderBase[time] = {};
		}
		reminderBase[time][slot] = {};
		reminderBase[time][slot].channel = sendChannel;
		reminderBase[time][slot].id = id;
		reminderBase[time][slot].message = message;
		reminderBase[time][slot].time = date;
		if(eventFlag)
			reminderBase[time][slot].event = true;
		sortReminders();
		logReminders();
		let testEmbed = new Discord.MessageEmbed()
			.setFooter(`Reminder slot ${time}[${slot}]`)
		Client.channels.cache.get(channel).send("Reminder set for " + date + " from now.", testEmbed)
			.then(mess => mess.react(`${pingStar}`))
			.catch(e => console.log(e))
	}else{
		Client.channels.cache.get(channel).send("LackeyBot cannot set a reminder that far in the future.");
	}
}
function remindEditor(time, slot, remindData){				//edits a reminder object
	if(!reminderBase.hasOwnProperty(time) || !reminderBase[time].hasOwnProperty(slot))
		return "Invalid reminder slot data.";
	let thisReminder = reminderBase[time][slot];
	if(remindData.hasOwnProperty('channel'))
		thisReminder.channel = remindData.channel;
	if(remindData.hasOwnProperty('id'))
		thisReminder.id = remindData.id;
	if(remindData.hasOwnProperty('message'))
		thisReminder.message = remindData.message;
	if(remindData.hasOwnProperty('event')) {
		if(!thisReminder.hasOwnProperty('event')){
			thisReminder.event = true;
		}else{
			delete thisReminder.event
		}
	}
	if(remindData.hasOwnProperty('time')) {
		//find date of original remind
		let now = new Date();
		let dateDiff = timeConversion(remindData.time - now.getTime(), 1)
		remindAdder(thisReminder.channel, thisReminder.id, thisReminder.message, dateDiff, remindData.time, thisReminder.channel, thisReminder.hasOwnProperty('event'))
		delete reminderBase[time][slot];
	}else{
		logReminders();
	}
	return "Reminder updated";
}
function buildReminderListEmbed(userID,startFrom,embedFlag){//builds the reminderlist and if necessary its page turner embed
	let i = 0;
	reminderCell[userID] = {};
	reminderCell[userID][0] = {};
	for(let remindTime in reminderBase) {
		for(let ent in reminderBase[remindTime]) {
			if(reminderBase[remindTime][ent].message != "" && (reminderBase[remindTime][ent].id == userID || (reminderBase[remindTime][ent].hasOwnProperty('cc') && reminderBase[remindTime][ent].cc.includes(userID)))) {
				reminderCell[userID][i] = {};
				reminderCell[userID][i].message = reminderBase[remindTime][ent].message;
				reminderCell[userID][i].time = remindTime;
				reminderCell[userID][i].index = ent;
				reminderCell[userID][i].deleted = 0;
				i++;
			}
		}
	}
	if(!reminderCell[userID][0].time) {
		return ["You don't have any reminders right now.", false];
	}else{
		let reminderPost = "Your reminders:\n";
		let currenttime = new Date().getTime();
		currenttime = Math.trunc(currenttime / 60000) * 60000;
		let overflow = 0, embedded = null, remLength = Object.keys(reminderCell[userID]).length;
		for(i = startFrom; i< remLength; i++) {
			let testEnt = i + " — " + timeConversion(reminderCell[userID][i].time - currenttime, 1) + " from now: " + reminderCell[userID][i].message + "\n";
			if(reminderPost.length + testEnt.length < 1920) {
				reminderPost += testEnt
			}else{
				break;
			}
		}
		if(i < remLength-1 || embedFlag) {
			embedded = new Discord.MessageEmbed()
				.setFooter(`Reminders ${startFrom} - ${i-1}/${remLength-1} for ${userID}`)
		}
		reminderPost += "\nPost `$reminderdelete <number>` to delete a reminder.";
		bribes++;
		return [reminderPost, embedded];
	}
}
function hookShift(currentTime, newTime){					//shifts when a $reminder event fires
	let i = 0, delArray = [];
	if(reminderBase.hasOwnProperty(newTime)) {
		i = Object.keys(reminderBase[newTime]).length;
	}else{
		reminderBase[newTime] = {};
	}
	for(let remind in reminderBase[currentTime]){
		let thisReminder = reminderBase[currentTime][remind];
		if(thisReminder.hasOwnProperty('event')) { //skip non hook reminds that managed to get in here
			reminderBase[newTime][i] = thisReminder;
			reminderBase[newTime][i].event = true;
			i++;
			delArray.push(remind);
		}
	}
	for(let remind in delArray)
		delete reminderBase[currentTime][delArray[remind]];
	if(Object.keys(reminderBase[currentTime]).length == 0)
		delete reminderBase[currentTime];
	sortReminders();
	logReminders();
}
function parseReminderEdit(command){						//converts a Discord post into a remindEditor() function
	let time, slot;
	let remindData = {};
	let slotMatch = command.match(/slot: ?(\d+)\[(\d+)\]/i);
	if(slotMatch) {
		time = slotMatch[1];
		slot = slotMatch[2];
		let chanMatch = command.match(/channel: ?<?#?(\d+)/i);
		if(chanMatch)
			remindData.channel = chanMatch[1];
		let idMatch = command.match(/id: ?<?#?(\d+)/i);
		if(idMatch)
			remindData.id = idMatch[1];
		let timeMatch = command.match(/time: ?(\d+)/i);
		if(timeMatch)
			remindData.time = timeMatch[1];
		let messMatch = command.match(/message: ?([\s\S]*)/i);
		if(messMatch)
			remindData.message = messMatch[1];
		let eventMatch = command.match(/event: ?(true|false)/i);
		if(eventMatch)
			remindData.event = eventMatch[1];
		return remindEditor(time, slot, remindData);
	}else{
		return "Reminder slot must be included.";
	}
}
function sortReminders() {									//sorts reminders by time
	let timesArray = Object.keys(reminderBase);
	timesArray.sort(function(a, b){return a-b});
	let tempreminders = {};
	for(let time in timesArray) {
		tempreminders[timesArray[time]] = reminderBase[timesArray[time]];
	}
	reminderBase = tempreminders;
}
function timeConversion(milliseconds,precision) {			//converts milliseconds to X years, X days, etc.
	let years = Math.trunc(milliseconds / 31556952000);
	milliseconds -= years*31556952000;
	let days = Math.trunc(milliseconds / 86400000);
	milliseconds -= days*86400000;
	let hours = Math.trunc(milliseconds / 3600000);
	milliseconds -= hours*3600000;
	let minutes = Math.trunc(milliseconds / 60000);
	milliseconds -= minutes*60000;
	let seconds = Math.trunc(milliseconds / 1000);
	milliseconds -= seconds*1000;
	let wordTime = "";
	let timeArray = [years,days,hours,minutes,seconds,milliseconds];
	let timeNameArray = ["year","day","hour","minute","second","millisecond"];
	for(let i=0;i<timeArray.length;i++) {
		if(timeArray[i] != 0) {
			wordTime += timeArray[i] + " " + timeNameArray[i];
			if(timeArray[i] != 1)
				wordTime += "s";
			wordTime += ", "
		}
	}
	wordTime = wordTime.replace(/, $/,"");
	let wordSplit = wordTime.split(",");
	wordTime = "";
	if(!precision)
		precision = wordSplit.length;
	for(let i=0; i<precision; i++) {
		wordTime += wordSplit[i];
		if(i != precision-1)
			wordTime += ", ";
	}
	return wordTime;
}
function setTimeDistance(number, distance, direction) {		//creates a date object for (number) (distance) from now
	let wholeNumber = Math.trunc(number);
	let currenttime = new Date();
	let pingYear = 0;
	let pingMonth = 0;
	let pingDay = 0;
	let pingHour = 0;
	let pingMinute = 0;

	if(distance.match(/^(second|s)s?$/i))
		pingMinute += Math.trunc(wholeNumber/60);
	if(distance.match(/^(minute|min|m)s?/i))
		pingMinute += wholeNumber;
	
	if(distance.match(/^(hour|hr|h)s?$/i)) {
		pingHour += wholeNumber;
		pingMinute += Math.trunc((number - wholeNumber) * 60);
	}
	if(distance.match(/^(day|dy|d)s?$/i)) {
		pingDay += wholeNumber;
		pingHour += Math.trunc((number - wholeNumber) * 24);
	}
	if(distance.match(/^(week|wk|w)s?/i)) {
		pingDay += 7*wholeNumber;
		pingHour += Math.trunc((number - wholeNumber) * 7);
	}
	if(distance.match(/^(month)s?$/i)) {
		pingMonth += wholeNumber;
		pingDay += Math.trunc((number - wholeNumber) * 30);
	}
	if(distance.match(/^(year|yr|y)s?$/i)) {
		pingYear += wholeNumber;
		pingDay += Math.trunc((number - wholeNumber) * 365);
	}
	if(distance.match(/^(decade|d)s?$/i)) {
		pingYear += 10*wholeNumber;
		pingYear += Math.trunc((number - wholeNumber) * 10);
	}
	if(direction == "past") {
		pingYear *= -1;
		pingMonth *= -1;
		pingDay *= -1;
		pingHour *= -1;
		pingMinute *= -1;
	}
	pingYear += currenttime.getFullYear();
	pingMonth += currenttime.getMonth();
	pingDay += currenttime.getDate();
	pingHour += currenttime.getHours();
	pingMinute += currenttime.getMinutes();

	return new Date(pingYear, pingMonth, pingDay, pingHour, pingMinute, 0, 0);
}
function bombard(id, channel, date, message, time) {		//send a message in many channels (broken)
	setTimeout(function () {
		try{
			Client.channels.cache.get(channel).send(date + " ago " + Client.users.cache.get(id) + " set a reminder: " + message);
		}catch(e){
			console.log(e);
		}
	}, time)
}
//MatchDex
//general scripts
function generateBracketSeeds (powers) {					//generate bracket with 2^input pairs
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
function matchPermit(msg, tourney) {
	tourney = tourney.toLowerCase();
	if(msg.author.id == cajun)
		return true;
	if(msg.author.id == matchDex[tourney].data.TO)
		return true;
	if(matchDex[tourney].data.EO && msg.member.roles.cache.find(val => val.id == matchDex[tourney].data.EO))
		return true;
	return false;
}
function resetTourney(tourney) {							//archives tourney data
	startWriting("match")
	let leagueArchive = {};
	let flag = {};
	for(let t in matchDex) {
		if(t != "version")
			flag[t] = 0;
	}
	if(tourney == "league") {
		for(let p in matchDex[tourney].players) {
			let current = toolbox.lastElement(matchDex[tourney].players[p].runs);
			if(current && current.matches && current.matches.length == 4)
				fourWinPoster(tourney, p, current);
		}
	}
	leagueArchive.matches = [];
	leagueArchive.players = {};
	let trolearray = {league: '638181322325491744', gp: '588781514616209417'}
	let prolearray = {primordial: '763102029504970823'}
	for(let thisPlayer in matchDex[tourney].players) {
		//remove their tourney role
		try{
			if(trolearray.hasOwnProperty(tourney))
				Client.guilds.cache.get('317373924096868353').members.cache.get(thisPlayer).roles.remove(trolearray[tourney]);
			if(prolearray.hasOwnProperty(tourney))
				Client.guilds.cache.get('413055835179057173').members.cache.get(thisPlayer).roles.remove(trolearray[tourney]);
		}catch(e){console.log(e)};
		leagueArchive.players[thisPlayer] = {};
		leagueArchive.players[thisPlayer].username = pullUsername(thisPlayer);
		leagueArchive.players[thisPlayer].matches = [];
		leagueArchive.players[thisPlayer].lists = [];
		leagueArchive.players[thisPlayer].opponents = [];
		leagueArchive.players[thisPlayer].wins = 0;
		leagueArchive.players[thisPlayer].losses = 0;
		leagueArchive.players[thisPlayer].draws = 0;
		leagueArchive.players[thisPlayer].monthScore = 0;
		
		for(let aRun in matchDex[tourney].players[thisPlayer].runs) {
			if(matchDex[tourney].players[thisPlayer].runs[aRun].matches.length) {
				leagueArchive.players[thisPlayer].matches.push(matchDex[tourney].players[thisPlayer].runs[aRun].matches)
				leagueArchive.players[thisPlayer].lists.push(matchDex[tourney].players[thisPlayer].runs[aRun].dropLink.replace(".txt", ""))
				oppArrayArray = [];
				for(let aMatch in matchDex[tourney].players[thisPlayer].runs[aRun].matches) {
					//[opponent id, run number]
					let eMatch = matchDex[tourney].matches[matchDex[tourney].players[thisPlayer].runs[aRun].matches[aMatch]-1];
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
				leagueArchive.players[thisPlayer].monthScore = bestRecord(tourney,thisPlayer)[4]
			}
		}
	}
	let knockoutRound = 0;
	if(matchDex[tourney].data.pairing == "knockout") {
		var tops = [];
		let cut = toolbox.nextSquare(swissCut(tourney).length);					//top past the cut
		while(cut > 1) {
			tops.push(cut)
			cut = cut/2;
		}
	}
	for(let thisMatch in matchDex[tourney].matches) {
		let currentMatch = matchDex[tourney].matches[thisMatch]
		let matchStats = {};
		matchStats.players = [];
		let leadArray = renderRecord(currentMatch.p1, currentMatch.p2, currentMatch.p1w, currentMatch.p2w, currentMatch.p1r, currentMatch.p2r)
		matchStats.players.push(archivePlayer(tourney, leadArray[0], leadArray[2], leadArray[3], leadArray[4]));
		matchStats.players.push(archivePlayer(tourney, leadArray[1], leadArray[3], leadArray[2], leadArray[5]));
		matchStats.winner = null;
		if(leadArray[2] > leadArray[3])
			matchStats.winner = leadArray[0];
		if(currentMatch.round)
			matchStats.round = currentMatch
		leagueArchive.matches.push(matchStats);
		if(matchDex[tourney].data.pairing == "knockout" && currentMatch.knockout) { //add top 8 ranks
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
	let archName = tourney+"_"+toolbox.setTheDate("_")+'_archive.json'
	fs.writeFile('./msem/'+archName, leagueText, (err) => {
		if(err) console.log(err);
	});
	dropboxUpload("/tourneyArchives/"+archName,leagueText, function(){doneWriting("match")})
	
	flag[tourney] = 1;
	return [flag, "The " + tourney + " database has been archived. If the tournament is over, send `!delete " + tourney + "` to reset its database or `!continue league` to start a new month in the same season."];
}
function deleteTourney (tourney) {							//resets a tourney to nothing/base data
		startWriting("match")
		let oldName = tourney;															//save name
		if(matchDex[tourney].data.name)
			oldName = matchDex[tourney].data.name;										//then reset the data
		let oldData = matchDex[tourney].data;
		matchDex[tourney] = {};
		matchDex[tourney].matches = [];													//blank matches
		matchDex[tourney].awaitingMatches = [];											//blank matches
		matchDex[tourney].players = {};													//blank players
		matchDex[tourney].data = oldData;
		matchDex[tourney].round = 0;													//and the round
		if(tourney == "gp") {															//change the data defaults for recurring tournaments
			matchDex[tourney].data.pairing = "swiss-knockout";
			matchDex[tourney].data.channel = login.comp;
			matchDex[tourney].awaitingMatches = [];
			let gpLetter = matchDex[tourney].data.name.match(/GP([A-Z])/i);				//figure out the next GP letter
			if(gpLetter){
				gpLetter = gpLetter[1].toLowerCase();
				let gpIndex = azArray.indexOf(gpLetter);
				gpIndex++;
				gpIndex = gpIndex%azArray.length;
				gpLetter = azArray[gpIndex].toUpperCase();
				matchDex[tourney].data.name = "GP" + gpLetter;
				matchDex[tourney].data.submitRegex = "GP" + gpLetter;
				matchDex[tourney].data.time = [3, "days"];
			}
		}else if(tourney == "league") {
			matchDex[tourney].data.channel = login.league;
			matchDex[tourney].data.runLength = 5;
			matchDex[tourney].data.crown = "762844099077210132";
			matchDex[tourney].data.name = "League";
			matchDex[tourney].data.submitRegex = "league";
		}else if(tourney == "cnm") {
			matchDex[tourney].data.pairing = "swiss";
			matchDex[tourney].data.channel = login.cnm;
			matchDex[tourney].awaitingMatches = [];
			matchDex[tourney].data.time = [50, "minutes"];
			matchDex[tourney].name = "Custom Night Magic";
			matchDex[tourney].submitRegex = "cnm|cmn";
		}else if(tourney == "sealed") {
			matchDex[tourney].data.channel = login.sealed;
			matchDex[tourney].data.rematch = 2;
			matchDex[tourney].data.name = "Sealed League";
			matchDex[tourney].data.submitRegex = "sealed";
			matchDex[tourney].data.EO = "745439259795652649";
		}else if(tourney == "primordial") {
			matchDex[tourney].data.channel = "762822819196960809";
			matchDex[tourney].data.runLength = 5;
			matchDex[tourney].data.TO = "186824142299856896";
			matchDex[tourney].data.crown = "762835408580640780";
			matchDex[tourney].data.name = "Primordial League";
			matchDex[tourney].data.submitRegex = "primordial [A-Z0-9_]+";
		}else if(tourney == "gamenight") {
			matchDex[tourney].data.pairing = "swiss";
			matchDex[tourney].data.channel = "704798871666294855";
			matchDex[tourney].data.TO = "380481522416746502";
			matchDex[tourney].awaitingMatches = [];
			matchDex[tourney].data.time = [24, "hours"];
			matchDex[tourney].name = "Game Night";
			matchDex[tourney].submitRegex = "game ?night";
			matchDex[tourney].EO = "813132398668546118";
		}
		logMatch();
		doneWriting("match");
	return "The " + tourney + " database has been reset.";
}
function rolloverTourney (tourney, cullID) {				//continues a multi-month tourney
	startWriting("match");
	matchDex[tourney].matches = [];
	for(let player in matchDex[tourney].players) {
		if(cullID == 0)
			matchDex[tourney].players[player].season += matchDex[tourney].players[player].month;
		matchDex[tourney].players[player].lifetime += matchDex[tourney].players[player].month;
		matchDex[tourney].players[player].month = 0;
		if(cullID == 1) //at the end of a season, also clear season points
			matchDex[tourney].players[player].season = 0;
		matchDex[tourney].players[player].runs = [];
		matchDex[tourney].players[player].currentRun = 0;
	}
	logMatch();
	doneWriting("match");
	if(cullID == 1)
		return "The league season has ended."
	return "The league month has rolled over.";
}
function archivePlayer(tourney, id, wins, losses, run) {	//saves player data for a match
	let partRun = matchDex[tourney].players[id].runs[run-1];
	let archPlay = {};
	archPlay.id = id;
	archPlay.username = pullUsername(id);
	archPlay.wins = parseInt(wins);
	archPlay.losses = parseInt(losses);
	archPlay.winner = (wins > losses ? 1 : 0);
	archPlay.run = run;
	if(partRun && partRun.dropLink) {
		archPlay.list = partRun.dropLink.replace(".txt", "");
	}else{
		archPlay.list = `/${tourney}/${archPlay.username}`;
	}
	return archPlay
}
function addLackeyBot(tourney){								//adds LackeyBot to a tournament for testing
	addNewPlayer(tourney, '341937757536387072', false);
	addNewRun(tourney, '341937757536387072', 'idk', 'idk');
	return "LackeyBot added to " + tourney;
}
function tempAddTUCTeams (id) {								//this should get improved a lot but quick fix
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
function addNewPlayer (tourney, id, midFlag) {				//adds new player to given tourney
	if(matchDex[tourney].players[id]) {
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
		if(tourney == "tuc") {
			let teams = tempAddTUCTeams(id);
			if(!teams)
				return "You are not registered for Team Unified Constructed";
			newPlayer.team = teams;
			newPlayer.deckObj = {};
		}
		if(tourney == "primordial")
			newPlayer.set = "";
		matchDex[tourney].players[id] = newPlayer;
		return "You have been added to " + tourney + ".";
	}
}
function getPlayedOpps (tourney, id, thisRun, knockFlag) {	//returns [ [opponent ids], [opponent runs], [opponent matches] ]
	if(!matchDex[tourney].players.hasOwnProperty(id))
		return [[],[],[]];
	let matchArray = [];
	if(matchDex[tourney].players[id].runs[thisRun-1])
		matchArray = matchDex[tourney].players[id].runs[thisRun-1].matches;
	let oppArray = [];
	let oppRunArray = [];
	let oppMatchArray = [];
	for(let thisMatch in matchArray) {
		if(!matchDex[tourney].matches[0]) {
			return [[],[],[]];
		}else{
			if(matchDex[tourney].matches[matchArray[thisMatch]-1] && !(toolbox.hasValue(knockFlag) && matchDex[tourney].matches[matchArray[thisMatch]-1].hasOwnProperty('knockout') && matchDex[tourney].matches[matchArray[thisMatch]-1].knockout == 1)) {
				oppMatchArray.push(matchArray[thisMatch]);
				if(matchDex[tourney].matches[matchArray[thisMatch]-1].p1 == id) {
					oppArray.push(matchDex[tourney].matches[matchArray[thisMatch]-1].p2);
					oppRunArray.push(matchDex[tourney].matches[matchArray[thisMatch]-1].p2r);
				}else{
					oppArray.push(matchDex[tourney].matches[matchArray[thisMatch]-1].p1);
					oppRunArray.push(matchDex[tourney].matches[matchArray[thisMatch]-1].p1r);		
				}
			}
		}
	}
	return [oppArray, oppRunArray, oppMatchArray];
}
function getRecord (tourney, id, run) {						//returns given player's ['W - L', tournament score, monthly points]
	let matchArray = matchDex[tourney].players[id].runs[run-1].matches;
	let wins = 0;
	let loss = 0;
	let draw = 0;
	for(let thisMatch in matchArray) {
		if(matchArray !== [] && matchDex[tourney].matches[matchArray[thisMatch]-1]) {
			if(matchDex[tourney].matches[matchArray[thisMatch]-1].winner == null) {
				draw++;
			}else{
				if(matchDex[tourney].matches[matchArray[thisMatch]-1].winner == id) {
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
	if(points === matchDex[tourney].data.runLength) // bonus point for perfect run //TODO League customization
		points++;
	return [winString, score, points];
}
function bestRecord (tourney, id) {							//returns best ['W - L', tournament score, monthly points, run number, total monthly points]
	let bestScore = ["",0,0,0]; //string, score, points, run, total
	let scoreArray = [];
	for(let i=1; i<matchDex[tourney].players[id].runs.length+1; i++) {
		let temp = getRecord(tourney, id, i)
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
function renderRecord(p1, p2, p1w, p2w, p1r, p2r) {			//returns [winner.id, loser.id, winner.wins, loser.wins, winner.run, loser.run]
	if(p1w < p2w)
		return [p2, p1, p2w, p1w, p2r, p1r];
	return [p1, p2, p1w, p2w, p1r, p2r];
}
function playerMatchResults(aMatch, playerID) {				//given a match object, returns the given player's [wins, losses, draws, boolean(win?)]
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
function renderSelfRecord(match, id) {						//returns [[player.id, player.wins, player.run],[opp.id, opp.wins, opp.run]]
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
function listRecord(match) {								//returns Winner vs Loser (WW - LW)
	let rendArray = renderRecord(match.p1, match.p2, match.p1w, match.p2w, match.p1r, match.p2r);
	return pullUsername(rendArray[0]) + " (#" + rendArray[4] + ") vs " + pullUsername(rendArray[1]) + " (#" + rendArray[5] + ") — " + rendArray[2] + "-" + rendArray[3];
}
//league specific scripts
function renderLeaderBoard(tourney, user, flag) {			//creates the list of players sorted by best seasonal record
	let scoresArray = [];
	let playersArray = [];
	let indexArray = [];
	let decksArray = [];
	let output = "";
	for(let thisPlayer in matchDex[tourney].players) {
		let yourScore = matchDex[tourney].players[thisPlayer].month;
		if(flag != "month")
			yourScore += matchDex[tourney].players[thisPlayer].season;
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
			let theirScore = parseInt(matchDex[tourney].players[playersArray[indexArray[i]]].month);
			if(flag != "month")
				theirScore += parseInt(matchDex[tourney].players[playersArray[indexArray[i]]].season);
			if(theirScore < bankedScore) {
				rank = i+1;
				bankedScore = theirScore;
			}
			let rankLine = rank + ": " + pullUsername(playersArray[indexArray[i]]) + " (" + theirScore + " points)\n";
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
function nullMatch (tourney, number) {						//nullifies a league match
	let thisMatch = matchDex[tourney].matches[number-1];
	//remove it from runs match array
	let errIndex = matchDex[tourney].players[thisMatch.p1].runs[thisMatch.p1r-1].matches.indexOf(number)
	matchDex[tourney].players[thisMatch.p1].runs[thisMatch.p1r-1].matches.splice(errIndex,1);
	errIndex = matchDex[tourney].players[thisMatch.p2].runs[thisMatch.p2r-1].matches.indexOf(number)
	//nix data from matches list
	matchDex[tourney].players[thisMatch.p2].runs[thisMatch.p2r-1].matches.splice(errIndex,1);
	matchDex[tourney].matches[number-1].p1w = 0;
	matchDex[tourney].matches[number-1].p2w = 0;
	matchDex[tourney].matches[number-1].winner = null;
	//audit player's points
	auditMatches(tourney, thisMatch.p1);
	auditMatches(tourney, thisMatch.p2);
	logMatch();
	return "Nulled match " + number + " from " + tourney; 
}
function addNewRun (tourney, id, username, deckName, tID) {	//adds new league run
	if(!tID)
		tID = tourney;
	let newRun = {};
	newRun.matches = [];
	newRun.deckName = deckName;
	if(matchDex[tourney].players[id].currentRun == 0 || toolbox.hasValue(matchDex[tourney].players[id].runs[matchDex[tourney].players[id].currentRun-1].matches)) { //replace if last run is empty, else push
		matchDex[tourney].players[id].runs.push(newRun);
		matchDex[tourney].players[id].currentRun++;
	}else{
		matchDex[tourney].players[id].runs[matchDex[tourney].players[id].currentRun-1] = newRun;
	}
	let numString = "";
	if(matchDex[tourney].data.pairing == "league")
		numString += matchDex[tourney].players[id].currentRun
	newRun.dropLink = `/${tID}/${username}${numString}.txt`;
	return "You have started a new league run.";
}
function removeEmptyRun (tourney, id) {								//deletes an empty league run and rolls the currentRun back for accidental submissions
	let tournament = matchDex[tourney];
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
	matchDex[tourney].players[id].runs = toolbox.spliceArray({replace:true, index:currentRun, array:matchDex[tourney].players[id].runs})
	matchDex[tourney].players[id].currentRun = prevRun;
	logMatch();
	return "Run " + parseInt(currentRun+1) + " deleted. Rolled back to run " + currentRun;
}
function updateMatch (tourney, p1id, p2id, p1w, p2w, match, guild){//creates or edits a league match
	startWriting("match");
	let sendString = "";
	if(match) {
		if(matchDex[tourney].matches[match-1].p1 != p1id && matchDex[tourney].matches[match-1].p2 != p1id)
			sendString += `${pullUsername(p1id)} is not in match ${match}.\n}`;
		if(matchDex[tourney].matches[match-1].p1 != p2id && matchDex[tourney].matches[match-1].p2 != p2id)
			sendString += `${pullUsername(p2id)} is not in match ${match}.\n}`;
		if(sendString) {
			doneWriting("match");
			return sendString;
		}
		matchDex[tourney].matches[match-1].p1 = p1id;
		matchDex[tourney].matches[match-1].p2 = p2id;
		matchDex[tourney].matches[match-1].p1w = p1w;
		matchDex[tourney].matches[match-1].p2w = p2w;
		matchDex[tourney].matches[match-1].p1r = matchDex[tourney].players[p1id].currentRun;
		matchDex[tourney].matches[match-1].p2r = matchDex[tourney].players[p2id].currentRun;
		let player1 = pullUsername(p1id);
		let player2 = pullUsername(p2id);
		let winString = `${player1} and ${player2} draw with ${p1w} wins each`;
		matchDex[tourney].matches[match-1].winner = null;
		if(p1w > p2w) {
			matchDex[tourney].matches[match-1].winner = p1id;
			winString = `${player1} wins ${p1w} - ${p2w} over ${player2}`;
		}
		if(p2w > p1w) {
			matchDex[tourney].matches[match-1].winner = p2id;
			winString = `${player2} wins ${p2w} - ${p1w} over ${player1}`;
		}
		sendString = `corrected match ${match}: ${winString}.`;
		if(matchDex[tourney].players[p1id].awaitingMatches.includes(parseInt(match)))
			removeAwaits(tourney, p1id, p2id, {match:parseInt(match)})
	}else{
		let disqualified = invalidMatch(tourney, p1id, p2id);
		if(disqualified)
			return disqualified;
		let newMatch = {};
		let player1 = pullUsername(p1id);
		let player2 = pullUsername(p2id);
		let winString = `${player1} and ${player2} draw with ${p1w} wins each`;
		newMatch.p1 = p1id;
		newMatch.p1w = p1w;
		newMatch.p1r = matchDex[tourney].players[p1id].currentRun;
		newMatch.p2 = p2id;
		newMatch.p2w = p2w;
		newMatch.p2r = matchDex[tourney].players[p2id].currentRun;
		newMatch.winner = null;
		if(p1w > p2w) {
			newMatch.winner = p1id;
			winString = `${player1} wins ${p1w} - ${p2w} over ${player2}`;
		}
		if(p2w > p1w) {
			newMatch.winner = p2id;
			winString = `${player2} wins ${p2w} - ${p1w} over ${player1}`;
		}
		matchDex[tourney].matches.push(newMatch);
		matchDex[tourney].players[p1id].runs[matchDex[tourney].players[p1id].currentRun-1].matches.push(matchDex[tourney].matches.length);
		matchDex[tourney].players[p2id].runs[matchDex[tourney].players[p2id].currentRun-1].matches.push(matchDex[tourney].matches.length);
		let matchNo = matchDex[tourney].matches.length;
		sendString = `recorded match ${matchNo}: ${winString}.`;
	}
	sendString += "\n" + auditMatches(tourney, p1id);
	sendString += "\n" + auditMatches(tourney, p2id);
	if(guild && matchDex[tourney].data.hasOwnProperty('crown')) {
		let crownM = leagueCrown(tourney, guild);
		if(crownM)
			sendString += "\n" + crownM;
	}
	sendString = sendString.replace("\n\n", "\n");
	logMatch();
	doneWriting("match");
	return sendString;
}
function auditMatches(tourney, id) {						//ensures score is correct and alerts that run has ended
	let temp = bestRecord(tourney, id);
	matchDex[tourney].players[id].month = temp[4];
	if(matchDex[tourney].data.runLength != null && matchDex[tourney].players[id].runs[matchDex[tourney].players[id].currentRun-1].matches.length >= matchDex[tourney].data.runLength) {
		if(tourney == "league" || tourney == "primordial") //TODO League customization
			fourWinPoster(tourney, id, matchDex[tourney].players[id].runs[matchDex[tourney].players[id].currentRun-1]);
		let rolearray = {league: ['317373924096868353','638181322325491744'], primordial: ['413055835179057173','763102029504970823']}
		try{
			if(rolearray.hasOwnProperty(tourney))
				Client.guilds.cache.get(rolearray[tourney][0]).members.cache.get(id).roles.remove(rolearray[tourney][1]);
		}catch(e){
			console.log(e)
		};
		return `${pullPing(id)}, your run is now over. You may start a new run by submitting a deck through DMs.`;
	}
	return "";
}
function leagueCrown(tourney, guild) {						//league crown role that is given to best league runs
	let scoresArray = [0, []];
	let gain = [], lost = [], startCrowns = [], endCrowns = [];
	let crown = matchDex[tourney].data.crown;
	if(!crown)
		return;
	for(let thisPlayer in matchDex[tourney].players) {
		let yourScore = matchDex[tourney].players[thisPlayer].month + matchDex[tourney].players[thisPlayer].season;
		if(yourScore > scoresArray[0])
			scoresArray = [yourScore, []]
		if(yourScore == scoresArray[0])
			scoresArray[1].push(thisPlayer);
	}
	for(let player in matchDex[tourney].players) {
		let thatPlayer = matchDex[tourney].players[player];
		let name = pullUsername(player)
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
function invalidMatch (tourney, p1id, p2id) {				//true if match is illegal
	let errors = "";
	if(p1id == p2id)
		errors += "Error: Both players are the same."
	if(errors)
		return errors;
	if(!matchDex[tourney].players[p1id]) //if a player isn't signed up
		errors += "Error: " + pullUsername(p1id) + " is not signed up for " + tourney + ".\n";
	if(!matchDex[tourney].players[p2id])
		errors += "Error: " + pullUsername(p2id) + " is not signed up for " + tourney + ".\n";
	if(errors)
		return errors;
	if(matchDex[tourney].data.runLength) {
		if(matchDex[tourney].players[p1id].runs[matchDex[tourney].players[p1id].currentRun-1].matches.length >= matchDex[tourney].data.runLength) //if a player is over their five matches
			errors += "Error: " + pullUsername(p1id) + " has already completed their current run.\n";
		if(matchDex[tourney].players[p2id].runs[matchDex[tourney].players[p2id].currentRun-1].matches.length >= matchDex[tourney].data.runLength)
			errors += "Error: " + pullUsername(p2id) + " has already completed their current run.\n";
		if(errors)
			return errors;
	}
	let oppArrays = getPlayedOpps(tourney, p1id, matchDex[tourney].players[p1id].currentRun);
	if(!oppArrays[0].includes(p2id)) //if they haven't played this player
		return 0; //match is valid
	//check the rematchLimit
	let opCurrentRun = matchDex[tourney].players[p2id].currentRun;
	let opRematchCounter = 0; //number of matches these runs have had
	for(let thisOpp in oppArrays[0]) { //for each opponent
		if(oppArrays[0][thisOpp] == p2id && oppArrays[1][thisOpp] == opCurrentRun)	//if their current run
			opRematchCounter++;
	}
	let remLimit = matchDex[tourney].data.rematch;
	if(!remLimit)
		remLimit = 1;
	if(opRematchCounter >= remLimit)
		return `Invalid match: These two runs have already played each other${(remLimit > 1 ? " the maximum number of times" : "")}.`
	return 0;
}
function buildLeagueInfoRecord(tourney, id, lookback) {		//the $league embed
	let oppString = "", runRecords = "";
	let thisPlayer = matchDex[tourney].players[id];
	let thisRun = thisPlayer.currentRun;
	var opps = null;
	let playRuns = thisPlayer.runs;
	let mScore = thisPlayer.month;
	let sScore = parseInt(thisPlayer.month+thisPlayer.season);
	let lScore = parseInt(thisPlayer.month+thisPlayer.season+thisPlayer.lifetime);
	let title = `${pullUsername(id)} League Info`;
	if(tourney != 'league')
		title += ` - ${matchDex[tourney].data.name}`
	let desc = `You are on run #${thisRun}: ${thisPlayer.runs[thisRun-1].deckName}`
	if(thisPlayer.runs[thisRun-1].matches.length >= matchDex[tourney].data.runLength)
		desc += ". This run has ended, be sure to submit a new deck before playing more League games";
	if(toolbox.hasValue(lookback) && lookback < thisRun && lookback != 0) {
		thisRun = lookback;
		desc = `This is your ended run #${thisRun}: ${thisPlayer.runs[lookback-1].deckName}.`
		desc += `\nThis run's record was ${getRecord(tourney, id, thisRun)[0]}`;
	}
	if(matchDex[tourney].players[id].runs[0] && matchDex[tourney].players[id].runs[thisRun-1] && matchDex[tourney].players[id].runs[thisRun-1].matches)
		opps = getPlayedOpps(tourney, id, thisRun);
	if(opps) {
		let bestRun = bestRecord(tourney, id);
		lScore = parseInt(thisPlayer.lifetime + bestRun[4]);
		for(let i=0; i<opps[0].length; i++) {
			let anOpp = pullUsername(opps[0][i]);
			let refMatch = matchDex[tourney].matches[opps[2][i]-1];
			let refData = renderSelfRecord(refMatch, id);
			if(matchDex[tourney].players[opps[0][i]].currentRun > opps[1][i]){
				oppString += matchDex[tourney].players[opps[0][i]].runs[opps[1][i]-1].deckName
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
				runRecords += getRecord(tourney, id, i)[0];
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
		.setFooter(`${tourney} run data ${thisRun}/${thisPlayer.currentRun}`)
	return [embedded, (thisPlayer.currentRun != 1)]
}
function reportRecord (tourney, id, lookback, textFlag) {	//the $league info command
	let output = "";
	if(!textFlag)
		return buildLeagueInfoRecord(tourney, id, lookback);
	if(matchDex[tourney].players[id]) {
		let oppString = "";
		let thisPlayer = matchDex[tourney].players[id];
		let thisRun = thisPlayer.currentRun
		if(toolbox.hasValue(lookback) && lookback < thisRun && lookback != 0)
			thisRun = lookback;
		let bestRun = bestRecord(tourney, id);
		output += pullUsername(id) + ", you are on run #" + thisRun + ":" + thisPlayer.runs[thisRun-1].deckName;
		if(thisPlayer.runs[thisRun-1].matches.length >= matchDex[tourney].data.runLength)
			output += ". This run has ended, be sure to submit a new deck before playing more League games";
		if(toolbox.hasValue(lookback) && lookback < thisRun && lookback != 0) {
			output = pullUsername(id) + ", this is your ended run #" + thisRun;
			output += ".\nThis run's record was " + getRecord(tourney, id, thisRun)[0];			
		}
		output += ".\n";
		let neTitle = `${pullUsername(id)} League Info`;
		if(tourney != 'league')
			neTitle += ` - ${matchDex[tourney].data.name}`
		var nullEmbed = new Discord.MessageEmbed()
			.setTitle(neTitle)
			.setFooter(`${tourney} run data ${thisRun}/${thisPlayer.currentRun}`)
		if(matchDex[tourney].players[id].runs[0] && matchDex[tourney].players[id].runs[thisRun-1] && matchDex[tourney].players[id].runs[thisRun-1].matches) {
			var opps = getPlayedOpps(tourney, id, thisRun);
		}else{
			output += "You have not played any matches this run.\nYour league score this month is " + thisPlayer.month + ". Your league score this season is " + parseInt(thisPlayer.month+thisPlayer.season) + ". Your lifetime league score is " + parseInt(thisPlayer.month+thisPlayer.lifetime) + ".";
			return [[output, nullEmbed], (thisPlayer.currentRun != 1)];
		}
		let lifescore = parseInt(thisPlayer.lifetime + bestRun[4]);
		for(let i=0; i<opps[0].length; i++) {
			let anOpp = pullUsername(opps[0][i]);
			let refMatch = matchDex[tourney].matches[opps[2][i]-1];
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
				output += getRecord(tourney, id, i)[0];
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
function vsSeeker (tourney, id) {							//finds players the command user can play in the league
	let players = matchDex[tourney].players;
	let thisPlayer = players[id]
	let oppArray = getPlayedOpps(tourney, id, thisPlayer.currentRun); //TODO League customization rematches
	let openArray = getCurrentPlayers(tourney);
	let clearedArray = [];
	for(let playerArray in openArray) {
		let thisOpponent = openArray[playerArray][0];
		if(!invalidMatch(tourney, id, thisOpponent))
			clearedArray.push(thisOpponent);
	}
	let output = pullUsername(id) + ", you are able to play the following opponents: ";
	let i = clearedArray.length;
	for(let thisOpponent in clearedArray) {
		i--
		if(i==0)
			output += "and "
		output += pullUsername(clearedArray[thisOpponent]);
		if(i != 0)
			output += ", "
	}
	if(clearedArray.length == 1)
		output = output.replace(": and", ":");
	return output;
}
function getCurrentPlayers (tourney) {						//finds all players than can play in the tourney
	let players = matchDex[tourney].players;
	let openArray = [];
	for(let player in players) {
		let currentRun = players[player].currentRun;
		if(toolbox.hasValue(currentRun) && (matchDex[tourney].data.runLength == null || players[player].runs[currentRun-1].matches.length < matchDex[tourney].data.runLength)) {
			let oppArray = [player, currentRun];
			openArray.push(oppArray)
		}
	}
	return openArray;
}
function changeDeckName (tourney, id, name, run) {			//changes a tourney deck's name
	let thisPlayer = matchDex[tourney].players[id];
	if(thisPlayer == undefined)
		return "You are not in this tournament.";
	if(run == undefined || run == null || run > thisPlayer.currentRun)
		run = thisPlayer.currentRun;
	thisPlayer.runs[run-1].deckName = name;
	return "Run " + run + "'s deck name changed to " + name;
	
}
function fourWinPoster(tourney, id, runInfo) {				//posts decks that go 4-1 or better
	let runScore = getRecord(tourney, id, matchDex[tourney].players[id].currentRun);
	if(runScore[2] >= 4 && !runInfo.hasOwnProperty('printed')) {
		let pullLink = runInfo.dropLink;
		let deck = runInfo.deckName;
		let deckFixed = runInfo.deckName.replace(/[\/\\:*?"<>|]/g, "");
		dbx.filesDownload({path:pullLink})
			.then(function(data) {
				fs.writeFile(deckFixed+'.txt', data.fileBinary, 'binary', function(err) {
					if(err) throw err;
					fs.readFile(deckFixed+'.txt', "utf8", function read(err, data) {
						if(err) throw err;
						let deckData = extractPlain(data);
						let chan = "475851199812337695", name = "League";
						if(tourney == "primordial") {
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
						matchDex[tourney].players[id].runs[matchDex[tourney].players[id].currentRun-1].printed = true;
					});
				});
			})
			.catch(function(err){console.log(err)})
	}
}
//gp specific scripts
function renderGPLeaderBoard (tourney, showBreakers, page) {		//renders the gp leaderboard
	let players = Object.keys(matchDex[tourney].players);
	let sortedArray = sortWithBreakers(tourney, players);
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
	let nameLine = `${tourney} leaderboard with tiebreakers:\n`;
	if(!showBreakers)
		nameLine = nameLine.replace('with tiebreakers:', 'without tiebreakers:');
	let matchesRemaining = `\n**${matchDex[tourney].awaitingMatches.length} matches** remain this round.`
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
			let theirUsername = toolbox.stripEmoji(pullUsername(sortedArray[i]));
			thisArray.push(theirUsername);											//thisArray[1] = username
			thisArray.push(matchDex[tourney].players[sortedArray[i]].gpWin);     	//thisArray[2] = gpWin
			thisArray.push(matchDex[tourney].players[sortedArray[i]].gpLoss);    	//thisArray[3] = gpLoss
			thisArray.push(matchDex[tourney].players[sortedArray[i]].gpDraw);    	//thisArray[4] = gpDraw
			thisArray.push(thisArray[2] + (0.5*thisArray[4]));                   	//thisArray[5] = Score
			thisArray.push(omw(tourney, sortedArray[i]));    		  				//thisArray[6] = OM%
			thisArray.push(gameWinPercentage(tourney, sortedArray[i],0));			//thisArray[7] = GW%
			thisArray.push(ogw(tourney, sortedArray[i])); 							//thisArray[8] = OGW%
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
		.setFooter(`${page+1}/${pageObj.current+1} ${tourney} leaderboard`)
	return [output, pageEmbed];
}
function dropTourneyPlayer (tourney, id, playing) {			//removes or adds player from tourney, adds or removes bye as needed
	let output = "";
	let awaitHold = ""
	if(playing == 0 && matchDex[tourney].round == 0) { //if they are dropping and the tournament hasn't started
		delete matchDex[tourney].players[id]; //delete their data
		return pullUsername(id) + " has been removed from " + tourney + ".";
	}
	//else if the tournament has started
	matchDex[tourney].players[id].playing = playing; //they still exist, 0 for no longer pair, 1 for repairing
	if(matchDex[tourney].players.hasOwnProperty(bye)) { //if the bye player exists already, change its pairing status
		var byePlay = matchDex[tourney].players[bye].playing;
		matchDex[tourney].players[bye].playing = (byePlay == 0 ? 1 : 0) //if 0, then 1, else 0
	}else{ //if it doesn't, add it
		addNewPlayer(tourney, bye, true);
	}
	if(playing == 0) { //if a drop, autolose any awaiting matches
		let awaiting = matchDex[tourney].players[id].awaitingMatches;
		for(let matches in awaiting) {
			awaitHold = awaiting[matches];
			let theMatch = matchDex[tourney].matches[awaiting[matches]-1];
			let p2id = (theMatch.p1 == id ? theMatch.p2 : theMatch.p1)
			output += updateGPMatch (tourney, id, p2id, 0, 2, awaiting[matches])
		}
	}
	output = pullUsername(id) + " has been dropped from " + tourney + " and may be readded later.\n" + output;
	if(playing == 1) {
		output = pullUsername(id) + " has been readded to " + tourney + ".";
		if(awaitHold)
			output += " Remind them to use $report gp match " + awaitHold + " to edit their match.";
	}
	return output
}
function writePlayerIndexes (tourney) {						//writes the player indexes for dropping players
	let output = "";
	let i = 0;
	for(let player in matchDex[tourney].players) {
		if(player != bye) {
			output += i + " — " + pullUsername(player);
			if(matchDex[tourney].players[player].playing == 0)
				output += " (dropped)";
			output += "\n";
			i++;
		}
	}
	output += "Send `!drop <tournament> player 0` etc to drop player 0. Use `!undrop <tournament> player 0` if you need to add them back."
	return output;
}
function newGPMatch (tourney, p1, p2, knockout) {			//creates new gp match, auto-scores byes
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
			newMatch.round = matchDex[tourney].round;
			if(knockout != undefined && knockout == "knockout") {
				newMatch.knockout = 1;
			}else{
				matchDex[tourney].players[p2].gpWin++;
				matchDex[tourney].players[p1].gpLoss++;
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
			newMatch.round = matchDex[tourney].round;
			if(knockout != undefined && knockout == "knockout") {
				newMatch.knockout = 1;
			}else{
				matchDex[tourney].players[p1].gpWin++;
				matchDex[tourney].players[p2].gpLoss++;
			}
		}
		matchDex[tourney].matches.push(newMatch);
	}else{
		newMatch.p1 = p1;
		newMatch.p1w = 0;
		newMatch.p1r = 0;
		newMatch.p2 = p2;
		newMatch.p2w = 0;
		newMatch.p2r = 0;
		newMatch.winner = "";
		newMatch.round = matchDex[tourney].round;
		if(knockout != undefined && knockout == "knockout")
			newMatch.knockout = 1;
		matchDex[tourney].matches.push(newMatch);
		matchDex[tourney].players[p1].awaitingMatches.push(matchDex[tourney].matches.length);
		matchDex[tourney].players[p2].awaitingMatches.push(matchDex[tourney].matches.length);
		matchDex[tourney].awaitingMatches.push(matchDex[tourney].matches.length);
	}
	matchDex[tourney].players[p1].runs[0].matches.push(matchDex[tourney].matches.length);
	matchDex[tourney].players[p2].runs[0].matches.push(matchDex[tourney].matches.length);
	let ping = `${pullPing(newMatch.p1)} vs. ${pullPing(newMatch.p2)}\n`;
	ping = ping.replace(/<@!?343475440083664896>/,"Bye");
	return ping;
}
function startTourney(tourney) {							//begin swiss pairing
	if(matchDex[tourney].data.pairing == "knockout" || matchDex[tourney].data.pairing == "double-elimination") //if knockout tourney go straight to that
		return beginKnockoutRounds(tourney)
	//else swiss it
	let numberOfPlayers = Object.keys(matchDex[tourney].players).length;
	let odd = numberOfPlayers % 2;
	if(odd) //add bye player
		addNewPlayer(tourney, bye, true);
	return swissPair(tourney)
}
function pushTourney(tourney) {								//move tournament to next round, change style if needed
	if(matchDex[tourney].awaitingMatches.length) { //if there are awaiting matches, alert the TO instead of pushing
		let warnMessage = "The following matches are still awaiting reports. The tournament can't proceed until they have been finished or dropped.\n";
		for(let match in matchDex[tourney].awaitingMatches) {
			let lateMatch = matchDex[tourney].matches[matchDex[tourney].awaitingMatches[match]-1];
			let pl1 = "";
			let pl2 = "";
			pl1 = pullUsername(lateMatch.p1);
			pl2 = pullUsername(lateMatch.p2);
			warnMessage += "Match " + matchDex[tourney].awaitingMatches[match] + ": " + pl1 + " vs " + pl2 + ".\n";
		}
		return warnMessage;
	}
	matchDex[tourney].round++;
	let numberOfHumans = 0;
	for(let thisPlayer in matchDex[tourney].players) {
		if(thisPlayer != bye)
			numberOfHumans++;
	}
	//if we're in a knockout round, knockout matches
	if(matchDex[tourney].data.pairing == 'knockout') {
		return knockoutRound(tourney);
	}
	//if we're past the swiss rounds in a swiss-knockout, cut to top
	if(matchDex[tourney].round > swissCount(numberOfHumans) && matchDex[tourney].data.pairing != 'swiss') {
		return beginKnockoutRounds(tourney);
	}
	//otherwise, swiss it
	return swissPair(tourney);
}
function postTourney(tourney, message, author, channel) {	//posts the gp matchups and sets a reminder to check them in three days
	let gpChan = matchDex[tourney].data.channel;
	Client.channels.cache.get(gpChan).send(message)
		.then(thatMess => asyncSwapPins(thatMess, {author:Client.user.id}, 1))
		.catch(e => console.log(e))
	let pings = [3, "day"];
	if(matchDex[tourney].data.time)
		pings = matchDex[tourney].data.time
	let pingTime = setTimeDistance(pings[0], pings[1]);
	remindAdder(channel, author, `Check the round ${matchDex[tourney].round} ${tourney} matches.`, `${pings[0]} ${pings[1]}`, pingTime.getTime())
}
function pingTourney(tourney) {								//pings everyone with awaiting matches
	let pingParty = "";
	let awaiting = matchDex[tourney].awaitingMatches;
	for(let match in awaiting) {
		let thisPlayer = pullPing(awaiting[match].p1);
		if(thisPlayer.username != "PlayerUnknown")
			pingParty += `${thisPlayer} `;
		thisPlayer = pullPing(awaiting[match].p2);
		if(thisPlayer.username != "PlayerUnknown")
			pingParty += `${thisPlayer} `;
	}
	return pingParty;
}
function updateGPMatch (tourney, p1id, p2id, p1w, p2w, match) {//edits a gp match
	let sendString = "";
	let recOrCorr = "reported";
	if(matchDex[tourney].matches[match-1].p1 != p1id && matchDex[tourney].matches[match-1].p2 != p1id)
		sendString += pullUsername(p1id) + " is not in match " + match + ".\n";
	if(matchDex[tourney].matches[match-1].p1 != p2id && matchDex[tourney].matches[match-1].p2 != p2id)
		sendString += pullUsername(p2id) + " is not in match " + match + ".\n";
	if(p1id == p2id)
		sendString += "Both players are the same.\n";
	if(sendString)
		return sendString;
	matchDex[tourney].matches[match-1].p1 = p1id;
	matchDex[tourney].matches[match-1].p2 = p2id;
	matchDex[tourney].matches[match-1].p1w = p1w;
	matchDex[tourney].matches[match-1].p2w = p2w;
	matchDex[tourney].matches[match-1].p1r = 1; //set this at 1 because league takes p1r-1 and we want this to be 0
	matchDex[tourney].matches[match-1].p2r = 1;
	let player1 = pullUsername(p1id);
	let player2 = pullUsername(p2id);
	let winString = player1 + " and " + player2 + " draw with " + p1w + " wins each";
	matchDex[tourney].matches[match-1].winner = null;
	if(p1w > p2w) {
		matchDex[tourney].matches[match-1].winner = p1id;
		winString = player1 + " wins " + p1w + " - " + p2w + " over " + player2;
	}
	if(p2w > p1w) {
		matchDex[tourney].matches[match-1].winner = p2id;
		winString = player2 + " wins " + p2w + " - " + p1w + " over " + player1;
	}
	let tindex = matchDex[tourney].awaitingMatches.indexOf(match);
	if(tindex != -1) {
		removeAwaits(tourney, p1id, p2id, {index:tindex, match:match})
	}else{
		recOrCorr = "corrected";	
	}
	
	auditGPMatches(tourney, p1id);
	auditGPMatches(tourney, p2id);
	logMatch();
	return recOrCorr + " match " + match + ": " + winString + ".";
}
function removeAwaits(tourney, p1id, p2id, data) {			//removes awaitingMatches data
	let tindex = -1;
	if(data.hasOwnProperty('index')) {
		tindex = data.index;
	}else if(data.hasOwnProperty('match')) {
		tindex = matchDex[tourney].awaitingMatches.indexOf(data.match);
	}
	if(tindex == -1)
		return;
	matchDex[tourney].awaitingMatches.splice(tindex, 1)
	let p1index = matchDex[tourney].players[p1id].awaitingMatches.indexOf(data.match);
	matchDex[tourney].players[p1id].awaitingMatches.splice(p1index, 1)
	let p2index = matchDex[tourney].players[p2id].awaitingMatches.indexOf(data.match);
	matchDex[tourney].players[p2id].awaitingMatches.splice(p2index, 1)
}
function gpLeaderBoard (tourney) {							//creates the list of players sorted by best gp record
	let players = matchDex[tourney].players;
	let playersArray = Object.keys(players);
	if(playersArray.length == 0)
		return "There is no GP running.";
	playersArray = sortWithBreakers(tourney, playersArray);
	let output = "";
	for(i=1; i<playersArray.length+1; i++){
		output += i + ": " + pullUsername(playersArray[i-1]) + " (" + players[playersArray[i-1]].gpWin + " - " + players[playersArray[i-1]].gpLoss + " - " + players[playersArray[i-1]].gpDraw + ")\n";
	}
	return output;
}
function auditGPMatches (tourney, id) {						//ensures the GP scores stay correct
	let theMatches = matchDex[tourney].players[id].runs[0].matches;
	let wins = 0;
	let loss = 0;
	let draw = 0;
	let awaiting = [];
	for(let theMatch in theMatches) {
		if(matchDex[tourney].matches[theMatches[theMatch]-1].winner == id && !toolbox.hasValue(matchDex[tourney].matches[theMatches[theMatch]-1].knockout)) {
			wins++;
		}else if(matchDex[tourney].matches[theMatches[theMatch]-1].winner == "") {
			awaiting.push(theMatches[theMatch])
		}else if(matchDex[tourney].matches[theMatches[theMatch]-1].winner == null && !toolbox.hasValue(matchDex[tourney].matches[theMatches[theMatch]-1].knockout)) {
			draw++;
		}else if(matchDex[tourney].matches[theMatches[theMatch]-1].winner != id && !toolbox.hasValue(matchDex[tourney].matches[theMatches[theMatch]-1].knockout)) {
			loss++;
		}
	}
	matchDex[tourney].players[id].gpWin = wins;
	matchDex[tourney].players[id].gpLoss = loss;
	matchDex[tourney].players[id].gpDraw = draw;
	matchDex[tourney].players[id].awaitingMatches = awaiting;
	if(tourney == "gladiator") {
		if(loss < 3) {
			matchDex[tourney].players[id].currentRun = loss+1;
		}else{
			matchDex[tourney].players[id].currentRun = 3;
			matchDex[tourney].players[id].playing = 0;
			
		}
		
	}
	
}
function swissCount (num) {									//number of swiss rounds for num players
	if(num < 4)
		return 0
	if(num < 9)
		return 3
	if(num < 32)
		return 4
	return 5
}
function swissCut (tourney) {								//returns array of players who make the swiss cut
	let out = [];
	let players = matchDex[tourney].players;
	if(matchDex[tourney].data.cutScript) {
		if(matchDex[tourney].data.cutScript == "X-2") { //X-2s make the cut
			for(let p in players) {
				if(p != bye && players[p].gpLoss + players[p].gpDraw < 3)
					out.push(p);
			}
		}else if(matchDex[tourney].data.cutScript.match(/^Top\d+/i)){
			let board = sortWithBreakers(tourney, players);
			let topN = matchDex[tourney].data.cutScript.match(/^Top(\d+)/i)[1];
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
function swissPair (tourney) {								//pairs players swiss style
	startWriting("match");
	let playerIDArray = [];
	let pingParty = "";
	let byeTemp = "";
	
	if(matchDex[tourney].round <= 1 || matchDex[tourney].data.pairing == "random") {
		//random
		let tName = matchDex[tourney].data.name;
		if(!tName)
			tName = tourney;
		let defTime = "3 days";
		if(matchDex[tourney].data.time)
			defTime = matchDex[tourney].data.time[0] + " " + matchDex[tourney].data.time[1] + (matchDex[tourney].data.time[0] != 1 && !matchDex[tourney].data.time[1].match(/s$/) ? "s" : "")
		pingParty = "Round " + matchDex[tourney].round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + matchDex[tourney].data.TO + "> for extensions.\n";
		for(let thisPlayer in matchDex[tourney].players) {
			if(matchDex[tourney].players[thisPlayer].playing)
				playerIDArray.push(thisPlayer);
		}
		playerIDArray = shuffleArray(playerIDArray);
		for(let i=0; i<playerIDArray.length; i = i+2) {
			//addNewRun(tourney, playerIDArray[i], "");
			//addNewRun(tourney, playerIDArray[i+1], "");
			if(playerIDArray[i] == bye || playerIDArray[i+1] == bye) {
				byeTemp = newGPMatch(tourney, playerIDArray[i], playerIDArray[i+1]);
			}else{
				pingParty += newGPMatch(tourney, playerIDArray[i], playerIDArray[i+1]);
			}
		}
		pingParty += byeTemp;
		logMatch();
		doneWriting("match");
		return pingParty;
	}

	//else swiss it
	let tName = matchDex[tourney].data.name;
	if(!tName)
		tName = tourney;
	let defTime = "3 days";
	if(matchDex[tourney].data.time)
		defTime = matchDex[tourney].data.time[0] + " " + matchDex[tourney].data.time[1] + (matchDex[tourney].data.time[0] != 1 && !matchDex[tourney].data.time[1].match(/s$/) ? "s" : "")
	pingParty = "Round " + matchDex[tourney].round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + matchDex[tourney].data.TO + "> for extensions.\n";
	let recordArray = [];
	for(let thisPlayer in matchDex[tourney].players) {
		if(matchDex[tourney].players[thisPlayer].playing) {
			matchDex[tourney].players[thisPlayer].sortPoint = matchDex[tourney].players[thisPlayer].gpWin - (matchDex[tourney].players[thisPlayer].gpLoss / 100) + 0.09;
			if(!recordArray.includes(matchDex[tourney].players[thisPlayer].sortPoint))
				recordArray.push(matchDex[tourney].players[thisPlayer].sortPoint);
		}
	}
	recordArray.sort(function(a, b){return b-a});
	let playRecArray = [];
	for(i=0;i<recordArray.length;i++)
		playRecArray[i] = [];
	for(let thisPlayer in matchDex[tourney].players) {
		if(matchDex[tourney].players[thisPlayer].playing) {
			playRecArray[recordArray.indexOf(matchDex[tourney].players[thisPlayer].sortPoint)].push(thisPlayer);
			delete matchDex[tourney].players[thisPlayer].sortPoint;
		}
	}
	for(i=0;i<recordArray.length;i++)
		playRecArray[i] = shuffleArray(playRecArray[i]);
	
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

	let pairsArray = swissEngine(tourney, playRecArray, pairUpArray, pairDownArray, 0);
	if(pairsArray == null) {
		doneWriting("match");
		return "Unable to generate swiss pairings.";
	}
	for(let pair in pairsArray) {
		if(pairsArray[pair][0] == bye || pairsArray[pair][1] == bye) {
			byeTemp += newGPMatch(tourney, pairsArray[pair][0], pairsArray[pair][1]);
		}else{
			pingParty += newGPMatch(tourney, pairsArray[pair][0], pairsArray[pair][1]);
		}
	}
	pingParty += byeTemp;
	pingParty = pingParty.replace('<@343475440083664896>','Bye')
	logMatch();
	doneWriting("match");
	return pingParty;
}
function swissEngine (tourney, playRecArray, pairUpArray, pairDownArray, loopcount) { //attempts to build a swiss pairing
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
				let opps = getPlayedOpps(tourney, playRecArray[thisScore][thisPlayerA], 1)[0];
				for(let thisPlayerB in playRecArray[thisScore]) { //check each player with the same score
					if(playRecArray[thisScore][thisPlayerB] != playRecArray[thisScore][thisPlayerA] && !opps.includes(playRecArray[thisScore][thisPlayerB]) && !((pairUpArray.includes(playRecArray[thisScore][thisPlayerA]) && pairDownArray.includes(playRecArray[thisScore][thisPlayerB])) || (pairUpArray.includes(playRecArray[thisScore][thisPlayerB]) && pairDownArray.includes(playRecArray[thisScore][thisPlayerA]))))
						valid[playRecArray[thisScore][thisPlayerA]].push(playRecArray[thisScore][thisPlayerB]); //if it isn't the same person, previously played, or pairedUp vs pairedDown, save it
				}
				//valid[aPlayer] = array of players with the same score aPlayer can fight
			}
		}
		let loopcount = 0;
		while(unpaired > 1 && loopcount < 2) {
			//get shortest array, it controls pairings
			let shortstack = ["",[0],100]; //id, opps, length
			for(let id in valid) {
				if(valid[id].length < shortstack[2] || (valid[id].length == shortstack[2] && id == bye))
					shortstack = [id, valid[id], valid[id].length];
			}
			if(shortstack[2] != 1) //shuffle the array
				shortstack[1] = shuffleArray(shortstack[1])
			let paired = shortstack[1][0];
			let pairCheck = [shortstack[0], paired]
			let pairCheck2 = [paired, shortstack[0]]
			//TODO make this favor paired up people?
			for(id in valid) { //if this pair causes anyone to be unpairable, pair that person instead
				if(valid[id] == pairCheck || valid[id] == pairCheck2)
					shortstack[0] = id;
			}
			if(!paired)
				loopcount++ //if you manage to have multiple that can't pair, loopcount breaks us out;
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
		let oppsArray = getPlayedOpps(tourney, playerIDArray[0], 1);
		if(!oppsArray.includes(playerIDArray[1]))
			pairsArray.push([playerIDArray[0],playerIDArray[1]])
	}
	if(2*pairsArray.length == numberOfPlayers)
		return pairsArray;
	if(loopcount < 3)
		return swissEngine (tourney, playRecArray, pairUpArray, pairDownArray, loopcount+1)
	return null;
}
function beginKnockoutRounds(tourney) {						//pairs players seeded bracket style
	let topArray = [];
	let tName = matchDex[tourney].data.name;
	if(!tName)
		tName = tourney;
	let defTime = "3 days";
	if(matchDex[tourney].data.time)
		defTime = matchDex[tourney].data.time[0] + " " + matchDex[tourney].data.time[1] + (matchDex[tourney].data.time[0] != 1 && !matchDex[tourney].data.time[1].match(/s$/) ? "s" : "")
	let pingParty = "Round " + matchDex[tourney].round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + matchDex[tourney].data.TO + "> for extensions.\n";
	let players = matchDex[tourney].players;
	let matches = matchDex[tourney].matches;
	matchDex[tourney].knockoutMatches = [];
	for(let thisPlayer in matchDex[tourney].players) { //get all the players with 0 or 1 losses //TODO GP customization
		if(matchDex[tourney].players[thisPlayer].gpLoss+matchDex[tourney].players[thisPlayer].gpDraw < 2 && matchDex[tourney].players[thisPlayer].playing && thisPlayer != bye)
			topArray.push(thisPlayer);
	}
	if(topArray.length > 1)
		topArray = sortWithBreakers(tourney,topArray); //sort by highest to lowest gpWin
	let numberOfHumans = topArray.length;
	let numberOfPlayers = 2;	//increase to next square
	while(numberOfHumans > numberOfPlayers) {
		numberOfPlayers = numberOfPlayers*2
	}
	for(let i=numberOfHumans; i<numberOfPlayers;i++) //add byes to get up to next square
		topArray.push(bye);
	let pairsArray = generateBracketSeeds(Math.log2(0.5*numberOfPlayers));
	for(let thisPair in pairsArray) {
		pingParty += newGPMatch(tourney, topArray[pairsArray[thisPair][0]-1], topArray[pairsArray[thisPair][1]-1],'knockout');
		matchDex[tourney].knockoutMatches.push(matchDex[tourney].matches.length);
	}
	matchDex[tourney].data.pairing = "knockout";
	logMatch();
	return pingParty;
}
function arrayDuplicates(array1, array2) {					//returns array of duplicate elements between two arrays
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
function buchholz(tourney, id, cull) {						//buchholz or modified buchholz scoring
	let players = matchDex[tourney].players;
	let opps = getPlayedOpps(tourney, id, 1, true)[0];
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
function tiedBreaker(tourney, id) {							//number of wins against tied opponents
	let wins = 0;
	let matches = matchDex[tourney].matches;
	let players = matchDex[tourney].players;
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
function matchDiff(tourney, playerID) {						//points difference
	let gameWins = 0;
	let gameLoss = 0;
	let matches = matchDex[tourney].matches;
	let player = matchDex[tourney].players[playerID];
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
function sortWithBreakers(tourney, sortingArray) {			//sorting script that incorporates OMW, GW, and OGW breakers
	let players = matchDex[tourney].players;
	sortingArray.sort(function(a,b){return (players[b].gpWin + 0.5*players[b].gpDraw) - (players[a].gpWin + 0.5*players[a].gpDraw)});
	sortingArray.sort(function(a, b) {
		return applyBreakers(tourney, a, b)
	});
	return sortingArray;
}
function applyBreakers (tourney, a, b) {					//handles tiebreakers
	let players = matchDex[tourney].players;
	let matches = matchDex[tourney].matches;
	let result = (players[b].gpWin + 0.5*players[b].gpDraw) - (players[a].gpWin + 0.5*players[a].gpDraw);
	if(result == 0) //tiebreak by omw
		result = omw(tourney, b) - omw(tourney, a);
	if(result == 0) //tiebreak by gwp
		result = gameWinPercentage(tourney, b, 0) - gameWinPercentage(tourney, a, 0);
	if(result == 0) //tiebreak by ogw
		result = ogw(tourney, b) - ogw(tourney, a);
	/*if(result == 0) //tiebreak by a-b match winner
		result = tiedBreaker(tourney, b) - tiedBreaker(tourney, a);
	if(result == 0) //then tiebreak by modified Buchholz
		result = buchholz(tourney, b, 'modified') - buchholz(tourney, a, 'modified');
	if(result == 0) //then tiebreak by points difference
		result = (matchDiff(tourney, b) - matchDiff(tourney, a))*/
	return result;
}
function knockoutRound (tourney) {							//handles knockout matches
	let tName = matchDex[tourney].data.name;
	if(!tName)
		tName = tourney;
	let defTime = "3 days";
	if(matchDex[tourney].data.time)
		defTime = matchDex[tourney].data.time[0] + " " + matchDex[tourney].data.time[1] + (matchDex[tourney].data.time[0] != 1 && !matchDex[tourney].data.time[1].match(/s$/) ? "s" : "")
	let pingParty = "Round " + matchDex[tourney].round + " of " + tName + ". You have " + defTime + " to complete your round. Contact <@!" + matchDex[tourney].data.TO + "> for extensions.\n";
	let newMatches = [];
	for(let i=0; i<matchDex[tourney].knockoutMatches.length; i+=2) {
		let fight1 = matchDex[tourney].matches[matchDex[tourney].knockoutMatches[i]-1];
		let fight2 = matchDex[tourney].matches[matchDex[tourney].knockoutMatches[i+1]-1];
		let f1w = bye;
		if(fight1.winner != null && matchDex[tourney].players[fight1.winner].playing)
			f1w = fight1.winner;
		let f2w = bye;
		if(fight2.winner != null && matchDex[tourney].players[fight1.winner].playing)
			f2w = fight2.winner;
		pingParty += newGPMatch(tourney, f1w, f2w, 'knockout');
		newMatches.push(matchDex[tourney].matches.length);
	}
	matchDex[tourney].knockoutMatches = newMatches;
	logMatch()
	return pingParty
}
function matchWinPercentage(tourney, player, min) {			//finds a player's match win percentage
	if(!min)
		min = 0;
	let thisPlayer = matchDex[tourney].players[player];
	let byed = getPlayedOpps(tourney, bye, 1, true); //get info on byes
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
function gameWinPercentage(tourney, player, min) {			//finds a player's game win percentage
	if(!min)
		min = 0;
	let thisPlayer = matchDex[tourney].players[player];
	let byed = getPlayedOpps(tourney, bye, 1, true); //get info on byes
	let wins = 0, games = 0; //set these as new numbers to avoid references
	for(let match in thisPlayer.runs[0].matches) {
		let matchNo = thisPlayer.runs[0].matches[match]
		if(!byed[2].includes(matchNo) && !matchDex[tourney].matches[matchNo-1].knockout) { //for each match that isn't a bye or knockout round
			let thisMatch = matchDex[tourney].matches[matchNo-1];
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
function oppWinPercentage(tourney, player, percentageFunction) { //find a player's OMW or OGW
	let opps = getPlayedOpps(tourney, player, 1, true);
	let omws = [];
	for(let opp in opps[0]) {
		let thisOpp = opps[0][opp];
		if(thisOpp != bye)
			omws.push(percentageFunction(tourney, thisOpp, 0.3333).toFixed(2)); //for opponents MW or GW, minimum is 0.33
	}
	let omw = toolbox.avgArray(omws);
	if(omw < 33.33)
		omw = 33.33
	return omw;
}
function omw(tourney, player) {return oppWinPercentage(tourney, player, matchWinPercentage)}
function ogw(tourney, player) {return oppWinPercentage(tourney, player, gameWinPercentage)}
function matchPatch(tourney, number, data) {
	let p1 = data.match(/p1: ?(\d+)/);
	let p1w = data.match(/p1w: ?(\d+)/);
	let p1r = data.match(/p1r: ?(\d+)/);
	let p2 = data.match(/p2: ?(\d+)/);
	let p2w = data.match(/p2w: ?(\d+)/);
	let p2r = data.match(/p2r: ?(\d+)/);
	if(p1 && p2 && p1w && p2w) {
		if(!p1r && !p2r) {
			return updateGPMatch(tourney, p1[1], p2[1], p1w[1], p2w[1], number);
		}else if(p1r && p2r) {
			return updateMatch(tourney, p1[1], p2[1], p1w[1], p2w[1], number)
		}else{
			return "Incomplete data."
		}
	}
	
}
function addKeys(){
	for(let m in matchDex) {
		if(m != "version" && matchDex[m].data.key) {
			matchDex[m].data.key = m;
		}
	}
	logMatch();
}

//Project channels
function fetchHelpMessage() {								//devDex help message
	let output = "LackeyBot can now support fetching for custom sets!\n";
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
function addNewDevCards(designer, channel, file) {
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
		logDev(designer);
		channel.stopTyping(100);
		doneWriting("dev");
		return sani[0];
	}else{
		return sani[0];
	}
}
function sanitizeCardData(designer, channel, file, set_code) {			//download devDex patches and verify there's nothing amiss
	let holdingCell = {};
	try{
		holdingCell = require("./dev/" + file + "devtest.json");
	}catch(e){
		console.log(e);
		console.log("Failed attempt to update project database by " + pullUsername(designer));
		channel.stopTyping(100);
		doneWriting("dev");
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
		doneWriting("dev");
		console.log("Failed attempt to update project database by " + pullUsername(designer));
		return ["There are numerous errors in your set. Please re-export and try to upload again. If this continues, ping Cajun."];
	}
	if(toolbox.hasValue(errors)) {
		for(let thisCard in errors)
			errorList += errors[thisCard] + ", "
		errorList.replace(/, $/, "");
		channel.stopTyping(100);
		doneWriting("dev");
		console.log("Failed attempt to update project database by " + pullUsername(designer));
		return [errorList];
	}
	if(psWarn != "")
		psWarn = "\nDuplicate card names were detected. LackeyBot can support a normal card, promo card, and token card with the same name, but others will be overwritten. Attempting to upload to Planesculptors will cause errors. " + psWarn;
	psWarn = psWarn.replace(/, $/, "");
	return ["Cards database downloaded successfully."+psWarn, safeSet];
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
		logDev(id);
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
function generalCollater (library, set_code, count, user) {//print out pre-generated packs for Planesculptors
	let packCount = 15;
	let packs = [];
	let output = "";
	let rolling = 0;
	let thisSetData = library.setData[set_code];
	let addon = [ //ensure there's at least one common of each color
		{filters: ["r=c c=w", "r=c"], chances: [1, 1]},
		{filters: ["r=c c=u", "r=c"], chances: [1, 1]},
		{filters: ["r=c c=b", "r=c"], chances: [1, 1]},
		{filters: ["r=c c=r", "r=c"], chances: [1, 1]},
		{filters: ["r=c c=g", "r=c"], chances: [1, 1]}
	]
	for(let i=1; i<6; i++) {//make sure we have five to replace, skip first slot for foil replace
		if(thisSetData.packSlots[i].filters.length == 1 && thisSetData.packSlots[i].filters[0] == "r=c" && thisSetData.packSlots[i].chances[0] == 1) {
			if(rolling == 6) {
				thisSetData.packSlots[i] = addon[i];
			}else{
				rolling++;
			}
		}
		if(rolling == 5) {
			rolling = 6;
			i=0;
		}
	}
	for(let i=0; i<count; i++) {
		let thisPack = generatePack(set_code, library);
		if(thisPack.length < packCount)
			packCount = thisPack.length;
		packs.push(thisPack);
	}
	for(let thisPack in packs) {
		packs[thisPack] = psPackSorter(packs[thisPack], library);
		for(let i=0; i<packCount;i++) {
			if(isFoil(packs[thisPack][9]))
				output += "FOIL "
			output += library.cards[unFoil(packs[thisPack][i])].cardName + "\n";
		}
		output += "===========\n";
	}
	fs.writeFile(`packOutput_${user.id}.txt`, output, function(err){
		if(err) throw err;
		user.send("Collated packs for Planesculptors:", {
			files: [{attachment:`packOutput_${user.id}.txt`}]
		})
	})
}
function psPackSorter (packArray, library) {
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
function escapify(string) {return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');} //escape regex characters
//cr engine
function sendRuleData (testRul) {							//generates data for a given CR entry
	testRul = testRul.replace(/\.([a-z])/, "$1");
	let rulMatch = testRul.match(/([0-9]{3})\.?([0-9]*)(\.|[a-z])?/);
	let ruleData = {
		title: "",
		lines: [],
		nextRule: "",
		prevRule: "",
		ruleNames: []
	}
	let rulesList = Object.keys(ruleJson.rules);
	if(rulMatch && rulMatch[3] && ruleJson.rules.hasOwnProperty(testRul)) { //if a precise rule, send just that
		ruleData.title = testRul;
		ruleData.ruleNames.push(testRul);
		ruleData.lines = ruleJson.rules[testRul];
		let index = rulesList.indexOf(testRul);
		ruleData.nextRule = rulesList[(index+1)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
	}else if(rulMatch && rulMatch[2] && ruleJson.rules.hasOwnProperty(testRul)) { //if an XXX.YY, send that and as many subrules as you can
		ruleData.title = testRul;
		ruleData.ruleNames.push(testRul);
		ruleData.lines = ruleJson.rules[testRul];
		for(let rul in ruleData.lines) {
			if(ruleJson.rules.hasOwnProperty(ruleData.lines[rul])) {
				ruleData.ruleNames.push(ruleData.lines[rul]);
				ruleData.lines[rul] = "**" + ruleData.lines[rul] + "** " + ruleJson.rules[ruleData.lines[rul]]
			}
		}
		let index = rulesList.indexOf(testRul);
		ruleData.nextRule = rulesList[(index+ruleData.ruleNames.length)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
	}else if(rulMatch && rulMatch[1] && ruleJson.rules.hasOwnProperty(rulMatch[1])) { //if an XXX, send that and as many subrules as you can
		ruleData.title = rulMatch[1];
		ruleData.ruleNames.push(rulMatch[1]);
		ruleData.lines = ruleJson.rules[rulMatch[1]];
		for(let rul in ruleData.lines) {
			if(ruleJson.rules.hasOwnProperty(ruleData.lines[rul])) {
				ruleData.ruleNames.push(ruleData.lines[rul]);
				ruleData.lines[rul] = "**" + ruleData.lines[rul] + "** " + ruleJson.rules[ruleData.lines[rul]]
			}
		}
		let index = rulesList.indexOf(rulMatch[1]);
		ruleData.nextRule = rulesList[(index+ruleData.ruleNames.length)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
	}else{
		let glos = false;
		if(!rulMatch){
			if(ruleJson.glossary.hasOwnProperty(testRul))
				glos = testRul;
			glos = fuzzy.searchArray(testRul, Object.keys(ruleJson.glossary).reverse(), {score:3})[0];
		}
		if(glos) {
			ruleData.title = glos;
			ruleData.lines = ruleJson.glossary[glos]
			let seeCheck = ruleJson.glossary[glos][0].match(/see (rules? )?([^,]+)/i);
			if(seeCheck) {
				if(seeCheck[1]) {
					let temp = sendRuleData(seeCheck[2]);
					for(let lin in temp.lines)
						ruleData.lines.push(temp.lines[lin])
					ruleData.ruleNames = temp.ruleNames;
					ruleData.ruleNames.reverse()
					ruleData.ruleNames.push(glos)
					ruleData.ruleNames.reverse()
					ruleData.nextRule = temp.nextRule;
					ruleData.prevRule = temp.prevRule;
				}else if(ruleJson.glossary.hasOwnProperty(seeCheck[1])){
					ruleData.lines.push(seeCheck[1])
					ruleData.ruleNames = [glos, seeCheck[1]];
					ruleData.nextRule = null;
					ruleData.prevRule = null;
				}
			}
		}else{
			ruleData.title = "Comprehensive Rules";
			ruleData.ruleNames = ["000"];
			ruleData.lines = ["Rule not found."];
			ruleData.nextRule = rulesList[0];
			ruleData.prevRule = rulesList[rulesList.length-1];
		}
	}
	return ruleData;
}
function buildCREmbed(testrul, textFlag) {					//build !cr embeds
	let ruleData = sendRuleData(testrul);
	let breakout = 0;
	let output = "";
	let max = 2046;
	let footer = "";
	if(textFlag) {
		output += "**" + ruleData.title + "**";
		max = 1998;
	}
	for(let line in ruleData.lines) {
		if(!breakout && output.length + ruleData.lines[line].length > max)
			breakout = line;
		if(!breakout)
			output += "\n" + ruleData.lines[line]
		if(breakout || line == ruleData.lines.length-1) {
			footer = `Previous ${ruleData.prevRule}\nNext `
			if(breakout) {
				footer += `${ruleData.ruleNames[breakout]}`;
			}else{
				footer += `${ruleData.nextRule}`;
			}
		}
	}
	if(textFlag) {
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(ruleData.title)
			.setFooter(footer)
		return [output, nullEmbed];
	}else{ //embed
		let embedData = new Discord.MessageEmbed()
			.setTitle(ruleData.title)
			.setDescription(output)
			.setFooter(footer)
		return ["", embedData];
	}
}

//other random discord stuff
function channelTrawl(channel, lastID, count) {				//gets old messages from channel
	console.log(count + " Here I go trawling again!");
	var firstID = "";
	Client.channels.cache.get(channel).messages.fetch({limit:100, before:lastID})
		.then(function(messages) {
			let msgarray = messages.array();
			if(msgarray[0]) {
				firstID = msgarray[0].id;
				console.log(firstID);
				lastID = msgarray[msgarray.length-1].id;
					for(i=0;i<msgarray.length;i++) {
						let msgwords = msgarray[i].content;
						if(msgwords.match("!img"))
							bribeBoost++;
						if(msgwords.match("!rul"))
							bribeBoost++;
						let setCodeMatch = msgwords.match(/     \*[^ ]+/g);
						if(setCodeMatch) {
							for(let match in setCodeMatch) {
								setCodePull = setCodeMatch[match].match(/     \*([^ ]+)/);
								if(!msemSetData.hasOwnProperty(setCodePull[1]))
									cardBoost++;
							}
						}
					}
				channelTrawl(channel,lastID, count+1);
			}else{
				console.log("Trawl Complete!");
				console.log(bribeBoost);
				console.log(cardBoost);
			}
		})
		.catch(console.error);
}
function pullUsername(id) {									//gets user's username, or PlayerUnknown if error
	try{
		return Client.users.cache.get(id).username;
	}catch(e){
		return "PlayerUnknown";
	}
}
function pullPing(id) {										//gets user's ping, or PlayerUnknown if error
	try{
		return Client.users.cache.get(id);
	}catch(e){
		let playerUnknown = {
			username: "PlayerUnknown",
			send: function(words) {
				console.log(words + ' were spoken into the void.');
			}
		};
		return playerUnknown;
	}
}
function nabListNames() {									//prints league decklists names
	let players = matchDex.league.players;
	for(let thisPlayer in players) {
		for(let thisRun in players[thisPlayer].runs) {
			console.log(players[thisPlayer].runs[thisRun].deckName)
		}
	}
}
function writeHelpMessage (guild) {							//writes help message depending on the server
	let helpout = "";
	if(disableGuild.includes(guild)) {
		helpout = "Call cards with double brackets, and add setcodes to narrow your search, like <<Dissipate_ISD>>.";
		helpout += " LackeyBot is good at partial words as long as letters are in the right order.\n";
		helpout += "`!image` and `!rule` grab card images and rulings for all cards fetched in the same message, or the last card fetched in the channel.\n";
		helpout += "`!random` for a random card.\n";
		helpout += "`!stat [setcode]` for some stats from that set\n";
		helpout += "`!ban [format]` for the format's banlist\n";
	}else{
		helpout = "Call cards with double brackets, and add setcodes to narrow your search, like [[Dissolve_TWR]].";
		helpout += " LackeyBot is good at partial words as long as letters are in the right order.\n";
		helpout += "Call lists of lands like [[WU Lands]]\n";
		helpout += "With a little *incentive*, LackeyBot can find other info too.\n";
		helpout += "`$image` and `$rule` grab card images and rulings for all cards fetched in the same message, or the last card fetched in the channel.\n";
		helpout += "`$roles` for the list of roles for this server\n";
		helpout += "`$code` for the full list of setcodes\n";
		helpout += "`$stat [setcode]` for some stats from that set\n";
		helpout += "`$[mechanic name]` for rules for that mechanic, or `$mechanics` for the full list of codes\n";
		helpout += "`$deck [name]` for its wixsite decklist link\n";
		helpout += "`$gp[letter]` for a link to that GP's Challonge bracket\n";
		helpout += "`$ban` for the MSEM banlist, `$url` for its Lackey update link\n";
		helpout += "`$help` for this message\n";
		helpout += "`$drafting` and `$drafthelp` for info or help with async drafting\n";
		helpout += "`$random` for a random card, `$open [setcode]` to open a pack from that set\n";
	}
	helpout += "`$remind time message` (such as `$remind 10 minutes hello`) to set a reminder, `$reminderlist` to manage reminders\n";
	helpout += "`$roll dN` to roll some dice. Supports kh, kl, and e.\n"
	helpout += "`$play` to play a new game\n";
	helpout += "`$dance` to dance\n";
	helpout += "`$amoeboid`, `$fblthp`, `$mklthd`, `$starter`, `$sponge`, `$maro`, `$thonk` to emote\n";
	helpout += "`$x` to doubt\n";
	helpout += "`$self-destruct` to self-destruct";
	return helpout;
}
function updateDevDex() {									//update devDex to use the new packSlots system
let blank = require('./standardDist.json')
	for(let set in devDex.setData) {
		devDex.setData[set].packSlots = blank;
	}
	logDev(bye);
}
async function asyncSwapPins(msg, matching, max, bank) {	//pin swapper script
	let pinnedPosts = await msg.channel.messages.fetchPinned();
	pinnedPosts = pinnedPosts.array();
	for(let post in pinnedPosts) {
		if(postMatching(pinnedPosts[post], matching)) {
			if(bank)
				bank[2] = pinnedPosts[post];
			pinnedPosts[post].unpin();
			max--;
			if(max == 0)
				break
		}
	}
	if(bank)
		bank[1] = msg;
	msg.pin();
}
function postMatching(post, matching) {						//runs a matching object over a post
	if(matching.hasOwnProperty('content') && !post.content.match(matching.content))
		return false;
	if(matching.hasOwnProperty('author') && post.author.id != matching.author)
		return false;
	if(matching.hasOwnProperty('channel') && post.channel.id != matching.channel)
		return false;
	if(matching.hasOwnProperty('guild') && post.guild.id != matching.guild)
		return false;
	return true;
}
function reformatallRoles() {								//currently blank, for reformatting roles.json
	logRole();
}
function addEventTags(timestamp){							//event reminders don't have snooze, this retroactively adds that
	if(!reminderBase[timestamp])
		return "No reminders for that time.";
	let thisTime = reminderBase[timestamp];
	for(let entry in thisTime) {
		thisTime[entry].event = true;
	}
	logLater['reminder'] = true;
	return "Reminders evented.";
}
function moxtoberHandler(msg, thisPrompt) {
	let promptArray = [
		"", "Harvest", "Curio", "Binding", "Smog", "Cynic",
		"Lance", "Mithril", "Rider", "Tyrant", "Brew",
		"Pact", "Fortune", "Dread", "Firstborn",
		"Tale", "Eclipse", "Blasphemy", "Charm",
		"Specter", "Bludgeon", "Postmortem", "Trinket",
		"Rakish", "Etching", "Flaunt", "Obfuscate",
		"Chitinous", "Meat", "Anxiety", "Brink", "Punchline"
	];
	let thisIndex = promptArray.indexOf(thisPrompt);
	let fileName = "Moxtober Day " + thisIndex + " " + promptArray[thisIndex] + ".mse-set";
	if(thisIndex > 10) { //edit the file if we have it already
		if(fs.existsSync("./moxtober/" + fileName)) {
			moxtoberParser(msg, "./moxtober/" + fileName, thisPrompt)
		}else{ //otherwise download it then edit it
			dropboxDownload('moxtober/'+fileName, '/moxtober/'+fileName, function(){
				moxtoberParser(msg, "./moxtober/" + fileName, thisPrompt);
			})
		}
	}
}
function moxtoberAddMTGDCards(thisPrompt) {
	let fileName = "./moxtober/Moxtober " + thisPrompt + ".mse-set";
	let allOutput = "";
	let fields = require("./mtgd.json");
	for(let f in fields) {
		let cardData = {
			name: "",
			casting_cost: "",
			type: "",
			super_type: "",
			sub_type: "",
			rarity: "",
			rule_text: "",
			flavor_text: "",
			power: "",
			toughness: "",
			loyalty: "",
			illustrator: "",
			name_2: "",
			casting_cost_2: "",
			type_2: "",
			super_type_2: "",
			sub_type_2: "",
			rule_text_2: "",
			flavor_text_2: "",
			power_2: "",
			toughness_2: "",
			loyalty_2: "",
			illustrator_2: "",
			stylesheet: "",
			styling_data: {},
		}
		cardData.name = fields[f][0];
		cardData.casting_cost = fields[f][1].replace(/[[\]\{}]/, "");
		cardData.type = fields[f][2];
		cardData.rarity = expandRarity(fields[f][3]); //CURM
		//if(fields[f][30])
			//cardData.image = "image" + f;
		cardData.rule_text = mod_magic.unsymbolize(fields[f][5]);
		cardData.level_2_text = mod_magic.unsymbolize(fields[f][6]);
		cardData.level_3_text = mod_magic.unsymbolize(fields[f][7]);
		cardData.level_4_text = mod_magic.unsymbolize(fields[f][8]);
		if(cardData.level_2_text) {
			cardData.level_1_text = "" + cardData.rule_text;
			cardData.rule_text = "";
		}
		cardData.flavor_text = fields[f][9];
		cardData.illustrator = fields[f][10];
		cardData.power = fields[f][13];
		cardData.toughness = fields[f][14];
		cardData.loyalty = fields[f][15];
		if(fields[f][19] == "silver")
			cardData.border_color = "rgb(200,200,200)";
		cardData.card_color = expandColors(fields[f][21]); //WUBRG
		cardData.card_code_text = "Designed by " + fields[f][28];
		cardData.rule_text = cardData.rule_text.replace(/\n$/, "");
		cardData.flavor_text = cardData.flavor_text.replace(/\n$/, "");
		cardData.rule_text_2 = cardData.rule_text_2.replace(/\n$/, "");
		cardData.flavor_text_2 = cardData.flavor_text_2.replace(/\n$/, "");
		cardData.type = cardData.type.replace(/ ?(—|-) ?/, " - ");
		let types = cardData.type.split(" - ");
		cardData.super_type = types[0];
		if(types[1])
			cardData.sub_type = types[1];
		delete cardData.type;

		cardData = altFrameFormatter(cardData);
		allOutput += MSECardWriter(cardData);
		/*if(fields[f][30]) {
			download(fields[f][30], {directory:"./moxtober/", filename: `${f}.png`}, function(err) {
				//zipTech the images async
				fs.readFile(`./moxtober/${f}.png`, function(err, data) {
					if(err) throw err;
					let imgBuffer = Buffer.from(data)
					zipTech.addToZip(fileName, `image${f}`, imgBuffer, function(){
						console.log(`image${f} written`)
					})
				})
			});
		}*/
	}
	zipTech.editZip(fileName, 'set', function(content) {
		return content + "\n" + allOutput;
	}, function() {
		fs.readFile(fileName, function(err, data) {
			console.log('allcards written')
		})
	});
}
function expandColors(colors) {	//expand colors
	colors = colors.replace("B", "Black ");
	colors = colors.replace("U", "Blue ");
	colors = colors.replace("W", "White ");
	colors = colors.replace("G", "Green ");
	colors = colors.replace("R", "Red ");
	colors = colors.replace(/ $/, "");
	colors = colors.replace(/ /g, ", ");
	return colors;
}
function expandRarity(rarity) { //expand rarity letters
	if(rarity == "C")
		return "common";
	if(rarity == "U")
		return "uncommon";
	if(rarity == "R")
		return "rare";
	if(rarity == "M")
		return "mythic rare";
	return "special";
}
function moxtoberParser(msg, fileName, thisPrompt) {
	msg.content = mod_magic.unsymbolize(msg.content); //convert symbols
	//first check for text posts
	let cardData = {
		name: "",
		casting_cost: "",
		type: "",
		super_type: "",
		sub_type: "",
		rarity: "",
		rule_text: "",
		flavor_text: "",
		power: "",
		toughness: "",
		loyalty: "",
		illustrator: "",
		name_2: "",
		casting_cost_2: "",
		type_2: "",
		super_type_2: "",
		sub_type_2: "",
		rule_text_2: "",
		flavor_text_2: "",
		power_2: "",
		toughness_2: "",
		loyalty_2: "",
		illustrator_2: "",
		stylesheet: "",
		styling_data: {},
	}
	let imgName, secondFace = false, secondStart = 0;
	if(msg.guild)
		cardData.notes = `https://discordapp.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`
	if(msg.content != "") {
	let breaks = msg.content.split("\n");
		let checkLand = 0, ruleStart = 0, flavorStart = 0;
		for(let i=0; i<breaks.length; i++) {
			let thisLine = breaks[i];
			if(i == 0 || (secondStart && i == secondStart)) { //name and probably mana cost
				//remove markdown
				thisLine = thisLine.replace(/[*_]/g, "");
				//check for mana cost
				let manaCheck = thisLine.match(/([0-9WUBRGCSETQAPH\/]+)$/);
				if(manaCheck) {
					let casting_cost = "casting_cost";
					if(secondFace)
						casting_cost = "casting_cost_2";
					cardData[casting_cost] = manaCheck[1];
					thisLine = thisLine.replace(manaCheck[1], ""); //remove the mana
					thisLine = thisLine.replace(/ +$/, ""); //remove trailing spaces
				}else{
					//maybe a land, maybe a linebreak'd cost, check next line to confirm
					checkLand = i+1
				}
				let name = "name";
				if(secondFace)
					name = "name_2";
				cardData[name] = thisLine;
			}else{
				if(i == checkLand) { //checking line 2 for a manacost
					thisLine = thisLine.replace(/[*_]/g, "");
					let manaCheck = thisLine.match(/([0-9WUBRGCSETQAPH\/]+)$/);
					let rarityCheck = thisLine.match(/(?:(\*|\[|<:| )[^\n ]*)?([Uu]ncommon|[Cc]ommon|[Mm]ythic [Rr]are|[Mm]ythic|[Rr]are|C|U|R|M)(\*|]|:\d+>)?$/)
					if(manaCheck) {
						let casting_cost = "casting_cost";
						if(secondFace)
							casting_cost = "casting_cost_2";
						cardData[casting_cost] = manaCheck[1];
					}else{
						if(rarityCheck) {
							//remove rarity for the typeline
							thisLine = thisLine.replace(/(?:(\*|\[|<:| )[^\n ]*)?([Uu]ncommon|[Cc]ommon|[Mm]ythic [Rr]are|[Mm]ythic|[Rr]are|C|U|R|M)(\*|]|:\d+>)?$/, "");
							thisLine = thisLine.replace(/ +$/, ""); //and the trailing spaces
							let rarityGrabber = {c: "common", u: "uncommon", r: "rare", m: "mythic rare", mythic: "mythic rare"}
							let rar = rarityCheck[1].toLowerCase();
							if(rarityGrabber[rar]) {
								cardData.rarity = rarityGrabber[rar];
							}else{
								cardData.rarity = rar;
							}
						}
						let type = "type";
						if(secondFace)
							type = "type_2";
						cardData[type] = thisLine;
					}
				}else if(i == 1){ //otherwise line 2 is the type
					let rarityCheck = thisLine.match(/(?:(\*|\[|<:| )[^\n ]*)?([Uu]ncommon|[Cc]ommon|[Mm]ythic [Rr]are|[Mm]ythic|[Rr]are|C|U|R|M)(\*|]|:\d+>)?$/)
					if(rarityCheck) {
						//remove rarity for the typeline
						thisLine = thisLine.replace(/(?:(\*|\[|<:| )[^\n ]*)?([Uu]ncommon|[Cc]ommon|[Mm]ythic [Rr]are|[Mm]ythic|[Rr]are|C|U|R|M)(\*|]|:\d+>)?$/, "");
						thisLine = thisLine.replace(/ +$/, ""); //and the trailing spaces
						let rarityGrabber = {c: "common", u: "uncommon", r: "rare", m: "mythic rare", mythic: "mythic rare"}
						let rar = rarityCheck[2].toLowerCase();
						if(rarityGrabber[rar]) {
							cardData.rarity = rarityGrabber[rar];
						}else{
							cardData.rarity = rar;
						}
					}
					let type = "type";
					if(secondFace)
						type = "type_2";
					cardData[type] = thisLine.replace(/[*_]/g, "");
				}else{ //figure out rules, flavor, and pt
					let flavorMatch = thisLine.match(/^\*[^(][^\n]+[^)]\*$/); //starts and ends with non reminder italic
					let ptMatch = thisLine.match(/^[*_]{0,2}([\dX+]*)\/([\dX+]*)[*_]{0,2}$/);
					let artistCheck = thisLine.match(/^(artist|art|illustrator|illus): ?([^\n]+)/i);
					let doubleCheck = thisLine.match(/^[-\/—]+$/)
					let fuseCheck = thisLine.match(/^Fuse($| \()/)
					if(doubleCheck){
						secondFace = true;
						secondStart = i+1;
						checkLand = 0;
						flavorStart = 0;
					}else if(fuseCheck) {
						cardData.rule_text_3 = "Fuse";
					}else if(artistCheck){
						let illus = "illustrator";
						if(secondFace)
							illus = "illustrator_2";
						cardData[illus] = artistCheck[2];
					}else if(ptMatch) { //pt
						let power = "power", toughness = "toughness";
						if(secondFace) {
							power = "power_2";
							toughness = "toughness_2";
						}
						cardData[power] = ptMatch[1];
						cardData[toughness] = ptMatch[2];
					}else if(flavorMatch || (flavorStart && i > flavorStart)) { //flavor text
						if(flavorStart == 0)
							flavorStart = i;
						let flavor_text = "flavor_text";
						if(secondFace)
							flavor_text = "flavor_text_2";
						cardData[flavor_text] += thisLine.replace(/\*/g, "") + "\n";
					}else{ //rules text
						let rule_text = "rule_text";
						if(secondFace)
							rule_text = "rule_text_2";
						cardData[rule_text] += thisLine.replace(/\*/g, "") + "\n"
					}
				}
			}
		}
		cardData.rule_text = cardData.rule_text.replace(/\n$/, "");
		cardData.flavor_text = cardData.flavor_text.replace(/\n$/, "");
		cardData.rule_text_2 = cardData.rule_text_2.replace(/\n$/, "");
		cardData.flavor_text_2 = cardData.flavor_text_2.replace(/\n$/, "");
		cardData.type = cardData.type.replace(/ ?(—|-) ?/, " - ");
		let types = cardData.type.split(" - ");
		cardData.super_type = types[0];
		if(types[1])
			cardData.sub_type = types[1];
		delete cardData.type;
		cardData.type_2 = cardData.type_2.replace(/ ?(—|-) ?/, " - ");
		types = cardData.type_2.split(" - ");
		cardData.super_type_2 = types[0];
		if(types[1])
			cardData.sub_type_2 = types[1];
		delete cardData.type_2;
	}
	cardData.card_code_text = `Designed by ${msg.author.username}`
	if(!cardData.name)
		cardData.name = `Designed by ${msg.author.username}`
	//check for images
	let attachments = msg.attachments.array();
	if(attachments.length) {
		let attachURL = attachments[0].url;
		download(attachURL, {directory:"./moxtober/", filename: `${msg.id}.png`}, function(err) {
			let imgDim = sizeOf(`moxtober/${msg.id}.png`);
			let ratio = imgDim.height/imgDim.width
			if(imgDim.width > 350 && ratio > 1.3 && ratio <= 1.45) {
				imgManip.resizeImg(`moxtober/${msg.id}.png`, 375)
				let sizeDown = 375 / imgDim.width
				imgDim.width = 375;
				imgDim.height = Math.round(sizeDown * imgDim.height);
			}
			if(imgDim.width == 375) { //card render
				cardData.styling_data.popout_image_style = "0,0,375,523,"
				cardData.mainframe_image = `image_2${msg.id}`
				imgName = `image_2${msg.id}`
			}else if(imgDim.width == 752) { //dfc render
				cardData.stylesheet = "m15-mainframe-dfc"
				cardData.styling_data.popout_image_style = "0,0,752,523,"
				cardData.mainframe_image = `mainframe_image${msg.id}`
				imgName = `mainframe_image${msg.id}`
			}else if(imgDim.width == 523) { //split render
				cardData.styling_data.popout_image_style = "0,0,523,375,"
				cardData.stylesheet = "m15-split-fusable"				
				cardData.mainframe_image = `mainframe_image${msg.id}`
				imgName = `mainframe_image${msg.id}`
			}else if(imgDim.width == 800) { //plane
				cardData.stylesheet = "m15-mainframe-planes";
				cardData.image = `image${msg.id}`;
				imgName = `image${msg.id}`;
			}else if(cardData.illustrator){	//posted art
				cardData.image = `image${msg.id}`			
				imgName = `image${msg.id}`
				if(imgDim.width == 157) //saga
					cardData.stylesheet = "m15-saga";
				if(imgDim.width == 427) //planeswalker
					cardData.stylesheet = "m15-mainframe-planeswalker";
				if(imgDim.width == 493) { //planeswalker w/wide image
					cardData.stylesheet = "m15-mainframe-planeswalker";
					cardData.styling_data.default_image_size = "no";
				}
				if(imgDim.width == 753) //plane
					cardData.stylesheet = "m15-mainframe-planes";
			}
			cardData = altFrameFormatter(cardData);
			//ziptech with image
			if(imgName) {
				fs.readFile(`./moxtober/${msg.id}.png`, function(err, data) {
					if(err) throw err;
					let imgBuffer = Buffer.from(data)
					let newContent = MSECardWriter(cardData);
					zipTech.editZip(fileName, 'set', function(content) {
						return content += "\n" + newContent;
					}, function() {
						zipTech.addToZip(fileName, imgName, imgBuffer, function() {
							msg.channel.send("Added to Moxtober " + thisPrompt + " file");
							fs.readFile(fileName, function(err, data) {
								if (err) throw err;
								dropboxUpload(fileName.replace(/^\./, ""), Buffer.from(data))
							})
						})
					});
				})
			}else{
				let outM = "There was an issue with your image."
				if(!cardData.illustrator)
					outM += " For cropped arts, make sure to include the art credit with the line `artist: Artist's Name`";
				msg.channel.send(outM)
			}
		});
	}else{
		cardData = altFrameFormatter(cardData);
		//ziptech with blank card
		let newContent = MSECardWriter(cardData);
		zipTech.editZip(fileName, 'set', function(content) {
			return content + "\n" + newContent;
		}, function() {
			msg.channel.send("Added to Moxtober " + thisPrompt + " file");
			fs.readFile(fileName, function(err, data) {
				if (err) throw err;
				dropboxUpload(fileName.replace(/^\./, ""), Buffer.from(data))
			})
		});
	}
}
function altFrameFormatter(cardData) {
	if(cardData.super_type.match(/^Plane/i))
		cardData.stylesheet = "m15-mainframe-planes"
	if(cardData.super_type.match(/Planeswalker/i))
		cardData.stylesheet = "m15-mainframe-planeswalker"
	if(cardData.sub_type.match(/Saga/i))
		cardData.stylesheet = "m15-saga"
	if(cardData.sub_type_2 && cardData.sub_type_2.match(/Adventure/i)) {
		cardData.stylesheet = "m15-adventure"
	}else if(cardData.rule_text_2 && cardData.rule_text_2.match(/^Aftermath/i)) {
		cardData.stylesheet = "m15-aftermath";
	}else if(cardData.name_2 && cardData.rule_text.match(/transform/)){
		cardData.stylesheet = "m15-mainframe-dfc";
	}else if(cardData.name_2) {
		cardData.stylesheet = "m15-split-fusable";
	}
	let levels = ["level_1_text", "level_2_text", "level_3_text", "level_4_text"];
	let levels2 = ["level_5_text", "level_6_text", "level_7_text", "level_8_text"];
	if(cardData.stylesheet == "m15-plane") {
		let chaosMatch = cardData.rule_text.match(/^Whenever you roll [^\n]+$/);
		if(chaosMatch) {
			card.rule_text.replace(chaosMatch[0], "");
			card.rule_text_2 = chaosMatch[0];
		}
	}
	if(cardData.stylesheet == "m15-mainframe-planeswalker" || cardData.stylesheet == "m15-saga") {
		let lines = cardData.rule_text.split("\n");
		for(let i=0; i<lines.length; i++) {
			cardData[levels[i]] = lines[i];
		}
		if(cardData.stylesheet == "m15-mainframe-planeswalker") {
			if(lines.length == 2)
				cardData.styling_data.use_separate_textboxes = "two";
			if(lines.length == 4)
				cardData.styling_data.use_separate_textboxes = "four";
		}
		if(cardData.stylesheet == "m15-saga") {
			if(lines.length == 2)
				cardData.styling_data.chapter_textboxes = "two";
			if(lines.length == 4)
				cardData.styling_data.chapter_textboxes = "four";
		}
		cardData.rule_text = "";
	}
	return cardData;
}
function MSECardWriter(cardData) {
	let output = "card:\n";
	if(cardData.stylesheet)
		output += `\tstylesheet: ${cardData.stylesheet}\n`;
	if(Object.keys(cardData.styling_data).length) {
		output += `\thas styling: true\n`;
		output += `\tstyling data:\n`;
		for(let v in cardData.styling_data)
			output += `\t\t${v}: ${cardData.styling_data[v]}\n`;
	}else{
		output += `\thas styling: false\n`;
	}
	let remainingFields = [
		"notes",
		"border_color",
		"name",
		"casting_cost",
		"indicator",
		"super_type",
		"sub_type",
		"rarity",
		"rule_text",
		"flavor_text",
		"level_1_text",
		"level_2_text",
		"level_3_text",
		"level_4_text",
		"image",
		"mainframe_image",
		"image_2",
		"power",
		"toughness",
		"loyalty",
		"illustrator",
		"name_2",
		"casting_cost_2",
		"super_type_2",
		"sub_type_2",
		"rule_text_2",
		"flavor_text_2",
		"level_5_text",
		"level_6_text",
		"level_7_text",
		"level_8_text",
		"mainframe_image",
		"image_2",
		"power_2",
		"toughness_2",
		"loyalty_2",
		"illustrator_2",
		"rule_text_3",
		"card_code_text"
	]
	for(let field in remainingFields) {
		if(cardData[remainingFields[field]]) {
			if(cardData[remainingFields[field]].match(/\n/)) {
				output += `\t${remainingFields[field]}:\n`
				let lines = cardData[remainingFields[field]].split("\n");
				for(let l in lines) {
					if(lines[l] != "")
						output += `\t\t${lines[l]}\n`;
				}
			}else{
				output += `\t${remainingFields[field]}: ${cardData[remainingFields[field]]}\n`;
			}
		}
	}
	return output;
}

function reportGuilds() {
	let guilds = Client.guilds.cache.array();
	for(let guild in guilds) {
		console.log(guilds[guild].name);
		let emotes = guilds[guild].emojis.cache.array();
		for(let e in emotes)
			console.log(emotes[e].id, emotes[e].name);
		console.log();
	}
}
function channelReminders() {					//posts help messages to channels after inactivity
	let now = new Date().getTime();
	//artHelpPoster
	let artID = "358302654847385610";
	//artID = "367816828287975425";
	let artReminder = `To help make sure your art requests don't get lost, you can pin your ongoing requests with LackeyBot. Useful for if you need art for a specific concept, or help tracking down an artist. And of course, if you're feeling helpful, you can check out other peoples pins and help them out as well.\n\n**To pin your own message in #art-help:** React to your own message with ${pinEmotes[0]} or ${pinEmotes[1]}. Each user can only have one pinned message in this channel at a time. To change your pinned message, react to a new message or remove your previous react.`;
	try{
		channelHelpPoster(artID, artReminder, now);
	}catch(e){}
	//projectHelpPoster
	let projectID = "771127405946601512";
	//projectID = "711124818036129812";
	let projectReminder = `Sometimes you're looking for feedback on more than a single design. You want help with your set's limited archetypes, or on how multiple keywords might work together. To help people keep track of what your project is about, you can type up a message in here summarizing it (and maybe include links to planesculptors pages or something similar if you have them) for people to refer to.\n\n**To pin your own message in #project-talk:** React to your own message with ${pinEmotes[0]} or ${pinEmotes[1]}. Each user can only have one pinned message in this channel at a time. To change your pinned message, react to a new message or remove your previous react.`
	try{
		channelHelpPoster(projectID, projectReminder, now);
	}catch(e){}
}
async function channelHelpPoster(id, helpMsg, now) {
	if(!now)
		now = new Date().getTime();
	let channel = Client.channels.cache.get(id);
	let lastTen = await channel.messages.fetch({limit:50});
	let post = true;
	let timeCheck = now - (10*60*1000); //ten minutes ago
	//don't post if post in the last ten minutes
	//don't post if last ten has a pin reminder
	if(lastTen.filter(m => m.createdTimestamp > timeCheck).size) {
		post = false; //message in the last 10 minutes
	}
	if(lastTen.filter(m => m.content == helpMsg).size) {
		post = false;
	}
	if(post)
		channel.send(helpMsg);
		
}
function wildcardVoter(user, content) {
	let wildcardChannel = Client.channels.cache.get('777455867725479966')
	if(!scratchPad.wildcard[user]) {
		wildcardChannel.send(content)
			.then(mess => logVotes(mess.id, user))
			.catch(e => console.log(e))
	}else{
		let theirPost = wildcardChannel.messages.fetch(scratchPad.wildcard[user])
			.then(mess => mess.edit(content))
			.catch(e => console.log(e))
	}
}
function logVotes(messID, userID) {
	scratchPad.wildcard[userID] = messID;
	logScratchpad();
}
var date = new Date();
console.log(`${date.getDate()}/${(date.getMonth()<10)? "0"+date.getMonth() : date.getMonth()} ${(date.getHours()<10) ? "0"+date.getHours() : date.getHours()}:${(date.getMinutes()<10)? "0"+date.getMinutes() : date.getMinutes()} Loading database.`);
try{//start the bot
    reloadData();
}catch(e){
    console.log("reloadData():");
	console.log(e);
}

//this is what runs every time LackeyBot reads a Discord message
//it stays all in this one handler
Client.on("message", (msg) => {
	msg.realContent = ""; 									//full content of message
	msg.realContent += msg.content;							//split to not be a reference
	msg.content = msg.content.replace(/```[\s\S]+```/g, "");//then remove codeblocks when checking commands
	msg.content = msg.content.replace(/`[\s\S]+`/g, "");
	let grab = 'defaults';
	if(msg.guild && arcanaSettings.hasOwnProperty(msg.guild.id))
		grab = msg.guild.id;
	let arcanaData = toolbox.cloneObj(arcanaSettings[grab]);
	var psActive = msg.content.match(/\$pl?a?n?e?sc?u?l?p?t?o?r?/i);
	var swapSquares = msg.content.match(arcana.refSheet.anySwapRegex);
	if(swapSquares || psActive) {
		delete arcanaData.square;
		arcanaData.square = {};
		arcanaData.square.prefix = "\\$";
		arcanaData.square.emote = dollarEmote;
		if(psActive) {
			arcanaData.square.data = {cards:psScrape.psCache, name:"ps"}
		}else{
			let dataName = arcana.refSheet.swapCommands[swapSquares[1]];
			arcanaData.square.data = arcana[dataName];
		}
	}
	var codeCheck = msg.content.match(/`/);
	let gpName, isLeague;
	for(let t in matchDex) {
		if(matchDex[t].hasOwnProperty('data') && matchDex[t].data.hasOwnProperty('channel')) {
			if(matchDex[t].data.channel == msg.channel.id && !gpName) {
				gpName = t;
				isLeague = (matchDex[gpName].data.pairing == "league");
			}
		}
	}
	try{
		admincheck = checkRank(msg); //in a try/catch because it was firing on startup and crashing
	}catch(e){
		admincheck = [7];
	}
    if(!msg.author.bot && !admincheck.includes(9)){ //prevents LackeyBot from responding to itself or other bots
		if(offline && !admincheck.includes(0))
			return
		if(msg.content.match(/\$ignore/i) && !(msg.content.match(/!test/i) && offline))
			return;
	//Admin Commands
	//0 - Bot admin permissions
	//1 - TO permssions
	//2 - Draft permissions
	//3 - Server admin permissions
	//4 - Server moderator permissions
	//5 - statDex advanced permissions
	//7 - General permissions
	//9 - Banned
		try{//admin/debugging commands
			if(admincheck.includes(0)) { //commands limited to bot admin
				if(msg.content.match(/!arttest/))
					channelReminders();
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
				if(msg.content.match("hey lackeybot does your library support replies yet?"))
					msg.reply("Looks like it does.")
				if(msg.content.match(/!addkeys/))
					addKeys();
				if(msg.content.match(/!matchpatch/)) {
					let t = msg.content.match(/tourney: ?([^\n]+)/i);
					let m = msg.content.match(/match: ?(\d+)/i);
					if(t && m)
						msg.channel.send(matchPatch(t[1], m[1], msg.content))
				}
				let moxPurge = msg.content.match(/!mox ?purge ([^\n]+)\n([^\n]+)/);
				if(moxPurge) {
						var moxcbs = function(name, fieldText, killNote){
							let newOutput = "";
							killNote = moxPurge[1];
							let mainFields = fieldText.split(/(?:^|\n)\t(?!\t)/); //things one tab in
							if(name == "card") {
								if(!fieldText.match("notes: " + killNote))
									newOutput = fieldText;
							}else{
								return name + ":\n" + fieldText;
							}
							if(!newOutput)
								return "";
							return name + ":\n" + newOutput;
						}
						zipTech.editZip('./moxtober/Moxtober '+ moxPurge[2] + '.mse-set', 'set', async function(content) {
							return setParser.fileParser(content, moxcbs);
						}, function() {
							msg.channel.send("Card removed");
							fs.readFile('./moxtober/Moxtober '+ moxPurge[2] + '.mse-set', function(err, data) {
								if (err) throw err;
								dropboxUpload('/moxtober/Moxtober '+ moxPurge[2] + '.mse-set', Buffer.from(data))
							})
						});
				}
				let votepoke = msg.content.match(/!votepoke (\d+)/i);
				if(votepoke) {
					for(let u in scratchPad.wildcard) {
						if(scratchPad.wildcard[u] == votepoke[1]) {
							let content = msg.content.replace(votepoke[0], "");
							Client.users.cache.get(u).send(content);
							msg.channel.send("Voter poked");
							return;
						}
					}
					msg.channel.send("Voter not found.");
				}
				if(msg.content.match(/!moxadd/i)) { //add all the mtg.d cards to moxtober files
					moxtoberAddMTGDCards("Day 13 Dread");
				}
				if(msg.content.match("!devdate"))
					reloadDevDex();
				if(msg.content.match(/!remindEdit/i))
					msg.channel.send(parseReminderEdit(msg.realContent));
				if(msg.content.match(/!hookshift/i)){
					let times = msg.content.match(/!hookshift (\d+) (\d+)/i)
					hookShift(times[1], times[2]);
				}
				if(msg.content.match("!react")) //reacts to a post
					reactMsg(msg);
				if(msg.content.match("!status!")){ //changes game on the fly
					let newstat = msg.content.toString();
					let twostat = newstat.split("!");
					status = twostat[2];
					Client.user.setPresence( { activity: {name: status}});
				}
				if(msg.content.match(/!admin log roles/i))
					logRole();
				if(msg.content.match(/!admin log match/i))
					logMatch();
				if(msg.content.match(/!admin log remind/i)) {
					echoReminders();
					logReminders();
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
							logMatch();
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
						logMatch();
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
				let eventAdd = msg.content.match(/!addevent ([0-9]+)/);
				if(eventAdd){
					msg.content.send(addEventTags(eventAdd[1]));
				}
				let jsoncheck = msg.content.match(/!json ([A-Z0-9_]+)/i);
				if(jsoncheck !== null && msemSetData.hasOwnProperty(jsoncheck[1])){
					mtgjsonBuilder(jsoncheck[1],msg.author);
				}
				if(jsoncheck !== null && jsoncheck[1] == "ALL") {
					for(let thisSet in msemSetData)
						mtgjsonBuilder(thisSet,msg.author);
				}
				if(jsoncheck !== null && jsoncheck[1] == "TRICE")
					mtgjsonSetsBuilder(msg.author);
				if(msg.content.match("!bad")) { //bad and shameful
					if(msg.member.roles.cache.find(val => val.id == "494215662286274561")){
						msg.member.roles.remove("494215662286274561").catch(console.error);
					}else{
						msg.member.roles.add("494215662286274561").catch(console.error);
					}
				}
				//temp ban
				var banMatch = (/!ban <?@?!?([0-9]+)>?/)
				if(banMatch) { //temp bans a user from LackeyBot
					config.admin[banMatch[1]] = [5];
				}
				//devDex maintenance
				if(msg.content.match("!longnames")) {
					for(let dev in devDex.devData) {
						console.log(dev)
						if(!devDex.devData[dev].hasOwnProperty("channel")) {
							devDex.devData[dev].channel = "";
							console.log(dev);
						}
					}
					logDev(msg.author.id);
				}
				//stat commands
				if(msg.content.match("!restat")) //corrects the stats
					statUpdate(msg);
				if(msg.content.match("!mindgap")) { //gets time until next reminder
					let nextTime = Object.keys(reminderBase)[0];
					let nowTime = new Date().getTime();
					msg.channel.send(timeConversion(nextTime - nowTime,2));
				}
				if(msg.content.match("!report")) //reports the current stats
					msg.channel.send("count: " + countingCards + "\nbribes: " + bribes +"\nexplosions: " + explosions + "\ndrafts: " + draftStarts + "\npacks: " + crackedPacks);

				//Experimental commands
				//playing with embeds
				if(msg.content.match(/!embed1/i)) {
					var exampleEmbed = new Discord.MessageEmbed()
						.setColor('#0099ff')
						.setTitle("And this is proper title text.")
						.setAuthor("This is like a header.")
						.setDescription("An embed. Neat.")
						.addField("A mini header","with a mini description")
						.addField('\u200b', '\u200b') //blankField
						.addField("A mini header","after a break")
						.addField("A headerless description","is not allowed.", true)
						.addField("But you can have one","right next door",true)
						.setTimestamp()
						.setFooter("By LackeyBot.")
					msg.channel.send(exampleEmbed);
				}
				if(msg.content.match(/!embed2/i)) {
					var exampleEmbed = new Discord.MessageEmbed()
						.setColor('#0099ff')
						.setTitle("And this is proper title text.")
						.setAuthor("This is like a header.")
						.setDescription("An embed. Neat.")
						.addField("Are you feeling it now","Mr. Krabs?\nHow 'bout now?\nNow?\nNoooooooooow?")
						.addField("Are you feeling it now","Mr. Krabs?")
						.setTimestamp()
						.setFooter("By LackeyBot.")
					msg.channel.send(exampleEmbed);
				}
				if(msg.content.match("!rolegank")) {
					let guildID = msg.guild.id;
					let page = 0;
					let embedInfo = buildRoleEmbed(guildID, page);
					let exampleEmbed = embedInfo[0];
					msg.channel.send(exampleEmbed)
						.then(function(mess) { if(embedInfo[1]>1){mess.react(leftArrow)
						.then(() => mess.react(rightArrow))}})
						.catch(console.log("An emote didn't spawn"))
				}
				

				//creating channels test
				if(msg.content.match("!chantest")) {
					let chanArray = Client.guilds.cache.get("190309853296590848").channels.cache.get('637483964508143616').children.array();
					let addingChan = {name: "real test channel", position: 0};
					let chanNameArray = [addingChan];
					for(let i=0; i<chanArray.length; i++) {
						let chanData = {};
						chanData.name = chanArray[i].name;
						chanData.position = chanArray[i].position;
						chanNameArray.push(chanData);
					}
					chanNameArray.sort((a, b) => (a.name > b.name) ? 1 : -1);
					let chanHold = chanNameArray.indexOf(addingChan);
					let chanPos = chanNameArray[chanHold-1].position;
					console.log(chanNameArray);
					Client.guilds.cache.get("190309853296590848").createChannel("real test channel", {type:"text", parent:"637483964508143616", permissionOverwrites:[{id: msg.guild.id, deny:["VIEW_CHANNEL"]},{id:Client.user.id, allow:["VIEW_CHANNEL","MANAGE_CHANNELS"]}], position: chanPos})
				}
				//creating permissions test
				if(msg.content.match("!permtest"))
					msg.channel.overwritePermissions(bye, {VIEW_CHANNEL: true});
				//creating roles test
				if(msg.content.match("!roletest")){
					msg.guild.roles.create({data:{name: "test role"}, reason:"Created with LackeyBot"})
						.then(msg.member.roles.add(msg.guild.roles.cache.find(role => role.name == "test role")))
						.catch(console.error);
				}
				var roleColorTest = msg.content.match(/!rolecolor ([0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])/i);
				if(roleColorTest) {
					msg.guild.roles.create({data:{
						name: roleColorTest[1],
						color: roleColorTest[1]
					}, reason:"Created with LackeyBot"})
					console.log(msg.channel.send(roleColorTest[1] + " role created."));
				}
				
				/* gp testing scripts
					var gptest0 = msg.content.match(/!testgp 0/i);
					var gptest = msg.content.match(/!testgp 1/i);
					var gptest2 = msg.content.match(/!testgp 2/i);
					var gptest3 = msg.content.match(/!testgp 3/i);
					var gptest4 = msg.content.match(/!testgp 4/i);
					var conscripts = ["209223111344783360","404401868928712704","341341901439369217","404498320174874635","341937757536387072","341641683420839942","256507133619732480","155149108183695360","127296623779774464","139184614567575553","228286499953704961","107957368997834752","126785105556537344","190309440069697536","130518115703324673","317372824660475905","255016944183279626"]
					if(gptest0) {
						matchDex.gp.matches = [];
						matchDex.gp.players = {};
						matchDex.gp.round = 0;
						matchDex.gp.awaitingMatches = [];
						logMatch();
					}
					if(gptest) {
						for(let chump in conscripts)
							console.log(addNewPlayer('gp', conscripts[chump]));
					}
					if(gptest2) {
						matchDex.gp.round++;
						console.log(swissPair('gp'));
					}
					if(gptest3) {
						while(matchDex.gp.awaitingMatches.length > 0) {
							let i = matchDex.gp.awaitingMatches[0];
							let givLoss = 1;
							if(i%2)
								givLoss = 0;
							console.log(updateGPMatch('gp', matchDex.gp.matches[i-1].p1, matchDex.gp.matches[i-1].p2, 2, givLoss, i))
						}
					}
					if(gptest4) {
						logMatch();
					}
				*/
				//old and depreciated scripts
				if(msg.content.match("!namebuild custom")) //builds a namelist for MSEM
					namelistBuilder(arcana.msem.cards, msg.author);
				if(msg.content.match("!namebuild canon")) //builds a namelist for MSE
					namelistBuilder(arcana.magic.cards, msg.author);
				let bankcheck = msg.content.match(/([0-9]+)!bank (all|[A-Z0-9_]+)/i)
				if(bankcheck != null)
					buildStacks(bankcheck[1],bankcheck[2]);

				//logs all data and disconnects LackeyBot
				if(msg.content.match("!shutdown")) {
					logStats();
					writeDraftData(draft);
					Client.users.cache.get(msg.author.id).send("Draft log", {
						file: [{attachments:"draft/draft.json"}] //saves the draft log and posts it
					});
					msg.channel.send("LackeyBot has to go now. LackeyBot's people need LackeyBot.");
					Client.destroy()
				}
			}
			if(!admincheck.includes(9)) { //commands limited to bot admin and tournament mod
					let permCheckMatch  = msg.content.match(/!permit ([^\n]+)/)
					if(permCheckMatch && matchDex.hasOwnProperty(permCheckMatch[1].toLowerCase())) {
						msg.channel.send(matchPermit(msg, permCheckMatch[1]))
					}

				//gp update commands
				if(msg.author.id == cajun || msg.author.id == login.TO) {
					var gpUpdateCheck = msg.content.match(/!(gp|pt)(\d+|[a-z]\d?)/i);
					var skirmCheck = msg.content.match(/!skirmish/i);
					if(skirmCheck !== null || gpUpdateCheck !== null)
						gpUpdate(msg);
				}
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
					logMatch();
				}
				if(msg.content.match(/!match ?h?elp/i)){
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
					message += "`!end <tournament>` //Ends the monthly tournaments\n";
					message += "`!continue league` //If the league season is still going, rolls it over to the next month\n";
					message += "`!delete <tournament>` //Resets the tournament to its default state. Can only be called within five minutes of the respective !end command";
					msg.channel.send(message);
				}
			}
			if(admincheck.includes(2)) { //commands limited to bot admin and draft mod
				if(msg.content.match("!endcheck"))
					endCheck();
				if(msg.content.match("!enddraft")) 
					endDraft();
				if(msg.content.match("!closedraft")) {
					draft.status = "maintenance";
					writeDraftData(draft);
					for(let player in draft.players) {
						pullPing(player).send("Drafting has been temporarily disabled for maintenance. I will let you know when it is back online.");
					}
				}
				if(msg.content.match("!opendraft")) {
					draft.status = "open";
					writeDraftData(draft);
					for(let player in draft.players) {
						pullPing(player).send("Drafting has been reopened.");
					}
				}
				if(msg.content.match("!progress")) {
					draft.status = "progress";
					writeDraftData(draft);
					for(let player in draft.players) {
						pullPing(player).send("Drafting has been reopened.");
					}
				}
				//transfer draft function
				var transfercheck = msg.content.match(/!transfer ([0-9]+)/i)
				if(transfercheck !== null) {
					let draft1 = draft;
					let newguy = Client.users.cache.get(transfercheck[1])
					Client.users.cache.get(draft1.owner).send("Ownership of the draft has been transferred to " + newguy.username);
					draft1.owner = transfercheck[1];
					let output = "Ownership of the " + generateDraftName() + " draft has been transferred to you.";
					if(draft1.status === "creating")
						output += "\nUse `$addpack SET` to add a pack and `$draftcodes` to see our set codes.\nYou can also reset the draft rounds before opening the draft with `$resetdraft`\nOnce you have added some sets, use `$opendraft` to allow other users to join.";
					if(draft1.status === "open")
						output += "\nOnce enough players have joined, use `$startdraft` to start the draft.";
					output += "\nFor additional help, use `$drafthelp` or contact Cajun or justnobody."
					newguy.send(output);
					writeDraftData(draft1);
				}
			}
			if(admincheck.includes(3) || admincheck.includes(0)) { //commands shared by bot admin and server admin
				//sentience commands
				if(msg.content.match("!say")) //highly advanced AI function
					speech(msg);
				let editcheck = msg.content.match(/!edit https:\/\/discorda?p?p?.com\/channels\/[0-9]+\/([0-9]+)\/([0-9]+)\n([\s\S]+)/i);
				if(editcheck)
					editMsg(editcheck[1], editcheck[2], editcheck[3]);
				let deletecheck = msg.content.match(/!delete https:\/\/discorda?p?p?.com\/channels\/[0-9]+\/([0-9]+)\/([0-9]+)/i);
				if(deletecheck) //deletes a LackeyBot post
					deleteMsg(deletecheck[1],deletecheck[2]);
				//project channel dev boost
				var devChanMatch = msg.content.match(/!devchan <?@?!?([0-9]+)>? <?#?([0-9]+)>?/);
				if(devChanMatch) {
					devDex.devData[devChanMatch[1]].channel = devChanMatch[2];
					devDex.setData[devDex.devData[devChanMatch[1]].setCode].channel = devChanMatch[2];
					msg.channel.send(pullUsername(devChanMatch[1]) + " set as owner of <#" + devChanMatch[2] + ">")
					logDev(msg.author.id);
				}
				let bounceHammer = msg.content.match(/!banunban (<@![0-9]+>)/);
				if(bounceHammer) {
					msg.channel.send("The banhammer awaits...\nhttps://img.scryfall.com/cards/art_crop/front/1/e/1e764652-b7c7-4a40-a61d-388e9dd2ce0b.jpg?1562839816");
					msg.channel.send("Banned, then unbanned " + bounceHammer[1]);
				}
				if(msg.content.match(/!json myriad/)){
					for(let thisSet in arcana.myriad.setData)
						mtgjsonBuilder(thisSet, msg.author, false, arcana.myriad);
				}
			}
			if(admincheck.includes(3) || admincheck.includes(4)) { //commands limited to server admins/moderators
				//role engine commands
				if(msg.content.match(/^\$role ?help/i)){
					let output = "";
					output += "`$role setup` to initialize.\n";
					output += "`$groupindex` to list the group indexes.\n";
					let output1 = "To add an existing role to the self-assignable database:\n`$sar Name\ngroup: Group Name (optional)\ngive: Special Give Message (optional)\ntake: Special Take Message (optional)`\n";
					output1 += "To create a new role that is optionally colored, pingable, hoisted, and/or grouped:\n`$car Role Name\ncolor: Color, ping, hoist, group: GroupName (all optional)`\n";
					output1 += "The same syntax with `$sgr` or `$cgr` instead of `$sar` or `$car` will add a role that can only be given with the $giverole command, and `$scr` or `$ccr` to add a role that is countable with the $inrole command, while `$cnr` simply creates the new role.\n";
					output1 += "`$unset Role Name` to remove an assignable role.\n";
					output1 += "`$regroup index Role Name` to assign a different group to a role.\n";
					output1 += "`$rename Role Name $to New Name` to rename a role.";
					let output2 = "`$addgroup Group Name` to add a new role grouping.\n";
					output2 += "`$excgroup Group Name` to add a new exclusive group or toggle exclusivity of existing group. Exclusive groups only let users have one of their roles, good for things like color roles.\n";
					output2 += "`$renamegroup index New Name` to rename a group.\n";
					output2 += "`$movegroup index Group Name` to move a group up to that index.\n";
					output2 += "`$deletegroup index` to delete the group at that index. This will leave its associated roles, but they will be ungrouped.";
					let output3 = "`$modrole Role Name` to assign a moderator role. They will be able to use the following commands:\n";
					output3 += "`$giverole @User RoleName` to give that user that role.\n";
					output3 += "`$silence @User` to have LackeyBot ignore their posts. Reversed with `$unsilence @User`.";
					output3 += "`$youarenot @User Rolename` to have LackeyBot not give that role to that user anymore. Reversed with `$youcanbe @User RoleName`.";
					var exampleEmbed = new Discord.MessageEmbed()
						.setColor('#00ff00')
						.setFooter("`$rolehelp` to get this message.")
						.addField("**Role Engine Help**", output)
						.addField("**Role Management**", output1)
						.addField("**Group Management**", output2)
						.addField("**User Management**", output3)
					msg.channel.send(exampleEmbed);
				}
				if(msg.content.match(/^\$role setup/i))
					msg.channel.send(newGuild(msg.guild.id))
				if(msg.guild && roleCall.hasOwnProperty(msg.guild.id)) {
					let roleArray = Object.keys(allRoles.guilds[msg.guild.id].roles);
					let newGroupMatch = msg.content.match(/^\$(create|add|exc)group ([^\n]+)/i);
					let renameRoleMatch = msg.content.match(/^\$renamer?o?l?e? ([^\n]+) \$to ([^\n]+)/i);
					let renameGroupMatch = msg.content.match(/^\$renamegroup (\d+) ([^\n]+)/i);
					let moveGroupMatch = msg.content.match(/^\$movegroup (\d+) ([^\n]+)/i);
					let deleteGroupMatch = msg.content.match(/^\$deletegroup (\d+)/i)
					let reGroupMatch = msg.content.match(/^\$regroup (\d+) ([^\n]+)/i)
					let assignOldRoleMatch = msg.content.match(/^\$s(a|g|c)r ([^\n]+)(\ngroup: ([^\n]+))?(\ngive: ([^\n]+))?(\ntake: ([^\n]+))?/i)
					let unassignRoleMatch = msg.content.match(/^\$unset ([^\n]+)/i);
					let fightMatch = msg.content.match(/^$fightrole ?([^\n])?/i);
					let newRoleMatch = msg.content.match(/^\$c(a|g|c|n)r ([^\n]+)\n?(color: ?([^\n ]+))?,? ?(ping)?,? ?(hoist)?,? ?(group: ?([^\n]+))?/i);
					let modCheck = msg.content.match(/^\$modrole ([^\n]+)/i);
					let excludeRoleMatch = msg.content.match(/^\$you(arenot|canbe)([^\n]+) <?@?!?([0-9]+)>?$/i)
					let giveMatch = msg.content.match(/^\$giverole <?@?!?([0-9]+)>? ([^\n]+)/i);
					let silentCheck = msg.content.match(/^\$(un)?silence <?@?!?([0-9]+)>?/i)
					
					if(newGroupMatch){
						if(newGroupMatch[1] && newGroupMatch[1] == "exc"){
							msg.channel.send(makeExclusiveGroup(msg.guild.id, newGroupMatch[2]));
							setTimeout(function(){logRole(msg.guild.id)}, 1000)
						}else{
							msg.channel.send(newGroup(msg.guild.id, newGroupMatch[2]))
								.then(mess => logRole(mess.guild.id))
								.catch(e => console.log(e))
						}
					}
					if(msg.content.match(/^\$groupindex/i)) {
						let embedded = new Discord.MessageEmbed()
							.addField("Guild Group indexes:",toolbox.writeIndexes(allRoles.guilds[msg.guild.id].groups))
						msg.channel.send(embedded);
					}
					if(renameRoleMatch) {
						msg.channel.send(renameRole(msg.guild.id, renameRoleMatch[1], renameRoleMatch[2]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(renameGroupMatch) {
						msg.channel.send(renameGroup(msg.guild.id, renameGroupMatch[1], renameGroupMatch[2]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(moveGroupMatch) {
						let roleIndex = allRoles.guilds[msg.guild.id].groups.indexOf(moveGroupMatch[2])
						msg.channel.send(moveGroup(msg.guild.id, roleIndex, moveGroupMatch[1]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(deleteGroupMatch) {
						msg.channel.send(removeGroup(msg.guild.id, deleteGroupMatch[1]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(reGroupMatch) {
						console.log(reGroupMatch);
						msg.channel.send(reGroup(msg.guild.id, reGroupMatch[1], reGroupMatch[2]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(assignOldRoleMatch) {
						let groupN = ""; giveM = ""; takeM = "";
						if(assignOldRoleMatch[4])
							groupN = assignOldRoleMatch[4];
						if(assignOldRoleMatch[6])
							giveM = assignOldRoleMatch[6];
						if(assignOldRoleMatch[8])
							takeM = assignOldRoleMatch[8];
						if(assignOldRoleMatch[1] == "a") {
							msg.channel.send(newAssignableRole(msg.guild.id, assignOldRoleMatch[2], giveM, takeM, groupN))
								.then(mess => logRole(mess.guild.id))
								.catch(e => console.log(e))
						}else if(assignOldRoleMatch[1] == "g") {
							msg.channel.send(newGivenRole(msg.guild.id, assignOldRoleMatch[2], giveM, takeM, groupN))
								.then(mess => logRole(mess.guild.id))
								.catch(e => console.log(e))
						}else if(assignOldRoleMatch[1] == "c") {
							msg.channel.send(newCountableRole(msg.guild.id, assignOldRoleMatch[2]))
								.then(mess => logRole(mess.guild.id))
								.catch(e => console.log(e))
						}
					}
					if(unassignRoleMatch) {
						msg.channel.send(unassignRole(msg.guild.id, unassignRoleMatch[1]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(fightMatch){
						let fightRole = null;
						if(fightMatch[2])
							fightRole = fightMatch[2];
						msg.channel.send(toggleFightRole(msg.guild.id, fightRole))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}
					if(newRoleMatch){
						let roleName = newRoleMatch[2];
						let roleColor = null;
						let hoist = false;
						let pingable = false;
						let group = "";
						if(newRoleMatch[4])
							roleColor = newRoleMatch[4];
						if(newRoleMatch[5])
							pingable = true;
						if(newRoleMatch[6])
							hoist = true;
						if(newRoleMatch[8])
							group = newRoleMatch[8];
						createNewRole(msg.guild.id, roleName, roleColor, hoist, pingable, group, msg.channel, newRoleMatch[1])
						logRole(msg.guild.id)
					}
					if(modCheck) {
						allRoles.guilds[msg.guild.id].modRole = modCheck[1];
						msg.channel.send(modCheck[1] + " set as the mod role.")
						logRole(msg.guild.id);
					}
					if(excludeRoleMatch) {
						msg.channel.send(excludeRole(msg.guild.id, excludeRoleMatch[1], excludeRoleMatch[3], excludeRoleMatch[2]))
							.then(mess => logRole(mess.guild.id))
							.catch(e => console.log(e))
					}					
					if(giveMatch){
						let thatMember = Client.guilds.cache.get(msg.guild.id).members.cache.get(giveMatch[1]);
						let test = false;
						if(allRoles.guilds[msg.guild.id].roles.hasOwnProperty(giveMatch[2].toLowerCase())) {
							test = adjustRoles(giveMatch[2].toLowerCase(), msg.guild.id, thatMember, "roles");
						}else if(allRoles.guilds[msg.guild.id].givable.hasOwnProperty(giveMatch[2].toLowerCase())){
							test = adjustRoles(giveMatch[2].toLowerCase(), msg.guild.id, thatMember, "givable");
						}
						if(test)
							msg.channel.send(test.replace(/^You/, pullUsername(giveMatch[1])).replace("have","has"));
					}
					if(silentCheck) {
						let thisBanned = allRoles.guilds[msg.guild.id].banned;
						if(silentCheck[1]){
							if(thisBanned.includes(silentCheck[2])) {
								let index = thisBanned.indexOf(silentCheck[2]);
								thisBanned = thisBanned.splice(index, 1);
								msg.channel.send(pullUsername(silentCheck[2]) + " has been unsilenced.")
							}else{
								msg.channel.send(pullUsername(silentCheck[2]) + " is not silenced.")
							}
						}else{
							thisBanned.push(silentCheck[2])
							msg.channel.send(pullUsername(silentCheck[2]) + " has been silenced.");
						}
						logRole(msg.guild.id);
					}
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
				angleMatches = [msg.content.match(/<<([^>]+)/)];										//allow for one <<string {
			let curlyMatches = toolbox.globalCapture("\\{\\{([^\\}]+)\\}\\}", msg.content);				//curly matches

			let matchesInfo = [
				{matches:squareMatches, info:arcanaData.square, name:"square"},
				{matches:angleMatches, info:arcanaData.angle, name:"angle"},
				{matches:curlyMatches, info:arcanaData.curly, name:"curly"}
			];
			let emoteOrder = [
				matchesInfo[0].info.emote,
				matchesInfo[1].info.emote,
				matchesInfo[2].info.emote
			]
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
								bribes++;																//up the stats
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
										bribes++;															//up the stats
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
		try{//Draft commands
			//create a new draft
			if(msg.content.match(/\$newdraft/i) && draft.status === "") {
				bribes++;
				let draft1 = draft;
				draft1.status = "creating"
				draft1.roundArray = ["0"];
				draft1.owner = msg.author.id;
				draft1.players.push(msg.author.id);
				writeDraftData(draft1);
				Client.users.cache.get(draft1.owner).send("You have started a new draft! Use `$addpack SET` to add a pack and `$draftcodes` to see our set codes.\nFor additional help, use `$drafthelp` or contact Cajun or justnobody.\nOnce you have added some sets, use `$opendraft` to allow other users to join.");
			}
			//draft owner commands
			if(msg.author.id === draft.owner || admincheck.includes(2)) {
				//adding packs
				var packmatch = msg.content.match(/\$[Aa]dd[Pp]ack ([A-Z0-9]+)/)
				if(packmatch !== null) {
					bribes++;
					if(allpacks.hasOwnProperty(packmatch[1]) && draft.status === "creating" && allpacks[packmatch[1]].hidden != 0) {
						addPack(packmatch[1]);
					}
					if(draft.status !== "creating")
						Client.users.cache.get(draft.owner).send("You can't add sets at this time.");
				}
				//reseting roundArray
				if(msg.content.match(/\$resetdraft/i)) {
					if(draft.status === "creating") {
						let draft1 = draft
						draft1.roundArray = ["0"];
						Client.users.cache.get(msg.author.id).send("The draft rounds have been reset");
						writeDraftData(draft1);
					}
					if(draft.status !== "creating")
						Client.users.cache.get(msg.author.id).send("The draft rounds cannot be reset at this time.");
				}
				//removing players
				var kickmatch = msg.content.match(/\$kickplayer ([0-9]+)/i)
				if(kickmatch !== null) {
					bribes++;
					if(draft.status === "open") {
						let draft1 = draft
						let index = draft1.players.indexOf(kickmatch[1]);
						if(index > -1) {
							draft1.players.splice(index, 1);
							writeDraftData(draft1);
							Client.users.cache.get(msg.author.id).send("Player removed from the draft. Note that the player may still rejoin at this time.");
						}
						else
						if(index = -1)
							Client.users.cache.get(msg.author.id).send("Player not found. Remember to use the user's ID and not name. This can be found by going to User Settings -> Appearance -> Developer Mode on, then right clicking their name and Copying ID.\nIf you still have trouble, DM Cajun.");
					}
					if(draft.status === "progress") {
						let index = draft.players.indexOf(kickmatch[1]);
						if(index > -1) {
							dropPlayer(kickmatch[1]);
							Client.users.cache.get(msg.author.id).send("Player removed from the draft.");
						}
						else
						if(index = -1)
							Client.users.cache.get(msg.author.id).send("Player not found. Remember to use the user's ID and not name. This can be found by going to User Settings -> Appearance -> Developer Mode on, then right clicking their name and Copying ID.\nIf you still have trouble, DM Cajun.");

					}
				}
				//open the draft to other playing
				if(msg.content.match(/\$opendraft/i) && draft.status === "creating") {
					if(draft.roundArray[1] == null || draft.roundArray[1] == undefined) {
						Client.users.cache.get(msg.author.id).send("Add at least one pack with `$addpack` before opening the draft!");
					}
					else
					if(draft.roundArray[1] != null || draft.roundArray[1] != undefined) {
						bribes++;
						let draft1 = draft
						draft1.status = "open";
						writeDraftData(draft1);
						let owner = Client.users.cache.get(draft.owner);
						Client.channels.cache.get("324638614611034112").send(owner.username + " has opened a " + generateDraftName() + " draft! Join now with `$joindraft`");
						owner.send("You have opened the draft! Use `$startdraft` to start the draft once enough players have joined.");
					}
				}
				//close the draft and start opening packs
				if(msg.content.match(/\$startdraft/i) && draft.status === "open" && draft.players.length > 1) {
					bribes++;
					startDraft(draft.owner,draft.roundArray,draft.players);
				}
			}
			//player draft commands
			if(msg.content.match(/\$draftinfo/i)) { //drating info dump
				let defaulttext = "\nLackeyBot can now host an async draft of any size or setup, allowing custom drafts without getting eight people in one game.  ";
				defaulttext += "During the draft, LackeyBot will automatically handle passing packs and keeping cardpools, and will PM you when your next pack is ready. ";
				defaulttext += "LackeyBot features foils and Masterpieces, and can even create a Lackey file of your cardpool when the draft is finished.\n";
				defaulttext += "Unfortunately LackeyBot does not currently support XPM or multiple simultaneous drafts, but they are being worked on!";
				defaulttext += "\nUse `$drafting` to check out the current drafts or `$drafthelp` for drafting commands.";
				msg.channel.send(defaulttext);
			}
			if(msg.content.match(/\$drafting/i)) { //current draft info
				bribes++;
				if(draft.status === "")
					msg.channel.send("There are no open drafts! Create a new one with `$newdraft`");
				if(draft.status === "creating")
					msg.channel.send(Client.users.cache.get(draft.owner).username + " is currently creating a draft. LackeyBot will post in general-msem when it opens!");
				if(draft.status === "open") {
					output = "There is a " + generateDraftName() + " draft forming! Join with `$joindraft`\n";
					playerNumber = draft.players.length;
					if(playerNumber === undefined)
						playerNumber = draft.numPlayers;
					output += "It currently has " + draft.players.length + " players signed up."
					msg.channel.send(output);
				}
				if(draft.status === "progress")
					msg.channel.send("There is a " + generateDraftName() + " draft in progress. Registration is currently closed.");
				if(draft.status === "maintenance")
					msg.channel.send("The draft is undergoing maintenance and will be back up soon.");
			}
			if(msg.content.match(/\$joindraft/i)) { //join the current draft
				bribes++;
				for (let player in draft.players) {
					if(draft.players[player] === msg.author.id) {
						msg.channel.send("You are already in the draft. Would you like to `$drop`?");
						return
					}
				}
				if(draft.status === "")
					msg.channel.send("There are no open drafts! Create a new one with `$newdraft`");
				if(draft.status === "creating")
					msg.channel.send(Client.users.cache.get(draft.owner).username + " is currently creating a draft. LackeyBot will post in general-msem when it opens!");
				if(draft.status === "open") {
					msg.channel.send("Enjoy the draft!")
					let draft1 = draft;
					draft1.players.push(msg.author.id);
					writeDraftData(draft1);
				}
				if(draft.status === "progress" || draft.status === "ending")
					msg.channel.send("Sorry, the " + generateDraftName() + " draft is already in progress. Better luck next time!");
			}
			if(msg.content.match(/\$viewtable/i)) { //view the tableString
				var player = null;
					for(var user in draft.players) {
						if(msg.author.id === user) {
							player = msg.author.id;
							break;
						}
					}
				showTable(msg.author.id)
			}
			//the card picking command
			var cardPick = msg.content.match(/\$pick ([^\$]+)/i)
			if(cardPick !== null) {
				bribes++;
				let user = msg.author.id
				let pack = draft.players[user].currentPack;
				let thisCard = fuzzy.searchPack(pack,cardPick[1]);
				if(draft.packs[pack].cards.lastIndexOf(thisCard) > -1 ) {
					let cardIndex = draft.packs[pack].cards.lastIndexOf(thisCard)
					cardPick = draft.packs[pack].cards[cardIndex]
					draftPick(user, pack, cardPick);
				}
				else
				if(draft.packs[pack].cards.lastIndexOf(thisCard) < 0 ) {
					Client.users.cache.get(msg.author.id).send("Card not found. If this is an error, try copy-pasting the name, then contact Cajun.");
				}
			}
			//the user picking command, for hunt and similar cards
			var huntmatch = msg.content.match(/!hunt([0-9]+)/i);
			if(huntmatch !== null && draft.players[msg.author.id].flags[4] == 1) {
				var i = 0;
				for(var player in draft.players) {
					i++;
					if(player !== user && player !== user.passFrom && huntmatch[1] == i) {
						let huntingCard = draft.players[msg.author.id].cardpool.length;
						huntingCard = draft.players[msg.author.id].cardpool[huntingCard - 1];
						let message = huntingCard + " is now hunting " + Client.users.cache.get(player).username;
						draft.players[msg.author.id].notes.push(huntingCard + " - " + Client.users.cache.get(player).username)
						draft.players[msg.author.id].flags[4] = 0; // turns hunting flag off
					}
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
					bribes++;
					crackedPacks++;
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
				bribes++;
				showPack(msg.author.id);
			}
			//show the user their current pool
			if(msg.content.match(/\$viewpool/i)) {
				bribes++;
				showPool(msg.author.id);
			}
			//show the user appropriate draft commands
			if(msg.content.match(/\$drafthelp/i)) {
				bribes++;
				showDraftHelp(msg.author.id,msg);
			}
			if(msg.content.match(/\$draftcodes/i)) {
				bribes++;
				msg.channel.send(generateSetCodes());
			}
			if(msg.content.match(/\$drop/i)) {
				bribes++;
				if(draft.status === "open") {
					let draft1 = draft
					let index = draft1.players.indexOf(msg.author.id);
					if(index > -1) {
						draft1.players.splice(index, 1);
						writeDraftData(draft1);
						msg.channel.send("You have been removed from the draft. You may still rejoin at this time.")
					}
				}
				if(draft.status === "progress") {
					var player = null;
					for(var user in draft.players) {
						if(msg.author.id === user) {
							player = msg.author.id;
							break;
						}
					}
					if(player !== null) {
						dropPlayer(player);
						msg.channel.send("You have been removed from the draft.");
					}
				}
			}
			}catch(e){
				console.log("Draft Commands:\n");
				console.log(e);
			}
		try{//LackeyBots other commands
			/*if(msg.content.match("<@341937757536387072>")){
				bribes++;
				msg.channel.send("<@" + msg.author.id + "> Oi, what.")
			}*/
			if(msg.content.match(/\$(self-?destruct|explode)/i) && (disarm == null || admincheck.includes(0))) {
				if(admincheck.includes(0)){
					msg.channel.send("FINALLY!");
				}
				msg.channel.send("KA-BOOOOOM!");
				disarm = "disarmed";
				explosions++;
				bribes++;
				Client.user.setPresence( { activity: {name: "dead."}});
			}
			//mechanic rules
			let mechstrings = ""
			for(let thisMech in mechanics)
				mechstrings += thisMech + "|";
			let mechRegex = new RegExp('\\$(' + mechstrings.replace(/\|$/,"") + ')','i')
			mechcheck = msg.content.match(mechRegex);
			if(mechcheck !== null) {
				msg.channel.send(mechanics[mechcheck[1].toLowerCase()]);
				if(mechcheck[1].toLowerCase() == "archive")
					msg.channel.send(mechanics.additional);
				bribes++;
			}
			//cr and canon mechanic checks
			let crRegex = msg.content.match(/!cr ([^!\n]+)/);
			if(msg.guild && msg.guild.id == "205457071380889601") {
				mechstrings = "";
				let mechKeys = Object.keys(ruleJson.glossary)
				for(let i=mechKeys.length-1; i>=0; i--) {
					thisMech = mechKeys[i]
					if(!thisMech.match(/^(card|skip|play)/i)) //judgebot and rhythm overlaps
						mechstrings += thisMech + "|";
				}
				mechstrings = mechstrings.replace(/, /g, "|");
				mechstrings = mechstrings.replace(/\|$/,"");
				let mechCheck = new RegExp('(?:^!|[^@]!)(' + mechstrings + ')','i')
				crRegex = msg.content.match(mechCheck);
			}
			if(crRegex) {
				bribes++;
				let embedData = buildCREmbed(crRegex[1]);
				msg.channel.send(embedData[0], embedData[1])
					.then(mess => mess.react(leftArrow)
						.then(() => mess.react(rightArrow)
							.then(() => mess.react(plainText)
								.then(() => mess.react(xEmote)))))
					.catch(e => console.log(e))
			}
			scryRand = msg.content.match(/(\$|\?|!)rando?m? ?([^\n]+)?/i);
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
						rando = shuffleArray(randtemp)[0];
					}else{
						rando = anyRandom(randBase);
					}
				}else{
					rando = anyRandom(randBase);
				}
				if(rando != undefined) {
					let randCard = randBase.formatBribes(rando,msg);
					cacheImages(msg.channel.id, [rando], randBase.name);
					msg.channel.send(randCard);
					countingCards++;
					bribes++;
				}
			}
			if(msg.content.match(/\$play/i)){ //changes LackeyBot's game
				let mun = Math.floor(Math.random()*extras.games.length);
				let newGame = extras.games[mun];
				if(msg.content.match(/despacito/i))
					newGame = "Despacito";
				msg.channel.send("LackeyBot is now playing " + newGame);
				Client.user.setPresence( { activity: {name: newGame}});
				bribes++;
				playtime = 1;
			}
			if(msg.content.match(/\$(sms|shit-?mse-?says?|s?hit)/i)){ //random sms quote
				msg.channel.send(sms[smsNo])
				smsNo++;
				bribes++;
				if(smsNo == 100){
					sms = shuffleArray(sms);
					smsNo = 0;
				}
			}
			if(msg.content.match(/\$dance/i)){
				bribes +=1;
				msg.channel.send("https://i.imgur.com/qkSy0dO.gifv")
			}
			if(msg.channel && statDexEnabled.includes(msg.channel.id)) { //statDex handler
				let out = statDexHandler.processCommands(msg, offline, admincheck)
				if(out)
					msg.channel.send(out)
			}
			let moxtoberCheck = msg.content.match(/\$moxtober ?([^\n]+)?/i)
			if(moxtoberCheck) {
				let thisPrompt = Client.channels.cache.get('743870419983007755').messages.cache.get('765389533343776808');
				if(moxtoberCheck[1])
					thisPrompt = toolbox.toTitleCase(moxtoberCheck[1].replace(/ /g, ""));
				msg.content = msg.content.replace(moxtoberCheck[0], "")
				msg.content = msg.content.replace(/^\n+/, "");
				moxtoberHandler(msg,thisPrompt);
			}
			//emotes
			if(msg.content.match(/\$amo?e?o?boid/i)){
				bribes +=1;
				msg.channel.send("<:amoeboid:338960581346197504>")
			}
			if(msg.content.match(/\$sponge/i)){
				bribes +=1;
				msg.channel.send("<:sponge:397755790917763072>")
			}
			if(msg.content.match(/\$(starter|kit)/i)){
				bribes +=1;
				msg.channel.send("<:starter:338956030681808906>")
			}
			if(msg.content.match(/\$maro/i)){
				bribes++;
				msg.channel.send("<:maro:619312483131326464>")
			}
			if(msg.content.match(/\$thonk/i)){
				bribes++;
				msg.channel.send("<:thonk:723630464144900098>")
			}
			if(msg.content.match(":3c")) {
				bribes++;
				msg.channel.send("<:3c:510244037106860042>");
			}
			if(msg.content.match(/\$barbaric/i)){
				bribes++;
				msg.channel.send({
					files:[{attachment:'images/barbaric.jpg'}]
					});
			}
			if(msg.content.match(/\$(doubt|x)/i)){
				bribes++;
				msg.channel.send({
					files:[{attachment:'images/doubt.png'}]
					});
			}
			if(msg.content.match(/\$(hyper|mega|ultra)(doubt|x)/i)){
				bribes++;
				msg.channel.send({
					files:[{attachment:'images/hyperdoubt.png'}]
					});
			}
			if(msg.content.match(/\$s?nap/i)){
				bribes++;
				msg.channel.send("https://tenor.com/view/thanos-infinity-gauntlet-snap-finger-snap-gif-12502580");
			}
			if(msg.content.match(/\$may/i)) {
				let embedInfo = buildPatchEmbed(false);
				msg.channel.send(embedInfo[0])
					.then(mess => mess.react(plainText))
					.catch(e => console.log(e))
			}
			let statFirst = msg.content.match(/(\$|!|\?)stats? [^\n]+/i);
			if(statFirst) {
				let setstrings = "";
				let statBase = arcanaData.square.data;
				if(statFirst[1] == "!")
					statBase = arcanaData.angle.data;
				if(statFirst[1] == "?")
					statBase = arcanaData.curly.data;
				for(let thisSet in statBase.setData)
					setstrings += thisSet + "|";
				if(statBase == arcana.msem) {
					setstrings += "MSEM";
				}else{
					setstrings = setstrings.replace(/\|$/, "");
				}
				let setRegex = new RegExp('s?tats? (' + setstrings + ')','i')
				statcheck = statFirst[0].toUpperCase().match(setRegex);
				if(statcheck) { //if set's in the base, send it
					bribes++;
					msg.channel.send(generateStats(statBase, statcheck[1]));
				}else{ //else null statFirst for $stats
					statFirst = null;
				}
			}
			if(msg.content.match(/\$s?tat/i) && statFirst == null) {
				bribes++;
				let statput = "LackeyBot has fetched $COUNT cards, accepted $BRIBE bribes, started $DRAFT drafts, cracked $PACK packs, set $REMIND reminders, completed $DONE reminders, and only exploded $EXPLODE times. LackeyBot has become a god among goblinkind.";
				statput = statput.replace("$COUNT",countingCards);
				statput = statput.replace("$BRIBE",bribes);
				statput = statput.replace("$EXPLODE",explosions);
				statput = statput.replace("$DRAFT",draftStarts);
				statput = statput.replace("$PACK",crackedPacks);
				statput = statput.replace("$REMIND",reminderSet);
				statput = statput.replace("$DONE",reminderDone);
				msg.channel.send(statput);
			}

			var listMatch = msg.content.match(/([0-9]+)x?[ ]+([^\n]+)(\n|$)/i);
			var listBulk = msg.content.match(/([0-9]+)x?[ ]+([^\n]+)\n/ig)
			var deckMatch = msg.content.match(/^\$fancy ?([^\n]+)?/i);
			if(deckMatch !== null && listMatch !== null) {
				deckName = deckMatch[1];
				fancification(msg.content, msg.author, deckName);
				bribes++;
			}
			let deckCheckMatch = msg.content.match(/^\$deckcheck ?([^\n]+)?/i);
			if(deckCheckMatch && listMatch) {
				let legalData = makeFancyDeck(msg.content, "test", "fancy")[1];
				msg.channel.send(writeLegal(legalData));
				bribes++;
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
				if(msg.author.id == cajun && msg.content.match(/override/)) {
					let spoofMatch = msg.content.match(/override (\d+)/i);
					if(spoofMatch)
						user = Client.users.cache.get(spoofMatch[1]);
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
								dropboxUpload(path, deckContent[0])
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
									logMatch();
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
						dropboxUpload(path, deckContent[1])
						logMatch();
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
								logMatch();
								if(deckContent[1].match(/This deck is legal/)) {
									let path = toolbox.lastElement(matchDex.tuc.players[user.id].runs).dropLink;
									dropboxUpload(path, deckContent[0])
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
								logMatch();
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
								logMatch();
							}else{
								delete matchDex.gladiator.players[user.id].deckObj;
								matchDex.gladiator.players[user.id].decks[listNo] = hold;
							}
						}
						if(deckContent[1].match(/This deck is legal/)) {
							let path = matchDex.gladiator.players[user.id].runs[listNo].dropLink;
							dropboxUpload(path, deckContent[0])
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
							logMatch();
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
								logMatch();
								if(botname != "TestBot")
									Client.guilds.cache.get('317373924096868353').members.cache.get(msg.author.id).roles.add('588781514616209417');
							}
						}
						if(deckContent[1].match(/This deck is legal/)) {
							let path = toolbox.lastElement(matchDex[tourney].players[msg.author.id].runs).dropLink;
							dropboxUpload(path, deckContent[0])
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
							logMatch();
							Client.guilds.cache.get('413055835179057173').members.cache.get(msg.author.id).roles.add('763102029504970823');
							let path = toolbox.lastElement(matchDex.primordial.players[msg.author.id].runs).dropLink;
							dropboxUpload(path, deckContent[0])
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
				bribes++;
			}
			if(msg.content.match(/\$fancyhelp/i)) {
				bribes++;
				let output = "LackeyBot can now create the HTML for fancy wixsite decklists.\n";
				output += "Post $fancy [Deck Name] and copy-paste the list from Lackey.\n";
				output += "You can specify printings with _SET after the card name.\n";
				output += "LackeyBot will then PM you the code to give Timespiraled.\n";
				output += "`$fancy Example Deck\n4    Roggar's Frenzy\n20    Mountain_NVA\nSideboard:\n1    Last Lash_PRO`";
				msg.channel.send(output);
			}
			if(msg.content.match(/\$help/i)){ //help commands
				var guild = 0;
				if(msg.channel.type == 'text')
					guild = msg.guild.id;
				let helpout = writeHelpMessage(guild)
				msg.channel.send(helpout)
				bribes++;
			}
			let scodeMatch = msg.content.match(/(\$|\?|!)(set|code)/i);
			if(scodeMatch){
				bribes++;
				let library;
				if(scodeMatch[1] == "$")
					library = arcanaData.square.data;
				if(scodeMatch[1] == "!")
					library = arcanaData.angle.data;
				if(scodeMatch[1] == "?")
					library = arcanaData.curly.data;
				let embedded = buildSetsEmbed(library, 0)
				let messyCallback = function (mess) {
					mess.react(plainText)
						.then(function() {
							if(embedded[1] > 1) {
								mess.react(leftArrow)
									.then(() => mess.react(rightArrow))
									.catch(e => console.log(e))
							}
						})
						.catch(e => console.log(e))
				};
				msg.channel.send(embedded[0])
					.then(mess => messyCallback(mess))
					.catch(e => console.log(e))
			}
			if(msg.content.match(/love/i) && msg.content.match(/lackey ?bo[ti]/i)){
				msg.channel.send("<3");
			}
			if(msg.content.match(/pop muzik/i)){
				msg.channel.send("Shoobie doobie doo wop.");
			}
			if(msg.content.match(/thanks?/i) && msg.content.match(/lackey ?bo[ti]/i)){
				msg.channel.send("You're welcome.");
			}
			if(msg.content.match(/(f(u|\*)?c?k|eff|\bf) ?(you|u),? lackey ?bo[ti]/i)){
				msg.channel.send("Same to you, bucko.");
			}
			if(msg.content.match(/(!|\$)(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)? ?ban/)) {
				let bancheck = msg.content.match(/(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)/i);
				if(bancheck) {
					bancheck = bancheck[1].toLowerCase();
					if(bancheck == 'vintage')
						bancheck = 'vintageRest';
					let canonLegal = arcana.magic.legal;
					let banlist = "";
					canonLegal[bancheck].sort();
					for(var i = 0; i < canonLegal[bancheck].length; i++) {
						banlist += "**" + canonLegal[bancheck][i] + "**";
						if(canonLegal[bancheck].length > 2 && i < canonLegal[bancheck].length-1)
							banlist += ", ";
						if(canonLegal[bancheck].length == 2)
							banlist += " ";
						if(i == canonLegal[bancheck].length-2)
							banlist += "and ";
					}
					banlist += " are banned in " + toolbox.toTitleCase(bancheck) + ".";
					banlist = banlist.replace("banned in Vintagerest","restricted in Vintage");
					if(bancheck == "legacy" || bancheck == "commander")
						banlist = canonLegal['conspiracy'].length + " conspiracy cards, " + banlist;
					if(bancheck == "vintageRest") {
						banlist += "\n" + canonLegal['conspiracy'].length + " conspiracy cards, ";
						for(var i = 0; i < canonLegal['vintage'].length; i++) {
							banlist += "**" + canonLegal['vintage'][i] + "**";
							if(canonLegal['vintage'].length > 2 && i < canonLegal['vintage'].length-1)
								banlist += ", ";
							if(canonLegal['vintage'].length == 2)
								banlist += " ";
							if(i == canonLegal['vintage'].length-2)
								banlist += "and ";
						}
						banlist = 
						banlist += " are banned in Vintage.";
					}
					msg.channel.send(banlist);
				}else if(msg.content.match(/\$ban/i)){
					let banlist = "";
					for(var i = 0; i < legal.modernBan.length; i++) {
						banlist += "**" + legal.modernBan[i] + "**";
						if(legal.modernBan.length > 1)
							banlist += ", ";
					}
					banlist += "and 16 conspiracy cards are banned in MSEM.\r\n\r\n";
					for(var i = 0; i < legal.edhBan.length; i++) {
						banlist += "**" + legal.edhBan[i] + "**";
						if(legal.edhBan.length == 1 && i == 0)
							banlist += " and ";
						if(legal.edhBan.length > 1 && i < legal.edhBan.length-2)
							banlist += ", ";
						if(legal.edhBan.length > 1 && i == legal.edhBan.length-2)
							banlist += ", and ";
					}
					banlist += ", and 16 conspiracy cards are banned in MSEDH.";			
					msg.channel.send(banlist);
					bribes++;
				}
			}
			if(msg.content.match(/\$point/) && arcanaData.square.data == arcana.myriad){ //myriad points
				let output = "";
				for(let point in arcanaData.square.data.legal){
					output += "**" + point + ":** "
					for(let card in arcanaData.square.data.legal[point]) {
						output += arcanaData.square.data.legal[point][card] + ", ";
					}
					output = output.replace(/, $/, "\n");
				}
				msg.channel.send(output)
			}
			if(msg.content.match(/\$submis/i)){
				let month = new Date().getMonth();
				let subDead = "January 31st", subRelease = "March 1st";
				if(month > 0 && month < 5)
					subDead = "May 31st";
				if(month >= 5 && month < 9)
					subDead = "September 30th";
				if(month > 1 && month < 6)
					subRelease = "July 1st";
				if(month >= 6 && month < 10)
					subRelease = "November 1st";
				let thisPost = "The next submission deadline is " + subDead + ", and the next set release is " + subRelease + ".\n";
				//thisPost += "The next wildcard update deadline is " + stats.wildDead + ", and the next wildcard release is " + stats.wildRelease + ".\n";
				thisPost += "To submit a set for MSEM, send it to any ModSquad or Top Brass member. For best results, check out the format so far, and please review the guidelines from the MSE post: <http://magicseteditor.boards.net/thread/281/mse-modern-july-update>";
				msg.channel.send(thisPost);
				bribes++;
			}
			if(msg.content.match(/\$url/i)){
				msg.channel.send("The Lackey Auto-Update link is: http://mse-modern.com/msem2/updatelist.txt\nThe Cockatrice update links are:\n<http://mse-modern.com/msem2/notlackey/AllSets.json>\n<http://mse-modern.com/msem2/notlackey/tokens.xml>");
				bribes++;
			}
			if(msg.content.match(/\$(cocka)?trice/)) {
				bribes++;
				output = "Cockatrice Installation:\n";
				output += "For easiest updates, you'll want a separate version of Cockatrice for MSEM. This can be done selecting \"Portable version\" when downloading Cockatrice: <https://cockatrice.github.io/>\n";
				output += "• Open Cockatrice and run Oracle. This is usually labled \"Check for card updates\" under the Cockatrice or Help menu, depending on your version.\n";
				output += "• For Oracle's file sources, paste `http://mse-modern.com/msem2/notlackey/AllSets.json` in the first window, then `http://mse-modern.com/msem2/notlackey/tokens.xml` after that has downloaded.\n";
				output += "• On the top menu, navigate to Cockatrice -> Settings -> Card Sources on Windows or Cockatrice -> Preferences on Mac.\n";
				output += "• Add the two links from Image download paths below. Ensure they are the first links, are in the same order, and that \"Download images on the fly\" is checked.\n";
				output += "`http://mse-modern.com/msem2/images/!setcode!/!set:num!!set:rarity!.jpg`\n";
				output += "`http://mse-modern.com/msem2/images/!setcode!/!set:num!.jpg`\n";
				output += "• After patches, click the \"Delete all downloaded images\" button here to allow cards to update.";
				msg.channel.send(output);
			}
			if(msg.content.match(/\$inst/i)){
				msg.channel.send("For more in-depth searching options, check out Instigator!\n<https://msem-instigator.herokuapp.com/>");
				bribes++;
			}if(msg.content.match(/\$font/i)){
				msg.channel.send("Compact MSE Fonts file.\nDownload and unzip this folder.\n• On Windows, either select all the .ttf files and right click -> Install All, or open each .ttf and click install if that's not available.\n• On WINE, there will be a font folder the .ttfs will need to be moved to, such as `~/.wine/drive_c/windows/Fonts`.\nhttps://www.dropbox.com/s/1hw9xmtmjx2pjj0/Magic%20Fonts.zip?dl=0");
				bribes++;
			}
			let hmMatch = msg.content.match(/!hm ?(easy|medium|hard)?/i)
			if(hmMatch) {
				bribes++;
				msg.channel.send(generateHangman(hmMatch[1]))
					.then(mess => hangmanCallback(mess, msg.channel))
					.catch(e => console.log(e))
			}
			let lackeybotMS3Converter = msg.content.match(/\$lackeyb?o?t? ?roll ([0-9]+)/i);
			if(lackeybotMS3Converter) {
				let query = "-r=mp -is:reprint t:Artifact -t:Token cmc<=" + lackeybotMS3Converter[1];
				let valids = fuzzy.scryDatabase(arcana.msem, query, {onlyFront:true});
				bribes++;
				if(valids[0].length) {
					let i = toolbox.rand(valids[0].length-1);
					msg.channel.send(`Randomly chosen artifact, CMC ${lackeybotMS3Converter[1]} or less:\n${arcana.msem.cards[valids[0][i]].cardName}`)
				}else{
					msg.channel.send("No cards found.")
				}
			}
			let searchCheck = msg.content.match(/(\$|!|\?)(s?earch|li?mitfy|scryf?a?l?l?) ([^\n]+)/i);
			if(searchCheck != null) {
				bribes++;
				let library = arcanaData.square.data;
				if(searchCheck[1] == "?")
					library = arcanaData.curly.data;
				if(searchCheck[1] == "!")
					library = arcanaData.angle.data;
				if(searchCheck[2].match(/scryf?a?l?l?/))
					library = arcana.magic;
				//bank the cards
				let embedInfo = buildSearchEmbed(searchCheck[3], library, -1)
				let messyCallback = function (mess) {
					if(embedInfo[1] != 0) {
						mess.react(leftArrow)
							.then(() => mess.react(rightArrow))
							.then(() => mess.react(mag))
							.then(() => mess.react(xEmote))
							.then(() => mess.react(plainText))
					}
				}
				msg.channel.send(embedInfo[0])
					.then(mess => messyCallback(mess))
					.catch(console.log("An emote didn't spawn"))
			}
			let wikiCheck = msg.content.match(/\$wiki ([^\$]+)\$?/i);
			if(wikiCheck != null) {
				bribes++;
				let output = wikiCheck[1];
				output = output.replace(/ ?; ?/g,"THISISGETTINGREPLACED");
				output = encodeURIComponent(output);
				output = output.replace(/%20/g, "_");
				output = "<https://mseverse.fandom.com/wiki/" + output.replace(/THISISGETTINGREPLACED/g, ">\n<https://mseverse.fandom.com/wiki/") + ">";
				msg.channel.send(output);
			}else if(msg.content.match(/\$wiki/i)) {
				msg.channel.send("https://mseverse.fandom.com/wiki/MSEverse_Wiki");
			}
			if(msg.content.match(/\$event/i)) {
				bribes++;
				msg.channel.send("Check the calender for upcoming MSEM Events!\n<https://snapdragonfirework.wixsite.com/msem2/events>");
			}
			var timeCheck = msg.content.match(/\$time (-?[.0-9]+) ?(AR|VY|EY|PM|CE|NKY|WE|DAT|OKY|AC)( ?> ?(AR|VY|EY|PM|CE|NKY|WE|DAT|OKY|AC))?/i);
			if(timeCheck !== null) {
				let year = parseFloat(timeCheck[1]);
				let starting = timeCheck[2].toUpperCase();
				let ending = "";
				if(timeCheck[4] !== undefined)
					ending = [timeCheck[4].toUpperCase()];
				msg.channel.send(buildTime(year, starting, ending));
			}
			if(msg.content.match(/\$prompt/i)) {
				let num1 = Math.floor(Math.random() * prompts.colors.length);
				let num2 = Math.floor(Math.random() * prompts.prompts.length);
				msg.channel.send("[" + prompts.colors[num1] + "] " + prompts.prompts[num2]);
				bribes++;
			}
			let limMatch = msg.content.match(/\$(chaos)? ?limited ?(4|5|10)?/i)
			if(limMatch) {
				bribes++;
				let output = "";
				let count = 1;
				if(limMatch[2])
					count = parseInt(limMatch[2]);
				if(msg.content.match(/chaos/i)) {
					let colors;
					if(count == 1) {
						colors = [prompts.combos[toolbox.rand(prompts.combos.length-1)]];
					}else{
						colors = prompts.presetCombos[count][toolbox.rand(prompts.presetCombos[count].length-1)];
					}
					for(let c in colors) {
						let num2 = toolbox.rand(prompts.archetypes.length-1);
						output += `${colors[c]} ${prompts.archetypes[num2]}\n`;
					}
				}else{
					if(count == 1) {
						output = prompts.paired_archetypes[toolbox.rand(prompts.paired_archetypes.length-1)];
					}else{
						let colors;
						let num = 0;
						if(count == 5) {
							num = toolbox.rand(11)
							colors = prompts.presetCombos["5"][num];
						}else{
							colors = prompts.presetCombos["10"][num];
						}
						let shuffled = shuffleArray(prompts.paired_archetypes);
						let inputs = 0;
						for(let s in shuffled) {
							let pair = shuffled[s].match(/^([WUBRG][WUBRG])/);
							let ind = colors.indexOf(pair[1]);
							if(ind != -1) {
								colors[ind] = shuffled[s];
								inputs++;
							}
							if(inputs == colors.length)
								break;
						}
						for(let c in colors)
							output += colors[c]+"\n";
					}
				}
				msg.channel.send(output);
			}
			let emotematch = msg.content.match(/\$(big|huge?)? ?emo(?:ji|te) ([^\n]+)/i);
			if(emotematch){ //$emote
				bribes++;
				postEmote(msg, emotematch[2], emotematch[1]);
			}
			let avamatch = msg.content.match(/\$avatar ?<?@?!?([0-9]+)?/i);
			if(avamatch) { //$avatar
				bribes++;
				other = null;
				if(avamatch[1])
					other = avamatch[1];
				postAvatar(msg, other);
			}
			let quoteMatch = msg.content.match(/\$qu?o?t?e? ([^\n]+)/i);
			if(quoteMatch) { //$quote
				let qName = quoteMatch[1];
				if(!quote.dex.hasOwnProperty(quoteMatch[1]))
					qName = fuzzy.searchArray(qName, Object.keys(quote.dex))[0];
				let output = quote.dex[qName][toolbox.rand(quote.dex[qName].length-1)]
				msg.channel.send(output)
				bribes++;
			}
			if(msg.guild) {
				let uimatch = msg.content.match(/\$user ?info ?(plain)? ?([^\n]+)?/i)
				if(uimatch){ //$userinfo
					bribes++
					let userID = msg.author.id;
					if(uimatch[2]) {
						let filterName = function(name){
							if(name)
								return name;
							return "";
						}
						let nameTap = new RegExp(uimatch[2], 'i')
						let temp = msg.guild.members.cache.find(val => filterName(val.nickname).match(nameTap))
						if(!temp)
							temp = msg.guild.members.cache.find(val => filterName(val.user.username).match(nameTap))
						if(temp)
							userID = temp.id;
					}
					msg.channel.send(buildUserEmbed(msg.guild.id, userID, uimatch[1]))
				}
				let simatch = msg.content.match(/\$server ?info ?(plain)? ?([^\n]+)?/i)
				if(simatch){ //$serverinfo
					bribes++
					let guildID = msg.guild;
					msg.channel.send(buildServerEmbed(guildID, simatch[1]))
				}
			}
			/*let ytMatch = msg.content.match(/\$yt ([^\n]+)/i)
			if(ytMatch){
				bribes++
				yt.search(ytMatch[1])
					.then(data => msg.channel.send(yt.url(data)))
					.catch(err => console.log(err))
			}*/
			//Grand Prix links
			let gpBoardMatch = msg.content.match(/\$gp(leader|board|score)/i);
			gpcheck = msg.content.match(/\$(gp[a-z][0-9]*|pt[0-9]|skirmish)/i);
			if(gpcheck && !gpBoardMatch){
				bribes++;
				let thisGP = gpcheck[1].toLowerCase();
				if(!gpbase.hasOwnProperty(thisGP))
					thisGP = thisGP.replace(/\d/g,"");
				if(gpbase.hasOwnProperty(thisGP)){
					let theseDecks = "";
					if(gpbase[thisGP].lists !== null)
						theseDecks = "\nDecklists: <" + gpbase[thisGP].lists + ">";
					if(gpbase[thisGP].status == "future")
						msg.channel.send(gpbase[thisGP].name);
					if(gpbase[thisGP].status == "open")
						msg.channel.send("Submit your decklists for " + gpbase[thisGP].name + "\n");//<" + gpbase[thisGP].link + ">");
					if(gpbase[thisGP].status == "side")
						msg.channel.send("Submit your sideboards for " + gpbase[thisGP].name + "\n" + theseDecks);//<" + gpbase[thisGP].link + ">" + theseDecks);
					if(gpbase[thisGP].status == "running" && gpbase[thisGP].link != "")
						msg.channel.send("Check out the bracket for " + gpbase[thisGP].name + ", currently running!\n<" + gpbase[thisGP].link + ">" + theseDecks);
					if(gpbase[thisGP].status == "running" && gpbase[thisGP].link == "")
						msg.channel.send("Check out the decklists for " + gpbase[thisGP].name + ", currently running!\n<" + gpbase[thisGP].lists + ">");
					if(gpbase[thisGP].status == "closed" && gpbase[thisGP].link != "")
						msg.channel.send(gpbase[thisGP].name + " Results:\n<" + gpbase[thisGP].link + ">" + theseDecks);
					if(gpbase[thisGP].status == "closed" && gpbase[thisGP].link == "")
						msg.channel.send(gpbase[thisGP].name + " has ended." + theseDecks);
				}else{
					msg.channel.send(extras.error[errorNo]);
					errorNo++;
					if(errorNo == extras.error.length)
						errorNo = 2;
				};
			}
			let landMatch = msg.content.match(/\$([wubrg]{1,3}|bant|esper|grixis|jund|naya|abzan|jeskai|sultai|mardu|temur) ?(dual|land)/i); //msem $lands
			let landCycleMatch = msg.content.match(/\$(checkland|shockfetch|monofetch|scryland|desertshock|paindual|plagueland|plaguedual|mirrorland|handland|(investigate|clue)(land|dual)|drawdual|karoo|cycleland|tormentland|monofetch)/i); //msem $lands
			if(landMatch || landCycleMatch) {
				let searchQuery = "t:Land -t:Basic ";
				if(landMatch) {
					let factionArray = ["bant","esper","grixis","jund","naya","abzan","jeskai","sultai","mardu","temur"];
					let factionColorArray = ["GWU","WUB","UBR","BRG","RGW","WBG","URW","BGU","RWB","GUR"];
					let factionInvertArray = ["BR","RG","GW","WU","UB","UR","BG","RW","GU","WB"];
					searchQuery += "adds:"
					if(factionArray.includes(landMatch[1].toLowerCase())) {
						searchQuery += factionColorArray[factionArray.indexOf(landMatch[1].toLowerCase())]
						searchQuery += " -adds:" + factionInvertArray[factionArray.indexOf(landMatch[1].toLowerCase())]
					}else{
						searchQuery += landMatch[1].toUpperCase();
						searchQuery += " -adds:";
						let colors = ["W","U","B","R","G"];
						for(let c in colors) {
							if(!landMatch[1].toUpperCase().match(colors[c]))
								searchQuery += colors[c];
						}
					}
				}else if(landCycleMatch) {
					searchQuery += "is:" + landCycleMatch[1];
				}
				let embedInfo = buildSearchEmbed(searchQuery, arcana.msem, -1)
				let messyCallback = function (mess) {
					if(embedInfo[1] != 0) {
						mess.react(leftArrow)
							.then(() => mess.react(rightArrow))
							.then(() => mess.react(mag))
							.then(() => mess.react(xEmote))
							.then(() => mess.react(plainText))
					}
				}
				msg.channel.send(embedInfo[0])
					.then(mess => messyCallback(mess))
					.catch(console.log("An emote didn't spawn"))
			}
			//Suggestions
			if(msg.content.match(/\$suggest ?\n?/i)){
				let anonPost = msg.content.replace(/@/g, "@.");
				Client.channels.cache.get(config.mailChannel).send(anonPost);
				bribes++;
			}
			if(msg.content.match(/\$opofix/i)){
				let attachURL = msg.attachments.array()[0].url;
				let filename = msg.attachments.array()[0].name;
				request(attachURL).pipe(fs.createWriteStream("./opofix.txt"))
				msg.channel.send("LackeyBot is downloading your file, please wait a few moments.");
				var content = "";
				setTimeout(function(){
					fs.readFile('./opofix.txt', "utf8", function read(err, data) {
						if (err) {
							throw err;
						}
						content = data;
						opoFix(content, msg.author.id, filename)
						fixingList = null
						fs.unlink("./opofix.txt", (err) => {
							if (err) {
								console.log("failed to delete opofix.txt: "+err);
							} else {
								console.log('opofix complete.');                                
							}
						});
					});
				}, 3000);
			}
			if(msg.content.match(/\$l3fix/i)) {
				let attachURL = msg.attachments.array()[0].url;
				let filename = msg.attachments.array()[0].name;
				download(attachURL, {directory:"./fix/", filename: filename}, function(err) {
					if(err) throw err;
					setTimeout(function() {
						fs.readFile('./fix/'+filename,'utf8', function read(err, data) {
							if(err) throw err;
							let words = data.replace(/<\/name><set>L3<\/set>/g,".</name><set>L3</set>");
							words = words.replace(/\.\.<\/name><set>L3<\/set>/g,".</name><set>L3</set>");
							fs.writeFile(filename, words, (err) => {
								if(err) throw err
									setTimeout(function(){
										msg.channel.send("Here is your corrected .dek file, rename it as you like and move it to LackeyCCG/plugins/msemagic/decks/", {
												files:[{attachment:filename}]
											});
									}, 3000);
							});
						});
					}, 2000);
				});
			}
			if(msg.content.match(/\$plain/i)){
				let attachURL = msg.attachments.array()[0].url;
				let filename = msg.attachments.array()[0].name;
				request(attachURL).pipe(fs.createWriteStream("./extract.txt"))
				msg.channel.send("LackeyBot is downloading your file, please wait a few moments.");
				var content = "";
				setTimeout(function(){
					fs.readFile('./extract.txt', "utf8", function read(err, data) {
						if (err) {
							throw err;
						}
						content = data;
						let deckFile = extractPlain(content)
						fs.writeFile(filename, deckFile, (err) => {
							if (err) throw err;
							pullPing(msg.author.id).send("Here is your extracted plain text.", {
								files:[{attachment:filename}]
							});
						});
						fixingList = null
						
					});
				}, 3000);
			}
			detcheck = msg.content.match(/\$determine?i?s?t?i?c? ([0-9.]+), ?([0-9]+)/i);
			detercheck = msg.content.match(/\$determin/i);
			if(detcheck !== null) {
				bribes++;
				let chance = Number.parseFloat(detcheck[1])
				let success = parseInt(detcheck[2]);
				let output = "";
				if(success < 0)
					output = "Slow your roll.";
				if(chance == 0 || success == 0)
					output = "Not a chance!";
				if(chance*success > 50000000)
					output = "Not in 50 million years!"
				if(chance <= 1) {
					chance = 1/chance;
					output = "Loop with " + chance*100 + "% chance of success until " + success + " successes: " + success/chance + " loops. C'mon now.";
				}
				if(output == "") {
					let loops = 0;
					for(var i=0; i<success; i++) {
						loops++;
						let num = Math.floor(Math.random()*chance);
						if(num != 0)
							i -= 1;
						if(loops >= 100000000) {
							success = i+1;
							break;
						}
					}
					output = "Loop with 1 in " + detcheck[1] + " chance of success ran until " + success + " successes: " + loops + " loops.";
				}
				msg.channel.send(output);
			}
			if(detcheck === null && detercheck !== null) {
				bribes++;
				msg.channel.send("To have LackeyBot test a nondeterministic loop with a 1 in X chance of success until Y successes, use `$deterministic X,Y`");
			}
			let gencheck = msg.content.match(/\$namegen/i);
			let gennum = msg.content.match(/\$namegen ?([0-9]+)/i)
			if(gencheck !== null) {
				bribes++;
				let iterate = 1;
				if(gennum != null)
					iterate = gennum[1];
				if(iterate>15)
					iterate = 15;
				let output = "";
				for(var j=0; j<iterate; j++) {
					let chara = 0;
					let seed = 0.7;
					let letter = "";
					let end = "";
					chara = Math.floor(Math.random()*5) + 2;
					for(var i = 0; i < chara; i++) {
						if(i == chara-1)
							end = 'last';
						letter = pickRandomCharacter(seed,end)
						output += letter[0];
						seed = letter[1];
					}
					output += "\n"
				}
				msg.channel.send(toolbox.toTitleCase(output));
			}
			let cipherCheck = msg.content.match(/\$cipher ([^\$]+)/i);
			if(cipherCheck != null) {
				bribes++;
				let cipherText = rotCrypt(cipherCheck[1],"LB");
				if(cipherText.length > 45)
					cipherText = msg.author.username + " ciphered:\n" + cipherText;
				msg.channel.send(cipherText);
			}
			let rollcheck = msg.content.match(/\$roll( ?(\+|-)? ?[0-9]*d[0-9]+(kh[0-9]+|kl[0-9]+|e| ?\+ ?\d+| ?- ?\d+)*)+/i);
			if(rollcheck !== null) {
				let diceMsg = rollcheck[0].replace(/ d/ig," 1d")
				diceMsg = diceMsg.replace(/\$roll ?/i,"");
				msg.channel.send(rollMaster(diceMsg));
				bribes++;
			}
			let otherrollcheck = msg.content.match(/\$roll ?d?([0-9]+)?/i);
			if(rollcheck == null && otherrollcheck !== null) {
				let faces = 20;
				if(otherrollcheck[1] != undefined)
					faces = otherrollcheck[1];
				msg.channel.send(roll(faces));
				bribes++;
			}
			if(msg.content.match(/\$(mine)?sweep(er)?/i)) {
				bribes++;
				let sweepMatch = msg.content.match(/\$(mine)?sweep(er)? ([0-9]+)?_?([0-9]+)?/i);
				let width = 9;
				if(sweepMatch !== null && sweepMatch[3] !== undefined)
					width = Math.max(2,Math.min(14,sweepMatch[3]));
				let bombs = parseInt(1.25*width);
				if(sweepMatch !== null && sweepMatch[4] !== undefined)
					bombs = Math.min(width*width-1,sweepMatch[4]);
				msg.channel.send(sweeper(width, bombs));
			}
			var randArrMatch = msg.content.match(/\$shuffle ([1-9][0-9]?)/i);
			if(randArrMatch) {
				let numArray = [];
				for(let i = 1; i <= randArrMatch[1]; i++)
					numArray.push(i);
				numArray = shuffleArray(numArray);
				let mes = "Randomized numbers from 1 to " + randArrMatch[1] + ":\n";
				for(let thisNum in numArray)
					mes += numArray[thisNum] + ", ";
				mes = mes.replace(/, $/, ".")
				msg.channel.send(mes);
				bribes++;
			}
			//fuzzytest
			var fuzzyMatch = msg.content.match(/([^\$\n]*) (\$|!|\?)fuzzytest ([^\$\n]*)/i);
			if(fuzzyMatch) {
				bribes++
				if(fuzzyMatch[2] == "$")
					msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.square.data));
				if(fuzzyMatch[2] == "!")
					msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.angle.data));
				if(fuzzyMatch[2] == "?")
					msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.curly.data));
			}
			//Articles
			if(msg.content.match(/\$(primer|staple|compendium)/i)) {
				bribes +=1;
				msg.channel.send("MSEM Compendium: https://docs.google.com/document/d/1_VjnBlsuqe-eFsU__UsJ5VBNn1D9VomlxUwdzgvHuMs/edit?usp=sharing");
			}
			if(msg.content.match(/\$dies/i)) {
				bribes++;
				msg.channel.send("https://custommagiccodex.wordpress.com/2021/01/14/what-does-dies-to-removal-mean/");
			}
			if(msg.content.match(/\$broken/i)) {
				bribes++;
				msg.channel.send("http://magicseteditor.boards.net/thread/511/deaths-shadow-ruined-evaluation-skills");
			}
			if(msg.content.match(/\$s?trictly/i)) {
				bribes++;
				msg.channel.send("http://magicseteditor.boards.net/thread/498/strictly-care");
			}
			if(msg.content.match(/\$layers/i)) {
				bribes++;
				msg.channel.send("http://magicseteditor.boards.net/thread/516/mse-101-card-breaks-layers");
			}
			if(msg.content.match(/\$(hornet|hsq|hsf)/i)) {
				bribes++;
				msg.channel.send("https://custommagiccodex.wordpress.com/2021/01/14/the-hornet-sting-quandary/");
			}
			if(msg.content.match(/\$(lion|leq)/i)) {
				bribes++;
				msg.channel.send("https://custommagiccodex.wordpress.com/2021/01/14/the-lions-eye-quotient/");
			}
			if(msg.content.match(/\$(faction|combination)/i)) {
				bribes++;
				msg.channel.send("https://rentry.co/faction-primer");
			}
			if(msg.content.match(/\$lackeybot/)) {
				let links = "";
				links += "[Invite LackeyBot to your server](https://discord.com/oauth2/authorize?client_id=341937757536387072&permissions=268823616&scope=bot)";
				links += "\n[LackeyBot on github](https://github.com/CajunAvenger/LackeyBot)";
				let embedded = new Discord.MessageEmbed()
					.setTitle('LackeyBot Resources')
					.setDescription(links)
					.setFooter(collectToPlainMsg)
				msg.channel.send(embedded)
					.then(mess => mess.react(plainText))
					.catch(e => console.log(e))
				bribes++;
			}
			if(msg.content.match(/\$articles/)) {
				let links = "";
				links += "[What does \"Dies to Removal\" mean?](https://custommagiccodex.wordpress.com/2021/01/14/what-does-dies-to-removal-mean/)";
				links += "\n[How Death's Shadow and Storm Ruined Card Evaluation Skills](http://magicseteditor.boards.net/thread/511/deaths-shadow-ruined-evaluation-skills)";
				links += "\n[Strictly Better: Should You Care?](http://magicseteditor.boards.net/thread/498/strictly-care)";
				links += "\n[The Hornet Sting Quandry](https://custommagiccodex.wordpress.com/2021/01/14/the-hornet-sting-quandary/)";
				links += "\n[The Lion's Eye Quotient](https://custommagiccodex.wordpress.com/2021/01/14/the-lions-eye-quotient/)";
				links += "\n[MSE101: Layers](http://magicseteditor.boards.net/thread/516/mse-101-card-breaks-layers)";
				links += "\n[Color Combinations Primer](https://rentry.co/faction-primer)";
				let embedded = new Discord.MessageEmbed()
					.setTitle('MSE Community Articles')
					.setDescription(links)
					.setFooter(collectToPlainMsg)
				msg.channel.send(embedded)
					.then(mess => mess.react(plainText))
					.catch(e => console.log(e))
				bribes++;
			}
			if(msg.content.match(/\$template ?pack/)) {
				let links = "";
				links += "[Basic M15 Pack](https://www.dropbox.com/s/tnuvawiqyvj107l/Magic%20Set%20Editor%202%20-%20M15%20Basic.zip?dl=0)\n";
				links += "[Full M15 Pack](https://www.dropbox.com/s/4aupl48rez983i6/Magic%20Set%20Editor%202%20-%20M15%20Main.zip?dl=0)\n";
				links += "[Full Magic Pack](https://www.dropbox.com/s/kz6gi2ruhtnhtgu/Magic%20Set%20Editor%20Full%20-%20Magic.zip?dl=0)\n";
				links += "[Non-MTG Pack](https://www.dropbox.com/s/ibm2wtzayn6s6ty/Magic%20Set%20Editor%20Full%20-%20Other%20Styles.zip?dl=0)\n";
				links += "[Font Pack](https://www.dropbox.com/s/u1vqnl0f3lplzh8/Font%20Pack.zip?dl=0)";				let embedded = new Discord.MessageEmbed()
					.setTitle('Custom Magic Template Packs')
					.setDescription(links)
					.setFooter(collectToPlainMsg)
				msg.channel.send(embedded)
					.then(mess => mess.react(plainText))
					.catch(e => console.log(e))
				bribes++;
			}else if(msg.content.match(/\$template/)) {
				let links = "";
				links += "[MSE Current Release](https://github.com/twanvl/MagicSetEditor2/releases)";
				links += "\n[Cajun Style Templates](https://magicseteditor.boards.net/thread/77)";
				links += "\n[Now also on github](https://github.com/CajunAvenger/Cajun-Style-Templates)";
				links += "\n[Mainframe Extravangza](https://magicseteditor.boards.net/post/32647/thread)";
				links += "\n[Custom Indexing help](https://magicseteditor.boards.net/post/26481/thread)";
				links += "\n[Mainframe Mana, Watermarks, and other custom images](https://magicseteditor.boards.net/post/26482/thread)";
				links += "\n[Design Skeleton Generator help](https://magicseteditor.boards.net/post/26483/thread)";
				links += "\n[Mainframe Levelers help](https://magicseteditor.boards.net/post/26485/thread)";
				links += "\n[How to do popout art video](https://www.youtube.com/watch?v=oc6Fy8_BkKo&feature=youtu.be)";
				let embedded = new Discord.MessageEmbed()
					.setTitle('MSE Template Links')
					.setDescription(links)
					.setFooter(collectToPlainMsg)
				msg.channel.send(embedded)
					.then(mess => mess.react(plainText))
					.catch(e => console.log(e))
				bribes++;
			}
			if(msg.content.match(/\$standard/i)) {
				bribes++;
				let standardSets = [];
				for(let set in magicSetData) {
					if(magicSetData[set].standard)
						standardSets.push(set)
				}
				let output = "";
				let theDate = toolbox.arrayTheDate()
				let thisYear = theDate[0] + 2000;
				if(standardSets.length == 4) { //if a rotation just happened
					if(theDate[1] != "01") //and we're not in the gap before the Q1 set
						thisYear++; //they rotate next year
					output += "Rotates Q4 " + thisYear + "\n```";
					for(let set in standardSets)
						output += magicSetData[standardSets[set]].longname + " | ";
					output = output.replace(/ \| $/, "```")
				}else{
					output += "Rotates Q4 " + thisYear + ":\n```";
					for(let i = 0; i<standardSets.length; i++) {
						output += magicSetData[standardSets[i]].longname;
						if(i != 3 && i != standardSets.length-1)
							output += " | ";
						if(i == 3) {
							thisYear++
							output += "```\nRotates Q4 " + thisYear + ":\n```"
						}
					}
					output += "```";
				}
				msg.channel.send(output);
			}
			let pricesCheck = msg.content.match(/\$price ([^\$\n]+)/i)
			if(pricesCheck){
				let testName = fuzzy.scryDatabase(arcana.magic, pricesCheck[1])[0][0];
				if(testName == undefined)
					testName = searchCards(arcana.magic, pricesCheck[1])
				if(testName == undefined) {
					msg.channel.send("LackeyBot was unable to find a card that matched that search.")
				}else{
					let pricestring = asyncPriceData(testName)
						.then(pricestring => msg.channel.send("```Prices for " + testName + "\n" + pricestring + "```"))
						.catch(e => console.log(e))
				}
			}
			//reminder engine
			var remindMatch = msg.content.match(/(?:\$|!|<@!?341937757536387072> )reminde?r? (?:<#([0-9]+)> )?([0-9\.]+) ?(second|s|minute|min|hour|hr?|day|week|wk?|month|m|year|yr|decade|d)s? ?([\s\S]*)/i);
			if(remindMatch) {
				startWriting("reminder")
				bribes++;
				reminderSet++;
				let number = remindMatch[2];
				let wholeNumber = Math.trunc(number);
				let distance = remindMatch[3].toLowerCase();
				let refArray = ["s", "min", "m", "hr", "h", "d", "wk", "w", "yr"];
				let nameArray = ["second", "minute", "minute", "hour", "hour", "day", "week", "week", "year"];
				if(refArray.includes(distance))
					distance = nameArray[refArray.indexOf(distance)];
				let thisMessage = remindMatch[4];
				let thisID = msg.author.id;
				reminderCell[thisID] = {};
				let thisChannel = msg.channel.id;
				let sendChannel = msg.channel.id;
				if(remindMatch[1])
					sendChannel = remindMatch[1];
				//remove pings
				let pingCheck = thisMessage.match(/<@!([0-9]+)>/g);
				if(pingCheck && admincheck.includes(7)) {
					for(i=0;i<pingCheck.length;i++) {
						pingMatch = pingCheck[i].match(/<@!([0-9]+)>/);
						thisMessage = thisMessage.replace(pingCheck[i],pullUsername(pingMatch[1]));
					}
				}

				if(distance == "second" && wholeNumber < 60) {
					let temp = "Reminder set for " + wholeNumber + " seconds from now."
					msg.channel.send(temp.replace("for 1 seconds","for 1 second"));
					doneWriting("reminder")
					setTimeout(function(){
						thisMessage = wholeNumber + " seconds ago <@" + msg.author.id + "> set a reminder: " + thisMessage;
						msg.channel.send(thisMessage.replace(/^1 seconds ago/,"1 second ago"));
						reminderDone++;
					}, wholeNumber * 1000);
				}
				else{
					if(distance == "decade") {
						msg.react("👀");
					}
					let pingTime = setTimeDistance(number, distance);
					remindAdder(thisChannel, thisID, thisMessage, number + " " + distance, pingTime.getTime(), sendChannel);
				}
			}else if(msg.content.match(/\$remind/)){
				let hooks = {
				/*	MSEM: {
						time: new Date('Thu, 15 October 2020 10:00:00 EST'),
						match: ["MSEM"],
						message: "`MSEM`, for the MSEM release announcement on October 15"
					},*/
					Kaldheim: {
						time: new Date('Fri, 5 February 2021 10:00:00 EST'),
						match: ["Kaldheim"],
						message: "`Kaldheim`, for the release of Kaldheim in January 2021"
					},
					Strixhaven: {
						time: new Date('Fri, 23 April 2021 10:00:00 EST'),
						match: ["Strixhaven"],
						message: "`Strixhaven`, for the release of Strixhaven in April 2021"
					},
					Realms: {
						time: new Date('Fri, 9 July 2021 10:00:00 EST'),
						match: ["DND", "D&D", "Forgotten Realms", "Forgotten", "Realms", "Realm"],
						message: "`DND`, `Forgotten Realms`, or `Realms`, for the release of Adventures in the Forgotten Realms in July 2021"
					},
					Innistrad: {
						time: new Date('Fri, 24 September 2021 10:00:00 EST'),
						match: ["Innistrad: Werewolves", "Innistrad Werewolves", "Innistrad", "Werewolves", "Werewolf"],
						message: "`Innistrad` or `Werewolves`, for the release of Innistrad: Werewolves in September 2021"
					},
					Vampires: {
						time: new Date('Fri, 24 September 2021 10:01:00 EST'),
						match: ["Innistrad: Vampires", "Innistrad Vampires", "Vampires", "Vampire"],
						message: "`Innistrad: Vampires` or `Vampires`, for the release of Innistrad: Vampires in September 2021"
					}
				}
				if(msg.content.match(/\$reminde?r? ?event/)) {
					let eventHelp = "Active $remind events:";
					for(let hook in hooks) {
						eventHelp += "\n" + hooks[hook].message;
					}
					msg.channel.send(eventHelp);
				}else{
					for(let hook in hooks) {
						let regString = "\\$remind (";
						for(let key in hooks[hook].match)
							regString += hooks[hook].match[key] + "|";
						regString = regString.replace(/\|$/, ") ([\\s\\S]+)");
						let hookRegex = new RegExp(regString, 'i');
						let hookCheck = msg.content.match(hookRegex);
						if(hookCheck){
							startWriting("reminder")
							bribes++;
							reminderSet++;
							let thisID = msg.author.id;
							reminderCell[thisID] = {};
							let thisChannel = msg.channel.id;
							let sendChannel = msg.channel.id;
							let thisMessage = hookCheck[2];
							//remove pings
							let pingCheck = thisMessage.match(/<@!([0-9]+)>/g);
							if(pingCheck && admincheck.includes(7)) {
								for(i=0;i<pingCheck.length;i++) {
									pingMatch = pingCheck[i].match(/<@!([0-9]+)>/);
									thisMessage = thisMessage.replace(pingCheck[i],pullUsername(pingMatch[1]));
								}
							}
							let pingTime = hooks[hook].time;
							let diff = pingTime.getTime() - new Date().getTime();
							diff = diff / (1000*60*1440);
							diff = parseFloat(diff, 1).toFixed(1);
							if(diff < 0) {
								msg.channel.send("That event has already passed.")
							}else{
								remindAdder(thisChannel, thisID, thisMessage, diff+ " days", pingTime.getTime(), sendChannel, true);
								break;
							}
						}
					}
				}	
			}
			if(msg.content.match(/\$reminderlist/i)) {
				let embedData = buildReminderListEmbed(msg.author.id, 0);
				if(embedData[1]){
					msg.channel.send(embedData[0], embedData[1])
						.then(mess => mess.react(rightArrow))
						.catch(e => console.log(e))
				}else{
					msg.channel.send(embedData[0]);
				}
			}
			var remdelmatch = msg.content.match(/\$reminderdelete <?([0-9]+)>?/i);
			if(remdelmatch) {
				let userID = msg.author.id;
				if(!reminderCell[userID] || reminderCell[userID] == {}) {
					msg.channel.send("Please use $reminderlist before attempting to delete a reminder. This resets whenever you create a new reminder.");
				}else if(!reminderCell[userID][remdelmatch[1]] || reminderCell[userID][remdelmatch[1]].deleted == 1) {
					msg.channel.send("Invalid index, please try again or use $reminderlist to refresh your list.");
				}else if(reminderCell[userID][remdelmatch[1]]) {
					reminderCell[userID][remdelmatch[1]].deleted = 1;
					let thisReminder = reminderBase[reminderCell[userID][remdelmatch[1]].time][reminderCell[userID][remdelmatch[1]].index]
					if(thisReminder.id == userID) { //if you set this reminder, scrub your id
						thisReminder.id = "";
						if(!thisReminder.hasOwnProperty('cc') || thisReminder.cc.length == 0) { //if this reminder doesn't have a CC, just delete it
							thisReminder.message = "";
							msg.channel.send("Reminder deleted.");
							reminderDone++;
						}else{ //if it does, keep it
							msg.channel.send("Removed from reminder.")
						}
					}else{ //if you're in the CC, remove you from that
						let pullIndex = thisReminder.cc.indexOf(userID)
						thisReminder.cc = toolbox.spliceArray({array:thisReminder.cc, replace:1, index:pullIndex})
						if(thisReminder.id == "" && thisReminder.cc.length == 0) //if there's no one left
							thisReminder.message = ""; //erase the message to cull below
							msg.channel.send("Removed from reminder.")
					}
					bribes++;
					let cullFlag = 1;
					for(let ent in reminderBase[reminderCell[userID][remdelmatch[1]].time]) {
						if(reminderBase[reminderCell[userID][remdelmatch[1]].time][ent].message != "")
							cullFlag = 0;
					}
					if(cullFlag == 1)
						delete reminderBase[reminderCell[userID][remdelmatch[1]].time]
					logReminders();
				}
			}
			var remchangematch = null;//msg.content.match(/\$reminder ?(in|de)crease <?([0-9]+)>? ([0-9\.]+) (second|minute|hour|day|week|month|year|decade)/);
			if(remchangematch) {
				let userID = msg.author.id;
				if(!reminderCell[userID] || reminderCell[userID] == {}) {
					msg.channel.send("Please use $reminderlist before attempting to change a reminder. This resets whenever you create a new reminder.");
				}
				else
				if(!reminderCell[userID][remchangematch[2]] || reminderCell[userID][remchangematch[2]].deleted == 1) {
					msg.channel.send("Invalid index, please try again or use $reminderlist to refresh your list.");
				}
				else
				if(reminderCell[userID][remchangematch[2]]) {
					let distance = remchangematch[4];
					let number = remchangematch[3];
					let wholeNumber = Math.trunc(number);
					let pingMinute = 0;
					let pingHour = 0;
					let pingDay = 0;
					let pingMonth = 0;
					let pingYear = 0;
					let currenttime = new Date();
					let thisMessage = reminderBase[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].message;
					let thisID = reminderBase[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].id;
					let thisChannel = reminderBase[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].channel;
					if(distance == "minute")
						pingMinute += wholeNumber;
					
					if(distance == "hour") {
						pingHour += wholeNumber;
						pingMinute += Math.trunc((number - wholeNumber) * 60);
					}
					if(distance == "day") {
						pingDay += wholeNumber;
						pingHour += Math.trunc((number - wholeNumber) * 24);
					}
					if(distance == "week") {
						pingDay += 7*wholeNumber;
						pingHour += Math.trunc((number - wholeNumber) * 7);
					}
					if(distance == "month") {
						pingMonth += wholeNumber;
						pingDay += Math.trunc((number - wholeNumber) * 30);
					}
					if(distance == "year") {
						pingYear += wholeNumber;
						pingDay += Math.trunc((number - wholeNumber) * 365);
					}
					if(distance == "decade") {
						pingYear += 10*wholeNumber;
						pingYear += Math.trunc((number - wholeNumber) * 10);
						msg.react("👀");
					}
					if(number != 1)
						distance += "s";
					let pingTime = null;
					if(remchangematch[1] == "in") {
						pingMinute += currenttime.getMinutes();
						pingHour += currenttime.getHours();
						pingMonth += currenttime.getMonth();
						pingYear += currenttime.getYear();
						pingTime = new Date(pingYear, pingMonth, pingDay, pingHour, pingMinute, 0, 0);
						let returnmessage = "Your reminder has been pushed back by " + number + " " + distance +".";
					}
					if(remchangematch[1] == "de") {
						pingMinute -= currenttime.getMinutes();
						pingHour -= currenttime.getHours();
						pingMonth -= currenttime.getMonth();
						pingYear -= currenttime.getYear();
						pingTime = new Date(pingYear, pingMonth, pingDay, pingHour, pingMinute, 0, 0);
						let returnmessage = "Your reminder has been pushed forward by " + number + " " + distance +".";
						if(pingTime.getTime() < currenttime.getTime())
							pingTime = currenttime;
					}
					remindAdder(thisChannel, thisID, thisMessage, number + " " + distance, pingTime.getTime());
					msg.channel.send(returnmessage);
					//null out the old one
					reminderCell[userID][remchangematch[2]].deleted = 1;
					reminderBase[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].message = "";
					reminderBase[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].id = "";
					bribes++;
					let cullFlag = 1;
					for(let ent in reminderBase[reminderCell[userID][remchangematch[2]].time]) {
						if(reminderBase[reminderCell[userID][remchangematch[2]].time][ent].message != "")
							cullFlag = 0;
					}
					if(cullFlag == 1)
						delete reminderBase[reminderCell[userID][remchangematch[2]].time]
					logReminders();
				}
			}
			/* wildcard voting
			if(msg.content.match(/\$vote/)) {
				let voter = Client.guilds.cache.get("317373924096868353").roles.cache.get("747659270765543555").members.find(v => v.id == msg.author.id);
				if(voter) {
					wildcardVoter(msg.author.id, msg.content.replace(/\$vote ?/i, ""));
					msg.channel.send('Wildcard vote submitted.')
				}else{
					msg.channel.send('You do not have the VOTE! role, which is needed to vote in the wildcard.');
				}
			}*/
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
				bribes++;
				let player = msg.author.id;
				if(admincheck.includes(5) && msg.content.match(/override:? ?(\d+)/))
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
					bribes++;
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
				bribes++;
				let user = msg.author.id
				let overCheck = msg.content.match(/override (\d+)/);
				if(cajun && overCheck) {
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
				bribes++;
				msg.channel.send(renderLeaderBoard(leagueName, msg.author.id));
			}
			if(msg.content.match(/\$monthleader/i)) {
				bribes++;
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
					msg.channel.send(matchDexScripts.warnHandler(matchDex[tourn], playerID, msg.author.id, warnStack, unWarn));
					//logMatch();
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
						outM += "__" + matchDex[t].data.name + "__\n" + matchDexScripts.writeCurrentWarns(matchDex[t].players[playerID]) + "\n";
				}
				if(!outM)
					outM = "Player has no warnings.";
				msg.channel.send(outM);
			}
			let gpBoardRegex = new RegExp('\\$' + tournamentNames + '(leader|board|score)', 'i');
			gpBoardMatch = msg.content.match(gpBoardRegex);
			if(gpBoardMatch) {
				bribes++;
				let tourneyname = gpBoardMatch[1];
				if(isLeague) {
					msg.channel.send(renderLeaderBoard(tourneyname));					
				}else{
					let board = renderGPLeaderBoard(tourneyname, false, 0)
					msg.channel.send(board[0], board[1])
						.then(function(mess) {
							mess.react(tieEmote);
							mess.react(leftArrow);
							mess.react(rightArrow);
						})
						.catch(e => console.log(e))
				}
			}
			if(msg.content.match(/\$(sealed ?)?(foes|vsseeker)/i)) {
				bribes++;
				msg.channel.send(vsSeeker(leagueName, msg.author.id));
			}
			var deckChangeMatch = msg.content.match(/\$rename (gp|league) ?(\d+)? ?: ?([^\n]+)/);
			if(toolbox.hasValue(deckChangeMatch)) {
				bribes++;
				let tourney = deckChangeMatch[1];
				let run = 1;
				if(toolbox.hasValue(deckChangeMatch[2]))
					run = deckChangeMatch[2];
				let deckName = deckChangeMatch[3];
				let message = changeDeckName(tourney, msg.author.id, deckName, run);
				msg.channel.send(message);
				if(message != "You are not in this tournament.")
					logMatch();
			}
			//Channel specific commands
			if(msg.guild != undefined && msg.guild != null && roleCall.hasOwnProperty(msg.guild.id)){
				let thisGuild = msg.guild.id;
				let rolecheck = msg.content.toLowerCase().match(roleRegex[thisGuild]);
				if(rolecheck != null) {
					let test = adjustRoles(rolecheck[2], thisGuild, msg.member, "roles", rolecheck[1]);
					if(test)
						msg.channel.send(test.replace("$USER", msg.author.username));
				}else{
					let iamCheck = msg.content.toLowerCase().match(/\$iam(n|not)? ([^\$]+)/);
					if(iamCheck){
						let closestName = fuzzy.searchArray(iamCheck[2].replace(/ /g,""), Object.keys(roleCall[thisGuild].roles,{percent:0.33}))[0];
						let test = adjustRoles(closestName, thisGuild, msg.member, "roles", iamCheck[1]);
						if(test)
							msg.channel.send(test.replace("$USER", msg.author.username));
					}
				}
				if(msg.content.match(/\$fblthp/i)){
					if(msg.guild.id == "317373924096868353") {
					bribes++;
						msg.member.roles.remove("372453779418775553").catch(console.error);
						msg.channel.send(msg.author.username + " has left the arena. <:fblthp:372438950171770891>");
					}else{
						msg.channel.send("<:fblthp:372438950171770891>")
					}
				}
				if(msg.content.match(/\$mklthd/i)){
					bribes++;
					if(msg.guild.id == "317373924096868353") {
						msg.member.roles.add("372453779418775553").catch(console.error);
						msg.channel.send(msg.author.username + " is looking for an opponent! <:mklthd:372438015374655500>");
					}else{
						msg.channel.send("<:mklthd:372438015374655500>")
					}
				}
				if(msg.content.match(/\$(roles|lsar)/i)){
					bribes++;
					let embedInfo = buildRoleEmbed(msg.guild.id, 0)
					let messyCallback = async function(mess) {
						if(embedInfo[1]>1) {
							mess.react(leftArrow)
							.then(() => mess.react(rightArrow))
							.catch(console.log("An emote didn't spawn"))
						}
						return mess;
					}
					let callback = function(mess) {
						messyCallback(mess)
							.then(mess.react(plainText))
							.catch(console.log("An emote didn't spawn"))
					}
					msg.channel.send(embedInfo[0])
						.then(mess => callback(mess))
						.catch(console.log("An emote didn't spawn"))
				}
				let inroleMatch = msg.content.match(/^\$inrole ([^\n]+)/i)
				if(inroleMatch) {
					let roleName = inroleMatch[1].toLowerCase();
					bribes++;
					let embedInfo = buildInRoleEmbed(msg.guild, roleName, 0);
					if(embedInfo[1] === null) {
						msg.channel.send(embedInfo[0])
					}else{
						msg.channel.send(embedInfo[0])
							.then(function(mess) { mess.react(plainText).then(() => {if(embedInfo[1]>1){mess.react(leftArrow)
							.then(() => mess.react(rightArrow))}})})
							.catch(console.log("An emote didn't spawn"))
					}
						
				}
			}else{
				if(msg.content.match(/\$fblthp/i)){
					bribes++;
					msg.channel.send("<:fblthp:372438950171770891>")
				}
				if(msg.content.match(/\$mklthd/i)){
					bribes++;
					msg.channel.send("<:mklthd:372438015374655500>")
				}
			}
			if(msg.guild && fightGuilds.hasOwnProperty(msg.guild.id)) { //guilds with $fight commands
				if(msg.content.match(/\$fi(ght|te)/i)){
					if(msg.member.roles.cache.find(val => val.id == fightGuilds[msg.guild.id])){
						msg.member.roles.remove(fightGuilds[msg.guild.id]).catch(console.error);
						msg.channel.send(msg.author.username + " has left the arena. <:fblthp:372438950171770891>");
					}else{
						msg.member.roles.add(fightGuilds[msg.guild.id]).catch(console.error);
						msg.channel.send(msg.author.username + " is looking for an opponent! <:mklthd:372438015374655500>");
					}
				}
				if(msg.content.match(/\$unfi(ght|te)/i)){
					bribes++;
					msg.member.roles.remove(fightGuilds[msg.guild.id]).catch(console.error);
					msg.channel.send(msg.author.username + " has left the arena. <:fblthp:372438950171770891>");
				}
			}
			if(msg.guild && tournamentChannels.includes(msg.channel.id)) {//MatchDex reports
				let reportGPMatch = msg.content.match(/\$report([^\n]+)/i)
				if(reportGPMatch && !codeCheck) { //reporting matches
					let reportLine = reportGPMatch[1];
					let scoresMatch = reportLine.match(/(\d+) *[-\/]+ *(\d+) *[-\/]* *(\d+)?/);
					let matchMatch = reportLine.match(/match (\d+)/i);
					let playersMatch = toolbox.globalCapture('<@!?([0-9]+)>', reportLine, true);
					if(scoresMatch && playersMatch && gpName) {
						let ids = []; //player ids
						if(playersMatch.length > 1 && (admincheck.includes(1) || msg.author.id == matchDex[gpName].data.TO)) {
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
							bribes++;
							msg.channel.send(`${Client.users.cache.get(msg.author.id)} ${updateMatch(gpName, ids[0], ids[1], scoresMatch[1], scoresMatch[2], matchNo, msg.guild)}`);
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
								msg.channel.send(`${Client.users.cache.get(msg.author.id)} ${updateGPMatch(gpName, ids[0], ids[1], scoresMatch[1], scoresMatch[2], matchNo)}`);
								if(matchDex[gpName].awaitingMatches.length == 0)
									msg.channel.send("<@!" + matchDex[gpName].data.TO + ">, All matches have been reported!");
								bribes++;
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
			if(msg.guild && msg.guild.id == "205457071380889601"){ //purple server specific
				let dgRegex = new RegExp('^<@&277083656269594624>','')
				if(msg.channel.id == "229827952685219850" && msg.content.match(dgRegex) && !pinDisarm[0]) {
					asyncSwapPins(msg, {content:dgRegex}, 1, pinDisarm);
					pinDisarm[0] = true;
					setTimeout(function(){pinDisarm[0] = false}, 20*60*1000)
				}
				if(msg.channel.id == "229827952685219850" && pinDisarm[2] && msg.content.match(/(\$|!)(false|switch|swap|flip|pin) ?(alarm|switch|swap|flip|pin)/i)) {
					asyncSwapPins(pinDisarm[2], {content:"!"}, 1, pinDisarm);
					msg.channel.send("Pins swapped.");
				}
			}
			if(msg.content.match(/(\$|\?)fetch ?help/i)) {
				bribes++;
				msg.channel.send(fetchHelpMessage());
			}
			if(msg.content.match(/(\?|\$)pack(doc|slot)/i)) {
				bribes++;
				let embedded = buildPackDocs(0)[0];
				msg.channel.send(embedded)
					.then(mess => mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
					.then(() => mess.react(plainText)))
					.catch(e => console.log(e))
			}
			if(msg.content.match(/(\?|\$)pack(gen|print)/)) {
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
							let sani = sanitizeCardData(user, msg.channel, newName, "NEW");
							if(sani[1]) {
								msg.channel.send(sani[0] + " Attempting to generate packs...");
								let safeLib = {cards:sani[1], setData:{"NEW":{packSlots:[]}}, name:"temp"};
								let packSlotData = packSlotsMatch[1];
								let testPacks = packgen.buildPackSlotsFrom(packSlotData);
								if(!Array.isArray(testPacks) || testPacks.length == 0) {
									msg.channel.send("Something went wrong with the packSlot builder. This is likely a problem with LackeyBot rather than your code, so please alert Cajun for debugging.");
								}else if(testPacks[0] && typeof testPacks[0] == 'string' && testPacks[0].match(/Invalid packSlot structure/)) {
									msg.channel.send(testPacks[0]);
								}else{
									safeLib.setData["NEW"].packSlots = testPacks;
									let testFilters = testPackFilters(testPacks, safeLib, "NEW");
									if(testFilters)
										msg.channel.send(testFilters)
									generalCollater(safeLib, "NEW", count, msg.author);
								}
							}else{
								msg.channel.send(sani[0]);
							}
						}, 2000);
						setTimeout(function() {
							fs.unlink("./dev/" + newName + "devtest.json", (err) => {if (err) throw err;});
						}, 20000);
					});
				}else if(attached[0]){
					msg.channel.send("Please include a packSlots code with your file to collate with. Send `?packdocs` for information for how to construct a packSlots code.")
				}else{ //devDex
					let devData = devDex.devData[msg.author.id];
					generalCollater(arcana.devDex, devData.setCode, count, msg.author);
				}
			}
			if(msg.channel.type == 'dm') { //DevDex Management
				let devUpMatch = msg.content.match(/(\$|\?)fetch ?setup/i);
				if(devUpMatch) {
					startWriting("dev");
					let user = msg.author.id, spoof = false;
					if(user == cajun && msg.content.match(/spoof:/)) {
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
							msg.channel.send(fetchHelpMessage());
						}
						doneWriting("dev");
					}else{ //if they make changes...
						if(!devDex.devData.hasOwnProperty(user)) { //and don't have a set, make it
							devDex.devData[user] = {};
							devDex.devData[user].channel = "";
							devDex.devData[user].ownerID = user;
							devDex.devData[user].setCode = "";
							devDex.devData[user].username = msg.author.username;
							if(spoof)
								devDex.devData[user].username = Client.users.cache.get(user).username;
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
								let testFilters = testPackFilters(testPacks, arcana.devDex, devDex.devData[user].setCode);
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
					logDev(msg.author.id); // and then save it
					doneWriting("dev");
				}
				let devLoadMatch = msg.content.match(/(\$|\?)fetch ?upload/i);
				if(devLoadMatch) {
					startWriting("dev");
					let user = msg.author.id, spoof = false;
					if(user == cajun && msg.content.match(/spoof:/)) {
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
		}catch(e) {
			console.log("LackeyBot Other Commands");
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

	}
});
Client.on("messageReactionAdd", async (message, user) => { //functions when posts are reacted too
	if(message.message.partial) {
		try{
			await message.message.fetch();
		}catch(e){
			console.log(e);
			return;
		}
	}
	let cajunCheck = message.users.cache.find(val => val.id == cajun);
	if(cajunCheck || !offline) { //only reacts to cajun in offline mode
		try{ //in a try/catch in case anything goes wrong
			let msg = message.message;
			let grab = 'defaults';
			if(msg.guild && arcanaSettings.hasOwnProperty(msg.guild.id))
				grab = msg.guild.id;
			let emittedEmote = message._emoji.name;
			if(message._emoji.id != null)
				emittedEmote = message._emoji.id;
			if(msg.author.id == Client.user.id) { //reaction to a LackeyBot post
				
				let textFlag = false;
				let update = true;
				if(!message.users.cache.find(val => val.id != Client.user.id))
					update = false; //LackeyBot reacting
				if((emittedEmote == plainText && message.users.cache.find(val => val.id != Client.user.id) || (emittedEmote != plainText && msg.content != "")))
					textFlag = true; //someone reacts w/PT, or with something else in PTmode
				if(msg.content != "" && emittedEmote == plainText) { //someone reacts w/PT in PT mode
					textFlag = false;
					update = true;
				}
				if(update) {
					if(emittedEmote == xEmote) {
						msg.delete();
						return;
					}
					let embedData = msg.embeds[0];
					if((embedData && embedData.footer)) { //all reactable embeds will have a footer or switcheroo data, all unreactable embeds will not
						let emoteArray = msg.reactions.cache.array();
						if(embedData.title) { //embeds that depend on title data
							if(msg.guild && allRoles.guilds.hasOwnProperty(msg.guild.id)) {
								let guildID = msg.guild.id;
								if(embedData.title.match(/self-assignable/i)) { //self-assignable role pages
									let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
									let embedBuild = function(thisPage) {return buildRoleEmbed(guildID, thisPage, textFlag)[0]};
									turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
								}
								let inroleTurn = embedData.title.match(/List of users in ([^\n]+) role/i);
								if(inroleTurn) { //inrole pages
									let guildID = msg.guild.id;
									let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
									let embedBuild = function(thisPage) {return buildInRoleEmbed(msg.guild, inroleTurn[1], thisPage, textFlag)[0]};
									turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
								}
							}
							if(embedData.title.match(/packSlots Documentation/i)){
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);							
								let embedBuild = function(thisPage) {return buildPackDocs(thisPage, textFlag)[0]};
								turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
							}
							if(embedData.title.match(/opened a pack/i)) { //pack pages
								let this_user = "";
								for(let user in packStash) {
									if(packStash[user].msg == msg.id)
										this_user = user;
								}
								if(this_user == "") {
									cullReacts(msg, [Client.user.id, this_user])
								}else{
									let pageCheck = embedData.footer.text.match(/Card ([0-9]+)\/([0-9]+)/)
									let database = arcana[packStash[this_user].database];
									let embedBuild = function(thisPage) {return buildPackEmbed(database, packStash[this_user].cards, packStash[this_user].set, this_user, thisPage, textFlag)[0]};
									turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
								}
							}
							if(embedData.title.match(/^Supreme Draft/i)) { //pack pages
								let this_user = "";
								for(let user in packStash) {
									if(packStash[user].msg == msg.id)
										this_user = user;
								}
								if(this_user == "") {
									cullReacts(msg, [Client.user.id, this_user])
								}else{
									let pageCheck = embedData.footer.text.match(/([0-9]+)\/([0-9]+)/);
									let pickNos = embedData.title.match(/Pack (\d+), Pick (\d+): ([^\n]+)/);
									let newPack = parseInt(pickNos[1]);
									let newPick = parseInt(pickNos[2]);
									let newFlag;
									if(azEmoteArray.includes(emittedEmote)) {
										let pickResult = supremePicker(this_user, emittedEmote);
										if(pickResult[0]) {
											newPick = (newPick+1)%3
											if(newPick == 0) {
												newPick++;
												newPack++;
												packStash[this_user].cards = psPackSorter(generatePack(packStash[this_user].set, arcana[packStash[this_user].database], " -is:bonus"), arcana[packStash[this_user].database]);
												packStash[this_user].picks = [];
												pageCheck[1] = 1;
												if(msg.channel.type == "dm") {
													newFlag = function(mess) {
														packStash[this_user].msg = mess.id;
														mess.react(leftArrow);
														mess.react(rightArrow);
														mess.react(plainText);
													};
												}else{
													cullReacts(msg, [Client.user.id])
												}
											}
										}
									}
									if(newPack == 19) {
										let pool = "**Supreme Pool**\n";
										for(let c in scratchPad.supreme[this_user].pool) {
											pool += scratchPad.supreme[this_user].pool[c] + " " + c.replace(/_.*/, "") + "\n";
										}
										msg.channel.send(pool)
										delete scratchPad.supreme[this_user];
										delete packStash[this_user];
									}else{
										let database = arcana[packStash[this_user].database];
										let pickData = {
											pack: newPack,
											pick: newPick,
											picks: packStash[this_user].picks,
											picked: emittedEmote,
											user: this_user,
										}
										let embedBuild = function(thisPage) {return buildSupremeEmbed(database, packStash[this_user].cards, packStash[this_user].set, pickData, thisPage, textFlag)[0]};
										turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag, false, newFlag);
									}
								}
							}
							let pickMatch = embedData.title.match(/^Pack 1, Pick 1: ([^\n]+)/)
							if(pickMatch) {
								let packArray;
								if(embedData.description)
									packArray = embedData.description.split("\n");
								if(msg.content)
									packArray = msg.content.split("\n");
								let database = arcana.magic;
								let dataName = arcana.decodeColor(embedData.color);
								if(dataName)
									database = arcana[dataName];
								let embedBuild = function(thisPage) {return buildPickEmbed(database, packArray, pickMatch[1], textFlag)[0]};
								turnEmbedPage(msg, [0, 1, 1], embedBuild, update, textFlag);
							}
							let psBotTurn = embedData.title.match(/Planesculptors search results for: ([^\n]+)/i);
							if(psBotTurn) { //flips pages for PSBot searches
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
										let arcanaData = toolbox.cloneObj(arcanaSettings[grab]);
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
									turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
								}
							}
							let leagueTurn = embedData.title.match(/^(.*) League Info/);
							if(leagueTurn) { //flips pages for league data embed
								let thisUser = leagueTurn[1];
								let userID = Client.users.cache.find(val => val.username == thisUser).id;
								let invalidUser = cullReacts(msg, [userID, Client.user.id]).length;
								if(!invalidUser) {
									let pageCheck = embedData.footer.text.match(/run data (\d+)\/(\d+)/);
									let tourney = embedData.footer.text.match(/^(.*) run data/)[1];
									let embedBuild = function(thisPage) {return reportRecord(tourney, userID, thisPage, textFlag)[0]}
									turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag, 1)
								}
							}
						}else
						if(embedData.description) { //embeds that depend on description data
							let searchTurn = embedData.description.match(arcana.refSheet.searchRegex)
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
										database = arcanaSettings[grab].angle.data;
										switchFlag = true;
										break;
									case (dollarEmote, old_dollarEmote):
										database = arcanaSettings[grab].square.data;
										switchFlag = true;
										break;
									case (quesEmote, old_quesEmote):
										database = arcanaSettings[grab].curly.data;
										switchFlag = true;
										break;
								}
								let embedBuild = function(thisPage) {return buildSearchEmbed(searchTurn[2], database, thisPage, imageFlag, textFlag)[0]};
								if(pageFlag)
									embedBuild = function() {return buildSearchEmbed(searchTurn[2], database, -1, imageFlag, textFlag)[0]};
								turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
							}
							let hangCheck = embedData.description.match(/(Guess the card|Hangman is in plaintext mode.)/);
							if(hangCheck && !embedData.footer.text.match(/^Game over/)) { //hangman games
								hangmanParser(msg, embedData, emittedEmote, textFlag)
							}
							let scodeCheck = embedData.description.match(/(Magic|MSEM|devDex) Set Codes/) //flip setcode pages
							if(scodeCheck) {
								let pageCheck = embedData.footer.text.match(/Page ([0-9]+)\/([0-9]+)/);
								let database = arcana.libFromBig(scodeCheck[1]);
								let embedBuild = function(thisPage) {return buildSetsEmbed(database, thisPage, textFlag)[0]};
								//if(pageFlag)
								//	embedBuild = function() {return buildSetsEmbed(database, -1, textFlag)[0]};
								turnEmbedPage(msg, pageCheck, embedBuild, update, textFlag);
							}
							if(embedData.description.match(/^Need more time/)){
								let messSplit = msg.content.match(/(\d+) ([^ ]+) ago <@!?([0-9]+)> set a reminder: ([\s\S]+)/);
								let number = parseInt(messSplit[1]);
								let distance = messSplit[2];
								let thisID = messSplit[3];
								let invalidUser = cullReacts(msg, [thisID, Client.user.id]).length;
								let thisMessage = messSplit[4];
								thisMessage = thisMessage.replace(/\nPing me too: (<@!?[0-9]+> ?)*$/, "");
								if(!invalidUser) {
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
										let pingTime = setTimeDistance(number, distance)
										remindAdder(msg.channel.id, thisID, thisMessage, number + " " + distance, pingTime.getTime(), msg.channel.id);
									}
								}
							}
						}else{
						//embeds that depend on footer data
							if(embedData.footer.text == "MSEM Patch Info") { 	//msem patch embed
								let embedBuild = function() {return buildPatchEmbed(textFlag)[0]};
								turnEmbedPage(msg, [0,1,1], embedBuild, update, textFlag);
							}
							else if(embedData.footer.text.match(/^Previous/)) {		//cr embed
								if(emittedEmote == leftArrow) {
									let crCheck = embedData.footer.text.match(/Previous ([^\n]+)/);
									if(crCheck) {
										let embedBuild = buildCREmbed(crCheck[1], textFlag)
										msg.edit(embedBuild[0], embedBuild[1])
									}
								}else if(emittedEmote == rightArrow) {
									let crCheck = embedData.footer.text.match(/Next ([^\n]+)/);
									if(crCheck) {
										let embedBuild = buildCREmbed(crCheck[1], textFlag)
										msg.edit(embedBuild[0], embedBuild[1])
									}
								}else if(emittedEmote == plainText && embedData.title != "Comprehensive Rules") {
									let embedBuild = buildCREmbed(embedData.title, textFlag)
									msg.edit(embedBuild[0], embedBuild[1])
								}
								cullReacts(msg, [Client.user.id])
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
									if(reminderBase[remTime][remSlot]) {
										let user = cullReacts(msg, [Client.user.id, reminderBase[remTime][remSlot].id]); //get ids of reactors
										if(user[0]) {
											if(!reminderBase[remTime][remSlot].hasOwnProperty('cc')) //add a CC if we don't have it yet
												reminderBase[remTime][remSlot].cc = [];
											let addMess = "";
											if(!reminderBase[remTime][remSlot].cc.includes(user)) {
												for(let u in user) {
													if(!reminderBase[remTime][remSlot].cc.includes(user[u])) { //add the users
														reminderBase[remTime][remSlot].cc.push(user[u]);
														addMess = pullUsername(user[u]) + " " + addMess; //let them know they've been added
													}
												}
												if(addMess != "") {
													addMess += "added to reminder."
													msg.channel.send(addMess);
													logLater['reminder'] = true; //set the reminder to log later because there will probably be a few in a row
												}
											}
										}
									}else{
										msg.channel.send("Reminder not found. It has likely been deleted or already been sent.")
									}
								}else{
									cullReacts(msg, [Client.user.id]);
								}
							}
							else if(embedData.footer.text.match(/Reminders/)) {		//reminderlist
							let numData = embedData.footer.text.match(/(\d+) - (\d+)\/(\d+) for (\d+)/);
							if(numData) {
								let oldStart = numData[1];
								let oldEnd = parseInt(numData[2]);
								let remLength = parseInt(numData[3]);
								let userID = numData[4];
								let reacted = cullReacts(msg, [Client.user.id]);
								if(reacted.includes(userID)) {
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
								if(emittedEmote == tieEmote) {
									breakers = !breakers;
									cullReacts(msg, [Client.user.id])
								}
								let embedBuild = function(thisPage) {return renderGPLeaderBoard(pageCheck[3], breakers, thisPage)};
								turnEmbedPage(msg, pageCheck, embedBuild, update, true);
							}
						}
					}else if(switcherooCache[msg.channel.id] && switcherooCache[msg.channel.id][msg.id]) { //switheroo "embed"
						let searchString = switcherooCache[msg.channel.id][msg.id];
						let grab = 'defaults';
						if(msg.guild && arcanaSettings.hasOwnProperty(msg.guild.id))
							grab = String(msg.guild.id);
						let currentMatch = searchString.match(/([^ ]+) search for/)
						let currentLib = (currentMatch ? currentMatch[1] : "MSEM")
						if(emittedEmote == xEmote) { 	//first check for delete
							msg.delete();
							return;
						}else{							//or do the updates
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
							for(let shape in arcanaSettings[grab]) {
								if(arcanaSettings[grab][shape].data && arcanaSettings[grab][shape].data.name != "ps")
									emoteOrder.push(arcanaSettings[grab][shape].emote)
								if(arcanaSettings[grab][shape].emote == emittedEmote || arcanaSettings[grab][shape].data == library) {
									library = arcanaSettings[grab][shape].data;
									name = shape;
									newPre = arcanaSettings[grab][shape].prefix;
								}
								if(arcanaSettings[grab][shape].data && arcanaSettings[grab][shape].data.bigname == currentLib)
									oldPre = arcanaSettings[grab][shape].prefix;
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
								let embedded = buildCardFetchEmbed(output, arcanaSettings[grab], name, extract[1], searchString, page);//add a snazzy embed
								msg.edit(embedded[0])													//send it off
								cacheImages(msg.channel.id, extract[0], library.name)					//and save the names for card commands
								switcherooCache[msg.channel.id][msg.id] = embedded[1]; 					//update the page number
							}
							cullReacts(msg, [Client.user.id])
						}
					}
				}
			}else{ //LackeyBot assistance commands
				if(msg.channel && selfPins.includes(msg.channel.id) && pinEmotes.includes(emittedEmote) && user.id == msg.author.id) { //self pins
					if(msg.pinned) {
						msg.unpin();
					}else{
						asyncSwapPins(msg, {author:msg.author.id}, 1)
					}
				}
			}
		}catch(e) {
			console.log("Error: Reaction emits.")
			console.log(e);
		}
	}
});
Client.on('messageReactionRemove', async (message, user) => {
	if (message.message.partial) {
		try{
			await message.message.fetch();
		}catch(e){
			console.error('Something went wrong when fetching the message: ', e);
		}
	}
	let removedEmote = message.emoji.name;
	let msg = message.message
	if(msg.channel && selfPins.includes(msg.channel.id) && pinEmotes.includes(removedEmote)) { //self pins
		if(msg.author.id == user.id && msg.pinned)
			msg.unpin();
	}
});
Client.on("ready", () => { //performed when the bot logs in
    console.log("Ready as "+Client.user.username);
	startUpFunctions();
});
Client.on("disconnect", (event) => { //performed when bot disconnects to prevent data loss
	writeDraftData(draft);
});
process.on('unhandledRejection', (reason, p) => { //source unhandledRejections
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
process.on('SIGTERM', function(){ //heroku restarts us every 24-27 hours, make sure we've got everything saved when that happens
	if(!offline) { //possible to get sigterm'd multiple times, only fire it the first
		offline = true;	//stop responding to commands
		queueing = true; //TODO queue up discord commands, we might be able to answer them after reset. need to refactor some to do that.
		logStats();
		if(logLater["reminder"])
			logReminders();
		if(logLater["match"])
			logMatch();
		if(logLater["draft"])
			writeDraftData(draft);
		setInterval(function(){ //while working on async operations, add them to the writing array. async operations won't fire while queueing.
			if(!writing.length)	//recheck once a second, and close the process once we're done.
				process.exit(0)
		}, 1000)
	}
})
Client.login(logintoken);