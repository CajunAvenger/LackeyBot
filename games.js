/* Games
 Holds the game-y scripts
*/
var config = require('./config/lackeyconfig.js').config;
var convars = config.variables;
var freedomUnits = require('./freedomUnits.js');
var fuzzy = require('./fuzzy.js');
var stats = require('./stats.js');
var prompts = require("./prompts.json");
var Discord = require('discord.js');
var eris = require('./eris.js');
var Client = eris.Client();
var extras = require("./msem/extras.json");
var arcana = require("./arcana.js");
var mod_magic = require("./magic.js");
var sms = require("./sms.json");
const toolbox = require("./toolbox.js");
var { //emote buffet
	yeet, boop, leftArrow, rightArrow, azArray, azEmoteArray, blank,
	old_dollarEmote, old_excEmote, old_quesEmote, old_plainText,
	old_mag, old_ruler, old_xEmote,
	dollarEmote, excEmote, quesEmote, plainText,
	mag, ruler, xEmote, pinEmotes, tieEmote,
	hourEmote, dayEmote, weekEmote, repeatEmote, pingStar,
	old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote,
	collectToPlainMsg, plainToCollectMsg,
} = require('./emoteBuffet.js');
function messageHandler(msg, perms) {
	if(perms.includes(0) || perms.includes(3)) {
		let bounceHammer = msg.content.match(/!banunban (<@![0-9]+>)/);
		if(bounceHammer) {
			msg.channel.send("The banhammer awaits...\nhttps://img.scryfall.com/cards/art_crop/front/1/e/1e764652-b7c7-4a40-a61d-388e9dd2ce0b.jpg?1562839816");
			msg.channel.send("Banned, then unbanned " + bounceHammer[1]);
		}
	}
	if(msg.content.match(/\$play/i)){ //changes LackeyBot's game
		let mun = Math.floor(Math.random()*extras.games.length);
		let newGame = extras.games[mun];
		if(msg.content.match(/despacito/i))
			newGame = "Despacito";
		msg.channel.send("LackeyBot is now playing " + newGame);
		Client.user.setPresence( { activity: {name: newGame}});
		stats.upBribes(1);
		convars.playtime = 1;
	}	if(msg.content.match(/\$(self-?destruct|explode)/i) && (convars.disarm == null || admincheck.includes(0))) {
		if(perms.includes(0))
			msg.channel.send("FINALLY!");
		msg.channel.send("KA-BOOOOOM!");
		convars.disarm = "disarmed";
		stats.upExplode(1);
		stats.upBribes(1);
		Client.user.setPresence( { activity: {name: "dead."}});
	}
	if(msg.content.match(/love/i) && msg.content.match(/lackey ?bo[ti]/i)){
		msg.channel.send("<3");
	}
	if(msg.content.match(/pop muzik/i)){
		msg.channel.send("Shoobie doobie doo wop.");
	}
	if(msg.content.match(/thanks?/i) && msg.content.match(/lackey ?bo[ti]/i)){
		msg.channel.send("You're welcome.");
	}
	if(msg.content.match(/(f(u|\*)?c?k|eff|\bf) ?(you|u),? lackey ?bo[ti]/i)){
		msg.channel.send("Same to you, bucko.");
	}
	let wikiCheck = msg.content.match(/\$wiki ([^\$]+)\$?/i);
	if(wikiCheck != null) {
		stats.upBribes(1);
		let output = wikiCheck[1];
		output = output.replace(/ ?; ?/g,"THISISGETTINGREPLACED");
		output = encodeURIComponent(output);
		output = output.replace(/%20/g, "_");
		output = "<https://mseverse.fandom.com/wiki/" + output.replace(/THISISGETTINGREPLACED/g, ">\n<https://mseverse.fandom.com/wiki/") + ">";
		msg.channel.send(output);
	}else if(msg.content.match(/\$wiki/i)) {
		msg.channel.send("https://mseverse.fandom.com/wiki/MSEverse_Wiki");
	}
	var timeCheck = msg.content.match(/\$time (-?[.0-9]+) ?(AR|VY|EY|PM|CE|NKY|WE|DAT|OKY|AC|GC)( ?> ?(AR|VY|EY|PM|CE|NKY|WE|DAT|OKY|AC|GC))?/i);
	if(timeCheck !== null) {
		let year = parseFloat(timeCheck[1]);
		let starting = timeCheck[2].toUpperCase();
		let ending = "";
		if(timeCheck[4] !== undefined)
			ending = [timeCheck[4].toUpperCase()];
		msg.channel.send(buildTime(year, starting, ending));
	}
	let detcheck = msg.content.match(/\$determine?i?s?t?i?c? ([0-9.]+), ?([0-9]+)/i);
	let detercheck = msg.content.match(/\$determin/i);
	if(detcheck !== null) {
		stats.upBribes(1);
		let chance = Number.parseFloat(detcheck[1])
		let success = parseInt(detcheck[2]);
		let output = "";
		if(success < 0)
			output = "Slow your roll.";
		if(chance == 0 || success == 0)
			output = "Not a chance!";
		if(chance*success > 50000000)
			output = "Not in 50 million years!"
		if(chance <= 1) {
			chance = 1/chance;
			output = "Loop with " + chance*100 + "% chance of success until " + success + " successes: " + success/chance + " loops. C'mon now.";
		}
		if(output == "") {
			let loops = 0;
			for(var i=0; i<success; i++) {
				loops++;
				let num = Math.floor(Math.random()*chance);
				if(num != 0)
					i -= 1;
				if(loops >= 100000000) {
					success = i+1;
					break;
				}
			}
			output = "Loop with 1 in " + detcheck[1] + " chance of success ran until " + success + " successes: " + loops + " loops.";
		}
		msg.channel.send(output);
	}
	if(detcheck === null && detercheck !== null) {
		stats.upBribes(1);
		msg.channel.send("To have LackeyBot test a nondeterministic loop with a 1 in X chance of success until Y successes, use `$deterministic X,Y`");
	}
	let gencheck = msg.content.match(/\$namegen/i);
	let gennum = msg.content.match(/\$namegen ?([0-9]+)/i)
	if(gencheck !== null) {
		stats.upBribes(1);
		let iterate = 1;
		if(gennum != null)
			iterate = gennum[1];
		if(iterate>15)
			iterate = 15;
		let output = "";
		for(var j=0; j<iterate; j++) {
			let chara = 0;
			let seed = 0.7;
			let letter = "";
			let end = "";
			chara = Math.floor(Math.random()*5) + 2;
			for(var i = 0; i < chara; i++) {
				if(i == chara-1)
					end = 'last';
				letter = pickRandomCharacter(seed,end)
				output += letter[0];
				seed = letter[1];
			}
			output += "\n"
		}
		msg.channel.send(toolbox.toTitleCase(output));
	}
	/*let cipherCheck = msg.content.match(/\$cipher ([^\$]+)/i);
	if(cipherCheck != null) {
		stats.upBribes(1);
		let cipherText = rotCrypt(cipherCheck[1],"LB");
		if(cipherText.length > 45)
			cipherText = msg.author.username + " ciphered:\n" + cipherText;
		msg.channel.send(cipherText);
	}*/
	let rollcheck = msg.content.match(/\$roll( ?(\+|-)? ?[0-9]*d[0-9]+(kh[0-9]+|kl[0-9]+|e| ?\+ ?\d+| ?- ?\d+)*)+/i);
	if(rollcheck !== null) {
		let diceMsg = rollcheck[0].replace(/ d/ig," 1d")
		diceMsg = diceMsg.replace(/\$roll ?/i,"");
		msg.channel.send(rollMaster(diceMsg));
		stats.upBribes(1);
	}
	let otherrollcheck = msg.content.match(/\$roll ?d?([0-9]+)?/i);
	if(rollcheck == null && otherrollcheck !== null) {
		let faces = 20;
		if(otherrollcheck[1] != undefined)
			faces = otherrollcheck[1];
		msg.channel.send(roll(faces));
		stats.upBribes(1);
	}
	if(msg.content.match(/\$(mine)?sweep(er)?/i)) {
		stats.upBribes(1);
		let sweepMatch = msg.content.match(/\$(mine)?sweep(er)? ([0-9]+)?[ |/_]?([0-9]+)?/i);
		let width = 9;
		if(sweepMatch !== null && sweepMatch[3] !== undefined)
			width = Math.max(2,Math.min(14,sweepMatch[3]));
		let bombs = parseInt(1.25*width);
		if(sweepMatch !== null && sweepMatch[4] !== undefined)
			bombs = Math.min(width*width-1,sweepMatch[4]);
		msg.channel.send(sweeper(width, bombs));
	}
	var randArrMatch = msg.content.match(/\$shuffle ([1-9][0-9]?)/i);
	if(randArrMatch) {
		let numArray = [];
		for(let i = 1; i <= randArrMatch[1]; i++)
			numArray.push(i);
		numArray = toolbox.shuffleArray(numArray);
		let mes = "Randomized numbers from 1 to " + randArrMatch[1] + ":\n";
		for(let thisNum in numArray)
			mes += numArray[thisNum] + ", ";
		mes = mes.replace(/, $/, ".")
		msg.channel.send(mes);
		stats.upBribes(1);
	}
	let convertMatch = msg.content.match(/\$convert ([^\n]+)/i);
	if(convertMatch) {
		msg.channel.send(freedomUnits.convertUnits(convertMatch[1]));
		stats.bribes++;
	}
	if(msg.content.match(/\$(sms|shit-?mse-?says?|s?hit)/i)){ //random sms quote
		stats.stats.bribes++;
		let num = toolbox.rand(sms.length-1);
		msg.channel.send(sms[num]);
	}
	if(msg.content.match(/\$dance/i)){
		stats.bribes++;
		msg.channel.send("https://i.imgur.com/qkSy0dO.gifv")
	}
	//emotes
	if(msg.content.match(/\$amo?e?o?boid/i)){
		stats.upBribes(1);
		msg.channel.send("<:amoeboid:338960581346197504>")
	}
	if(msg.content.match(/\$sponge/i)){
		stats.upBribes(1);
		msg.channel.send("<:sponge:397755790917763072>")
	}
	if(msg.content.match(/\$(starter|kit)/i)){
		stats.upBribes(1);
		msg.channel.send("<:starter:338956030681808906>")
	}
	if(msg.content.match(/\$maro/i)){
		stats.upBribes(1);
		msg.channel.send("<:maro:619312483131326464>")
	}
	if(msg.content.match(/\$thonk/i)){
		stats.upBribes(1);
		msg.channel.send("<:thonk:723630464144900098>")
	}
	if(msg.content.match(":3c")) {
		stats.upBribes(1);
		msg.channel.send("<:3c:510244037106860042>");
	}
	if(msg.content.match(/\$barbaric/i)){
		stats.upBribes(1);
		msg.channel.send({
			files:[{attachment:'images/barbaric.jpg'}]
			});
	}
	if(msg.content.match(/\$(doubt|x)/i)){
		stats.upBribes(1);
		msg.channel.send({
			files:[{attachment:'images/doubt.png'}]
			});
	}
	if(msg.content.match(/\$(hyper|mega|ultra)(doubt|x)/i)){
		stats.upBribes(1);
		msg.channel.send({
			files:[{attachment:'images/hyperdoubt.png'}]
			});
	}
	if(msg.content.match(/\$s?nap/i)){
		stats.upBribes(1);
		msg.channel.send("https://tenor.com/view/thanos-infinity-gauntlet-snap-finger-snap-gif-12502580");
	}

	if(msg.content.match(/\$lackeybot/)) {
		let links = "";
		links += "[Invite LackeyBot to your server](https://discord.com/oauth2/authorize?client_id=341937757536387072&permissions=268823616&scope=bot)";
		links += "\n[LackeyBot on github](https://github.com/CajunAvenger/LackeyBot)";
		let embedded = new Discord.MessageEmbed()
			.setTitle('LackeyBot Resources')
			.setDescription(links)
			.setFooter(collectToPlainMsg)
		msg.channel.send(embedded)
			.then(mess => mess.react(plainText))
			.catch(e => console.log(e))
		stats.upBribes(1);
	}
	if(msg.content.match(/\$template ?pack/)) {
		let links = "";
		links += "[Basic M15 Pack](https://www.dropbox.com/s/tnuvawiqyvj107l/Magic%20Set%20Editor%202%20-%20M15%20Basic.zip?dl=0)\n";
		links += "[Full M15 Pack](https://www.dropbox.com/s/4aupl48rez983i6/Magic%20Set%20Editor%202%20-%20M15%20Main.zip?dl=0)\n";
		links += "[Full Magic Pack](https://www.dropbox.com/s/kz6gi2ruhtnhtgu/Magic%20Set%20Editor%20Full%20-%20Magic.zip?dl=0)\n";
		links += "[Non-MTG Pack](https://www.dropbox.com/s/ibm2wtzayn6s6ty/Magic%20Set%20Editor%20Full%20-%20Other%20Styles.zip?dl=0)\n";
		links += "[Font Pack](https://www.dropbox.com/s/u1vqnl0f3lplzh8/Font%20Pack.zip?dl=0)";				let embedded = new Discord.MessageEmbed()
			.setTitle('Custom Magic Template Packs')
			.setDescription(links)
			.setFooter(collectToPlainMsg)
		msg.channel.send(embedded)
			.then(mess => mess.react(plainText))
			.catch(e => console.log(e))
		stats.upBribes(1);
	}else if(msg.content.match(/\$template/)) {
		let links = "";
		links += "[MSE Current Release](https://github.com/twanvl/MagicSetEditor2/releases)";
		links += "\n[Cajun Style Templates](https://magicseteditor.boards.net/thread/77)";
		links += "\n[Now also on github](https://github.com/CajunAvenger/Cajun-Style-Templates)";
		links += "\n[Mainframe Extravangza](https://magicseteditor.boards.net/post/32647/thread)";
		links += "\n[Custom Indexing help](https://magicseteditor.boards.net/post/26481/thread)";
		links += "\n[Mainframe Mana, Watermarks, and other custom images](https://magicseteditor.boards.net/post/26482/thread)";
		links += "\n[Design Skeleton Generator help](https://magicseteditor.boards.net/post/26483/thread)";
		links += "\n[Mainframe Levelers help](https://magicseteditor.boards.net/post/26485/thread)";
		links += "\n[How to do popout art video](https://www.youtube.com/watch?v=oc6Fy8_BkKo&feature=youtu.be)";
		let embedded = new Discord.MessageEmbed()
			.setTitle('MSE Template Links')
			.setDescription(links)
			.setFooter(collectToPlainMsg)
		msg.channel.send(embedded)
			.then(mess => mess.react(plainText))
			.catch(e => console.log(e))
		stats.upBribes(1);
	}
	//Articles
	if(msg.content.match(/\$articles/)) {
		let links = "";
		links += "[What does \"Dies to Removal\" mean?](https://custommagiccodex.wordpress.com/2021/01/14/what-does-dies-to-removal-mean/)";
		links += "\n[How Death's Shadow and Storm Ruined Card Evaluation Skills](http://magicseteditor.boards.net/thread/511/deaths-shadow-ruined-evaluation-skills)";
		links += "\n[Strictly Better: Should You Care?](http://magicseteditor.boards.net/thread/498/strictly-care)";
		links += "\n[The Hornet Sting Quandry](https://custommagiccodex.wordpress.com/2021/01/14/the-hornet-sting-quandary/)";
		links += "\n[The Lion's Eye Quotient](https://custommagiccodex.wordpress.com/2021/01/14/the-lions-eye-quotient/)";
		links += "\n[MSE101: Layers](http://magicseteditor.boards.net/thread/516/mse-101-card-breaks-layers)";
		links += "\n[Color Combinations Primer](https://rentry.co/faction-primer)";
		let embedded = new Discord.MessageEmbed()
			.setTitle('MSE Community Articles')
			.setDescription(links)
			.setFooter(collectToPlainMsg)
		msg.channel.send(embedded)
			.then(mess => mess.react(plainText))
			.catch(e => console.log(e))
		stats.upBribes(1);
	}
	if(msg.content.match(/\$(primer|staple|compendium)/i)) {
		stats.upBribes(1);
		msg.channel.send("MSEM Compendium: https://docs.google.com/document/d/1_VjnBlsuqe-eFsU__UsJ5VBNn1D9VomlxUwdzgvHuMs/edit?usp=sharing");
	}
	if(msg.content.match(/\$dies/i)) {
		stats.upBribes(1);
		msg.channel.send("https://custommagiccodex.wordpress.com/2021/01/14/what-does-dies-to-removal-mean/");
	}
	if(msg.content.match(/\$broken/i)) {
		stats.upBribes(1);
		msg.channel.send("http://magicseteditor.boards.net/thread/511/deaths-shadow-ruined-evaluation-skills");
	}
	if(msg.content.match(/\$s?trictly/i)) {
		stats.upBribes(1);
		msg.channel.send("http://magicseteditor.boards.net/thread/498/strictly-care");
	}
	if(msg.content.match(/\$layers/i)) {
		stats.upBribes(1);
		msg.channel.send("http://magicseteditor.boards.net/thread/516/mse-101-card-breaks-layers");
	}
	if(msg.content.match(/\$(hornet|hsq|hsf)/i)) {
		stats.upBribes(1);
		msg.channel.send("https://custommagiccodex.wordpress.com/2021/01/14/the-hornet-sting-quandary/");
	}
	if(msg.content.match(/\$(lion|leq)/i)) {
		stats.upBribes(1);
		msg.channel.send("https://custommagiccodex.wordpress.com/2021/01/14/the-lions-eye-quotient/");
	}
	if(msg.content.match(/\$(faction|combination)/i)) {
		stats.upBribes(1);
		msg.channel.send("https://rentry.co/faction-primer");
	}
	let hmMatch = msg.content.match(/!hm ?(easy|medium|hard)?/i)
	if(hmMatch) {
		stats.upBribes(1);
		msg.channel.send(generateHangman(hmMatch[1]))
			.then(mess => hangmanCallback(mess, msg.channel))
			.catch(e => console.log(e))
	}
	let lackeybotMS3Converter = msg.content.match(/\$lackeyb?o?t? ?roll ([0-9]+)/i);
	if(lackeybotMS3Converter) {
		let query = "-r=mp -is:reprint t:Artifact -t:Token cmc<=" + lackeybotMS3Converter[1];
		let valids = fuzzy.scryDatabase(arcana.msem, query, {onlyFront:true});
		stats.upBribes(1);
		if(valids[0].length) {
			let i = toolbox.rand(valids[0].length-1);
			msg.channel.send(`Randomly chosen artifact, CMC ${lackeybotMS3Converter[1]} or less:\n${arcana.msem.cards[valids[0][i]].cardName}`)
		}else{
			msg.channel.send("No cards found.")
		}
	}
	if(msg.content.match(/\$font/i)){
		msg.channel.send("Compact MSE Fonts file.\nDownload and unzip this folder.\n• On Windows, either select all the .ttf files and right click -> Install All, or open each .ttf and click install if that's not available.\n• On WINE, there will be a font folder the .ttfs will need to be moved to, such as `~/.wine/drive_c/windows/Fonts`.\nhttps://www.dropbox.com/s/1hw9xmtmjx2pjj0/Magic%20Fonts.zip?dl=0");
		stats.upBribes(1);
	}
	if(msg.content.match(/\$prompt/i)) {
		let num1 = Math.floor(Math.random() * prompts.colors.length);
		let num2 = Math.floor(Math.random() * prompts.prompts.length);
		msg.channel.send("[" + prompts.colors[num1] + "] " + prompts.prompts[num2]);
		stats.upBribes(1);
	}
	let limMatch = msg.content.match(/\$(chaos)? ?limited ?(4|5|10)?/i)
	if(limMatch) {
		stats.upBribes(1);
		let output = "";
		let count = 1;
		if(limMatch[2])
			count = parseInt(limMatch[2]);
		if(msg.content.match(/chaos/i)) {
			let colors;
			if(count == 1) {
				colors = [prompts.combos[toolbox.rand(prompts.combos.length-1)]];
			}else{
				colors = prompts.presetCombos[count][toolbox.rand(prompts.presetCombos[count].length-1)];
			}
			for(let c in colors) {
				let num2 = toolbox.rand(prompts.archetypes.length-1);
				output += `${colors[c]} ${prompts.archetypes[num2]}\n`;
			}
		}else{
			if(count == 1) {
				output = prompts.paired_archetypes[toolbox.rand(prompts.paired_archetypes.length-1)];
			}else{
				let colors, num = 0;
				if(count == 5) {
					num = toolbox.rand(11)
					colors = prompts.presetCombos["5"][num];
				}else{
					num = toolbox.rand(2)
					colors = prompts.presetCombos["10"][num];
				}
				if(!prompts.splitPAs) { //build this so it doesn't freeze
					prompts.splitPAs = {};
					for(let p in prompts.paired_archetypes) {
						let pair = prompts.paired_archetypes[p].match(/([WUBRG][WUBRG])/);
						let k = pair[1];
						if(!prompts.splitPAs.hasOwnProperty(k))
							prompts.splitPAs[k] = [];
						prompts.splitPAs[k].push(prompts.paired_archetypes[p]);
					}
				}
				for(let p in colors) {
					let ar = prompts.splitPAs[colors[p]];
					num = toolbox.rand(ar.length-1);
					output += ar[num] + "\n";
				}
			}
		}
		msg.channel.send(output);
	}
	/* p sure this is a bad idea but i did it mostly as practice
	let ytMatch = msg.content.match(/\$yt ([^\n]+)/i)
	if(ytMatch){
		stats.upBribes(1)
		yt.search(ytMatch[1])
			.then(data => msg.channel.send(yt.url(data)))
			.catch(err => console.log(err))
	}*/

}
function helpMessage() {
	let helpout = "**Games Help**\n";
	helpout += "`$roll`, `$roll dN`, or `$roll XdN` to roll some dice. ";
	helpout += "Supports adding dice rolls, khX, klX, and e (keep high X, keep low X, exploding dice).\n";
	helpout += "`$sweep` to generate a Minesweeper board, `$sweep X Y` to generate one with X rows and Y mines.\n";
	helpout += "`$namegen X` to generate up to 15 random names.\n";
	helpout += "`$cipher message` to cipher or decipher a message.\n";
	helpout += "`$articles` for a selection of MSE design articles.\n";
	helpout += "`$template pack` or `$temlates` for MSE template links.\n";
	helpout += "`$wiki` or `$wiki page` for the MSEverse Wiki.\n";
	helpout += "`$time X AR/PM/etc` to convert a time AR/PM/etc into multiple Magic calendars.\n";
	helpout += "`$prompt` for a design prompt.\n";
	helpout += "`$limited 5/10` for a set of random curated draft archetypes.\n";
	helpout += "`$chaoslimited 4/5/10` for a set of fully random draft archetypes.\n";
	helpout += "`$sms` for a random quote from MSE's history.\n";
	helpout += "`$play` to have LackeyBot play a new game\n";
	helpout += "`$dance` to dance\n";
	helpout += "`$amoeboid`, `$fblthp`, `$mklthd`, `$starter`, `$sponge`, `$maro`, `$thonk` to emote\n";
	helpout += "`$x` to doubt\n";
	helpout += "`$self-destruct` to self-destruct.\n";
	return helpout;
}

