/* quoteDex
 Under construction
 $q command to replace Nadeko's ... command
*/
let fs = require('fs');
let dex = require('./quotedex.json');
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
		if(!notedex.hasOwnProperty(noteMatch[1]))
			notedex[noteMatch[1]] = [];
		notedex[noteMatch[1]].push(noteMatch[2]);
	}else{
		console.log('Error at ' + content)
	}
	if(id == "702298390515417171") {
		fs.writeFile('notedex.json', JSON.stringify(notedex, false, 1), (err) => {
			if(err) throw err;
			console.log('Done!');
		});
	}
}
exports.dex = dex;