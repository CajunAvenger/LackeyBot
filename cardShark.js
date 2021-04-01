/* cardShark
 arcana commands
*/
var config = require('./config/lackeyconfig.js').config;
var fuzzy = require('./fuzzy.js');
var arcana = require('./arcana.js');
var mod_magic = require('./magic.js');
var psScrape = require('./psScrape.js');
var eris = require('./eris.js');
var Client = eris.Client();
var Discord = require('discord.js');
var download = require('download-file');
var mechanics = require("./msem/mechs.json");
var ruleJson = require("./canon/cr.json");
var extras = require("./msem/extras.json");
var rp = require('request-promise-native');
var stats = require("./stats.js");
var toolbox = require("./toolbox.js");
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
//cr engine
function sendRuleData (testRul) {							//generates data for a given CR entry
	testRul = testRul.replace(/\.([a-z])/, "$1");
	let rulMatch = testRul.match(/([0-9]{3})\.?([0-9]*)(\.|[a-z])?/);
	let ruleData = {
		title: "",
		lines: [],
		nextRule: "",
		prevRule: "",
		ruleNames: []
	}
	let rulesList = Object.keys(ruleJson.rules);
	if(rulMatch && rulMatch[3] && ruleJson.rules.hasOwnProperty(testRul)) { //if a precise rule, send just that
		ruleData.title = testRul;
		ruleData.ruleNames.push(testRul);
		ruleData.lines = ruleJson.rules[testRul];
		let index = rulesList.indexOf(testRul);
		ruleData.nextRule = rulesList[(index+1)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
	}else if(rulMatch && rulMatch[2] && ruleJson.rules.hasOwnProperty(testRul)) { //if an XXX.YY, send that and as many subrules as you can
		ruleData.title = testRul;
		ruleData.ruleNames.push(testRul);
		ruleData.lines = ruleJson.rules[testRul];
		for(let rul in ruleData.lines) {
			if(ruleJson.rules.hasOwnProperty(ruleData.lines[rul])) {
				ruleData.ruleNames.push(ruleData.lines[rul]);
				ruleData.lines[rul] = "**" + ruleData.lines[rul] + "** " + ruleJson.rules[ruleData.lines[rul]]
			}
		}
		let index = rulesList.indexOf(testRul);
		ruleData.nextRule = rulesList[(index+ruleData.ruleNames.length)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
	}else if(rulMatch && rulMatch[1] && ruleJson.rules.hasOwnProperty(rulMatch[1])) { //if an XXX, send that and as many subrules as you can
		ruleData.title = rulMatch[1];
		ruleData.ruleNames.push(rulMatch[1]);
		ruleData.lines = ruleJson.rules[rulMatch[1]];
		for(let rul in ruleData.lines) {
			if(ruleJson.rules.hasOwnProperty(ruleData.lines[rul])) {
				ruleData.ruleNames.push(ruleData.lines[rul]);
				ruleData.lines[rul] = "**" + ruleData.lines[rul] + "** " + ruleJson.rules[ruleData.lines[rul]]
			}
		}
		let index = rulesList.indexOf(rulMatch[1]);
		ruleData.nextRule = rulesList[(index+ruleData.ruleNames.length)%rulesList.length];
		ruleData.prevRule = rulesList[Math.max(0,index-1)];
	}else{
		let glos = false;
		if(!rulMatch){
			if(ruleJson.glossary.hasOwnProperty(testRul))
				glos = testRul;
			glos = fuzzy.searchArray(testRul, Object.keys(ruleJson.glossary).reverse(), {score:3})[0];
		}
		if(glos) {
			ruleData.title = glos;
			ruleData.lines = ruleJson.glossary[glos]
			let seeCheck = ruleJson.glossary[glos][0].match(/see (rules? )?([^,]+)/i);
			if(seeCheck) {
				if(seeCheck[1]) {
					let temp = sendRuleData(seeCheck[2]);
					for(let lin in temp.lines)
						ruleData.lines.push(temp.lines[lin])
					ruleData.ruleNames = temp.ruleNames;
					ruleData.ruleNames.reverse()
					ruleData.ruleNames.push(glos)
					ruleData.ruleNames.reverse()
					ruleData.nextRule = temp.nextRule;
					ruleData.prevRule = temp.prevRule;
				}else if(ruleJson.glossary.hasOwnProperty(seeCheck[1])){
					ruleData.lines.push(seeCheck[1])
					ruleData.ruleNames = [glos, seeCheck[1]];
					ruleData.nextRule = null;
					ruleData.prevRule = null;
				}
			}
		}else{
			ruleData.title = "Comprehensive Rules";
			ruleData.ruleNames = ["000"];
			ruleData.lines = ["Rule not found."];
			ruleData.nextRule = rulesList[0];
			ruleData.prevRule = rulesList[rulesList.length-1];
		}
	}
	return ruleData;
}
function buildCREmbed(testrul, textFlag) {					//build !cr embeds
	let ruleData = sendRuleData(testrul);
	let breakout = 0;
	let output = "";
	let max = 2046;
	let footer = "";
	if(textFlag) {
		output += "**" + ruleData.title + "**";
		max = 1998;
	}
	for(let line in ruleData.lines) {
		if(!breakout && output.length + ruleData.lines[line].length > max)
			breakout = line;
		if(!breakout)
			output += "\n" + ruleData.lines[line]
		if(breakout || line == ruleData.lines.length-1) {
			footer = `Previous ${ruleData.prevRule}\nNext `
			if(breakout) {
				footer += `${ruleData.ruleNames[breakout]}`;
			}else{
				footer += `${ruleData.nextRule}`;
			}
		}
	}
	if(textFlag) {
		let nullEmbed = new Discord.MessageEmbed()
			.setTitle(ruleData.title)
			.setFooter(footer)
		return [output, nullEmbed];
	}else{ //embed
		let embedData = new Discord.MessageEmbed()
			.setTitle(ruleData.title)
			.setDescription(output)
			.setFooter(footer)
		return ["", embedData];
	}
}
function scryCard(cardName) { 								//get scryfall data for a card
	let cardStuff = arcana.magic.cards[cardName];
	let testurl = "https://api.scryfall.com/cards/" + cardStuff.scryID;
	let requestPromise;
	requestPromise = new Promise((resolve, reject) => {
		rp({url: testurl, json: true}).then(body => {
			resolve(body);
		}, () => {
			console.log('Falling back to fuzzy search for '+cardName);
			rp({url: testurl, json: true})
				.then(response => resolve({data: [response]}), reject);
		});
	});
	return requestPromise;
}
async function priceCanon (name) {							//get the price data
	//name = "Fold into Aether_5DN";
	let priceStuff = '';
	let callback = function (data) {
		priceStuff = data.prices;
	}
	let beep = scryCard(name)
		.then(data => callback(data))
		.catch(e => console.log(e))
	let pricewait = await beep;
	return priceStuff;
}
async function asyncPriceData (cardName, page) {			//convert price to string
	if(fuzzy.embedCache.prices.hasOwnProperty(cardName)) {
		buildPriceEmbed(cardName, page)
	}else{
		let priceObj = await priceCanon(cardName); //"usd":"0.19","usd_foil":"1.12","eur":"0.05","tix":"0.03"
		let priceString = "";
		if(priceObj.usd != null) {
			priceString += "$" + priceObj.usd;
			if(priceObj.usd_foil != null)
				priceString += " ($" + priceObj.usd_foil + " Foil)"
			priceString += " | "
		}
		if(priceObj.eur != null)
			priceString += priceObj.eur + "€ | "
		if(priceObj.tix != null)
			priceString +=	priceObj.tix + " Tix";
		priceString = priceString.replace(" | | ", " | ")
		priceString = priceString.replace(/ \| $/, "")
		return priceString;
	}
}
function buildSetsEmbed (library, page, textFlag) {			//build $codes embed
	let helpout = "";
	let desc = library.bigname + " Set Codes";
	let setsDatabase = library.setData;
	let setCount = 0;
	for(let thisSet in setsDatabase) {
		helpout += "**" + thisSet + "**: " + setsDatabase[thisSet].longname + "\n";
		setCount++;
	}
	let lines = helpout.split('\n');
	if(textFlag) {
		let start = 0 + 20*page;
		let end = Math.min(lines.length, start+20);
		let pages = Math.ceil(lines.length / 20)
		let output = desc + ":";
		for(let i=start;i<end;i++) {
			output += "\n" + lines[i];
		}
		let nullEmbed = new Discord.MessageEmbed()
			.setDescription('**' + desc + '**')
			.setFooter('Page ' + parseInt(page+1) + '/' + pages)
			return [[output, nullEmbed]];
	}
	let inlines = [[],[],[]]
	let thirds = Math.ceil(Math.min(60,lines.length) / 3);
	let start = 0 + 60*page;
	let end = start + thirds;
	let pages = Math.ceil(lines.length / 60)
	for(let i=start; i<end; i++) {
		let first = i;
		let second = i+thirds;
		let third = i+thirds+thirds;
		if(third >= lines.length)
			third = null;
		if(lines[first])
			inlines[0].push(lines[first])
		if(lines[second])
			inlines[1].push(lines[second])
		if(lines[third])
			inlines[2].push(lines[third])
	}
	end = Math.min(setCount, end);
	let embedded = new Discord.MessageEmbed()
		.setDescription('**' + desc + '**')
		.setFooter('Page ' + parseInt(page+1) + '/' + pages)
	if(inlines[0].length > 0 && inlines[0][0] != "")
		embedded.addField('Codes ' + parseInt(1+start) + '-' + end + ":", inlines[0], true)
	if(inlines[1].length > 0 && inlines[1][0] != "")
		embedded.addField('Codes ' + parseInt(start+thirds+1) + "-" + parseInt(start+2*thirds) + ":", inlines[1], true)
	if(inlines[2].length > 0 && inlines[2][0] != "")
		embedded.addField('Codes ' + parseInt(start+2*thirds+1) + "-" + parseInt(Math.min(start+3*thirds, lines.length)) + ":", inlines[2], true)
	let reportPages = Math.ceil(lines.length / 20); //set the arrows in case of plaintexting
	return [embedded, reportPages];
}
function generateStats(library, thisSet) { 					//generates $stats messages
	let setInfo;
	if(thisSet == "MSEM" && library == arcana.msem) {
		setInfo = {longname: "MSE Modern", masterpiece: false, msem: true};
	}else{
		setInfo = library.setData[thisSet];
	}
	let statput = `${setInfo.longname} has $SETCARDS cards `
	let mastermatch = thisSet.match(/MPS_/);
	if(mastermatch == null) {
		statput += "($SETRARITY), "
	}else{
		statput += "and "
	}
	statput += "$SETTOKENS tokens, and $SETPROMOS."
	statput += `\nThe set's most common mana cost is $SETCOMMON.\n${setInfo.longname}'s converted mana cost is $SETMANA.\nIf ${setInfo.longname} was animated, it would be a $SETPT $SETTYPE.`
	if(setInfo.hasOwnProperty('Design') && setInfo.Design) {
		statput += `\nSet Design: ${setInfo.Design}`;
	}
	if(setInfo.hasOwnProperty('leadID') && setInfo.leadID) {
		statput += `\nSet Design: ${eris.pullUsername(setInfo.leadID)}`;
	}
	if(setInfo.hasOwnProperty('psSet') && setInfo.psSet) {
		statput += `\nPlanesculptors Page: http://www.planesculptors.net/set/${setInfo.psSet}`;
	}
	if(extras.hasOwnProperty(thisSet))
		statput = extras[thisSet]
	if(setInfo.hasOwnProperty("Link") && setInfo.Link)
		statput += `\nSet Download: <${setInfo.Link}>`;

	let setCardCount = 0;
	let setRareDist = {common:0, uncommon:0, rare:0, "mythic rare":0, bonus:0, "basic land":0, special:0, masterpiece:0, token:0};
	let setManaCost = {};
	let setCMC = 0;
	let setPower = 0;
	let setToughness = 0;
	let setType = {};
	let thisType = "";
	for(var thisCard in library.cards) {
		if(setInfo.hasOwnProperty('msem') || library.cards[thisCard].setID == thisSet || library.cards[thisCard].setID == setInfo.masterpiece || (library.cards[thisCard].setID == "tokens" && library.cards[thisCard].cardID.match(thisSet))) {
			setRareDist[library.cards[thisCard].rarity]++;
			if(library.cards[thisCard].rarity.match(/(common|uncommon|rare|mythic rare|basic land|bonus)/) || mastermatch) {
				setCardCount++;
				let testPow = parseInt(library.cards[thisCard].power);
				if(!isNaN(testPow))
					setPower += testPow;
				if(library.cards[thisCard].hasOwnProperty('power2')){
					testPow = parseInt(library.cards[thisCard].power2);
					if(!isNaN(testPow))
						setPower += testPow;
				}
				testPow = parseInt(library.cards[thisCard].toughness);
				if(!isNaN(testPow))
					setToughness += testPow;
				if(library.cards[thisCard].hasOwnProperty('toughness2')){
					testPow = parseInt(library.cards[thisCard].toughness2);
					if(!isNaN(testPow))
						setToughness += testPow;
				}

				if(library.cards[thisCard].cmc != "")
					setCMC += parseInt(library.cards[thisCard].cmc);
				if(library.cards[thisCard].hasOwnProperty('cmc2') && library.cards[thisCard].cmc2 != "")
					setCMC += parseInt(library.cards[thisCard].cmc2);
				if(library.cards[thisCard].cardType.match(/Creature/)) {
					let thisType = library.cards[thisCard].typeLine.split(" — ")[1];
					if(!setType.hasOwnProperty(thisType)) {
						setType[thisType] = {};
						setType[thisType].count = 0;
					}
					setType[thisType].count++;
				}
				if(library.cards[thisCard].hasOwnProperty('cardType2') && library.cards[thisCard].cardType.match(/Creature/)) {
					let thisType = library.cards[thisCard].typeLine2.split(" — ")[1];
					if(!setType.hasOwnProperty(thisType)) {
						setType[thisType] = {};
						setType[thisType].count = 0;
					}
					setType[thisType].count++;
				}
				if(library.cards[thisCard].manaCost != "") {
					let thisCost = library.cards[thisCard].manaCost;
					if(!setManaCost.hasOwnProperty(thisCost)) {
						setManaCost[thisCost] = {};
						setManaCost[thisCost].count = 0;
					}
					setManaCost[thisCost].count++;
				}
			}
		}
	}
	let bestType = ["",0];
	let bestCost = ["",0];
	for(let type in setType) {
		if(setType[type].count > bestType[1])
			bestType = [type,setType[type].count];
	}
	for(let cost in setManaCost) {
		if(setManaCost[cost].count > bestCost[1])
			bestCost = [cost,setManaCost[cost].count];
	}
	let RarityDist = "";
	if(setRareDist.common > 0)
		RarityDist += setRareDist.common + "C, ";
	if(setRareDist.uncommon > 0)
		RarityDist += setRareDist.uncommon + "U, ";
	if(setRareDist.rare > 0)
		RarityDist += setRareDist.rare + "R";
	if(setRareDist["mythic rare"] > 0)
		RarityDist += ", " + setRareDist["mythic rare"] + "M";
	if(setRareDist["basic land"] > 0)
		RarityDist += ", " + setRareDist["basic land"] + "L";
	if(setRareDist.bonus > 0)
		RarityDist += ", " + setRareDist.bonus + "B";
	let setPromos = setRareDist.special +" promos";
	if(setRareDist.special == 1)
		setPromos = "1 promo";
	if(setRareDist.special == 0)
		setPromos = "no promos";
	let setPT = setPower + "/" + setToughness;
	statput = statput.replace("$SETCARDS",setCardCount);
	statput = statput.replace("$SETRARITY", RarityDist);
	statput = statput.replace("$SETTOKENS", setRareDist.token);
	statput = statput.replace("$SETPROMOS", setPromos);
	statput = statput.replace("$SETCOMMON", bestCost[0]);
	statput = statput.replace("$SETMANA", setCMC);
	statput = statput.replace("$SETPT", setPT);
	statput = statput.replace("$SETTYPE", bestType[0].replace(/ $/,""));
	statput = statput.replace("$SETMASTER", setRareDist.masterpiece);
	statput = statput.replace(", and no promos", "");
	statput = statput.replace(" and 0 tokens", "");
	statput = statput.replace(", 0 tokens", "");
	
	return statput;
}
function buildSearchLink(library, searchString) { 			//generates search link from proper site
	let output = "";
	if(library.searchData.site) {
		output += "<" + library.searchData.site;
		//generate the link
		output += encodeURIComponent(searchString);
		output += library.searchData.end + ">";
		output = output.replace(/ /g, "+");
		output = output.replace(/["“”]/g, "%22");
	}
	return output;
}
function buildSearchEmbed(searchString, library, page, imgFlag, textFlag) {									//builds $search embeds
	searchString = fuzzy.formatScryfallKeys(searchString);
	let searchLink = buildSearchLink(library, searchString);
	let site = library.searchData.title + " search";
	let database = library.cards;
	let valids = fuzzy.scryDatabase(library, searchString);
	if(valids[1] && library.searchData.title == "Scryfall")
		searchLink = searchLink.replace(">","&unique=prints>");
	let bumpedPage = parseInt(page+1);
	let hits = valids[0].length;
	let count = '1 hit found:';
	if(hits == 0) {
		let nohits = ['LackeyBot detected 0 hits.','This may be because you used a key LackeyBot doesn\'t support or a difference in databases. If this is an error, please tell Cajun.'];
		if(valids[2] == true)
			nohits = ['LackeyBot timed out.','Your search terms were too much for the little guy. Please use the Scryfall link instead.'];
		var embedded = new Discord.MessageEmbed()
			.setDescription("["+site+"]("+searchLink+" '"+searchString+"')")
			.addField(nohits[0], nohits[1])
		return [embedded, hits];
	}
	if(hits > 1)
		count = hits + ' hits found, showing the '+toolbox.ordinalize(bumpedPage)+':'
	if(page == -1) {
		count = count.replace(/found[^\n]+/i, "found. Check the link, or react to preview.")
	}
	if(valids[2] == true)
		count = 'LackeyBot timed out, only partial results will be shown: ' + count;
	if(textFlag) {
		let embedText = "";
		if(valids[2] == true)
			embedText += 'LackeyBot timed out, only partial results will be shown: ';
		embedText += hits + " hits found: " + searchLink;
		if(page != -1)
			embedText += "\n" + library.writeCard(valids[0][page], true);
		let nullEmbed = new Discord.MessageEmbed()
			.setFooter('Page ' + bumpedPage + '/' + hits + ". 🔍 for image, ❌ to collapse, 💬 for plaintext.")
			.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')")
		return [[embedText, nullEmbed]]
	}
	//build the embed
	var embedded = new Discord.MessageEmbed()
		.setFooter('Page ' + bumpedPage + '/' + hits + ". 🔍 for image, ❌ to collapse, 💬 for plaintext.")
	if(page != -1) {
		if(imgFlag) {
			embedded.addField(count, database[valids[0][page]].fullName)
			embedded.setImage(printImages([valids[0][page]], library, true))
		}else{
			embedded.addField(count, library.writeCard(valids[0][page], true))
			embedded.setThumbnail(printImages([valids[0][page]], library, true))
		}
		embedded.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')")
	}else{
		embedded.setDescription("["+site+"]("+searchLink.replace(/[<>]/g,"")+" '"+searchString+"')\n"+count)
	}
	return [embedded, hits];
}
function printImages(card_array, library, first) { 			//generates link from proper site
	if(card_array == [])
		return;
	let printString = "";
	for(let thisCard in card_array) {
		printString += library.printImage(card_array[thisCard], first) + "\n";
	}
	return printString.replace(/\n$/,"");
}
//MSE
function namelistBuilder(database, user) {					//creates a list of names for the Name Exporter
	let namelistArray = [];
	let nameString = "";
	for(let thisCard in database) {
		if(namelistArray.includes(database[thisCard].cardName) || database[thisCard].rarity == "basic land" || database[thisCard].setID == "CMB1" || database[thisCard].setID == "tokens" || database[thisCard].shape == "command"){
			//console.log(database[thisCard].cardName.replace(/\*/g,""))
		}else{
			namelistArray.push(database[thisCard].cardName);
			if(database[thisCard].cardName2 !== undefined)
				namelistArray.push(database[thisCard].cardName2);
		}
	}
	for(var i=0; i<namelistArray.length; i++) {
		nameString += namelistArray[i];
		if(i !== namelistArray.length-1)
			nameString += "|";
	}
	let nearnameString = nameString.replace(/(and|or|in|into|to|upon|the|of|from|at|through|with) /ig, "");
	nameString = "	#The name list\n	name_list := { \"(" + nameString + ")\"}\n\n";
	nameString += "	near_name_list := { \"(" + nearnameString + ")\"}\n";
	fs.writeFile('namelist.txt', nameString, (err) => {
		if (err) throw err;
		});
	user.send({
		files: [{attachment:"./namelist.txt", name:"namelist.txt"}]
		});
}
function wildcardVoter(user, content) {						//post and anonymize wildcard voters
	let wildcardChannel = Client.channels.cache.get('777455867725479966')
	if(!scratchPad.wildcard[user]) {
		wildcardChannel.send(content)
			.then(function(mess) {
				scratchPad.wildcard[userID] = messID;
				version.logScratchpad();
			})
			.catch(e => console.log(e))
	}else{
		let theirPost = wildcardChannel.messages.fetch(scratchPad.wildcard[user])
			.then(mess => mess.edit(content))
			.catch(e => console.log(e))
	}
}

function messageHandler(msg, perms) {
	let arcanaData = arcana.configureArcana(msg);
	if(perms.includes(0)) {
	let jsoncheck = msg.content.match(/!json ([A-Z0-9_]+)/i);
	if(jsoncheck && arcana.hasOwnProperty(jsoncheck[1])) {
		for(let thisSet in arcana[jsoncheck[1]].setData) //instigator file for each set
			mod_magic.wtfjsonBuilder(thisSet, msg.author, arcana[jsoncheck[1]]);
		mod_magic.mtgjsonSetsBuilder(msg.author, arcana[jsoncheck[1]])	//mtgv5 file for format
	}
		if(msg.content.match("!namebuild custom")) //builds a namelist for MSEM
			namelistBuilder(arcana.msem.cards, msg.author);
		if(msg.content.match("!namebuild canon")) //builds a namelist for MSE
			namelistBuilder(arcana.magic.cards, msg.author);

	}
	//General Commands
	//These are commands that work with any/most sets in Arcana

	let statFirst = msg.content.match(/(\$|!|\?)stats? [^\n]+/i);
	if(statFirst) { 
		let setstrings = "", ministrings = "";
		let statBase = arcanaData.square.data;
		if(statFirst[1] == "!")
			statBase = arcanaData.angle.data;
		if(statFirst[1] == "?")
			statBase = arcanaData.curly.data;
		for(let thisSet in statBase.setData) {
			if(thisSet.length == 1) {
				ministrings += thisSet + "|";
			}else{
				setstrings += thisSet + "|";
			}
		}
		setstrings += ministrings;
		
		if(statBase == arcana.msem) {
			setstrings += "MSEM";
		}else{
			setstrings = setstrings.replace(/\|$/, "");
		}
		let setRegex = new RegExp('s?tats? (' + setstrings + ')','i')
		statcheck = statFirst[0].toUpperCase().match(setRegex);
		if(statcheck) { //if set's in the base, send it
			stats.upBribes(1);
			msg.channel.send(generateStats(statBase, statcheck[1]));
		}else{ //else null statFirst for $stats
			statFirst = null;
		}
	}else if(msg.content.match(/\$s?tat/i)) { //lackey stats
		stats.upBribes(1);
		let statput = "LackeyBot has fetched $COUNT cards, accepted $BRIBE bribes, started $DRAFT drafts, cracked $PACK packs, set $REMIND reminders, completed $DONE reminders, and only exploded $EXPLODE times. LackeyBot has become a god among goblinkind.";
		statput = statput.replace("$COUNT",stats.cardCount);
		statput = statput.replace("$BRIBE",stats.bribes);
		statput = statput.replace("$EXPLODE",stats.explosions);
		statput = statput.replace("$DRAFT",stats.drafts);
		statput = statput.replace("$PACK",stats.packs);
		statput = statput.replace("$REMIND",stats.reminderSet);
		statput = statput.replace("$DONE",stats.reminderDone);
		msg.channel.send(statput);
	}

	let scodeMatch = msg.content.match(/(\$|\?|!)(set|code)/i);
	if(scodeMatch){
		stats.upBribes(1);
		let library;
		if(scodeMatch[1] == "$")
			library = arcanaData.square.data;
		if(scodeMatch[1] == "!")
			library = arcanaData.angle.data;
		if(scodeMatch[1] == "?")
			library = arcanaData.curly.data;
		let embedded = buildSetsEmbed(library, 0)
		let messyCallback = function (mess) {
			mess.react(plainText)
				.then(function() {
					if(embedded[1] > 1) {
						mess.react(leftArrow)
							.then(() => mess.react(rightArrow))
							.catch(e => console.log(e))
					}
				})
				.catch(e => console.log(e))
		};
		msg.channel.send(embedded[0])
			.then(mess => messyCallback(mess))
			.catch(e => console.log(e))
	}
	//banlists todo generalize this better
	if(msg.content.match(/(!|\$)(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)? ?ban/)) {
		let bancheck = msg.content.match(/(brawl|commander|historic|legacy|modern|pauper|pioneer|standard|vintage|primordial)/i);
		if(bancheck) {
			bancheck = bancheck[1].toLowerCase();
			if(bancheck == 'vintage')
				bancheck = 'vintageRest';
			let canonLegal = arcana.magic.legal;
			let banlist = "";
			canonLegal[bancheck].sort();
			for(var i = 0; i < canonLegal[bancheck].length; i++) {
				banlist += "**" + canonLegal[bancheck][i] + "**";
				if(canonLegal[bancheck].length > 2 && i < canonLegal[bancheck].length-1)
					banlist += ", ";
				if(canonLegal[bancheck].length == 2)
					banlist += " ";
				if(i == canonLegal[bancheck].length-2)
					banlist += "and ";
			}
			banlist += " are banned in " + toolbox.toTitleCase(bancheck) + ".";
			banlist = banlist.replace("banned in Vintagerest","restricted in Vintage");
			if(bancheck == "legacy" || bancheck == "commander")
				banlist = canonLegal['conspiracy'].length + " conspiracy cards, " + banlist;
			if(bancheck == "vintageRest") {
				banlist += "\n" + canonLegal['conspiracy'].length + " conspiracy cards, ";
				for(var i = 0; i < canonLegal['vintage'].length; i++) {
					banlist += "**" + canonLegal['vintage'][i] + "**";
					if(canonLegal['vintage'].length > 2 && i < canonLegal['vintage'].length-1)
						banlist += ", ";
					if(canonLegal['vintage'].length == 2)
						banlist += " ";
					if(i == canonLegal['vintage'].length-2)
						banlist += "and ";
				}
				banlist = 
				banlist += " are banned in Vintage.";
			}
			msg.channel.send(banlist);
		}else if(msg.content.match(/\$ban/i)){
			let banlist = "";
			for(var i = 0; i < arcana.msem.legal.modernBan.length; i++) {
				banlist += "**" + arcana.msem.legal.modernBan[i] + "**";
				if(arcana.msem.legal.modernBan.length > 1)
					banlist += ", ";
			}
			banlist += "and 16 conspiracy cards are banned in MSEM.\r\n\r\n";
			for(var i = 0; i < arcana.msem.legal.edhBan.length; i++) {
				banlist += "**" + arcana.msem.legal.edhBan[i] + "**";
				if(arcana.msem.legal.edhBan.length == 1 && i == 0)
					banlist += " and ";
				if(arcana.msem.legal.edhBan.length > 1 && i < arcana.msem.legal.edhBan.length-2)
					banlist += ", ";
				if(arcana.msem.legal.edhBan.length > 1 && i == arcana.msem.legal.edhBan.length-2)
					banlist += ", and ";
			}
			banlist += ", and 16 conspiracy cards are banned in MSEDH.";			
			msg.channel.send(banlist);
			stats.upBribes(1);
		}
	}
	let searchCheck = msg.content.match(/(\$|!|\?)(s?earch|li?mitfy|scryf?a?l?l?) ([^\n]+)/i);
	if(searchCheck != null) {
		stats.upBribes(1);
		let library = arcanaData.square.data;
		if(searchCheck[1] == "?")
			library = arcanaData.curly.data;
		if(searchCheck[1] == "!")
			library = arcanaData.angle.data;
		if(searchCheck[2].match(/scryf?a?l?l?/))
			library = arcana.magic;
		//bank the cards
		let embedInfo = buildSearchEmbed(searchCheck[3], library, -1)
		let messyCallback = function (mess) {
			if(embedInfo[1] != 0) {
				mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
					.then(() => mess.react(mag))
					.then(() => mess.react(xEmote))
					.then(() => mess.react(plainText))
			}
		}
		msg.channel.send(embedInfo[0])
			.then(mess => messyCallback(mess))
			.catch(console.log("An emote didn't spawn"))
	}

	//fuzzytest
	var fuzzyMatch = msg.content.match(/([^\$\n]*) (\$|!|\?)fuzzytest ([^\$\n]*)/i);
	if(fuzzyMatch) {
		stats.upBribes(1)
		if(fuzzyMatch[2] == "$")
			msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.square.data));
		if(fuzzyMatch[2] == "!")
			msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.angle.data));
		if(fuzzyMatch[2] == "?")
			msg.channel.send(fuzzy.fuzzyCheck(fuzzyMatch[1], fuzzyMatch[3], arcanaData.curly.data));
	}	
	//Magic Commands
	//These are commands that work primarily/only with Magic

	//cr and canon mechanic checks
	let crRegex = msg.content.match(/!cr ([^!\n]+)/);
	if(msg.guild && msg.guild.id == "205457071380889601") {
		let mechstrings = "";
		let mechKeys = Object.keys(ruleJson.glossary)
		for(let i=mechKeys.length-1; i>=0; i--) {
			thisMech = mechKeys[i]
			if(!thisMech.match(/^(card|skip|play)/i)) //judgebot and rhythm overlaps
				mechstrings += thisMech + "|";
		}
		mechstrings = mechstrings.replace(/, /g, "|");
		mechstrings = mechstrings.replace(/\|$/,"");
		let mechCheck = new RegExp('(?:^!|[^@]!)(' + mechstrings + ')','i')
		crRegex = msg.content.match(mechCheck);
	}
	if(crRegex) {
		stats.upBribes(1);
		let embedData = buildCREmbed(crRegex[1]);
		msg.channel.send(embedData[0], embedData[1])
			.then(mess => mess.react(leftArrow)
				.then(() => mess.react(rightArrow)
					.then(() => mess.react(plainText)
						.then(() => mess.react(xEmote)))))
			.catch(e => console.log(e))
	}
	if(msg.content.match(/\$standard/i)) {
		stats.upBribes(1);
		let standardSets = [];
		for(let set in arcana.magic.setData) {
			if(arcana.magic.setData[set].standard)
				standardSets.push(set)
		}
		let output = "";
		let theDate = toolbox.arrayTheDate()
		let thisYear = theDate[0] + 2000;
		if(standardSets.length == 4) { //if a rotation just happened
			if(theDate[1] != "01") //and we're not in the gap before the Q1 set
				thisYear++; //they rotate next year
			output += "Rotates Q4 " + thisYear + "\n```";
			for(let set in standardSets)
				output += arcana.magic.setData[standardSets[set]].longname + " | ";
			output = output.replace(/ \| $/, "```")
		}else{
			output += "Rotates Q4 " + thisYear + ":\n```";
			for(let i = 0; i<standardSets.length; i++) {
				output += arcana.magic.setData[standardSets[i]].longname;
				if(i != 3 && i != standardSets.length-1)
					output += " | ";
				if(i == 3) {
					thisYear++
					output += "```\nRotates Q4 " + thisYear + ":\n```"
				}
			}
			output += "```";
		}
		msg.channel.send(output);
	}
	let pricesCheck = msg.content.match(/\$price ([^\$\n]+)/i)
	if(pricesCheck){
		let testName = fuzzy.scryDatabase(arcana.magic, pricesCheck[1])[0][0];
		if(testName == undefined)
			testName = fuzzy.searchCards(arcana.magic, pricesCheck[1])
		if(testName == undefined) {
			msg.channel.send("LackeyBot was unable to find a card that matched that search.")
		}else{
			let pricestring = asyncPriceData(testName)
				.then(pricestring => msg.channel.send("```Prices for " + testName + "\n" + pricestring + "```"))
				.catch(e => console.log(e))
		}
	}	
	//MSEM Commands
	//These are commands that work primarily/only with MSEM

	//mechanic rules
	let mechstrings = ""
	for(let thisMech in mechanics)
		mechstrings += thisMech + "|";
	let mechRegex = new RegExp('\\$(' + mechstrings.replace(/\|$/,"") + ')','i')
	mechcheck = msg.content.match(mechRegex);
	if(mechcheck !== null) {
		msg.channel.send(mechanics[mechcheck[1].toLowerCase()]);
		if(mechcheck[1].toLowerCase() == "archive")
			msg.channel.send(mechanics.additional);
		stats.upBribes(1);
	}
	if(msg.content.match(/\$submis/i)){
		let month = new Date().getMonth();
		let subDead = "January 31st", subRelease = "March 1st";
		if(month > 0 && month < 5)
			subDead = "May 31st";
		if(month >= 5 && month < 9)
			subDead = "September 30th";
		if(month > 1 && month < 6)
			subRelease = "July 1st";
		if(month >= 6 && month < 10)
			subRelease = "November 1st";
		let thisPost = "The next submission deadline is " + subDead + ", and the next set release is " + subRelease + ".\n";
		//thisPost += "The next wildcard update deadline is " + stats.wildDead + ", and the next wildcard release is " + stats.wildRelease + ".\n";
		thisPost += "To submit a set for MSEM, send it to any ModSquad or Top Brass member. For best results, check out the format so far, and please review the guidelines from the MSE post: <http://magicseteditor.boards.net/thread/281/mse-modern-july-update>";
		msg.channel.send(thisPost);
		stats.upBribes(1);
	}
	if(msg.content.match(/\$url/i)){
		msg.channel.send("The Lackey Auto-Update link is: http://mse-modern.com/msem2/updatelist.txt\nThe Cockatrice update links are:\n<http://mse-modern.com/msem2/notlackey/AllSets.json>\n<http://mse-modern.com/msem2/notlackey/tokens.xml>");
		stats.upBribes(1);
	}
	if(msg.content.match(/\$(cocka)?trice/)) {
		stats.upBribes(1);
		output = "Cockatrice Installation:\n";
		output += "For easiest updates, you'll want a separate version of Cockatrice for MSEM. This can be done selecting \"Portable version\" when downloading Cockatrice: <https://cockatrice.github.io/>\n";
		output += "• Open Cockatrice and run Oracle. This is usually labled \"Check for card updates\" under the Cockatrice or Help menu, depending on your version.\n";
		output += "• For Oracle's file sources, paste `http://mse-modern.com/msem2/notlackey/AllSets.json` in the first window, then `http://mse-modern.com/msem2/notlackey/tokens.xml` after that has downloaded.\n";
		output += "• On the top menu, navigate to Cockatrice -> Settings -> Card Sources on Windows or Cockatrice -> Preferences on Mac.\n";
		output += "• Add the two links from Image download paths below. Ensure they are the first links, are in the same order, and that \"Download images on the fly\" is checked.\n";
		output += "`http://mse-modern.com/msem2/images/!setcode!/!set:num!!set:rarity!.jpg`\n";
		output += "`http://mse-modern.com/msem2/images/!setcode!/!set:num!.jpg`\n";
		output += "• After patches, click the \"Delete all downloaded images\" button here to allow cards to update.";
		msg.channel.send(output);
	}
	if(msg.content.match(/\$inst/i)){
		msg.channel.send("For more in-depth searching options, check out Instigator!\n<https://msem-instigator.herokuapp.com/>");
		stats.upBribes(1);
	}
	let landMatch = msg.content.match(/\$([wubrg]{1,3}|bant|esper|grixis|jund|naya|abzan|jeskai|sultai|mardu|temur) ?(dual|land)/i); //msem $lands
	let landCycleMatch = msg.content.match(/\$(checkland|shockfetch|monofetch|scryland|desertshock|paindual|plagueland|plaguedual|mirrorland|handland|(investigate|clue)(land|dual)|drawdual|karoo|cycleland|tormentland|monofetch)/i); //msem $lands
	if(landMatch || landCycleMatch) {
		let searchQuery = "t:Land -t:Basic ";
		if(landMatch) {
			let factionArray = ["bant","esper","grixis","jund","naya","abzan","jeskai","sultai","mardu","temur"];
			let factionColorArray = ["GWU","WUB","UBR","BRG","RGW","WBG","URW","BGU","RWB","GUR"];
			let factionInvertArray = ["BR","RG","GW","WU","UB","UR","BG","RW","GU","WB"];
			searchQuery += "adds:"
			if(factionArray.includes(landMatch[1].toLowerCase())) {
				searchQuery += factionColorArray[factionArray.indexOf(landMatch[1].toLowerCase())]
				searchQuery += " -adds:" + factionInvertArray[factionArray.indexOf(landMatch[1].toLowerCase())]
			}else{
				searchQuery += landMatch[1].toUpperCase();
				searchQuery += " -adds:";
				let colors = ["W","U","B","R","G"];
				for(let c in colors) {
					if(!landMatch[1].toUpperCase().match(colors[c]))
						searchQuery += colors[c];
				}
			}
		}else if(landCycleMatch) {
			searchQuery += "is:" + landCycleMatch[1];
		}
		let embedInfo = buildSearchEmbed(searchQuery, arcana.msem, -1)
		let messyCallback = function (mess) {
			if(embedInfo[1] != 0) {
				mess.react(leftArrow)
					.then(() => mess.react(rightArrow))
					.then(() => mess.react(mag))
					.then(() => mess.react(xEmote))
					.then(() => mess.react(plainText))
			}
		}
		msg.channel.send(embedInfo[0])
			.then(mess => messyCallback(mess))
			.catch(console.log("An emote didn't spawn"))
	}
	//Suggestions
	if(msg.content.match(/\$suggest ?\n?/i)){
		let anonPost = msg.content.replace(/@/g, "@.");
		Client.channels.cache.get(config.mailChannel).send(anonPost);
		stats.upBribes(1);
	}
	/* wildcard voting, currently closed
	if(msg.content.match(/\$vote/)) {
		let voter = Client.guilds.cache.get("317373924096868353").roles.cache.get("747659270765543555").members.find(v => v.id == msg.author.id);
		if(voter) {
			wildcardVoter(msg.author.id, msg.content.replace(/\$vote ?/i, ""));
			msg.channel.send('Wildcard vote submitted.')
		}else{
			msg.channel.send('You do not have the VOTE! role, which is needed to vote in the wildcard.');
		}
	}
	if(perms.includes(5)) {
		let votepoke = msg.content.match(/!votepoke (\d+)/i);
		if(votepoke) {
			for(let u in scratchPad.wildcard) {
				if(scratchPad.wildcard[u] == votepoke[1]) {
					let content = msg.content.replace(votepoke[0], "");
					eris.pullPing(u).send(content);
					msg.channel.send("Voter poked");
					return;
				}
			}
			msg.channel.send("Voter not found.");
		}

	}*/
	if(msg.content.match(/\$plain/i)){
		let attachURL = msg.attachments.array()[0].url;
		let filename = msg.attachments.array()[0].name;
		msg.channel.send("LackeyBot is downloading your file, please wait a few moments.");
		download(attachURL, {filename:"extract.txt"}, function(err) {
			fs.readFile('./extract.txt', "utf8", function read(err, data) {
				if (err)
					throw err;
				let deckFile = extractPlain(data)
				fs.writeFile(filename, deckFile, (err) => {
					if (err) throw err;
					eris.pullPing(msg.author.id).send("Here is your extracted plain text.", {
						files:[{attachment:filename}]
					});
				});
				fixingList = null
				
			});
		}, 3000);
	}

	//devDex Commands
	//These are commands that work primarily/only with devDex
	
	//Other Commands
	//These are commands that work primarily/only with other arcana database

	if(msg.content.match(/\$point/) && arcanaData.square.data == arcana.myriad){ //myriad points
		let output = "";
		for(let point in arcanaData.square.data.legal){
			output += "**" + point + ":** "
			for(let card in arcanaData.square.data.legal[point]) {
				output += arcanaData.square.data.legal[point][card] + ", ";
			}
			output = output.replace(/, $/, "\n");
		}
		msg.channel.send(output)
	}

	
}
function helpMessage() {
	let helpout = "**Cards Help**\n";
	helpout += "LackeyBot supports up to three cards databases on each server.\n";
	//todo script this
	helpout += "Normally, canon Magic cards are called in <<Angle Brackets>> with !commands.\n";
	helpout += "MSEM cards are called in [[Square Brackets]] with $commands.\n";
	helpout += "Uploadable databse cards are called in {{Curly Brackets}} with ?commands.\n";
	helpout += "The square brackets can be changed with $database commands, such as `$myriad` or `$ps`.\n";
	helpout += "The following work for each database, using their prefixes in place of !\n";
	helpout += "`!search Scryfall query` for a Scryfall search link and embed preview.\n";
	helpout += "`!random` or `!random Scryfall query` for a random card that can match a Scryfall query.\n";
	helpout += "`!sets` for a list of set codes.\n";
	helpout += "`!stats SET` for some stats from that set.\n";
	helpout += "The following work for only the Magic database, using the prefixes shown.\n";
	helpout += "`!cr XX.XXXa` for CR citations.\n";
	helpout += "`$standard` for sets legal in standard.\n";
	helpout += "`$price CardName` for Scryfall prices for a card.\n";
	helpout += "`$ban format` for the banlist for that format.\n";
	return helpout;
}
exports.messageHandler = messageHandler;
exports.helpMessage = helpMessage;
exports.buildSetsEmbed = buildSetsEmbed;