//toy mechanics
function sweeper(width, bombs) {							//minesweeper generator
	let total = width * width;
	let rows = [];
	let board = [];
	let pieceWhite = "⬜";
	let pieceBomb = "💣";
	let str = "||" + bombs + "|| bombs placed.\n";
	let numbers = [":one:",":two:",":three:",":four:",":five:",":six:",":seven:",":eight:",":nine:"];
	// Place board
	let placed = 0;
	while (placed < total) {
		board[placed] = pieceWhite;
		placed++;
	}
	// Place bombs
	let bombsPlaced = 0;
	let placement = () => {
		let index = Math.floor(Math.random() * (total));
		if (board[index] == pieceBomb){
			placement();
		}else{
			board[index] = pieceBomb;
			bombsPlaced++;
		}
	}
	while (bombsPlaced < bombs) {
		placement();
	}
	// Create rows
	let currow = 1;
	board.forEach((item, index) => {
		i = index+1;
		if (!rows[currow-1]) rows[currow-1] = [];
		rows[currow-1].push(item);
		if (i%width == 0) currow++;
	});
	// Generate numbers
	rows.forEach((row, index) => {
		row.forEach((item, iindex) => {
			if (item == pieceBomb) {
				let uprow = rows[index-1];
				let downrow = rows[index+1];
				let num = (it) => { if (it != undefined && typeof it == "number") return true; else return false; };
				let unknownSquare = (it) => { if(it == pieceBomb) return true; else return it == undefined };
				if (uprow) {
					if (num(uprow[iindex-1])) uprow[iindex-1]++;
					else if (!unknownSquare(uprow[iindex-1])) uprow[iindex-1] = 1;

					if (num(uprow[iindex])) uprow[iindex]++;
					else if (!unknownSquare(uprow[iindex])) uprow[iindex] = 1;

					if (num(uprow[iindex+1])) uprow[iindex+1]++;
					else if (!unknownSquare(uprow[iindex+1])) uprow[iindex+1] = 1;
				}

				if (num(row[iindex-1])) row[iindex-1]++;
				else if (!unknownSquare(row[iindex-1])) row[iindex-1] = 1;

				if (num(row[iindex+1])) row[iindex+1]++;
				else if (!unknownSquare(row[iindex+1])) row[iindex+1] = 1;

				if (downrow) {
					if (num(downrow[iindex-1])) downrow[iindex-1]++;
					else if (!unknownSquare(downrow[iindex-1])) downrow[iindex-1] = 1;

					if (num(downrow[iindex])) downrow[iindex]++;
					else if (!unknownSquare(downrow[iindex])) downrow[iindex] = 1;

					if (num(downrow[iindex+1])) downrow[iindex+1]++;
					else if (!unknownSquare(downrow[iindex+1])) downrow[iindex+1] = 1;
				}
			}
		});
	});
	// Create a string to send
	rows.forEach(row => {
		row.forEach(item => {
			if (typeof item == "number") it = numbers[item-1];
			else it = item;
			str += `||${it}||`;
		});
		str += "\n";
	});
	str = str.replace(/\|\|⬜\|\|/, "⬜");
	return str;
}
function rotCrypt (message, rotNo) {						//ciphers messages using ROTX or the lackeybot rotation
	let alphaArray = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
	let miniAlphaArray = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
	let lackeycypher = ["l","a","c","k","e","y","b","o","t","s","i","p","h","r","u","w","v","m","q","x","n","z","j","f","g","d"];
	let rotMessage = "";
	if(rotNo == "LB") {
		let temp = message.toLowerCase();
		if(miniAlphaArray.includes(temp[0])) {
			rotNo = lackeycypher.indexOf(temp[0]);
			let tempRotNo = lackeycypher[25-rotNo];
			rotNo = miniAlphaArray.indexOf(temp[0].toLowerCase());
			tempRotNo = miniAlphaArray.indexOf(tempRotNo);
			if(rotNo < tempRotNo){
				rotNo = Math.abs(rotNo-tempRotNo);
			}else{
				rotNo = (26-rotNo) + tempRotNo;
			}
		}else{
			rotNo = 13;
		}
	}
	for(var i=0; i<message.length; i++) {
		let isNon = 1;
		let thisChar = message[i];
		if(alphaArray.includes(thisChar)) {
			let num = alphaArray.indexOf(thisChar)+rotNo;
			num = Math.round(((num/26)-Math.floor(num/26))*26);
			rotMessage += alphaArray[num]
			isNon = 0;
		}
		if(miniAlphaArray.includes(thisChar)) {
			let num = miniAlphaArray.indexOf(thisChar)+rotNo;
			num = Math.round(((num/26)-Math.floor(num/26))*26);
			rotMessage += miniAlphaArray[num]
			isNon = 0;
		}
		if(isNon == 1)
			rotMessage += thisChar;
	}
	return rotMessage
}
function pickRandomCharacter(seed,last) {					//picks random characters for namegen
	let vowelArray = ["a","e","i","o","u","a","e"];
	let consArray = ["b","c","d","f","g","h","k","l","m","n","p","r","s","t","b","c","d","f","h","l","m","n","p","r","s","t","m","n","t","r","s","st","ch","th","sh","tr","j","q","x","y","z","v","w"];
	let specArray = [" ","'","-"," "," "];
	let letters = "";
	let num = Math.random();
	let newseed = 0.5;
	if(num > seed) { //vowel
		let char1 = toolbox.shuffleArray(vowelArray);
		letters += char1[0];
		num = Math.random()*2.5;
		if(num < 1) {
			let char1 = toolbox.shuffleArray(vowelArray);
			let char2 = toolbox.shuffleArray(consArray);
			letters += char1[0] + char2[0];
		}
		if(num >= 1 && num < 2) {
			let char1 = toolbox.shuffleArray(consArray);
			letters += char1[0] + char1[1];
			newseed = 0;
		}
		if(num >= 2) {
			let char1 = toolbox.shuffleArray(vowelArray);
			letters += char1[0];
			newseed = 0.95;
		}
	}else{ //cons
		let char1 = toolbox.shuffleArray(consArray);
		let char2 = toolbox.shuffleArray(vowelArray);
		letters += char1[0] + char2[0];		
	}
	if(last != 'last') {
		num = Math.random();
		if(num <= 0.3)
			letters += toolbox.shuffleArray(specArray)[0];
	}
	return [letters, newseed];
}
//Timeline
function buildTime (year, starting, ending) {				//the timeline handler
	let output = year + starting;
	if(year == "0" && (starting == "NKY" || starting == "OKY"))
		year = "-1"
	year = convertAR(Number.parseFloat(year), starting);
	let holding = ""
	let floatNo = 0;
	if(ending == "")
		ending = ["AR", "PM", "NKY", "VY", "WE", "DAT", "AC", "CE", "GC"];
	if(starting == "DAT")
		floatNo = 2;
	for(var i = 0; i < ending.length; i++) {
		if(ending[i] != starting) {
			holding = convertCalendar(year, ending[i],floatNo);
			if(starting != "EY" && holding[1] == "VY" && parseInt(holding[0]) > 512) {
				holding[1] = "EY";
				holding[0] -= 512;
			}
			output += " = " + holding[0] + holding[1];
		}
	}
	output += "\n(AR: Argivian Reckoning, PM: Post-Mending, NKY: New Khalizor Year, VY: Volarian Year, EY: Eternity Years, WE: War's End, DAT: Dilated Adiran Time, AC: After Custom, GC: Great Calamity)";
	let nky = output.match(/-([0-9]+)NKY/);
	if(nky) {
		let year2 = parseInt(nky[1])
		output = output.replace(/-([0-9]+)NKY/, (1993+year2) + "OKY");
		output = output.replace(/NKY: New/, "OKY: Old");
	}
	let oky = output.match(/([0-9]+)OKY/)
	if(oky) {
		let year3 = parseInt(oky[1]);
		if(year3 > 1992) {
			output = output.replace(/([0-9]+)OKY/, (year3-1992) + "OKY");
			output = output.replace(/NKY: New/, "OKY: Old");
		}
	}
	return output;
}
function convertAR (year, starting) {						//first convert to AR
	//convert to AR
	switch(starting) {
		case "GC":
			year += 4330;
			break;
		case "VY":
			year += 4201;
			break;
		case "EY":
			year += 4713;
			break;
		case "PM":
			year += 4500;
			break;
		case "CE":
			year += 2550;
			break;
		case "NKY":
			if(year < 0)
				year++;
			year += 2932;
			break;
		case "OKY":
			if(year < 0)
				year++;
			year += 940
			break;
		case "WE":
			year += 4900;
			break;
		case "AC":
			year += 4558;
			break;
		case "DAT":
			let overflowYear = 0;
			if(year > 7001.4)
				overflowYear = year - 7001.4;
			if(year >= 0) {
				let a = 0.0022/3;
				let b = 0;
				let c = 1;
				let d =  -1*Math.max(0,Math.min(7001.4,year));

				let delta0 = Math.pow(b,2) - 3*a*c;
				let delta1 = 2*Math.pow(b,3) - 9*a*b*c + 27*Math.pow(a,2)*d;
				let calc = Math.pow((delta1 + Math.pow(Math.pow(delta1,2)-4*Math.pow(delta0,3), 1/2))/2 , 1/3);
				year = (-1/(3*a))*(b+calc+(delta0/calc));
				year += 4354;
				year +=	(overflowYear/98.02);
			}else{
				year += 4354;
			}
			year = Number.parseFloat(year).toFixed(2);
	}
	return year;
}
function convertCalendar (year, ending, floatNo) {			//then convert to other calendar
	switch(ending) {
		case "DAT":
			year -= 4354;
			if(year >= 0) {
				let theYear = Math.min(210,year);
				let theOverflow = Math.max(0,year-210);
				year = (0.0022/3)*Math.pow(theYear,3) + year + (97.02*theOverflow);
				year = Number.parseFloat(year).toFixed(3);
				year = year.replace(/000?$/,"0");
			}
			break;
		case "GC":
			year -= 4330;
			break;
		case "VY":
			year -= 4201;
			break;
		case "EY":
			year -= 4713;
			break;
		case "PM":
			year -= 4500;
			ending = " post-Mending";
			if(year < 0) {
				year = -1 * year;
				ending = " pre-Mending"
			}
			break;
		case "CE":
			year -= 2550;
			//convert negative years to BCE, no Year 0
			if(year <= 0) {
				year = -1 * year +1;
				ending = "BCE"
			}
			break;
		case "NKY":
			year -= 2932;
			if(year <= 0)
				year -= 1;
			break;
		case "OKY":
			year -= 940;
			if(year <= 0)
				year -= 1;
			break;
		case "WE":
			year -= 4900;
			break;
		case "AC":
			year -= 4558;
		year = Number.parseFloat(year).toFixed(floatNo);
	}
	return [year, ending];
}
//Dice
function roll(faces) {										//roll die with N faces
	let myNumber = Math.floor(Math.random()*Math.min(faces, 100))+1;
	return myNumber;
}
function rollMaster (diceString) {							//writes the results
	let results = rollout(diceString);
	let mathmatch = results.match(/(-?[0-9]+)/g);
	let math = 0;
	for(var i = 0; i < mathmatch.length; i++)
		math += parseInt(mathmatch[i]);
	let message = math
	if(mathmatch.length > 1){
		if(results.length >= 1000)
			results = results.substring(0,999) + "..."
		message += " (" + results + ")";
		message = message.replace(" + )",")");
		message = message.replace(/\+  ?-/g, "- ");
		message = message.replace(/\+  \+/g, "+");
	}
	return message;
}
function rollout(diceCommand) {								//the $roll handler
	let thisDie = diceCommand.match(/(- ?)?([0-9]*)d([0-9]+)(kh\d+|kl\d+|e)?( ?- ?\d+($|[^d])| ?\+ ?\d+($|[^d]))?/i);
	let quant = 1;
	let faces = 20;
	let flags = "";
	let dieName = "";
	if(thisDie !== null) {
		if(thisDie[3] !== undefined) {
			faces = Math.min(parseInt(thisDie[3]),100);
			dieName = thisDie[2] + "d" + thisDie[3];
		}
		if(thisDie[2] !== undefined) {
			if(thisDie[3] == undefined) {
				faces = Math.min(thisDie[2],100);
				dieName = thisDie[2];
			}else{
				quant = Math.min(thisDie[2],100);
			}
		}
		flags = thisDie[4];
	}
	let rollArray = [];
	for(var i = 0; i < quant; i++)
		rollArray.push(roll(faces));
	if(flags !== undefined && flags !== "") {
		let khMatch = flags.match(/kh([0-9]+)+/i);
		let klMatch = flags.match(/kl([0-9]+)+/i);
		if(khMatch !== null){
			dieName += "kh" + khMatch[1];
			let dieMatch = Math.min(parseInt(khMatch[1]),rollArray.length);
			rollArray = toolbox.maxArray(rollArray,dieMatch);
		}
		if(klMatch !== null){
			dieName += "kl" + klMatch[1];
			let dieMatch = Math.min(parseInt(klMatch[1]),rollArray.length);
			rollArray = toolbox.minArray(rollArray,dieMatch);
		}
		if(flags.match(/e/i)) {
			dieName += "e"
			for(var m = 0; m < rollArray.length; m++) {
				if(rollArray[m] == faces)
					rollArray[m] += rollExplode(faces,1);
			}
		}
	}
	let message = "";
	let sum = 0;
	let dualdie = diceCommand.match(dieName+"d");
	for(var n = 0; n < rollArray.length; n++) {
		sum += rollArray[n];
		if(dualdie == null) {
			if(thisDie[1] !== undefined)
				message += "-";
			message += rollArray[n] + " + ";
		}
	}
	if(thisDie[5] !== undefined)
		message += thisDie[5].replace(/- /g, "-") + " + ";
	diceCommand = diceCommand.replace(dieName, sum);
	thisDie = diceCommand.match(/([0-9]*)d([0-9]+)([^ \n]+)?/i);
	if(thisDie !== null){
		message += rollout(diceCommand);
	}
	return message;
}
function rollExplode (faces, i) {							//the explode function
	if(faces < 2)
		return faces;
	if(faces * i > 9000)
		return (9001 - faces*i);
	let rolledNumber = roll(faces);
	if(rolledNumber == faces)
		rolledNumber += rollExplode(faces);
	return rolledNumber;
}
//hangman
function generateHangman (diff) {							//generate canon hangman
	let cardNames = Object.keys(arcana.magic.cards);
	let rando = Math.floor(Math.random()*cardNames.length-1)+1;
	//rando = 5439; //Man-o'-war for debugging purposes
	let chosenName = cardNames[rando];
	let card = arcana.magic.cards[chosenName];
	chosenName = card.cardName;
	chosenName = chosenName.replace(/_[^\n]+/g, "");
	let nameMatch = new RegExp('guess: ' + chosenName, 'i')
	let blankName = chosenName.toLowerCase();
	let count = 0;
	for(let letter in azArray) {
		if(blankName.match(azArray[letter])) {
			count++;
			let letterReg = new RegExp (azArray[letter], 'ig')
			blankName = blankName.replace(letterReg, blank)
		}
	}
	if(!diff)
		diff = "medium";
	diff = diff.toLowerCase();
	let medMana = "";
	let ezType = "";
	if(diff != "hard")
		medMana = "  " + mod_magic.symbolize(card.manaCost)
	if(diff == "easy")
		ezType = "\n" + card.typeLine;
	let hangText = "Guess the card:\n" + blankName + medMana + ezType + "\n```" + rando + "\n";
	hangText += "   ____    \n"; 
	hangText += "  |    |    Missing: " + count + " letter(s)\n";
	hangText += "  |         Guessed: -\n";
	hangText += "  |         Correct: -%\n";
	hangText += "  |         \n";
	hangText += " _|_______";
	hangText += "```";
	hangText += "\nReact with 🇦 🇧 ... 🇿 to guess letters.";
	hangText += "\nOr guess an answer with `guess: Card Name`.";
	let embedded = new Discord.MessageEmbed()
		.setDescription(hangText)
		.setFooter("Game in progress. React with 💬 to change to plaintext mode.")
		.setColor('000001')
	if(diff == "easy")
		embedded.setColor('000000')
	if(diff == "hard")
		embedded.setColor('000002')
	return embedded;
}
function hangmanCallback (msg, channel) {					//sets up hangman collector for name guesses
	msg.react(plainText)
	const collFilter = m => m.content.match(/guess:/i)
	const collector = channel.createMessageCollector(collFilter, {time:5*60*1000});
	collector.on('collect', m => {
		hangmanParser(msg, msg.embeds[0], null, msg.content != "", m.content, collector);
	});
	/*collector.on('end', collected => {
		console.log(`Collected ${collected.size}`);
	});*/

}
function hangmanParser(msg, embedData, emittedEmote, textFlag, guess, collector){ //translates guess or react into hangman data
	let hangText = msg.content;
	if(hangText == "")
		hangText = embedData.description
	let guessedLetters = hangText.match(/Guessed: ([A-Z]+)/);
	if(guessedLetters) {
		guessedLetters = guessedLetters[1].match(/([A-Z])/g);
	}else{
		guessedLetters = [];
	}
	let newLetter = "";
	let update = false;
	if(emittedEmote) { //reaction
		var azIndex = azEmoteArray.indexOf(emittedEmote);
		if(azIndex != -1) { //letter react
			newLetter = azArray[azIndex].toUpperCase();
			if(!guessedLetters.includes(newLetter)) {
				guessedLetters.push(newLetter);
				update = true;
			}
		}else if(textFlag) { //convert to plaintext
			let diff = "medium"
			if(embedData.color == 0)
				diff = "easy";
			if(embedData.color == 2)
				diff = "hard";
			let embedded = updateHangman(hangText, "", guessedLetters, diff, textFlag, guess, msg, collector)
			msg.edit(embedded[0], embedded[1])
		}
	}
	if(update || guess) {
		let diff = "medium"
		if(embedData.color == 0)
			diff = "easy";
		if(embedData.color == 2)
			diff = "hard";
		let embedded = updateHangman(hangText, newLetter, guessedLetters, diff, textFlag, guess, msg, collector)
		if(textFlag) {
			msg.edit(embedded[0], embedded[1])
		}else{
			msg.edit("", embedded);
		}
	}
}
function updateHangman (hangMan, newLetter, guessedLetters, diff, textFlag, guess, msg, collector) { //update canon hangman
	let gameOver = 0;
	let count = parseInt(hangMan.match(/Missing: ([0-9]+)/)[1]);
	let misses = 0;
	let guessedRight = 0;
	let rando = hangMan.match(/```([^\n]+)/)[1];
	let cardList = Object.keys(arcana.magic.cards);
	let cardName = cardList[rando]
	let card = arcana.magic.cards[cardName];
	let chosenName = fuzzy.anglicizeLetters(card.cardName);
	if(!diff)
		diff = "medium";
	let medMana = "";
	let ezType = "";
	if(diff != "hard")
		medMana = "  " + mod_magic.symbolize(card.manaCost)
	if(diff == "easy")
		ezType = "\n" + card.typeLine;
	let blankName = "";
	
	let guessString = guessedLetters.join('');
	let missedCards = hangMan.match(/Guessed cards:\n([^`]+)```/i);
	if(missedCards)
		missedCards = missedCards[1].match(/([^\n`]+)/g);
	if(missedCards == null)
		missedCards = [];
	if(newLetter != "") {
		let counReg = new RegExp(newLetter, 'i')
		if(chosenName.match(counReg))
			count--;
	}else if(guess){ //guessed name
		let collMatch = new RegExp('guess: ?'+chosenName, 'i');
		if(guess.match(collMatch)) { //they got it right
			count = 0;
			guessedRight = 1;
			collector.stop();
		}else{ //they guessed wrong
			missedCards.push(guess.replace(/guess: ?/i, ""));
		}
	}
	if(count == 0)
		gameOver = 2;
	for(let letter in guessedLetters) {
		let letReg = new RegExp(guessedLetters[letter], 'i');
		if(!chosenName.match(letReg))
			misses++;
	}
	for(let card in missedCards)
		misses++;
	let correctPer = parseFloat((1 - misses / (guessedLetters.length+missedCards.length+guessedRight))*100).toFixed(0);
	let headText = (misses > 0 ? "o" : " ");
	let bodText = (misses > 1 ? "|" : " ");
	let lArmText = (misses > 2 ? "/" : " ");
	let rArmText = (misses > 3 ? "\\" : " ");
	let lLegText = (misses > 4 ? "/" : " ");
	let rLegText = (misses > 5 ? "\\" : " ");
	if(misses > 5)
		gameOver = 1;
	if(gameOver > 0) {
		blankName = chosenName;
	}else{
		for(let i = 0; i < chosenName.length; i++) {
			let thisLetter = chosenName.charAt(i).toUpperCase();
			if(guessedLetters.includes(thisLetter)) {
				blankName += chosenName.charAt(i);
			}else if(azArray.includes(thisLetter.toLowerCase())) {
				blankName += blank;
			}else{
				blankName += chosenName.charAt(i);
			}
		}
	}
	chosenName = fuzzy.anglicizeLetters(chosenName.replace(/[’'"\(\)\/\-,]/g, "").replace(/ /g, "_"));
	let hangText = "Guess the card:\n" + blankName + medMana + ezType + "\n```" + rando + "\n";
	hangText += "   ____    \n"; 
	hangText += "  |    |    Missing: " + count + " letter(s)\n";
	hangText += "  |    " + headText + "    Guessed: " + guessString + "\n";
	hangText += "  |   " + lArmText + bodText + rArmText + "   Correct: " + correctPer + "%\n";
	hangText += "  |   " + lLegText + " " + rLegText + "   \n";
	hangText += " _|_______";
	if(missedCards) {
		hangText += "\nGuessed cards:\n";
		for(let card in missedCards){
			hangText += missedCards[card] + "\n";
		}
	}
	hangText += "```";
	hangText += "\nReact with 🇦 🇧 ... 🇿 to guess letters.";
	hangText += "\nOr guess an answer with `guess: Card Name`.";
	if(textFlag) {
		let embedText = "";
		embedText += hangText;
		let nullEmbed = new Discord.MessageEmbed()
			.setDescription("Hangman is in plaintext mode.")
			.setFooter("Game in progress.")
		if(diff == "easy")
			nullEmbed.setColor('000000')
		if(diff == "hard")
			nullEmbed.setColor('000002')
		if(gameOver == 1) {
			embedText += "\nGame over! You didn't guess the card!";
			nullEmbed.setImage(arcana.magic.printImage(cardName, true));
			nullEmbed.setColor('ff0000');
		}
		if(gameOver == 2) {
			embedText += "\nGame over! You guessed the card!";
			nullEmbed.setImage(printImages([cardName], arcana.magic, true));
			nullEmbed.setColor('00ff44');
		}
		return[embedText, nullEmbed];
	}
	let embedded = new Discord.MessageEmbed()
		.setDescription(hangText)
		.setFooter("Game in progress. React with 💬 to change to plaintext mode.")
	if(diff == "easy")
		embedded.setColor('000000')
	if(diff == "hard")
		embedded.setColor('000002')
	if(gameOver == 1) {
		embedded.setFooter("Game over! You didn't guess the card.");
		embedded.setImage(printImages([cardName], arcana.magic, true));
		embedded.setColor('ff0000');
	}
	if(gameOver == 2) {
		embedded.setFooter("Game over! You guessed the card.");
		embedded.setImage(printImages([cardName], arcana.magic, true));
		embedded.setColor('00ff44');
	}
	return embedded;
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
exports.messageHandler = messageHandler;
exports.hangmanParser = hangmanParser;
exports.helpMessage = helpMessage;