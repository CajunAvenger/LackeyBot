/* Help
 build help commands by pulling help functions across modules
*/
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
var eris = require('./eris.js');
var stats = require('./stats.js');
var cardShark = require('./cardShark.js');
var devDex = require('./devDex.js');
var dysnomia = require('./dysnomia.js');
var draftDexScripts = require('./draftDexScripts.js');
var games = require('./games.js');
var matchDexScripts = require('./matchDex.js');
var quoteDex = require('./quotedex.js');
var reminderDex = require('./remindScripts.js');
var roleDex = require('./roleDexScripts.js');
var scratchPad = require('./scratchPad.js');

function helpMessage() {
	let helpout = "**LackeyBot Help**\n";
	helpout = "Call cards with double brackets, and add setcodes to narrow your search, like <<Dissipate_ISD>>.";
	helpout += " LackeyBot is good at partial words as long as letters are in the right order.\n";
	helpout += `React ${old_mag} to show card images and ${old_ruler} for card rulings for the fetched cards.\n`;
	helpout += "\nSend `$help topic` for more help on a specific topic.\n"
	helpout += "**cards**: more info on card commands.\n";
	//helpout += "**config**: more info on configuring LackeyBot for your server.\n";
	helpout += "**devDex**: info on the uploadable database.\n";
	helpout += "**discord**: info on discord commands.\n";
	helpout += "**draft**: info on discord drafting.\n";
	helpout += "**games**: info on game commands.\n";
	helpout += "**match**: info on matchmaking commands.\n";
	helpout += "**quotes**: info on quote commands.\n";
	helpout += "**reminder**: info on reminder commands.\n";
	helpout += "**role**: info on role commands.\n";
	helpout += "**scratchpad**: info on scratchpad commands.\n";
	return helpout;
}

function messageHandler(msg, perms) {
	let helpMatch = msg.content.match(/\$help ?([^\n]+)?/i);
	if(helpMatch){ //help commands
		stats.upBribes(1);
		let topic = "help";
		if(helpMatch[1])
			topic = helpMatch[1].toLowerCase();
		let output = "";
		if(topic.match(/card/i)) {
			output = cardShark.helpMessage(msg.author.id);
		}else if(topic.match(/devDex|proect|uploadable/i)) {
			output = devDex.helpMessage();
		}else if(topic.match(/discord|dysnomia/i)) {
			output = dysnomia.helpMessage();
		}else if(topic.match(/draft/i)) {
			output = draftDexScripts.helpMessage(draftDexScripts.focusedDraft(msg.author.id));
		}else if(topic.match(/game/i)) {
			output = games.helpMessage();
		}else if(topic.match(/match/i)) {
			output = matchDexScripts.helpMessage();
		}else if(topic.match(/quote/i)) {
			output = quoteDex.helpMessage();
		}else if(topic.match(/remind/i)) {
			output = reminderDex.helpMessage();
		}else if(topic.match(/role/i)) {
			output = roleDex.helpMessage();
		}else if(topic.match(/scratchPad/i)) {
			output = scratchPad.helpMessage();
		}else{
			output = helpMessage();
		}
		msg.channel.send(output);
	}
}

exports.messageHandler = messageHandler;