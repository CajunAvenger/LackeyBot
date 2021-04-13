var roleDex = {guilds:{}, fightGuilds:{}};
var roleRegex = {};
var Discord = require('discord.js');
var eris = require('./eris.js');
var Client = eris.Client();
var dbx = require('./boxofmud.js');
var fuzzy = require('./fuzzy.js');
var fs = require('fs');
var stats = require('./stats.js');
var toolbox = require('./toolbox.js');
var version = require('./version.js');
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
	dbx.dropboxDownload('roles.json','https://www.dropbox.com/s/94ltqp66mmo1ko0/roles.json?dl=0',reloadRoles);
}
function reloadRoles() {	//loads roles and roleRegex after downloading
	console.log('Reloading roles');
	let test = require("./roles.json");
	if(test.version < version.versionCheck.roles)
	console.log("Version error in roles.");
	roleDex = test;
	roleRegex = buildRoleRegex();
}


function buildRoleRegex(server) {												//builds roleRegex on startup to reduce computation
	let servArray = [];
	if(server) {
		servArray = [server]
	}else{
		servArray = Object.keys(roleDex.guilds)
	}
	for(let serv in servArray) {
		let regString = "\\$iam(n|not)? (";
		let roleList = Object.keys(roleDex.guilds[servArray[serv]].roles);
		roleList.sort(function(a, b) {
			return b.length - a.length;
		});
		for(let r in roleList){
			regString += roleList[r] + "|";
		}
		let guildReg = new RegExp(regString.replace(/\|$/,"")+")",'i')
		roleRegex[servArray[serv]] = guildReg;
	}
	return roleRegex;
}
//roles.json
function newGuild(guildID){														//adds a new role server to LB
	if(!roleDex.guilds.hasOwnProperty(guildID)){
		version.startWriting("role");
		roleDex.guilds[guildID] = {banned:[], prefix:"", roles:{}, groups:["General","Colors"], exclusive:[], countable:{}, excluded:{}};
		return "LackeyBot has initialized this server. Send `$role help` for a list of role commands.";
	}
	return "Server is already established."
}
function newGroup(guildID, groupName) {											//adds a new role group
	version.startWriting("role");
	let len = roleDex.guilds[guildID].groups.length;
	if(groupName == "")
		groupName = len;
	if(roleDex.guilds[guildID].groups.includes(groupName)){
		version.doneWriting("role");
		return "Group " + groupName + " already exists.";
	}
	groupName = toolbox.toTitleCase(groupName)
	roleDex.guilds[guildID].groups.push(groupName);
	return "Group " + groupName + " added at position " + len + ".";
}
function renameRole(guildID, oldName, newName) {								//renames a role
	version.startWriting("role");
	oldName = oldName.replace(/ $/, "").toLowerCase();
	newName = newName.toLowerCase();
	let response = ""
	if(roleDex.guilds[guildID].roles.hasOwnProperty(oldName)) {
		roleDex.guilds[guildID].roles[newName] = roleDex.guilds[guildID].roles[oldName];
		delete roleDex.guilds[guildID].roles[oldName];
		response += "Renamed role " + oldName + " to " + newName + ". "
	}else if(roleDex.guilds[guildID].givable.hasOwnProperty(oldName)) {
		roleDex.guilds[guildID].givable[newName] = roleDex.guilds[guildID].givable[oldName];
		delete roleDex.guilds[guildID].givable[oldName];
		response += "Renamed givable role " + oldName + " to " + newName + ". "
	}else if(roleDex.guilds[guildID].countable.hasOwnProperty(oldName)) {
		roleDex.guilds[guildID].countable[newName] = roleDex.guilds[guildID].countable[oldName];
		delete roleDex.guilds[guildID].countable[oldName];
		response += "Renamed countable role " + oldName + " to " + newName + ". "
	}else{
		response = "LackeyBot does not have this role.";
	}
	buildRoleRegex(guildID);
	return response;
}
function renameGroup(guildID, groupIndex, groupName) {							//renames a role group
	version.startWriting("role");
	if(groupName == "")
		groupName = groupIndex;
	groupName = toolbox.toTitleCase(groupName);
	if(roleDex.guilds[guildID].groups.includes(groupName)) {
		version.doneWriting("role");
		return "Group " + groupName + " already exists.";
	}
	let oldName = roleDex.guilds[guildID].groups[groupIndex];
	let exIndex = roleDex.guilds[guildID].exclusive.indexOf(oldName);
	if(exIndex != -1)
		roleDex.guilds[guildID].exclusive[exIndex] = groupName;
	for(let role in roleDex.guilds[guildID].roles) {
		if(roleDex.guilds[guildID].roles[role].group == oldName)
			roleDex.guilds[guildID].roles[role].group = groupName;
	}
	roleDex.guilds[guildID].groups[groupIndex] = groupName;
	return "Renamed group index " + groupIndex + " to " + groupName + ".";
}
function moveGroup(guildID, groupIndex, newGroupIndex) {						//moves a role group
	if(groupIndex == newGroupIndex)
		return "That is the same index.";
	let currentIndex = "Group " + roleDex.guilds[guildID].groups[groupIndex]
	roleDex.guilds[guildID].groups = toolbox.reassignIndex(roleDex.guilds[guildID].groups, groupIndex, newGroupIndex);
	return currentIndex + " moved to index " + newGroupIndex + ".";
}
function removeGroup(guildID, groupIndex) {										//removes a role group
	version.startWriting("role")
	let currentIndex = "Group " + roleDex.guilds[guildID].groups[groupIndex];
	for(let role in roleDex.guilds[guildID].roles){
		if(roleDex.guilds[guildID].roles[role].group == roleDex.guilds[guildID].groups[groupIndex])
			roleDex.guilds[guildID].roles[role].group = ""
	}
	roleDex.guilds[guildID].groups.splice(groupIndex, 1);
	return currentIndex + " removed.";
}
function makeExclusiveGroup(guildID, groupName) {								//adds an exclusive group, for things like color roles
	version.startWriting("role")
	groupName = toolbox.toTitleCase(groupName);
	let currentGroups = roleDex.guilds[guildID].groups;
	let currentExclu = roleDex.guilds[guildID].exclusive;
	if(currentGroups.includes(groupName)) {
		if(currentExclu.includes(groupName)) {
			currentExclu.splice(currentExclu.indexOf(groupName), 1);
			return "Group " + groupName + " is no longer exclusive.";
		}else{
			currentExclu.push(groupName);
			return "Group " + groupName + " is now exclusive.";
		}
	}else{
		newGroup(guildID, groupName);
		currentExclu.push(groupName);
		return "Exclusive group " + groupName + " added.";
	}
}
function reGroup(guildID, groupIndex, roleName) {								//resets a role's group
	version.startWriting("role") //todo should this be here
	if(groupIndex >= roleDex.guilds[guildID].groups.length)
		return "Index not found."
	let groupName = roleDex.guilds[guildID].groups[groupIndex];
	let theseRoles = roleDex.guilds[guildID].roles;
	roleName = roleName.toLowerCase().replace(/ $/, "");
	if(theseRoles.hasOwnProperty(roleName)) {
		theseRoles[roleName].group = groupName;
		return "Role " + roleName + " changed to group " + groupName + ".";
	}else{
		return "Role not found.";
	}
}
function newAssignableRole(guildID, roleName, giveMessage, takeMessage, group) {//adds a new role to LB
	version.startWriting("role")
	roleName = roleName.replace(/ $/, "")
	group = toolbox.toTitleCase(group);
	if(!roleDex.guilds[guildID].groups.includes(group))
		group = roleDex.guilds[guildID].groups[0];
	let roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	if(roleID == null) {
		roleName = roleName.toLowerCase();
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		roleName = toolbox.toTitleCase(roleName);
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		version.doneWriting("role")
		return "LackeyBot could not find this role.";
	}
	roleID = roleID.id;
	let roleMini = roleName.toLowerCase();
	roleDex.guilds[guildID].roles[roleMini] = {};
	roleDex.guilds[guildID].roles[roleMini].id = roleID;
	roleDex.guilds[guildID].roles[roleMini].give = giveMessage;
	roleDex.guilds[guildID].roles[roleMini].take = takeMessage;
	roleDex.guilds[guildID].roles[roleMini].group = group;
	if(roleDex.guilds[guildID].roles[roleMini].give == 0)
		roleDex.guilds[guildID].roles[roleMini].give = "You now have the " + roleName + " role.";
	if(roleDex.guilds[guildID].roles[roleMini].take == 0)
		roleDex.guilds[guildID].roles[roleMini].take = "You no longer have the " + roleName + " role.";
	buildRoleRegex(guildID);
	return roleName + " added as self assignable role.";
}
function newCountableRole(guildID, roleName) {									//adds a new countable role to LB
	version.startWriting("role")
	roleName = roleName.replace(/ $/, "")
	let roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	if(roleID == null) {
		roleName = roleName.toLowerCase();
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		roleName = toolbox.toTitleCase(roleName);
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		version.doneWriting("role");
		return "LackeyBot could not find this role.";
	}
	roleID = roleID.id;
	let roleMini = roleName.toLowerCase();
	roleDex.guilds[guildID].countable[roleMini] = {};
	roleDex.guilds[guildID].countable[roleMini].id = roleID;
	return roleName + " added as countable role.";
}
function newGivenRole(guildID, roleName, giveMessage, takeMessage, group) {		//adds a new give-only role to LB
	version.startWriting("role")
	roleName = roleName.replace(/ $/, "")
	group = toolbox.toTitleCase(group);
	let roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	if(roleID == null) {
		roleName = roleName.toLowerCase();
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		roleName = toolbox.toTitleCase(roleName);
		roleID = Client.guilds.cache.find(val => val.id == guildID).roles.cache.find(val => val.name == roleName);
	}
	if(roleID == null) {
		version.doneWriting("role")
		return "LackeyBot could not find this role.";
	}
	roleID = roleID.id;
	let roleMini = roleName.toLowerCase();
	roleDex.guilds[guildID].givable[roleMini] = {};
	roleDex.guilds[guildID].givable[roleMini].id = roleID;
	roleDex.guilds[guildID].givable[roleMini].give = giveMessage;
	roleDex.guilds[guildID].givable[roleMini].take = takeMessage;
	roleDex.guilds[guildID].givable[roleMini].group = group;
	if(roleDex.guilds[guildID].givable[roleMini].give == 0)
		roleDex.guilds[guildID].givable[roleMini].give = "You now have the " + roleName + " role.";
	if(roleDex.guilds[guildID].givable[roleMini].take == 0)
		roleDex.guilds[guildID].givable[roleMini].take = "You no longer have the " + roleName + " role.";
	return roleName + " added as mod-givable role.";
}
function unassignRole(guildID, roleName) {										//removes a role from LB
	version.startWriting("role")
	roleName = roleName.replace(/ $/, "").toLowerCase();
	let response = ""
	if(roleDex.guilds[guildID].roles.hasOwnProperty(roleName)) {
		delete roleDex.guilds[guildID].roles[roleName];
		response += "Assignable role " + roleName + " deleted. "
	}else if(roleDex.guilds[guildID].givable.hasOwnProperty(roleName)) {
		delete roleDex.guilds[guildID].givable[roleName];
		response += "Givable role " + roleName + " deleted. "
	}else if(roleDex.guilds[guildID].countable.hasOwnProperty(roleName)) {
		delete roleDex.guilds[guildID].countable[roleName];
		response += "Countable role " + roleName + " deleted. "
	}else{
		version.doneWriting("role");
		response = "LackeyBot does not have this role.";
	}
	buildRoleRegex(guildID);
	return response;
}
function excludeRole(guildID, flag, userID, roleName){							//bans a user from having a self-assignabe role
	version.startWriting("role")
	let thisGuild = roleDex.guilds[guildID];
	roleName = roleName.replace(/ $/, "").toLowerCase();
	let thisRole;
	if(thisGuild.roles.hasOwnProperty(roleName)) {
		thisRole = thisGuild.roles[roleName];
	}else{
		roleName = fuzzy.searchArray(roleName.replace(/ /g,""), Object.keys(thisGuild.roles,{percent:0.33}))[0];
		thisRole = thisGuild.roles[roleName];
	}
	if(flag.match(/arenot/)) {
		if(!thisGuild.hasOwnProperty('excluded'))
			thisGuild.excluded = {};
		if(!thisGuild.excluded.hasOwnProperty(thisRole.id))
			thisGuild.excluded[thisRole.id] = [];
		thisGuild.excluded[thisRole.id].push(userID)
		let thatMember = Client.guilds.cache.get(guildID).members.cache.get(userID)
		adjustRoles(roleName, guildID, thatMember, "roles", true); //remove the role
		return `${thatMember.user.username} can no longer assign ${roleName}.`;
	}else{
		let userIndex = thisGuild.excluded[thisRole.id].indexOf(userID)
		thisGuild.excluded[thisRole.id].splice(userIndex, 1)
		let thatMember = Client.guilds.cache.get(guildID).members.cache.get(userID)
		return `${thatMember.user.username} can now assign ${roleName} again.`;
	}
}
function toggleFightRole(guildID, fightID) {									//toggles if a server uses the $fight/$unfight commands
	version.startWriting("role")
	if(roleDex.roleDex.fightGuilds.hasOwnProperty(guildID)) {
		delete roleDex.roleDex.fightGuilds[guildID];
		return "Server no longer has a fight role."
	}
	roleDex.roleDex.fightGuilds[guildID] = fightID;
	return "Server now has a fight role."
}
function createNewRole(guildID, roleName, roleColor, hoist, mention, group, channel, giveFlag) { //create a new role in the guild
	roleName = roleName.replace(/ $/, "")
	if(!roleDex.guilds[guildID].groups.includes(group))
		group = roleDex.guilds[guildID].groups[0];
	let roleData = {name:roleName, color:roleColor, hoist:hoist, mentionable:mention}
	let callback = function(role) {
		let output = "";
		if(giveFlag == "a") {
			output += newAssignableRole(guildID, roleName, "", "", group);
		}else if(giveFlag == "g") {
			output += newGivenRole(guildID, roleName, "", "", group);
		}else if(giveFlag == "c") {
			output += newCountableRole(guildID, roleName);
		}
		version.logRole(roleDex);
		output = `Created new role with name ${role.name}\n` + output;
		channel.send(output);
	};
	Client.guilds.cache.find(val => val.id == guildID).roles.create({data:roleData, reason:"Created with LackeyBot"})
		.then(role => callback(role))
		.catch(e => console.log(e))
}
function changeRolePrefix(guildID, prefix) {									//TODO doesn't work yet
	roleDex.guilds[guildID].prefix = prefix;
	buildRoleRegex(guildID);
}
function sortGuildRoles(guildRoles) {											//sorts the guilds roles by group number, then alphabetically
	let theseGroups = guildRoles.groups;
	let theseRoles = guildRoles.roles;
	let roleArray = Object.keys(theseRoles);
	roleArray.sort(); //sort alphabetically
	/*roleArray.sort(function(a,b){ //then arrange by group indexes
		let result = theseGroups.indexOf(theseRoles[a].group) - theseGroups.indexOf(theseRoles[b].group)
		return result;
	});
	//wasn't working on live for some reason??? */
	let workAround = {};
	for(let group in theseGroups){ //save them per group
		workAround[theseGroups[group]] = [];
	}
	workAround["Unsorted"] = [];
	for(let role in roleArray){ //push them alphabetically
		let roleGroup = "Unsorted";
		if(theseRoles[roleArray[role]].group != "")
			roleGroup = theseRoles[roleArray[role]].group
		workAround[roleGroup].push(roleArray[role])
	}
	let newroleArray = [];
	for(let group in theseGroups){ //add them to a new array by group alphabetically
		for(let role in workAround[theseGroups[group]])
			newroleArray.push(workAround[theseGroups[group]][role]);
	}
	return newroleArray;
}
function writeRoleStack(guildID, page, textFlag) {								//writes the stack of roles and their group number
	let theseRoles = roleDex.guilds[guildID].roles;
	let theseNames = sortGuildRoles(roleDex.guilds[guildID]);
	let allArray = [[]];
	let j = 0;
	for(let i=0; i<theseNames.length; i++) {
		if(i == 0){
			allArray[j].push(theseNames[i])
		}else if(allArray[j].length < 20 && theseRoles[theseNames[i]].group == theseRoles[theseNames[i-1]].group){
			allArray[j].push(theseNames[i])
		}else{
			j++;
			allArray.push([]);
			allArray[j].push(theseNames[i])	
		}
	}
	let pageArray = [(3*page)%allArray.length];
	let p2 = (3*page+1)%allArray.length
	if(!pageArray.includes(p2))
		pageArray.push(p2)
	let p3 = (3*page+2)%allArray.length
	if(!pageArray.includes(p3))
		pageArray.push(p3)
	let outputArray = []
	for(let page in pageArray)
		outputArray.push(allArray[pageArray[page]])
	return [outputArray, theseNames.length, Math.ceil(allArray.length/3)];
}
function buildRoleEmbed(guildID, page, textFlag) {								//builds a page of the roles embed for a guild
	let rolestuff = writeRoleStack(guildID, page, textFlag);
	let roleArrays = rolestuff[0];
	let pages = rolestuff[2];
	let roleObj = {};
	let i = 0;
	for(let roleArray in roleArrays){
		roleObj[i] = {header:"", string:""};
		roleObj[i].header = roleDex.guilds[guildID].roles[roleArrays[roleArray][0]].group;
		if(roleObj[i].header == "")
			roleObj[i].header = "Unsorted";
		for(let role in roleArrays[roleArray]){
			roleObj[i].string += roleArrays[roleArray][role] + "\n";
		}
		i++;
	}
	if(textFlag) {
		let embedText = "There are " + rolestuff[1] + " self-assignable roles. Use $iam [role] to assign them (e.g. `$iam judge`). Using the command again or `$iamnot [role]` will remove it."
		for(let grouping in roleObj) {
			embedText += "\n**" + roleObj[grouping].header + "**\n" + roleObj[grouping].string
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("There are " + rolestuff[1] + " self-assignable roles.")
			.setFooter("Page " + parseInt(page+1) + "/" + pages + ". 💬 to restore embed.")
		return [[embedText, nullEmbed], pages]
	}
	var exampleEmbed = new Discord.MessageEmbed()
		.setColor('#0099ff')
		.setTitle("There are " + rolestuff[1] + " self-assignable roles.")
		.setDescription("Use $iam [role] to assign them (e.g. `$iam judge`). Using the command again or `$iamnot [role]` will remove it.")
		.setFooter("Page " + parseInt(page+1) + "/" + pages + ". 💬 for plaintext.")
	for(let grouping in roleObj) {
		exampleEmbed.addField(roleObj[grouping].header, roleObj[grouping].string, true)
	}
	return [exampleEmbed, pages];
}
function buildInRoleEmbed(guild, roleName, page, textFlag) {					//build inrole embed
	roleName = roleName.replace(/ $/, "")
	let members;
	let roleColor = "00ff33";
	if(roleDex.guilds[guild.id].roles.hasOwnProperty(roleName)) { //exact role
		let roleData = guild.roles.cache.get(roleDex.guilds[guild.id].roles[roleName].id);
		members = roleData.members.array();
		if(roleData.color)
			roleColor = roleData.color;
	}else if(roleDex.guilds[guild.id].countable.hasOwnProperty(roleName)) { //exact countable
		let roleData = guild.roles.cache.get(roleDex.guilds[guild.id].countable[roleName].id);
		members = roleData.members.array();
		if(roleData.color)
			roleColor = roleData.color;
	}else{ //fuzzy
		let first = fuzzy.searchArray(roleName, Object.keys(roleDex.guilds[guild.id].roles), {percent:0.33});
		let second = fuzzy.searchArray(roleName, Object.keys(roleDex.guilds[guild.id].countable), {percent:0.33});
		if(first[1] == 0 && second[1] == 0)
			return ["Role not found.", null];
		if(first[1] > second[1]) {
			roleName = first[0];
			let roleData = guild.roles.cache.get(roleDex.guilds[guild.id].roles[roleName].id);
			members = roleData.members.array();
			if(roleData.color)
				roleColor = roleData.color;
		}else{
			roleName = second[0];
			let roleData = guild.roles.cache.get(roleDex.guilds[guild.id].countable[roleName].id);
			members = roleData.members.array();
			if(roleData.color)
				roleColor = roleData.color;
			}
	}
	if(members.length == 0) {
		let embedded = new Discord.MessageEmbed()
			.setTitle("List of users in " + roleName + " role - " + members.length)
			.setColor(roleColor)
			.addField("Users", "No one has the " + roleName + " role.")
			.setFooter("Page 1/1")
		if(textFlag)
			return [["No one has the " + roleName + " role.", embedded], null]
		return [embedded, 1];
	}
	let memberArray = [];
	for(let mem in members)
		memberArray.push(members[mem].user.username);
	if(textFlag) {
		let pages = Math.ceil(memberArray.length/20);
		let embedText = "**List of users in " + roleName + " role - " + members.length + "**";
		let start = page*20;
		let end = Math.min(start+20, members.length);
		for(let i = start; i<end; i++) {
			embedText += "\n" + memberArray[i];
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle("List of users in " + roleName + " role - " + members.length)
			.setFooter("Page " + parseInt(page+1) + "/" + pages)

		return [[embedText, nullEmbed], pages]
	}
	let embedInfo = eris.buildGeneralEmbed(memberArray, "Users", page, 20)
	let embedded = embedInfo[0];
	embedded.setColor(roleColor);
	embedded.setTitle("List of users in " + roleName + " role - " + members.length);
	return [embedded, embedInfo[1]];
}
function isExcluded(guild, role, user) {										//checks if a user has been excluded from assigning a role
	if(guild.excluded.hasOwnProperty(role)) {
		if(guild.excluded[role].includes(user))
			return true;
	}
	return false;
}
function adjustRoles(littleName, thisGuild, member, base, forceRemove){			//adds/removes/toggles roles
	if(littleName && roleDex.guilds[thisGuild][base].hasOwnProperty(littleName.toLowerCase())) {
		stats.upBribes(1);
		let type = null;
		let userRoles = member.roles.cache;
		let userRolesArray = userRoles.array();
		let thisRole = roleDex.guilds[thisGuild][base][littleName];
		if(userRoles.find(val => val.id == thisRole.id)){
			member.roles.remove(thisRole.id).catch(console.error);
			return thisRole.take;
		}else if(forceRemove || isExcluded(roleDex.guilds[thisGuild], thisRole.id, member.id)) {
			return "";
		}else{
			if(roleDex.guilds[thisGuild].exclusive.includes(thisRole.group)){
				let exclusiveIDs = objectFindAll(roleDex.guilds[thisGuild][base], "group", new RegExp('^'+thisRole.group+'$', 'i'), "id")
				for(let role in userRolesArray) {
					if(exclusiveIDs.includes(userRolesArray[role].id))
						member.roles.remove(userRolesArray[role].id).catch(console.error);
				}
				/*for(let role in roleDex.guilds[thisGuild][base]) {
					if(roleDex.guilds[thisGuild][base][role].group == thisRole.group)
						member.roles.remove(roleDex.guilds[thisGuild][base][role].id).catch(console.error);
				}*/
			}
		}
		member.roles.add(thisRole.id).catch(console.error);
		return thisRole.give;
	}
}
function objectFindAll(obj, key, match, returnKey) {							//returns array of object keys that match a particular key
	let output = [];
	for(let k in obj) {
		if(obj[k][key].match(match)) {
			if(returnKey) {
				output.push(obj[k][returnKey])
			}else{
				output.push(k);
			}
		}
	}
	return output;
}
function pullRoles(guildID) {								//grabs list of roles of a server
	let theRoles = Client.guilds.cache.find(val => val.id == guildID).roles.array();
	for(let role in theRoles) {
		if(!roleDex.guilds[guildID].roles.hasOwnProperty(theRoles[role].name))
			console.log(theRoles[role].name)
	}
}

function messageHandler(msg, perms) {
	if(perms.includes(0)) {
		//Experimental commands
		if(msg.content.match("!rolegank")) {
			let guildID = msg.guild.id;
			let page = 0;
			let embedInfo = buildRoleEmbed(guildID, page);
			let exampleEmbed = embedInfo[0];
			msg.channel.send(exampleEmbed)
				.then(function(mess) { if(embedInfo[1]>1){mess.react(leftArrow)
				.then(() => mess.react(rightArrow))}})
				.catch(console.log("An emote didn't spawn"))
		}
		//creating channels test
		if(msg.content.match("!chantest")) {
			let chanArray = Client.guilds.cache.get("190309853296590848").channels.cache.get('637483964508143616').children.array();
			let addingChan = {name: "real test channel", position: 0};
			let chanNameArray = [addingChan];
			for(let i=0; i<chanArray.length; i++) {
				let chanData = {};
				chanData.name = chanArray[i].name;
				chanData.position = chanArray[i].position;
				chanNameArray.push(chanData);
			}
			chanNameArray.sort((a, b) => (a.name > b.name) ? 1 : -1);
			let chanHold = chanNameArray.indexOf(addingChan);
			let chanPos = chanNameArray[chanHold-1].position;
			Client.guilds.cache.get("190309853296590848").createChannel("real test channel", {type:"text", parent:"637483964508143616", permissionOverwrites:[{id: msg.guild.id, deny:["VIEW_CHANNEL"]},{id:Client.user.id, allow:["VIEW_CHANNEL","MANAGE_CHANNELS"]}], position: chanPos})
		}
		if(msg.content.match("!bad")) { //bad and shameful
			if(msg.member.roles.cache.find(val => val.id == "494215662286274561")){
				msg.member.roles.remove("494215662286274561").catch(console.error);
			}else{
				msg.member.roles.add("494215662286274561").catch(console.error);
			}
		}
	}
	if(perms.includes(3) || perms.includes(4)) {	//commands limited to server admins/moderators
		//role engine commands
		if(msg.content.match(/^\$role ?help/i)){
			let output = "";
			output += "`$role setup` to initialize.\n";
			output += "`$groupindex` to list the group indexes.\n";
			let output1 = "To add an existing role to the self-assignable database:\n`$sar Name\ngroup: Group Name (optional)\ngive: Special Give Message (optional)\ntake: Special Take Message (optional)`\n";
			output1 += "To create a new role that is optionally colored, pingable, hoisted, and/or grouped:\n`$car Role Name\ncolor: Color, ping, hoist, group: GroupName (all optional)`\n";
			output1 += "The same syntax with `$sgr` or `$cgr` instead of `$sar` or `$car` will add a role that can only be given with the $giverole command, and `$scr` or `$ccr` to add a role that is countable with the $inrole command, while `$cnr` simply creates the new role.\n";
			output1 += "`$unset Role Name` to remove an assignable role.\n";
			output1 += "`$regroup index Role Name` to assign a different group to a role.\n";
			output1 += "`$rename Role Name $to New Name` to rename a role.";
			let output2 = "`$addgroup Group Name` to add a new role grouping.\n";
			output2 += "`$excgroup Group Name` to add a new exclusive group or toggle exclusivity of existing group. Exclusive groups only let users have one of their roles, good for things like color roles.\n";
			output2 += "`$renamegroup index New Name` to rename a group.\n";
			output2 += "`$movegroup index Group Name` to move a group up to that index.\n";
			output2 += "`$deletegroup index` to delete the group at that index. This will leave its associated roles, but they will be ungrouped.";
			let output3 = "`$modrole Role Name` to assign a moderator role. They will be able to use the following commands:\n";
			output3 += "`$giverole @User RoleName` to give that user that role.\n";
			output3 += "`$silence @User` to have LackeyBot ignore their posts. Reversed with `$unsilence @User`.";
			output3 += "`$youarenot @User Rolename` to have LackeyBot not give that role to that user anymore. Reversed with `$youcanbe @User RoleName`.";
			var exampleEmbed = new Discord.MessageEmbed()
				.setColor('#00ff00')
				.setFooter("`$rolehelp` to get this message.")
				.addField("**Role Engine Help**", output)
				.addField("**Role Management**", output1)
				.addField("**Group Management**", output2)
				.addField("**User Management**", output3)
			msg.channel.send(exampleEmbed);
		}
		if(msg.content.match(/^\$role setup/i))
			msg.channel.send(newGuild(msg.guild.id))
		if(msg.guild && roleDex.guilds && roleDex.guilds.hasOwnProperty(msg.guild.id)) {
			let roleArray = Object.keys(roleDex.guilds[msg.guild.id].roles);
			let newGroupMatch = msg.content.match(/^\$(create|add|exc) ?group ([^\n]+)/i);
			let renameRoleMatch = msg.content.match(/^\$rename ?r?o?l?e? ([^\n]+) \$to ([^\n]+)/i);
			let renameGroupMatch = msg.content.match(/^\$rename ?group (\d+) ([^\n]+)/i);
			let moveGroupMatch = msg.content.match(/^\$move ?group (\d+) ([^\n]+)/i);
			let deleteGroupMatch = msg.content.match(/^\$delete ?group (\d+)/i)
			let reGroupMatch = msg.content.match(/^\$regroup (\d+) ([^\n]+)/i)
			let assignOldRoleMatch = msg.content.match(/^\$s(a|g|c)r ([^\n]+)(\ngroup: ([^\n]+))?(\ngive: ([^\n]+))?(\ntake: ([^\n]+))?/i)
			let unassignRoleMatch = msg.content.match(/^\$unset ([^\n]+)/i);
			let fightMatch = msg.content.match(/^$fight ?role ?([^\n])?/i);
			let newRoleMatch = msg.content.match(/^\$c(a|g|c|n)r ([^\n]+)\n?(color: ?([^\n ]+))?,? ?(ping)?,? ?(hoist)?,? ?(group: ?([^\n]+))?/i);
			let modCheck = msg.content.match(/^\$mod ?role ([^\n]+)/i);
			let excludeRoleMatch = msg.content.match(/^\$you ?(arenot|canbe)([^\n]+) <?@?!?([0-9]+)>?$/i)
			let giveMatch = msg.content.match(/^\$give ?role <?@?!?([0-9]+)>? ([^\n]+)/i);
			let silentCheck = msg.content.match(/^\$(un)?silence <?@?!?([0-9]+)>?/i)
			
			if(newGroupMatch){
				if(newGroupMatch[1] && newGroupMatch[1] == "exc"){
					msg.channel.send(makeExclusiveGroup(msg.guild.id, newGroupMatch[2]));
					setTimeout(function(){version.logRole(roleDex)}, 1000)
				}else{
					msg.channel.send(newGroup(msg.guild.id, newGroupMatch[2]))
						.then(mess => version.logRole(roleDex))
						.catch(e => console.log(e))
				}
			}
			if(msg.content.match(/^\$group ?index/i)) {
				let embedded = new Discord.MessageEmbed()
					.addField("Guild Group indexes:",toolbox.writeIndexes(roleDex.guilds[msg.guild.id].groups))
				msg.channel.send(embedded);
			}
			if(renameRoleMatch) {
				msg.channel.send(renameRole(msg.guild.id, renameRoleMatch[1], renameRoleMatch[2]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(renameGroupMatch) {
				msg.channel.send(renameGroup(msg.guild.id, renameGroupMatch[1], renameGroupMatch[2]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(moveGroupMatch) {
				let roleIndex = roleDex.guilds[msg.guild.id].groups.indexOf(moveGroupMatch[2])
				msg.channel.send(moveGroup(msg.guild.id, roleIndex, moveGroupMatch[1]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(deleteGroupMatch) {
				msg.channel.send(removeGroup(msg.guild.id, deleteGroupMatch[1]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(reGroupMatch) {
				msg.channel.send(reGroup(msg.guild.id, reGroupMatch[1], reGroupMatch[2]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(assignOldRoleMatch) {
				let groupN = ""; giveM = ""; takeM = "";
				if(assignOldRoleMatch[4])
					groupN = assignOldRoleMatch[4];
				if(assignOldRoleMatch[6])
					giveM = assignOldRoleMatch[6];
				if(assignOldRoleMatch[8])
					takeM = assignOldRoleMatch[8];
				if(assignOldRoleMatch[1] == "a") {
					msg.channel.send(newAssignableRole(msg.guild.id, assignOldRoleMatch[2], giveM, takeM, groupN))
						.then(mess => version.logRole(roleDex))
						.catch(e => console.log(e))
				}else if(assignOldRoleMatch[1] == "g") {
					msg.channel.send(newGivenRole(msg.guild.id, assignOldRoleMatch[2], giveM, takeM, groupN))
						.then(mess => version.logRole(roleDex))
						.catch(e => console.log(e))
				}else if(assignOldRoleMatch[1] == "c") {
					msg.channel.send(newCountableRole(msg.guild.id, assignOldRoleMatch[2]))
						.then(mess => version.logRole(roleDex))
						.catch(e => console.log(e))
				}
			}
			if(unassignRoleMatch) {
				msg.channel.send(unassignRole(msg.guild.id, unassignRoleMatch[1]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(fightMatch){
				let fightRole = null;
				if(fightMatch[2])
					fightRole = fightMatch[2];
				msg.channel.send(toggleFightRole(msg.guild.id, fightRole))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}
			if(newRoleMatch){
				let roleName = newRoleMatch[2];
				let roleColor = null;
				let hoist = false;
				let pingable = false;
				let group = "";
				if(newRoleMatch[4])
					roleColor = newRoleMatch[4];
				if(newRoleMatch[5])
					pingable = true;
				if(newRoleMatch[6])
					hoist = true;
				if(newRoleMatch[8])
					group = newRoleMatch[8];
				createNewRole(msg.guild.id, roleName, roleColor, hoist, pingable, group, msg.channel, newRoleMatch[1])
				version.logRole(roleDex)
			}
			if(modCheck) {
				roleDex.guilds[msg.guild.id].modRole = modCheck[1];
				msg.channel.send(modCheck[1] + " set as the mod role.")
				version.logRole(roleDex);
			}
			if(excludeRoleMatch) {
				msg.channel.send(excludeRole(msg.guild.id, excludeRoleMatch[1], excludeRoleMatch[3], excludeRoleMatch[2]))
					.then(mess => version.logRole(roleDex))
					.catch(e => console.log(e))
			}					
			if(giveMatch){
				let thatMember = Client.guilds.cache.get(msg.guild.id).members.cache.get(giveMatch[1]);
				let test = false;
				if(roleDex.guilds[msg.guild.id].roles.hasOwnProperty(giveMatch[2].toLowerCase())) {
					test = adjustRoles(giveMatch[2].toLowerCase(), msg.guild.id, thatMember, "roles");
				}else if(roleDex.guilds[msg.guild.id].givable.hasOwnProperty(giveMatch[2].toLowerCase())){
					test = adjustRoles(giveMatch[2].toLowerCase(), msg.guild.id, thatMember, "givable");
				}
				if(test)
					msg.channel.send(test.replace(/^You/, eris.pullUsername(giveMatch[1])).replace("have","has"));
			}
			if(silentCheck) {
				let thisBanned = roleDex.guilds[msg.guild.id].banned;
				if(silentCheck[1]){
					if(thisBanned.includes(silentCheck[2])) {
						let index = thisBanned.indexOf(silentCheck[2]);
						thisBanned = thisBanned.splice(index, 1);
						msg.channel.send(eris.pullUsername(silentCheck[2]) + " has been unsilenced.")
					}else{
						msg.channel.send(eris.pullUsername(silentCheck[2]) + " is not silenced.")
					}
				}else{
					thisBanned.push(silentCheck[2])
					msg.channel.send(eris.pullUsername(silentCheck[2]) + " has been silenced.");
				}
				version.logRole(roleDex);
			}
		}
	}
	if(msg.guild && roleDex && roleDex.guilds && roleDex.guilds.hasOwnProperty(msg.guild.id)){
		let thisGuild = msg.guild.id;
		let rolecheck = msg.content.toLowerCase().match(roleRegex[thisGuild]);
		if(rolecheck != null) {
			let test = adjustRoles(rolecheck[2], thisGuild, msg.member, "roles", rolecheck[1]);
			if(test)
				msg.channel.send(test.replace("$USER", msg.author.username));
		}else{
			let iamCheck = msg.content.toLowerCase().match(/\$iam(n|not)? ([^\$]+)/);
			if(iamCheck){
				let closestName = fuzzy.searchArray(iamCheck[2].replace(/ /g,""), Object.keys(roleDex.guilds[thisGuild].roles,{percent:0.33}))[0];
				let test = adjustRoles(closestName, thisGuild, msg.member, "roles", iamCheck[1]);
				if(test)
					msg.channel.send(test.replace("$USER", msg.author.username));
			}
		}
		if(msg.content.match(/\$fblthp/i)){
			if(msg.guild.id == "317373924096868353") {
			stats.upBribes(1);
				msg.member.roles.remove("372453779418775553").catch(console.error);
				msg.channel.send(msg.author.username + " has left the arena. <:fblthp:372438950171770891>");
			}else{
				msg.channel.send("<:fblthp:372438950171770891>")
			}
		}
		if(msg.content.match(/\$mklthd/i)){
			stats.upBribes(1);
			if(msg.guild.id == "317373924096868353") {
				msg.member.roles.add("372453779418775553").catch(console.error);
				msg.channel.send(msg.author.username + " is looking for an opponent! <:mklthd:372438015374655500>");
			}else{
				msg.channel.send("<:mklthd:372438015374655500>")
			}
		}
		if(msg.content.match(/\$(roles|lsar)/i)){
			stats.upBribes(1);
			let embedInfo = buildRoleEmbed(msg.guild.id, 0)
			let messyCallback = async function(mess) {
				if(embedInfo[1]>1) {
					mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
					.catch(console.log("An emote didn't spawn"))
				}
				return mess;
			}
			let callback = function(mess) {
				messyCallback(mess)
					.then(mess.react(plainText))
					.catch(console.log("An emote didn't spawn"))
			}
			msg.channel.send(embedInfo[0])
				.then(mess => callback(mess))
				.catch(console.log("An emote didn't spawn"))
		}
		let inroleMatch = msg.content.match(/^\$inrole ([^\n]+)/i)
		if(inroleMatch) {
			let roleName = inroleMatch[1].toLowerCase();
			stats.upBribes(1);
			let embedInfo = buildInRoleEmbed(msg.guild, roleName, 0);
			if(embedInfo[1] === null) {
				msg.channel.send(embedInfo[0])
			}else{
				msg.channel.send(embedInfo[0])
					.then(function(mess) { mess.react(plainText).then(() => {if(embedInfo[1]>1){mess.react(leftArrow)
					.then(() => mess.react(rightArrow))}})})
					.catch(console.log("An emote didn't spawn"))
			}
				
		}
	}else{
		if(msg.content.match(/\$fblthp/i)){
			stats.upBribes(1);
			msg.channel.send("<:fblthp:372438950171770891>")
		}
		if(msg.content.match(/\$mklthd/i)){
			stats.upBribes(1);
			msg.channel.send("<:mklthd:372438015374655500>")
		}
	}
	if(msg.guild && roleDex && roleDex.fightGuilds && roleDex.fightGuilds.hasOwnProperty(msg.guild.id)) { //guilds with $fight commands
		if(msg.content.match(/\$fi(ght|te)/i)){
			if(msg.member.roles.cache.find(val => val.id == roleDex.fightGuilds[msg.guild.id])){
				msg.member.roles.remove(roleDex.fightGuilds[msg.guild.id]).catch(console.error);
				msg.channel.send(msg.author.username + " has left the arena. <:fblthp:372438950171770891>");
			}else{
				msg.member.roles.add(roleDex.fightGuilds[msg.guild.id]).catch(console.error);
				msg.channel.send(msg.author.username + " is looking for an opponent! <:mklthd:372438015374655500>");
			}
		}
		if(msg.content.match(/\$unfi(ght|te)/i)){
			stats.upBribes(1);
			msg.member.roles.remove(roleDex.fightGuilds[msg.guild.id]).catch(console.error);
			msg.channel.send(msg.author.username + " has left the arena. <:fblthp:372438950171770891>");
		}
	}
}
function helpMessage() {
	let helpout = "**Roles Help**\n";
	helpout += "`$roles` or `$lsar` to see a list of self-assignable roles for this server.\n";
	helpout += "`$iam roleName` to toggle that role on yourself.\n";
	helpout += "`$iamn roleName` to remove that role from yourself.\n";
	helpout += "`$inrole roleName` for a list of users in that role. The embed's color will be the color of that role.\n";
	helpout += "For server admins: `$role setup` to begin setting up LackeyBot for this server, then `$role help` for a list of commands to set up self-assignable roles.\n";
	return helpout;
}
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.buildRoleEmbed = buildRoleEmbed;
exports.buildInRoleEmbed = buildInRoleEmbed;
exports.buildRoleRegex = buildRoleRegex;
exports.roleDex = roleDex;
exports.roleRegex = roleRegex;
exports.dl = dl;
exports.liveGuild = function(id) {
	return roleDex.guilds.hasOwnProperty(id);
}