/* Dysnomia
 moon of Eris
*/
var eris = require('./eris.js')
var Client = eris.Client();
var stats = require('./stats.js');
var Discord = require('discord.js');
var config = require('./config/lackeyconfig.js').config;
var convars = config.variables;
var download = require('download-file');
var toolbox = require('./toolbox.js');
var { //emote buffet
	yeet, boop, leftArrow, rightArrow,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');
function speech(msg) {										//handles the LackeyBot AI
	let channelMatch = msg.content.match(/channel: *<?#?([0-9]+)/i);
	let reactMatch = msg.content.match(/react: *[^\n]+/ig);
	let messageMatch = msg.content.match(/message: *([\s\S]+)/i);
	let message = "";
	if(messageMatch)
		message = messageMatch[1];
	let embedded = "";
	if(reactMatch) {
		for(let c in reactMatch) {
			let reactString = reactMatch[c];
			let complexMatch = reactString.match(/react: *React/);
			let simpleMatch = reactString.match(/react: *([^ ]+) *<?@?&?([0-9]+)/);
			if(complexMatch) {
				message += reactString.replace(/^react: */, "").replace(/(^| )(\d+)( |$)/, "$1<@&$2>$3")
			}
			else if(simpleMatch) {
				let emote = simpleMatch[1];
				let role = simpleMatch[2];
				message += `\nReact ${emote} to join <@&${role}>.`;
			}else{
				msg.channel.send("Error in Role Reactor setup. React lines should be formatted as either `react: emoji @role` or `react: React emoji (message text including @role)`.");
				return;
			}
		}
		embedded = new Discord.MessageEmbed()
			.setFooter('Role Reactor')
	}
	Client.channels.cache.get(channelMatch[1]).send(message, embedded);
}
function deleteMsg(channel,message) {						//deletes a given LackeyBot post
	Client.channels.cache.get(channel).messages.fetch(message)
		.then(message => message.delete())
		.catch(console.error)
}
function editMsg(channel,message,newwords) {				//edits a given LackeyBot post
	Client.channels.cache.get(channel).messages.fetch(message)
		.then(msg => msg.edit(newwords))
		.catch(console.error);
}
function reactMsg(msg) {									//reacts to a given post
	let reactCheck = msg.content.match(/!react https:\/\/discorda?p?p?.com\/channels\/[0-9]+\/([0-9]+)\/([0-9]+)/i);
	let emotesCheck = msg.content.match(/\n([^ ]+)/g);
	let channel = reactCheck[1];
	let message = reactCheck[2];
	for(var i=0; i<emotesCheck.length;i++) {
		let emote = emotesCheck[i];
		emote = emote.match(/\n([^ ]+)/);
		emote = emote[1];
		if(emote.match(/</)){
			emote = emote.match(/([0-9]+)>/);
			emote = emote[1];
		}
		Client.channels.cache.get(channel).messages.fetch(message)
			.then(message => message.react(emote))
			.catch(console.error);
	}
}
//server/user stuff
function nameGuilds() {										//grabs list of servers LB is on
	let theGuilds = Client.guilds.array();
	for(let guild in theGuilds)
		console.log(theGuilds[guild].name);
}
function buildUserEmbed(guildID, userID, textFlag, avLink) {//$userinfo
	let user = Client.guilds.cache.find(val => val.id == guildID).members.cache.find(val => val.id == userID);
	if(textFlag) {
		let servDate = new Date(user.joinedTimestamp);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let discDate = new Date(user.user.createdTimestamp);
		let discDateFull = `${discDate.getFullYear()}/${discDate.getMonth()+1}/${discDate.getDate()} ${discDate.getHours()}:${toolbox.fillLength(discDate.getMinutes(), 2, "0")}`;
		let output = "__Name:__ " + "**" + user.user.username + "**#" + user.user.discriminator;
		output += "\n__Nickname:__ " + (user.nickname != null ? user.nickname:user.user.username);
		output += "\n__ID:__ " + user.id;
		output += "\n__Roles:__ " + user.roles.cache.array().length-1;
		output += "\n__Joined server:__ " + servDateFull;
		output += "\n__Joined Discord:__ " + discDateFull;
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('$userinfoplain for plaintext.')
			.setColor(user.roles.cache.find(val => val.color != 0).color)
		if(avLink)
			nullEmbed.setThumbnail(avLink);
		let color = user.roles.cache.find(val => val.color != 0)
		if(color)
			nullEmbed.setColor(color.color)
		return [output, nullEmbed]
	}else{
		let avLink = user.user.avatarURL({format: 'png', dynamic: true})
		let servDate = new Date(user.joinedTimestamp);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let discDate = new Date(user.user.createdTimestamp);
		let discDateFull = `${discDate.getFullYear()}/${discDate.getMonth()+1}/${discDate.getDate()} ${discDate.getHours()}:${toolbox.fillLength(discDate.getMinutes(), 2, "0")}`;
		let userEmbed = new Discord.MessageEmbed()
			.addField('Name', "**" + user.user.username + "**#" + user.user.discriminator, true)
			.addField('Nickname', (user.nickname != null ? user.nickname:user.user.username), true)
			.addField('ID', user.id, true)
			.addField('Roles', user.roles.cache.array().length-1, true)
			.addField('Joined server', servDateFull, true)
			.addField('Joined Discord', discDateFull, true)
			.setThumbnail(avLink)
			.setFooter('$userinfoplain for plaintext.')
		let color = user.roles.cache.find(val => val.color != 0)
		if(color)
			userEmbed.setColor(color.color)
		return ["", userEmbed];
	}
}
function buildServerEmbed(server, textFlag, avLink) {		//$serverinfo
	if(textFlag) {
		let servDate = new Date(server.createdAt);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let user = server.members.cache.find(val => val.id == server.ownerID).user;
		let output = "**" + server.name + "**";
		output += "\n__ID:__ " + server.id;
		output += "\n__Owner:__ " + "**" + user.username + "**#" + user.discriminator;
		output += "\n__Members:__ " + server.memberCount;
		output += "\n__Text channels:__ " + server.channels.cache.filter(val => val.type == "text").array().length;
		output += "\n__Voice channels:__ " + server.channels.cache.filter(val => val.type == "voice").array().length;
		output += "\n__Created:__ " + servDateFull;
		output += "\n__Region:__ " + server.region;
		output += "\n__Roles:__ " + server.roles.cache.array().length;
		output += "\n__Emojis:__ " + server.emojis.cache.array().length;
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('$serverinfoplain for plaintext.')
		if(avLink)
			nullEmbed.setThumbnail(avLink);
		return [output, nullEmbed];
	}else{
		let avLink = server.iconURL({format: 'png', dynamic: true})
		let servDate = new Date(server.createdAt);
		let servDateFull = `${servDate.getFullYear()}/${servDate.getMonth()+1}/${servDate.getDate()} ${servDate.getHours()}:${toolbox.fillLength(servDate.getMinutes(), 2, "0")}`;
		let user = server.members.cache.find(val => val.id == server.ownerID).user;
		let emoteLine = "";
		let serverEmbed = new Discord.MessageEmbed()
			.setTitle(server.name)
			.addField('ID', server.id, true)
			.addField('Owner', "**" + user.username + "**#" + user.discriminator, true)
			.addField('Members', server.memberCount, true)
			.addField('Text channels', server.channels.cache.filter(val => val.type == "text").array().length, true)
			.addField('Voice channels', server.channels.cache.filter(val => val.type == "voice").array().length, true)
			.addField('Created', servDateFull, true)
			.addField('Region', server.region, true)
			.addField('Roles', server.roles.cache.array().length, true)
			.addField('Emojis', server.emojis.cache.array().length, true)
			.setThumbnail(avLink)
			.setFooter('$serverinfoplain for plaintext.')
		return ["", serverEmbed];
	}
}
function postAvatar(msg, otherid) {							//$avatar
	let id = msg.author.id;
	let avid = msg.author.avatar;
	if(otherid) {
		let user = eris.pullPing(otherid);
		id = user.id;
		avid = user.avatar;
	}
	let attachURL = `https://cdn.discordapp.com/avatars/${id}/${avid}.gif`
	download(attachURL, {directory:"./examples/", filename:"avatar.gif"}, function(err) {
		if(err) {
			msg.channel.send(attachURL.replace(".gif", ".png"));
		}else{
			msg.channel.send(attachURL);
		}
	});
}
function postEmote(msg, emoteSnag, bigFlag) {				//$emote and $bigemote
	let bigCheck = emoteSnag.match(/<:[^:]+:[0-9]+>/)
	if(bigCheck)
		bigFlag = true;
	emoteSnag = emoteSnag.match(/(^|:[^:]+:|<)([0-9]+)/)[2];
	let emoteStuff = Client.emojis.cache.array().find(val => val.id == emoteSnag);
	
	if(!bigFlag && emoteStuff) {
		msg.channel.send(`<:${emoteStuff.name}:${emoteStuff.id}>`)
	}else{
		let attachURL = `https://cdn.discordapp.com/emojis/${emoteSnag}.gif`;
		download(attachURL, {directory:"./examples/", filename:"emote.gif"}, function(err) {
			if(err) {
				msg.channel.send(attachURL.replace(".gif", ".png"));
			}else{
				msg.channel.send(attachURL);
			}
		});
	}
}
//other random discord stuff
async function asyncSwapPins(msg, matching, max, bank) {	//pin swapper script
	let pinnedPosts = await msg.channel.messages.fetchPinned();
	pinnedPosts = pinnedPosts.array();
	for(let post in pinnedPosts) {
		if(postMatching(pinnedPosts[post], matching)) {
			if(bank)
				bank[2] = pinnedPosts[post];
			pinnedPosts[post].unpin();
			max--;
			if(max == 0)
				break
		}
	}
	if(bank)
		bank[1] = msg;
	msg.pin();
}
function postMatching(post, matching) {						//runs a matching object over a post
	if(matching.hasOwnProperty('content') && !post.content.match(matching.content))
		return false;
	if(matching.hasOwnProperty('author') && post.author.id != matching.author)
		return false;
	if(matching.hasOwnProperty('channel') && post.channel.id != matching.channel)
		return false;
	if(matching.hasOwnProperty('guild') && post.guild.id != matching.guild)
		return false;
	return true;
}
function channelReminders() {								//recurring help messages
	let now = new Date().getTime();
	//artHelpPoster
	let artID = "358302654847385610";
	//artID = "367816828287975425";
	let artReminder = `To help make sure your art requests don't get lost, you can pin your ongoing requests with LackeyBot. Useful for if you need art for a specific concept, or help tracking down an artist. And of course, if you're feeling helpful, you can check out other peoples pins and help them out as well.\n\n**To pin your own message in #art-help:** React to your own message with ${pinEmotes[0]} or ${pinEmotes[1]}. Each user can only have one pinned message in this channel at a time. To change your pinned message, react to a new message or remove your previous react.`;
	try{
		channelHelpPoster(artID, artReminder, now);
	}catch(e){}
	//projectHelpPoster
	let projectID = "771127405946601512";
	//projectID = "711124818036129812";
	let projectReminder = `Sometimes you're looking for feedback on more than a single design. You want help with your set's limited archetypes, or on how multiple keywords might work together. To help people keep track of what your project is about, you can type up a message in here summarizing it (and maybe include links to planesculptors pages or something similar if you have them) for people to refer to.\n\n**To pin your own message in #project-talk:** React to your own message with ${pinEmotes[0]} or ${pinEmotes[1]}. Each user can only have one pinned message in this channel at a time. To change your pinned message, react to a new message or remove your previous react.`
	try{
		channelHelpPoster(projectID, projectReminder, now);
	}catch(e){}
}
async function channelHelpPoster(id, helpMsg, now) {		//posts help messages to channels after inactivity
	if(!now)
		now = new Date().getTime();
	let channel = Client.channels.cache.get(id);
	let lastTen = await channel.messages.fetch({limit:50});
	let post = true;
	let timeCheck = now - (10*60*1000); //ten minutes ago
	//don't post if post in the last ten minutes
	//don't post if last ten has a pin reminder
	if(lastTen.filter(m => m.createdTimestamp > timeCheck).size) {
		post = false; //message in the last 10 minutes
	}
	if(lastTen.filter(m => m.content == helpMsg).size) {
		post = false;
	}
	if(post)
		channel.send(helpMsg);
}

function helpMessage() {
	let helpout = "**Dysnomia Help**\n";
	helpout += "`$userinfo` for info about yourself.\n";
	helpout += "`$serverinfo` for info about this server.\n";
	helpout += "`$userinfoplain` and `$serverinfoplain` for plaintext versions.\n";
	helpout += "`$bigemote id` for fullsize custom emote image.\n";
	helpout += "`$emote id` for emote size custom emote image.\n";
	helpout += "`$avatar` for your avatar.\n";
	helpout += "`$avatar id` for another user's avatar.\n";
	return helpout;
}

function messageHandler(msg, perms) {
	if(perms.includes(0) || perms.includes(3)) {
		//sentience commands
		if(msg.content.match("!say")) //highly advanced AI function
			speech(msg);
		let editcheck = msg.content.match(/!edit https:\/\/discorda?p?p?.com\/channels\/[0-9]+\/([0-9]+)\/([0-9]+)\n([\s\S]+)/i);
		if(editcheck)
			editMsg(editcheck[1], editcheck[2], editcheck[3]);
		let deletecheck = msg.content.match(/!delete https:\/\/discorda?p?p?.com\/channels\/[0-9]+\/([0-9]+)\/([0-9]+)/i);
		if(deletecheck) //deletes a LackeyBot post
			deleteMsg(deletecheck[1],deletecheck[2]);
		if(msg.content.match("!react")) //reacts to a post
			eris.reactMsg(msg);
	}
	let emotematch = msg.content.match(/\$(big|huge?)? ?emo(?:ji|te) ([^\n]+)/i);
	if(emotematch){ //$emote
		stats.upBribes(1);
		postEmote(msg, emotematch[2], emotematch[1]);
	}
	let avamatch = msg.content.match(/\$avatar ?<?@?!?([0-9]+)?/i);
	if(avamatch) { //$avatar
		stats.upBribes(1);
		other = null;
		if(avamatch[1])
			other = avamatch[1];
		postAvatar(msg, other);
	}
	if(msg.guild) {
		let uimatch = msg.content.match(/\$user ?info ?(plain)? ?([^\n]+)?/i)
		if(uimatch){ //$userinfo
			stats.upBribes(1)
			let userID = msg.author.id;
			if(uimatch[2]) {
				let filterName = function(name){
					if(name)
						return name;
					return "";
				}
				let nameTap = new RegExp(uimatch[2], 'i')
				let temp = msg.guild.members.cache.find(val => filterName(val.nickname).match(nameTap))
				if(!temp)
					temp = msg.guild.members.cache.find(val => filterName(val.user.username).match(nameTap))
				if(temp)
					userID = temp.id;
			}
			let usinfo = buildUserEmbed(msg.guild.id, userID, uimatch[1]);
			msg.channel.send(usinfo[0], usinfo[1])
		}
		let simatch = msg.content.match(/\$server ?info ?(plain)? ?([^\n]+)?/i)
		if(simatch){ //$serverinfo
			stats.upBribes(1)
			let guildID = msg.guild;
			let servEmbed = buildServerEmbed(guildID, simatch[1])
			msg.channel.send(servEmbed[0], servEmbed[1])
		}
	}
	//Channel specific commands
	if(msg.guild && msg.guild.id == "205457071380889601"){ //purple server specific
		let dgRegex = new RegExp('^<@&277083656269594624>','')
		if(msg.channel.id == "229827952685219850" && msg.content.match(dgRegex) && !convars.pinDisarm[0]) {
			asyncSwapPins(msg, {content:dgRegex}, 1, convars.pinDisarm);
			convars.pinDisarm[0] = true;
			setTimeout(function(){convars.pinDisarm[0] = false}, 20*60*1000)
		}
		if(msg.channel.id == "229827952685219850" && convars.pinDisarm[2] && msg.content.match(/(\$|!)(false|switch|swap|flip|pin) ?(alarm|switch|swap|flip|pin)/i)) {
			asyncSwapPins(convars.pinDisarm[2], {content:"!"}, 1, convars.pinDisarm);
			msg.channel.send("Pins swapped.");
		}
	}

}

exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.channelReminders = channelReminders;
exports.asyncSwapPins = asyncSwapPins;
