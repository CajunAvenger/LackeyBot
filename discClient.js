const Discord = require("discord.js");
var Client;
function sendClient(){
	return Client;
}
function initialize(){
	Client = new Discord.Client({ partials:['MESSAGE', 'REACTION'] });
}
function pullUsername(id) { //gets user's username, or PlayerUnknown if error
	try{
		return Client.users.cache.get(id).username;
	}catch(e){
		return "PlayerUnknown";
	}
}
function pullPing(id) { //gets user's ping, or PlayerUnknown if error
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

exports.sendClient = sendClient
exports.initialize = initialize
exports.pullUsername = pullUsername
exports.pullPing = pullPing