/* Eris
 handles Discord-y things
*/
var config = require('./config/lackeyconfig.js').config;
var convars = config.variables;
var Discord = require('discord.js');
var DiscordClient = new Discord.Client({ partials:['MESSAGE', 'REACTION'] });
let logintoken = config.test.token
if(config.login)
	logintoken = config.login.token
DiscordClient.login(logintoken);						//log into discord
var {leftArrow, rightArrow} = require('./emoteBuffet.js');

function pullUsername(id) {									//gets user's username, or PlayerUnknown if error
	try{
		let name = DiscordClient.users.cache.get(id).username;
		if(name == undefined)
			throw ""
		return name;
	}catch(e){
		if(id.match(/[^0-9]/)) { //draftbot
			return id;
		}
		return "PlayerUnknown";
	}
}
function pullPing(id) {										//gets user's ping, or PlayerUnknown if error
	try{
		let ping = DiscordClient.users.cache.get(id);
		if(ping == undefined)
			throw ""
		return ping;
	}catch(e){
		let playerUnknown = {
			username: "PlayerUnknown",
			send: function(words) {
				//console.log(words + ' were spoken into the void.');
			}
		};
		return playerUnknown;
	}
}
function pullGuild(id) {									//gets user's ping, or PlayerUnknown if error
	try{
		let ping = DiscordClient.guilds.cache.get;
		if(ping == undefined)
			throw ""
		return ping;
	}catch(e){
		let guildUnknown = {
			username: "PlayerUnknown",
			send: function(words) {
				//console.log(words + ' were spoken into the void.');
			}
		};
		return playerUnknown;
	}
}
function reactLRArrows(msg) { 								//callback that adds the left/right arrow reacts
	msg.react(leftArrow)
		.then(msg.react(rightArrow))
}

var {MessageEmbed} = require('discord.js');
var { //emote buffet
	yeet, boop,
	azArray, azEmoteArray,
	blank, resetList, leftArrow, rightArrow, upArrow, downArrow,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote, forwardArrow, backwardArrow,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');
/*
	emit = {
		message: {},
		user: {}
	}
	coordData = {
		xHere: 0, yHere: 0, zHere: 0,
		xEdge: 0, yEdge: 0, zEdge: 0,
		resetCoord: [0,0,0] or false
	}
*/
//embedTech
function cullReacts (msg, legalIDs) {						//removes reactions from everyone not in legalIDs
	if(msg.channel.type == 'dm')
		return [];
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
function buildGeneralEmbed(array, header, page, perPage, textFlag) {						//converts an array into a basic paginated embed
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
function turnEmbedPage(emit, pageCheck, embedBuild, update, textFlag, altIndex, newPost) {	//moves to the left or right page of a 1d embed, can probably be simplified
	let msg = emit.message.message;			//message that turned the page
	let user = emit.user;					//user that reacted
	let emote = emit.message._emoji.name;	//emote they reacted with
	let removeThisReact = function() {		//function to remove the react
		if(emit.message.message.channel.type != "dm")
			emit.message._emoji.reaction.users.remove(user)
	}
	let thisPage = parseInt(pageCheck[1]);	//the current page
	let lastPage = parseInt(pageCheck[2]);	//the maximum pages
	if(!altIndex){							//if this embed uses a zero index
		thisPage--;							//decrement pages
		lastPage--;
	}

	if(emote == rightArrow || emote == downArrow) {		//next page on > or V
		thisPage++;
		if(thisPage > lastPage)							//roll over to zero
			thisPage = 0;
		removeThisReact();								//remove the react
	}else if(emote == leftArrow || emote == upArrow) {	//previous page on < or ^
		thisPage -= 1;
		if(thisPage < 0)
			thisPage = lastPage;						//roll over to last page
		removeThisReact();
	}else if(emote == resetList) {						//reset to page 1
		thisPage = 0;
		removeThisReact();
	}

	if(altIndex && thisPage == 0)			//move to differet index
		thisPage = altIndex;
	//rebuild the embed with the given function on the new page
	let embedData = embedBuild(thisPage);	//return {embed} or [msg content, {embed}] on plainText
	let outPost = "", outEmbed = embedData;	//message content, embed
	if(textFlag) {
		outPost = embedData[0];
		outEmbed = embedData[1];
	}
	if(newPost != undefined) {			//is this a new post?
		msg.channel.send(embedData[0],outEmbed)
			.then(mess => newPost(mess))//new post with newPost callback
			.catch()
	}else{
		msg.edit(embedData[0],outEmbed)//else edit the original post
	}
}
function navigateEmbed(emit, coordData, embedBuild, edgeBehavior, textFlag, altIndex, newPost) {	//moves to the left or right page of a 1d embed, can probably be simplified
	let msg = emit.message.message;			//message that moved the embed
	let user = emit.user;					//user that reacted
	let emote = emit.message._emoji.name;	//emote they reacted with
	let removeThisReact = function() {		//function to remove the react
		if(emit.message.message.channel.type != "dm")
			emit.message._emoji.reaction.users.remove(user)
	}
	let threeD = false;
	let coords = [coordData.xHere, coordData.yHere, coordData.zHere];
	let edges = [coordData.xEdge, coordData.yEdge, coordData.zEdge];
	let boops = [false, false, false];		//track if they run into a wall
	let incs = [rightArrow, upArrow, backwardArrow];
	let decs = [leftArrow, downArrow, forwardArrow];
	if(incs.includes(emote)) {
		let ind = incs.indexOf(emote);
		coords[ind]++;
		if(coords[ind] > edges[ind]) {
			switch(edgeBehavior) {
				case "rollover":
					coords[ind] = 0;
					break;
				case "wall":
					coords[ind]--;
					boops[ind] = true;
			}
		}
		removeThisReact();
	}
	else if(decs.includes(emote)) {
		let ind = incs.indexOf(emote);
		coords[ind]--;
		if(coords[ind] < 0) {
			switch(edgeBehavior) {
				case "rollover":
					coords[ind] = edges[ind];
					break;
				case "wall":
					coords[ind]++;
					boops[ind] = true;
			}
		}
		removeThisReact();
	}
	else if(emote == resetList && coordData.resetCoord) {
		coords = coordData.resetCoord;
	}
	//rebuild the embed with the given function on the new page
	let embedData = embedBuild(coords, boops);	//return {embed} or [msg content, {embed}] on plainText
	let outPost = "", outEmbed = embedData;	//message content, embed
	if(textFlag) {
		outPost = embedData[0];
		outEmbed = embedData[1];
	}
	if(newPost != undefined) {			//is this a new post?
		msg.channel.send(embedData[0],deadEmbed)
			.then(mess => newPost(mess))//new post with newPost callback
			.catch()
	}else{
		msg.edit(embedData[0],deadEmbed)//else edit the original post
	}
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

exports.MessageEmbed = MessageEmbed;
exports.turnEmbedPage = turnEmbedPage;
exports.navigateEmbed = navigateEmbed;
exports.buildGeneralEmbed = buildGeneralEmbed;
exports.pullPing = pullPing;
exports.pullUsername = pullUsername;
exports.pullGuild = pullGuild;
exports.reactLRArrows = reactLRArrows;

exports.Client = function() {
	return DiscordClient;
}