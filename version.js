/* Version
 handles version control
*/

var config = require('./config/lackeyconfig.js').config;
var admin = config.dev;
var login = config.login;
var offline = config.offline;
var eris = require('./eris.js');
var Client = eris.Client();
var dbx = require('./boxofmud.js');
var toolbox = require('./toolbox.js');
var fs = require('fs');
var botname = config.test.botname;
if(config.login)
	botname = config.login.botname
let downloadLoop = {devDex: 0, reminderBase: 0};

var writing = [];
var versionCheck = {stats:0, remind:0, roles:0, gpbase:0, matchDex:0, devDex:0, draft:0};

var logLater = { //some files may be updated several times very quickly, save and log later instead of logging multiple times
	'reminder': false,
	'match': false,
	'draft': false
}
function startWriting(op) {									//tracks which sensitive operations are occuring
	return writing.push(op);
}
function doneWriting(op) {									//tracks which sensitive operations are occuring
	return writing.splice(writing.indexOf(op), 1);
}
function editVersions() {									//version control post
	if(botname == "TestBot" || offline)
		return;
	/*readVersionControl();
	if(reminderData.verions === undefined)
		reminderData.versions = versionCheck.remind;
	if(matchDex.verions === undefined)
		matchDex.versions = versionCheck.matchDex;
	if(allRoles.verions === undefined)
		allRoles.versions = versionCheck.allRoles;
	if(gpbase.verions === undefined)
		gpbase.versions = versionCheck.gpbase;
	if(draftDex.verions === undefined)
		draftDex.versions = versionCheck.draftDex;
	if(devDex.verions === undefined)
		devDex.versions = versionCheck.devDex;
	if(reminderData.version === undefined || matchDex.version === undefined || allRoles.version === undefined || gpbase.version === undefined || draftDex.version === undefined || (devDex.version === undefined && versionCheck.devDex === undefined)){
		eris.pullPing(admin).send("Version control is seriously effed.")
		eris.pullPing(admin).send(JSON.stringify(versionCheck))
		return;
	}*/
	let newwords = "";
	newwords += "\nremind: " + versionCheck.remind;
	newwords += "\nmatchDex: " + versionCheck.matchDex;
	newwords += "\ndevDex: " + versionCheck.devDex;
	newwords += "\nroles: " + versionCheck.roles;
	newwords += "\ngpbase: " + versionCheck.gpbase;
	newwords += "\ndraft: " + versionCheck.draft;
	editMsg(config.versionControlChannel, config.versionControlPost, newwords);
}
function editMsg(channel,message,newwords) {				//edits a given LackeyBot post
	Client.channels.cache.get(channel).messages.fetch(message)
		.then(msg => msg.edit(newwords))
		.catch(console.error);
}
async function readVersionControl(){					//read versions from Discord
	let vc = await Client.channels.cache.get(config.versionControlChannel).messages.fetch(config.versionControlPost)
	vc = vc.content;
	versionCheck.remind = parseInt(vc.match(/remind: (\d+)/)[1]);
	versionCheck.matchDex = parseInt(vc.match(/matchDex: (\d+)/)[1]);
	versionCheck.devDex = parseInt(vc.match(/devDex: (\d+)/)[1]);
	versionCheck.roles = parseInt(vc.match(/roles: (\d+)/)[1]);
	versionCheck.gpbase = parseInt(vc.match(/gpbase: (\d+)/)[1]);
	versionCheck.draftDex = parseInt(vc.match(/drafts?: (\d+)/)[1]);
	return "Done";
}
async function loadEmUp() {
	try {
		let wait = await readVersionControl();
	}catch(e){
		console.log(e);
		eris.pullPing(admin).send("Version control has failed.");
	}
}
function writingArray() {
	return writing;
}

