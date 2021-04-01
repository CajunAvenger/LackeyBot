var gpDex = {};
var dbx = require('./boxofmud.js');
var fs = require('fs');
var stats = require('./stats.js');
var version = require('./version.js');
var config = require('./config/lackeyconfig.js').config;
var admin = config.dev;
var convars = config.variables;

function dl() {
	dbx.dropboxDownload('msem/gpbase.json','https://www.dropbox.com/s/t9hdhad8ol1c7cu/gpbase.json?dl=0',reloadGPBase)
}
function reloadGPBase() {									//loads gpbase after downloading
	console.log('Reloading gpbase');
	let test = require("./msem/gpbase.json");
	if(test.version < version.versionCheck.gpbase)
	console.log("Version error in gpbase.");
	gpbase = test;
}

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
		dbx.dropboxUpload('/lackeybot stuff/gpbase.json',words);
		msg.author.send(thisGP + " updated");
	}
}

function messageHandler(msg, perms) {
	if(msg.author.id == admin || msg.author.id == config.login.TO) {
		var gpUpdateCheck = msg.content.match(/!(gp|pt)(\d+|[a-z]\d?)/i);
		if(gpUpdateCheck)
			gpUpdate(msg);
	}
	//Grand Prix links
	let gpBoardMatch = msg.content.match(/\$gp(leader|board|score)/i);
	gpcheck = msg.content.match(/\$(gp[a-z][0-9]*|pt[0-9]|skirmish)/i);
	if(gpcheck && !gpBoardMatch){
		stats.upBribes(1);
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
			msg.channel.send(extras.error[convars.errorNo]);
			convars.errorNo++;
			if(convars.errorNo == extras.error.length)
				convars.errorNo = 2;
		};
	}
}
exports.messageHandler = messageHandler;
exports.gpDex = gpDex;
exports.dl = dl;