var reminderData = {}
var config = require('./config/lackeyconfig.js').config;
var admin = config.dev;
var eris = require('./eris.js');
var Client = eris.Client();
var Discord = require('discord.js');
var dbx = require('./boxofmud.js');
var fs = require('fs');
var stats = require('./stats.js');
var version = require('./version.js');
var reminderCell = {};									//holds reminderlists
var toolbox = require('./toolbox.js');
var download = require('download-file');

var { //emote buffet
	yeet, boop,
	azArray, azEmoteArray,
	blank, resetList, leftArrow, rightArrow,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');

function dl() {
	dbx.dropboxDownload('reminderBase.json','https://www.dropbox.com/s/p69q3kvmfu2lvj2/reminderBase.json?dl=0',reloadRemind);
}
function reloadRemind(attachURL) {							//loads reminderBase after downloading
	console.log('Reloading reminderBase');
	setTimeout(function(){ //won't stop firing early, try/catch isn't helping, time for aggressive measures
		try{
			let test = require("./reminderBase.json");
			let list = Object.keys(test.reminders);
			if(test.version < version.versionCheck.remind)
				throw "Version error in reminders.";
			reminderData = test;
		}catch(e){ //firing before it's supposed to? 
			console.log(e);
			version.downloadLoop.reminderBase++
			console.log("reminderBase download failed, reattempt " + version.downloadLoop.reminderBase);
			if(version.downloadLoop.reminderBase < 5){
					dbx.dropboxDownload('reminderBase.json','https://www.dropbox.com/s/p69q3kvmfu2lvj2/reminderBase.json?dl=0',reloadRemind);
					//downloadReminders(attachURL);
			}else{
				eris.pullPing(admin).send("reminderBase failed to reload.");
			}
		}
	},500*(2*version.downloadLoop.reminderBase));
}
function downloadReminders(attachURL) {						//downloads reminderBase after Dropbox betrayed us
	download(attachURL, {directory:"./", filename:"reminderBase.json"}, function(err) {
		if(err) {
			eris.pullPing(admin).send("reminderBase failed to reload.");
		}else{
			reloadRemind(attachURL);
		}
	});
}
function checkReminders() { //check if reminders need to fire, called 1/minute in lackeybot.js
	let refDate = new Date().getTime();
	refDate = Math.trunc(refDate / 60000) * 60000;
	let logFlag = 0;
	for(let remindTime in reminderData.reminders) {
		if(remindTime <= refDate) {
			try{ //potentially could have an array of dates and sort it?
				remindScript(reminderData.reminders[remindTime], refDate, remindTime);
				delete reminderData.reminders[remindTime];
				logFlag = 1;
			}catch(e){console.log(e)}
		}else{
			//break; //things were getting sorted to the end and js wouldn't fix it, so no longer assume its in order sadly
		}
	}
	if(logFlag == 1 || version.logLater['reminder'])
		version.logReminders(reminderData);
	version.logLater['reminder'] = false;
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
		if(ent[ping].message != "") {
			let date = ent[ping].time;
			if(refDate - intendDate > 600000) {
				date += " (and " + toolbox.timeConversion(refDate - intendDate,2) + ")";
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
				eris.pullPing(ent[ping].id).send(aReminder, remEmbed)
					.then(mess => reminderEmotes(mess))
					.catch(e => console.log(e))
			}
			stats.remDone(1);
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
		if(reminderData.reminders[time]) {
			slot = Object.keys(reminderData.reminders[time]).length;
		}else{
			reminderData.reminders[time] = {};
		}
		reminderData.reminders[time][slot] = {};
		reminderData.reminders[time][slot].channel = sendChannel;
		reminderData.reminders[time][slot].id = id;
		reminderData.reminders[time][slot].message = message;
		reminderData.reminders[time][slot].time = date;
		if(eventFlag)
			reminderData.reminders[time][slot].event = true;
		sortReminders();
		version.logReminders(reminderData);
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
	if(!reminderData.reminders.hasOwnProperty(time) || !reminderData.reminders[time].hasOwnProperty(slot))
		return "Invalid reminder slot data.";
	let thisReminder = reminderData.reminders[time][slot];
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
		let dateDiff = toolbox.timeConversion(remindData.time - now.getTime(), 1)
		remindAdder(thisReminder.channel, thisReminder.id, thisReminder.message, dateDiff, remindData.time, thisReminder.channel, thisReminder.hasOwnProperty('event'))
		delete reminderData.reminders[time][slot];
	}else{
		version.logReminders(reminderData);
	}
	return "Reminder updated";
}
function buildReminderListEmbed(userID,startFrom,embedFlag){//builds the reminderlist and if necessary its page turner embed
	let i = 0;
	reminderCell[userID] = {};
	reminderCell[userID][0] = {};
	for(let remindTime in reminderData.reminders) {
		for(let ent in reminderData.reminders[remindTime]) {
			if(reminderData.reminders[remindTime][ent].message != "" && (reminderData.reminders[remindTime][ent].id == userID || (reminderData.reminders[remindTime][ent].hasOwnProperty('cc') && reminderData.reminders[remindTime][ent].cc.includes(userID)))) {
				reminderCell[userID][i] = {};
				reminderCell[userID][i].message = reminderData.reminders[remindTime][ent].message;
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
			let testEnt = i + " — " + toolbox.timeConversion(reminderCell[userID][i].time - currenttime, 1) + " from now: " + reminderCell[userID][i].message + "\n";
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
		stats.upBribes(1);
		return [reminderPost, embedded];
	}
}
function hookShift(currentTime, newTime){					//shifts when a $reminder event fires
	let i = 0, delArray = [];
	if(reminderData.reminders.hasOwnProperty(newTime)) {
		i = Object.keys(reminderData.reminders[newTime]).length;
	}else{
		reminderData.reminders[newTime] = {};
	}
	for(let remind in reminderData.reminders[currentTime]){
		let thisReminder = reminderData.reminders[currentTime][remind];
		if(thisReminder.hasOwnProperty('event')) { //skip non hook reminds that managed to get in here
			reminderData.reminders[newTime][i] = thisReminder;
			reminderData.reminders[newTime][i].event = true;
			i++;
			delArray.push(remind);
		}
	}
	for(let remind in delArray)
		delete reminderData.reminders[currentTime][delArray[remind]];
	if(Object.keys(reminderData.reminders[currentTime]).length == 0)
		delete reminderData.reminders[currentTime];
	sortReminders();
	version.logReminders(reminderData);
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
	let timesArray = Object.keys(reminderData.reminders);
	timesArray.sort(function(a, b){return a-b});
	let tempreminders = {};
	for(let time in timesArray) {
		tempreminders[timesArray[time]] = reminderData.reminders[timesArray[time]];
	}
	reminderData.reminders = tempreminders;
}
function reformatroleDex() {								//currently blank, for reformatting roles.json
	version.logRole();
}
function addEventTags(timestamp){							//event reminders don't have snooze, this retroactively adds that
	if(!reminderData.reminders[timestamp])
		return "No reminders for that time.";
	let thisTime = reminderData.reminders[timestamp];
	for(let entry in thisTime) {
		thisTime[entry].event = true;
	}
	version.logLater['reminder'] = true;
	return "Reminders evented.";
}
function addCC(remTime, remSlot, user, msg) {				//handle CC embeds
	if(reminderData.reminders[remTime][remSlot]) {
		if(!reminderData.reminders[remTime][remSlot].hasOwnProperty('cc')) //add a CC if we don't have it yet
			reminderData.reminders[remTime][remSlot].cc = [];
		let addMess = "";
		if(!reminderData.reminders[remTime][remSlot].cc.includes(user.id)) {
			reminderData.reminders[remTime][remSlot].cc.push(user.id);
			msg.channel.send(user.username + " added to reminer"); //let them know they've been added
			version.logLater['reminder'] = true; //set the reminder to log later because there will probably be a few in a row
		}
	}else{
		msg.channel.send("Reminder not found. It has likely been deleted or already been sent.")
	}
}

function messageHandler(msg, perms) {
	if(perms.includes(0)) {
		if(msg.content.match(/!remindEdit/i))
			msg.channel.send(parseReminderEdit(realContent));
		if(msg.content.match(/!hookshift/i)){
			let times = msg.content.match(/!hookshift (\d+) (\d+)/i)
			hookShift(times[1], times[2]);
		}
		let eventAdd = msg.content.match(/!addevent ([0-9]+)/);
		if(eventAdd){
			msg.content.send(addEventTags(eventAdd[1]));
		}
		if(msg.content.match("!mindgap")) { //gets time until next reminder
			let nextTime = Object.keys(reminderData.reminders)[0];
			let nowTime = new Date().getTime();
			msg.channel.send(toolbox.timeConversion(nextTime - nowTime,2));
		}
	}
	//reminder engine
	var remindMatch = msg.content.match(/(?:\$|!|<@!?341937757536387072> )remindm?e?r? (?:<#([0-9]+)> )?([0-9\.]+) ?(second|s|minute|min|hour|hr?|day|week|wk?|month|m|year|yr|decade|d)s? ?([\s\S]*)/i);
	if(remindMatch) {
		version.startWriting("reminder")
		stats.upBribes(1);
		stats.remSet(1);
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
				thisMessage = thisMessage.replace(pingCheck[i],eris.pullUsername(pingMatch[1]));
			}
		}
		if(msg.author.id != config.dev)
			thisMessage = thisMessage.replace(/@everyone/g, "why would you do this")
		if(distance == "second" && wholeNumber < 60) {
			let temp = "Reminder set for " + wholeNumber + " seconds from now."
			msg.channel.send(temp.replace("for 1 seconds","for 1 second"));
			version.doneWriting("reminder")
			setTimeout(function(){
				thisMessage = wholeNumber + " seconds ago <@" + msg.author.id + "> set a reminder: " + thisMessage;
				msg.channel.send(thisMessage.replace(/^1 seconds ago/,"1 second ago"));
				stats.remDone(1);
			}, wholeNumber * 1000);
		}
		else{
			if(distance == "decade") {
				msg.react("👀");
			}
			let pingTime = toolbox.setTimeDistance(number, distance);
			remindAdder(thisChannel, thisID, thisMessage, number + " " + distance, pingTime.getTime(), sendChannel);
		}
	}else if(msg.content.match(/\$remind/)){
		let hooks = { //to do, json-ify this
		/*	MSEM: {
				time: new Date('Thu, 15 October 2020 10:00:00 EST'),
				match: ["MSEM"],
				message: "`MSEM`, for the MSEM release announcement on October 15"
			},*/
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
					version.startWriting("reminder")
					stats.upBribes(1);
					stats.remSet(1);
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
							thisMessage = thisMessage.replace(pingCheck[i],eris.pullUsername(pingMatch[1]));
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
			let thisReminder = reminderData.reminders[reminderCell[userID][remdelmatch[1]].time][reminderCell[userID][remdelmatch[1]].index]
			if(thisReminder.id == userID) { //if you set this reminder, scrub your id
				thisReminder.id = "";
				if(!thisReminder.hasOwnProperty('cc') || thisReminder.cc.length == 0) { //if this reminder doesn't have a CC, just delete it
					thisReminder.message = "";
					msg.channel.send("Reminder deleted.");
					stats.remDone(1);
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
			stats.upBribes(1);
			let cullFlag = 1;
			for(let ent in reminderData.reminders[reminderCell[userID][remdelmatch[1]].time]) {
				if(reminderData.reminders[reminderCell[userID][remdelmatch[1]].time][ent].message != "")
					cullFlag = 0;
			}
			if(cullFlag == 1)
				delete reminderData.reminders[reminderCell[userID][remdelmatch[1]].time]
			version.logReminders(reminderData);
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
			let thisMessage = reminderData.reminders[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].message;
			let thisID = reminderData.reminders[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].id;
			let thisChannel = reminderData.reminders[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].channel;
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
			reminderData.reminders[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].message = "";
			reminderData.reminders[reminderCell[userID][remchangematch[2]].time][reminderCell[userID][remchangematch[2]].index].id = "";
			stats.upBribes(1);
			let cullFlag = 1;
			for(let ent in reminderData.reminders[reminderCell[userID][remchangematch[2]].time]) {
				if(reminderData.reminders[reminderCell[userID][remchangematch[2]].time][ent].message != "")
					cullFlag = 0;
			}
			if(cullFlag == 1)
				delete reminderData.reminders[reminderCell[userID][remchangematch[2]].time]
			version.logReminders(reminderData);
		}
	}
}
function helpMessage() {
	let helpout = "**Reminder Help**\n";
	helpout += "`$remind X time` to set a reminder for X time, with the rest of the message being used as the reminder.\n";
	helpout += "Accepts seconds/s, minutes/min/m, hours/hr/h, days/d, weeks/wk/w, year.\n";
	helpout += "When LackeyBot sends your reminder, you can snooze the reminder for an hour, a day, a week, or the same amount of time by reacting to its message.\n";
	helpout += "When a reminder is set in a public channel, LackeyBot will react with a star. Anyone else who reacts with that star will be added to the reminder.\n";
	helpout += "`$reminderlist` to see a list of your current reminders.\n";
	helpout += "`$reminderdelete N` to delete the chosen reminder. Numbers from the reminderlist remain the same until you call it again or set a new reminder.\n";
	helpout += "`$remind event` for a list of active reminder events.\n";
	helpout += "Setting a reminder using those keys in place of the time will fire those reminders at the specified event.\n";
	return helpout;
}
exports.remindAdder = remindAdder;
exports.checkReminders = checkReminders;
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.addCC = addCC;
exports.buildReminderListEmbed = buildReminderListEmbed;
exports.dl = dl;
exports.sendDex = function() {
	return reminderData;
}