/*
	disasterBoard
*/
var scratchPad = {}
var eris = require('./eris.js');
var Client = eris.Client;
var dbx = require('./boxofmud.js');
var fs = require('fs');
var version = require('./version.js');
var stats = require('./stats.js');
const toolbox = require('./toolbox.js');


function dl() {
	dbx.dropboxDownload('scratchPad.json','/lackeybot stuff/scratchPad.json',reloadScratchpad);
}
function reloadScratchpad() {								//loads the scratchpad
	console.log('Reloading scratchPad');
	scratchPad = require('./scratchPad.json');
	updateDisasterMatch();
}

//Disasters
var disasterNames = "(example)";
var disasterMatch = /\$days?(since|0|delete) (example)/i
function buildDisasterNames() {								//build regex, short names last
	let disArray = Object.keys(scratchPad.disasters)
	disArray.sort(function(a, b) {
		return b.length-a.length;
	})
	let regString = "";
	for(let a in disArray)
		regString += disArray[a] + "|";
	regString = regString.replace(/\|$/, ")");
	if(regString != "")
		regString = "(" + regString;
	return regString;
}
function updateDisasterMatch(){								//update regex
	disasterNames = buildDisasterNames();
	disasterMatch = new RegExp('\\$days?(since|0|delete) ' + disasterNames, 'i')
}
function newDisaster(user, name, mess, daysSince) {			//new disaster with $daysset
	if(scratchPad.disasters[name])
		return ["That name is already in use.",0];
	let now = new Date().getTime();
	let disaster = {
		owner: user,
		name: name,
		date: now,
		mess: mess
	}
	if(daysSince)
		disaster.date = toolbox.setTimeDistance(daysSince, "days", "past").getTime();
	scratchPad.disasters[name] = disaster;
	updateDisasterMatch();
	return ["Disaster added.",1];
}
function deleteDisaster(user, name) {						//end disaster with $daysdelete
	if(!scratchPad.disasters[name])
		return ["Disaster not found.",0]
	if(scratchPad.disasters[name].owner != user)
		return ["You don't own that disaster.",0];
	delete scratchPad.disasters[name];
	return ["Disaster averted.", 1];
}
function daysDisaster(name) {								//returns X days or X hours since
	let dis = scratchPad.disasters[name];
	let diff = toolbox.timeSince(dis.date);
	let days = toolbox.timeConversion(diff, 1, ["day", "hour"]);
	return days;
}
function checkDisaster(name) {								//check disaster with $dayssince
	return [`It has been **${daysDisaster(name)}** since ${scratchPad.disasters[name].mess}.`,0];
}
function zeroDisaster(user, name) {							//fire disaster with $days0
	let dis = scratchPad.disasters[name];
	if(dis.owner == user) {
		let days = daysDisaster(name);
		days = days.replace(/(\d+)/, "~~$1~~ **0**")
		dis.date = new Date().getTime();
		return [`It has been ${days} since ${scratchPad.disasters[name].mess}.`,1];
	}
}

function messageHandler(msg, perms) {
	let disastersMatch = msg.content.match(disasterMatch);
	if(disastersMatch && disastersMatch[1]) {
		stats.upBribes(1);
		let command = disastersMatch[1];
		let name = disastersMatch[2];
		let output;
		switch(command.toLowerCase()) {
			case "delete": //delete a disaster
				output = deleteDisaster(msg.author.id, name)
				break;
			case "since": //check a disaster
				output = checkDisaster(name)
				break;
			case "0": //fire a disaster
				output = zeroDisaster(msg.author.id, name)
				break;
		}
		if(output) {
			msg.channel.send(output[0]);
			if(output[1])
				version.logScratchpad(scratchPad);
		}
	}
	let newDisMatch = msg.content.match(/\$days?set ([^ ]+) *(\d+ days?)?\n([^\n]{1,100})/)
	if(newDisMatch) {
		stats.upBribes(1);
		let name = newDisMatch[1];
		let mess = newDisMatch[3];
		let time;
		if(newDisMatch[2])
			time = newDisMatch[2].match(/(\d+)/)[1];
		let output = newDisaster(msg.author.id, name, mess, time);
		msg.channel.send(output[0]);
		if(output[1])
			version.logScratchpad(scratchPad);
	}

}
function helpMessage() {
	let helpout = "**Scratchpad Help**\n";
	helpout += "Scratchpad is used for lightweight and semi-permanent user data.\n";
	helpout += "Currently Scratchpad only has one feature:\n";
	helpout += "__Disaster Board__\nYou can set a date and have LackeyBot track how many days its been since, ie '5 days since <disaster> happened.'\n";
	helpout += "Use the following command to set a disaster. You can remove the 'X days' part to set the date to today instead of X days ago:\n";
	helpout += "`$daysset name X days\nmessage text`\n";
	helpout += "Once set, anyone can use `$dayssince name` to get 'It has been {# days} since {message text}.'\n";
	helpout += "Once set, the owner can use `$days0 name` to change the date to today and get 'It has been ~~{# days}~~ 0 days since {message text}.'\n";
	helpout += "The owner can also delete the disaster with `$daysdelete name`.\n";
	return helpout;
}

exports.dl = dl;
exports.scratchPad = scratchPad;
exports.newDisaster = newDisaster;
exports.deleteDisaster = deleteDisaster;
exports.checkDisaster = checkDisaster;
exports.zeroDisaster = zeroDisaster;
exports.disasterMatch = disasterMatch;
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;