function logStats(stats) {									//updates stats.json
	if(botname == "TestBot")
		return;
	startWriting("stats");
	let statPost = "";
	statPost += "cards: " + stats.cardCount;
	statPost += "\nbribes: " + stats.bribes;
	statPost += "\ndrafts: " + stats.drafts;
	statPost += "\npacks: " + stats.packs;
	statPost += "\nreminder1: " + stats.reminderSet;
	statPost += "\nreminder2: " + stats.reminderDone;
	statPost += "\nexplode: " + stats.explosions;
	if(!stats.cardCount || !stats.bribes || !stats.drafts || !stats.packs || !stats.reminderSet || !stats.reminderDone || !stats.explosions) {
		eris.pullPing(admin).send("stats have nulled");
	}else{
		editMsg(config.versionControlChannel, "747541293219184700", statPost);
	}
	Client.channels.cache.get(login.stats).send(statPost);
	doneWriting("stats");
}
function logReminders(reminderData) {						//updates reminderlist.json
	if(botname == "TestBot")
		return;
	reminderData.version++;
	versionCheck.remind = reminderData.version;
	editVersions();
	let words = JSON.stringify(reminderData);
	dbx.dropboxUpload('/lackeybot stuff/reminderBase.json', words, function(){doneWriting("reminder")});
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
function logMatch(matchDex) {								//updates matchDex.json
	if(botname == "TestBot")
		return;
	matchDex.version++;
	versionCheck.matchDex = matchDex.version;
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
		dbx.dropboxUpload('/lackeybot stuff/matchDex.json',matchWords, function(){doneWriting("match")});
	}
}
function logDev(devDex, id) {								//updates devDex.json
	console.log("Change to project database by " + eris.pullUsername(id));
	devDex.version++;
	versionCheck.devDex = devDex.version;
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
	//loadArcanaSettings();
	dbx.dropboxUpload('/lackeybot stuff/devDex.json',JSON.stringify(partialDex).replace(/},"/g,"},\r\n\""), function(){doneWriting("dev")});
}
function logRole(allRoles, guildID) {						//updates roles.json
	allRoles.version++;
	versionCheck.roles = allRoles.version;
	for(let guild in allRoles.guilds)
		if(!allRoles.guilds[guild].hasOwnProperty('excluded'))
			allRoles.guilds[guild].excluded = {};
	editVersions();
	dbx.dropboxUpload('/lackeybot stuff/roles.json',JSON.stringify(allRoles), function(){doneWriting("role")});
}
function logScratchpad(scratchPad) {						//updates scratchPad.json
	dbx.dropboxUpload('/lackeybot stuff/scratchPad.json',JSON.stringify(scratchPad, null, 3), function(){doneWriting("scratchPad")});
}
function logDraft(draftDex) {								//updates draftDex.json
	draftDex.version++;
	versionCheck.draft = draftDex.version;
	editVersions();
	//prettify for now, probably do a basic JSON.stringify once we're sure this is solid
	let fulltext = ""
	fulltext += `{`;
	fulltext += `\n\t"version":${draftDex.version},`;
	fulltext += `\n\t"ticker":${draftDex.ticker},`;
	fulltext += `\n\t"drafts":{`;
	//drafts
	for(let d in draftDex.drafts) {
		fulltext += `\n\t\t"${d}":{`
		//details
		fulltext += `\n\t\t\t"owner":"${draftDex.drafts[d].owner}",`
		fulltext += `\n\t\t\t"name":"${draftDex.drafts[d].name}",`
		fulltext += `\n\t\t\t"status":"${draftDex.drafts[d].status}",`
		fulltext += `\n\t\t\t"libraries":${JSON.stringify(draftDex.drafts[d].libraries)},`
		fulltext += `\n\t\t\t"empty":"${draftDex.drafts[d].empty}",`
		fulltext += `\n\t\t\t"roundArray":${JSON.stringify(draftDex.drafts[d].roundArray)},`
		fulltext += `\n\t\t\t"playerIDs":${JSON.stringify(draftDex.drafts[d].playerIDs)},`
		fulltext += `\n\t\t\t"botIDs":${JSON.stringify(draftDex.drafts[d].botIDs)},`
		fulltext += `\n\t\t\t"players":{`
		//players
		for(let p in draftDex.drafts[d].players)
			fulltext += `\n\t\t\t\t"${p}":${JSON.stringify(draftDex.drafts[d].players[p])},`
		fulltext = fulltext.replace(/,$/, "");
		fulltext += `\n\t\t\t},`
		fulltext += `\n\t\t\t"packs":[`
		//packs
		for(let p in draftDex.drafts[d].packs)
			fulltext += `\n\t\t\t\t${JSON.stringify(draftDex.drafts[d].packs[p])},`
		fulltext = fulltext.replace(/,$/, "");
		fulltext += `\n\t\t\t]`
		fulltext += `\n\t\t},`
	}
	fulltext = fulltext.replace(/,$/, "");
	fulltext += `\n\t},`;
	fulltext += `\n\t"players":{`;
	//players
	for(let p in draftDex.players)
		fulltext += `\n\t\t"${p}":${JSON.stringify(draftDex.players[p])},`
	fulltext = fulltext.replace(/,$/, "");
	fulltext += `\n\t}`;
	fulltext += `\n}`;
	dbx.dropboxUpload('/lackeybot stuff/draftDex.json',fulltext);
}
function writeVersion(name, v) {
	versionCheck[name] = v;
}

exports.logLater = logLater;
exports.versionCheck = versionCheck;
exports.readVersionControl = readVersionControl;
exports.startWriting = startWriting;
exports.doneWriting = doneWriting;
exports.logStats = logStats;
exports.logReminders = logReminders;
exports.logMatch = logMatch;
exports.logDev = logDev;
exports.logRole = logRole;
exports.logScratchpad = logScratchpad;
exports.logDraft = logDraft;
exports.downloadLoop = downloadLoop;
exports.loadEmUp = loadEmUp;
exports.writingArray = writingArray;
exports.writeVersion = writeVersion;