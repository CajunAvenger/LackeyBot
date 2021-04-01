var config = require('./config/lackeyconfig.js').config;
var eris = require('./eris.js');
var Discord = require('discord.js');
var Client = eris.Client();
var admin = config.dev;
var fs = require('fs');
var version = require('./version.js');
const toolbox = require('./toolbox.js');
var statNumbers = {cardCount:0, bribes:0, drafts:0, packs:0, reminderSet:0, reminderDone:0, explosions:0}


async function reloadStats() {								//loads stats after downloading
	console.log('Reloading stats');
	try {
		let sp = await Client.channels.cache.get(config.versionControlChannel).messages.fetch("747541293219184700")
		sp = sp.content;
		statNumbers.cardCount += parseInt(sp.match(/cards: (\d+)/)[1]);
		statNumbers.bribes += parseInt(sp.match(/bribes: (\d+)/)[1]);
		statNumbers.drafts += parseInt(sp.match(/drafts: (\d+)/)[1]);
		statNumbers.packs += parseInt(sp.match(/packs: (\d+)/)[1]);
		statNumbers.reminderSet += parseInt(sp.match(/reminder1: (\d+)/)[1]);
		statNumbers.reminderDone += parseInt(sp.match(/reminder2: (\d+)/)[1]);
		statNumbers.explosions += parseInt(sp.match(/explode: (\d+)/)[1]);
	}catch(e){
		console.log(e)
		eris.pullPing(admin).send("Stats version control has failed.");
	}
}
function statUpdate(msg) {									//updates the stats live
	if(!statNumbers.hasOwnProperty('cardCount')){
		msg.author.send("LackeyBot has just restarted and has not reloaded the stats database yet. Please wait a moment and retry the command.");
		return;
	}
	let countCheck = msg.content.match(/count: ?([0-9]+)/i);
	let bribeCheck = msg.content.match(/bribes: ?([0-9]+)/i);
	let boomCheck = msg.content.match(/explo(?:de|sions): ?([0-9]+)/i);
	let draftCheck = msg.content.match(/drafts: ?([0-9]+)/i);
	let packCheck = msg.content.match(/packs: ?([0-9]+)/i);
	let patchCheck = msg.content.match(/patch: ?([^\n]+)/i);
	let deadlineCheck = msg.content.match(/deadline: ?([^\n]+)/i);
	let releaseCheck = msg.content.match(/release: ?([^\n]+)/i);
	if(countCheck !== null)
		statNumbers.cardCount = parseInt(countCheck[1]);
	if(bribeCheck !== null)
		statNumbers.bribes = parseInt(bribeCheck[1]);
	if(boomCheck !== null)
		statNumbers.explosions = parseInt(boomCheck[1]);
	if(draftCheck !== null)
		statNumbers.drafts = parseInt(draftCheck[1]);
	if(packCheck !== null)
		statNumbers.packs = parseInt(packCheck[1]);
	if(patchCheck !== null)
		statNumbers.patchLink = patchCheck[1];
	if(deadlineCheck !== null) {
		statNumbers.subDead = deadlineCheck[1];
		msg.channel.send("Deadline changed to " + statNumbers.subDead + "/" + deadlineCheck[1]);
	}
	if(releaseCheck !== null)
		statNumbers.subRelease = releaseCheck[1];
	version.logStats(statNumbers);
	msg.channel.send("Stats updated.");
}
exports.dl = reloadStats;
exports.stats = function() {
	return statNumbers;
};
exports.upBribes = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.bribes += num;
}
exports.upCards = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.cardCount += num;
}
exports.upDrafts = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.drafts += num;
}
exports.upPacks = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.packs += num;
}
exports.remSet = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.reminderSet += num;
}
exports.remDone = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.reminderDone += num;
}
exports.upExplode = function(num) {
	if(!num && num !== 0)
		num = 1;
	statNumbers.explosions += num;
}
