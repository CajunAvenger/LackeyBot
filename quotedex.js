/* quotequoteDex
 Under construction
 $q command to replace Nadeko's ... command
*/
var fs = require('fs');
var quoteDex = require('./quotedex.json');
var fuzzy = require('./fuzzy.js');
var toolbox = require('./toolbox.js');
var stats = require('./stats.js');

//loading old messages
let msgs = [
	"702298390515417171"
]
function nabMsg(Client, channel, message) {
	Client.channels.get(channel).fetchMessage(message)
		.then(msg => logMsg(msg.content, message))
		.catch(e => console.log(e))		
}
function runMsgs(Client) {
	for(let msg in msgs) {
		nabMsg(Client, '279861790194532353',msgs[msg]);
	}
}
function logMsg(content, id) {
	let noteMatch = content.match(/^\.*([^ ]+) ([\s\S]+)$/);
	if(noteMatch) {
		if(!noteDex.hasOwnProperty(noteMatch[1]))
			noteDex[noteMatch[1]] = [];
		noteDex[noteMatch[1]].push(noteMatch[2]);
	}else{
		console.log('Error at ' + content)
	}
	if(id == "702298390515417171") {
		fs.writeFile('noteDex.json', JSON.stringify(noteDex, false, 1), (err) => {
			if(err) throw err;
			console.log('Done!');
		});
	}
}

function messageHandler(msg, perms) {
	let quoteMatch = msg.content.match(/\$qu?o?t?e? ([^\n]+)/i);
	if(quoteMatch) { //$quote
		let qName = quoteMatch[1];
		if(!quoteDex.hasOwnProperty(quoteMatch[1]))
			qName = fuzzy.searchArray(qName, Object.keys(quoteDex))[0];
		let output = quoteDex[qName][toolbox.rand(quoteDex[qName].length-1)]
		msg.channel.send(output)
		stats.upBribes(1);
	}
}
function helpMessage() {
	let helpout = "**quoteDex Help**\n";
	helpout += "`$q name` to call a quote with the set name.\n";
	//todo, list of quotes
	//todo, way to modify quotes
	return helpout;
}
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;