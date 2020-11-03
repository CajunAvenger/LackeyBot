/* Bob
 Bob builds the Lackey plugin from the MSEM cards file
 Is also called in Rick
*/
const fs = require("fs");
var time = new Date()
var start = time.getTime();
var toolbox = require("./toolbox");
var timeArray = toolbox.arrayTheDate(time);
var release = 0
var updateMessage = "";
var cards = require('./msem/cards.json');
var legal = require('./msem/legal.json');
var setsArray = require("./msem/setData.json");
var uninstallArray = require('./uninstall.json');
var usedNames = [];
if(process.argv[2] != undefined) {
	for(let i=2; i<process.argv.length; i++)
		updateMessage += process.argv[i] + " ";
	cardURLsBuilder();
	formatsBuilder();
	versionBuilder();
	updatelistFixer();
	allcardsBuilder();
	uninstallBuilder();
}else{
	console.log('bob fired without action')
}

exports.tokenName = tokenName;
exports.pullTokenSet = pullTokenSet;
exports.convertNumbers = convertNumbers;
exports.lackeyScript = setupScripts;
exports.lackeyColorCondenser = lackeyColorCondenser;


function allcardsBuilder () { //builds the Lackey allcards file
	let allcards = "Name	Set	ImageFile	Color	Cost	ConvertedCost	Type	Power	Toughness	Rarity	Note	Script	Text	PackStuff\r\n";
	for(let card in cards) {
		if(cards[card].setID != "BOT" && !legal.masterpiece.includes(cards[card].fullName)) {
			if(cards[card].setID == "tokens") {
				allcards += tokenName(cards[card]);
				allcards += "	tokens	";
				allcards += cards[card].cardID;
				allcards += "	" + lackeyColorCondenser(cards[card].color);
				allcards += "		" + cards[card].cmc + "	";
				if(cards[card].fullName.match(/Reminder/)) {
					allcards += cards[card].typeLine.replace(/ $/,"");
				}else{
					allcards += "Token";
				}
				allcards += "	" + cards[card].power;
				allcards += "	" + cards[card].toughness;
				allcards += "	T		" + setupScripts(cards[card]);
				allcards += "	" + lackeyTextConverter(cards[card].rulesText);
				allcards += "	\r\n";
			}else{
				allcards += lackeyBaseWriter(cards[card]);
			}
		}
	}
	allcards = allcards.replace(/’/g,"'");
	allcards = allcards.replace(/—/g,"-");
	allcards = allcards.replace(/★/g,"X");
	fs.writeFile('plugin/allcards.txt', allcards, (err) => {
		if (err) throw err;
		console.log('allcards written');
		});
}
function tokenName(card) { //generates a token's name
	if(card.fullName == "Revived " + card.cardName)
		return "revived " + card.cardName + " " + pullTokenSet(card, setsArray);
	if(card.cardName == "Treasure")
		return "Treasure " + pullTokenSet(card, setsArray);
	if(card.cardName == "Gold")
		return "Gold " + pullTokenSet(card, setsArray);
	if(card.cardName == "Lotus Petal")
		return card.fullName;
	if(card.cardName == "Idol")
		return "Idol " + pullTokenSet(card, setsArray);
	if(pullTokenSet(card, setsArray) == "MSEMAR")
		return card.cardName;
	if(card.fullName.match(/(Reminder|Emblem)/i))
		return card.fullName + " " + pullTokenSet(card, setsArray);
 	//TODO figure out why this is here
	if(card == cards["Bessie Emblem._TKN_VTM"])
		return "Promo Bessie Emblem VTM";
	if(!card.typeLine.match(card.cardName.replace(/\*/g,"")))
		return card.cardName + " " + pullTokenSet(card, setsArray);
	let waydualsarray = ["Plains Island","Island Swamp","Swamp Mountain","Mountain Forest","Forest Plains","Plains Swamp","Island Mountain","Swamp Forest","Mountain Plains","Forest Island"];
	if(waydualsarray.includes(card.cardName))
		return card.cardName;
	let tokenPT = card.power + "/" + card.toughness + " ";
	if(tokenPT == "/ " || tokenPT.match("★") || tokenPT.match("X"))
		tokenPT = "";
	let tokenColor = lackeyColorCondenser(card.color);
	if(tokenColor == "") {
		tokenColor = "colorless ";
	}else{
		if(tokenColor.length > 2) {
			tokenColor = "";
		}else{
			if(tokenColor == "WU")
				tokenColor = "white and blue ";
			if(tokenColor == "UB")
				tokenColor = "blue and black ";
			if(tokenColor == "BR")
				tokenColor = "black and red ";
			if(tokenColor == "RG")
				tokenColor = "red and green ";
			if(tokenColor == "WG")
				tokenColor = "green and white ";
			if(tokenColor == "WB")
				tokenColor = "white and black ";
			if(tokenColor == "UR")
				tokenColor = "blue and red ";
			if(tokenColor == "BG")
				tokenColor = "black and green ";
			if(tokenColor == "WR")
				tokenColor = "red and white ";
			if(tokenColor == "UG")
				tokenColor = "green and blue ";
			if(tokenColor == "W")
				tokenColor = "white ";
			if(tokenColor == "U")
				tokenColor = "blue ";
			if(tokenColor == "B")
				tokenColor = "black ";
			if(tokenColor == "R")
				tokenColor = "red ";
			if(tokenColor == "G")
				tokenColor = "green ";
		}
	}
	let tokenType = card.typeLine.replace(/(Basic |Snow |Token |Artifact |Creature |Enchantment |Land |Emblem )/g,"");
	let tokenName = tokenPT + tokenColor + tokenType.replace("— ","");

	if(card.typeLine.match("Legendary") || !card.typeLine.match("—"))
		tokenName = card.cardName + " ";
	if(card.typeLine.match("Emblem"))
		tokenName = tokenType.replace("— ","") + " Emblem ";
	tokenName = tokenName.replace(/  /g, " ");
	tokenName += pullTokenSet(card, setsArray);
	if(tokenName == "1/1 colorless Scout WAY")
		tokenName = "1/1 Scout WAY";
	if(tokenName == "1/1 colorless Scout MS2")
		tokenName = "1/1 Scout MS2";
	if(tokenName == "1/1 colorless Scout MPS_MSE")
		tokenName = "1/1 Scout MPS_MSE";
	if(tokenName == "8/8 colorless Elemental ALR")
		tokenName = "8/8 Elemental ALR";
	return tokenName;
}
function pullTokenSet(card, setbase) { //determines what set a token belongs to
	for(let set in setbase) {
		if(card.cardID.match(set))
			return set;
		if(card.setID.match(set))
			return set;
		
	}
	return "MSEMAR";
}
function lackeyBaseWriter(card) { //writes a standard card entry
	//Tokens, Masterpieces
	var thisEntry = "";
	thisEntry += card.cardName.replace(/\*/g,"");
	if(card.shape == "split")
		thisEntry += " // " + card.cardName2;
	if(card.rarity == "special" || card.rarity == "masterpiece" || card.setID == "L2" || card.setID == "L3")
		thisEntry += ".";
	if(card.hidden)
		thisEntry = card.hidden;
	let testName = thisEntry + "_" + card.setID;
	let alphaArray = ["", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"];
	if(card.rarity == "basic land" && setsArray[card.setID].basics == 2)
		alphaArray[0] = "a";
	let i = 0;
	while(usedNames.includes(testName)) {
		i++
		testName = thisEntry + " " + alphaArray[i] + "_" + card.setID;
	}
	if(i || (card.rarity == "basic land" && setsArray[card.setID].basics == 2)) {
		thisEntry += " " + alphaArray[i];
	}
	usedNames.push(testName);
	thisEntry += "	" + card.setID;
	thisEntry += "	" + card.cardID;
	if(card.shape == "doubleface") {
		thisEntry += "a," + card.cardID + "b";
	}else if(card.notes == "non-English"){
		thisEntry += "," + card.cardID + "b"
	}
	thisEntry += "	" + lackeyColorCondenser(card.color);
	if(card.shape == "split")
		thisEntry += " // " + lackeyColorCondenser(card.color2);
	thisEntry += "	" + card.manaCost.replace(/[\{\}]/g,"");
	if(card.shape == "split")
		thisEntry += " // " + card.manaCost2.replace(/[\{\}]/g,"");
	thisEntry += "	" + card.cmc;
	if(card.shape == "split")
		thisEntry += " // " + card.cmc2;
	thisEntry += "	" + card.typeLine.replace(/ $/,"");
	if(card.shape == "split" && (card.typeLine.replace(/ $/,"") != card.typeLine2.replace(/ $/,"")))
		thisEntry += " // " + card.typeLine2.replace(/ $/,"");
	thisEntry += "	" + card.power + "	";
	if(card.typeLine.match("Planeswalker")) {
		thisEntry += card.loyalty;
	}else{
		thisEntry += card.toughness;
	}
	thisEntry += "	" + lackeyRarityCondenser(card) + "	";
	let banhistory = "";
	if(legal.modernBan.includes(card.fullName) || card.typeLine.match(/Conspiracy/))
		banhistory += "Banned";
	if(legal.edhBan.includes(card.fullName)) {
		if(banhistory != "")
			banhistory += ", "
		banhistory += "EDH Banned";
	}
	thisEntry += banhistory;
	thisEntry += "	";
	thisEntry += setupScripts(card);
	thisEntry += "	" + lackeyTextConverter(card.rulesText);
	if(card.shape == "split")
		thisEntry += " // " + lackeyTextConverter(card.rulesText2);
	if(card.shape == "doubleface" || card.shape == "adventure") {
		thisEntry += " ----- ";
		thisEntry += card.cardName2 + "|"  + card.typeLine2;
		if(card.typeLine2.match("Planeswalker"))
			thisEntry += " [" + card.loyalty + "] ";
		if(card.power2 != "")
			thisEntry += " [" + card.power2 + "/" + card.toughness2 + "] ";
		thisEntry += lackeyTextConverter(card.rulesText2);
	}
	thisEntry += "	"; //add packstuff
	if(card.notes.includes("reprint"))
		thisEntry += "reprint,"
	thisEntry += "\r\n";
	return thisEntry;
}
function lackeyColorCondenser (swath) { //condenses card colors down to Lackey color
	if(!swath)
		return "";
	var someColors = "";
	if(swath.match("White"))
		someColors += "W";
	if(swath.match("Blue"))
		someColors += "U";
	if(swath.match("Black"))
		someColors += "B";
	if(swath.match("Red"))
		someColors += "R";
	if(swath.match("Green"))
		someColors += "G";
	return someColors;
}
function lackeyRarityCondenser (card) { //condenses card rarity down to Lackey rarity
	var cardRare = "";
	if(card.rarity == "common")
		cardRare = "C";
	if(card.rarity == "uncommon")
		cardRare = "U";
	if(card.rarity == "rare")
		cardRare = "R";
	if(card.rarity == "mythic rare")
		cardRare = "M";
	if(card.rarity == "bonus")
		cardRare = "B";
	if(card.rarity == "special")
		cardRare = "P";
	if(card.rarity == "masterpiece")
		cardRare = "MPS";
	return cardRare;
}
function lackeyTextConverter (cardText) { //converts text to Lackey-viable text
	var thisStuff = cardText.replace(/[\{\}]/g,"");
	thisStuff = thisStuff.replace(/\n/g," ");
	thisStuff = thisStuff.replace(/\*/g,"");
	thisStuff = thisStuff.replace(/ [ ]+/g," ");
	return thisStuff;
}
function convertNumbers (number) { //converts numbers up to twenty to number words
	if(number == "a" || number == "an")
		return "1";
	if(number == "X" || number == "a number of")
		return "X";
	let value = toolbox.convertNumbers(number);
	return value;
}
function setupScripts (card){ //handles the script building
	let initScript = "";
	let cleanedName = card.cardName.replace(/\*/g,"");
	cleanedName = cleanedName.replace(/’/g,"'");
	var etbtMatch = card.rulesText.match(cleanedName + " enters the battlefield tapped");
	if(etbtMatch)
		initScript += "/cr90";
	var counterMatch = card.rulesText.match(/enters the battlefield (tapped )?with (a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty) (\+1\/\+1|-1\/-1|time|charge|sanctum) counters?/);
	var counterColor = "red";
	if(counterMatch) {
		var counterCount = convertNumbers(counterMatch[2]);
		if(counterMatch[3] == "+1/+1" || counterMatch[3] == "charge")
			counterColor = "green"
		if(initScript != "")
			initScript += ";";
		initScript += "/cc" + counterColor + "=" + counterCount;
	}
	if(card.typeLine.match("Saga"))
		initScript += "/ccyellow=1";
	if(card.typeLine.match("Planeswalker"))
		initScript += "/ccgreen=" + card.loyalty;
	if(initScript != "")
		initScript = "<s><a>y</a><l>Initialize</l><f>" + initScript + "</f></s>";
	if(card.typeLine.match("Planeswalker")) {
		var breakMatch = card.rulesText.match(/[^\n]*\n/g);
		for(let line in breakMatch) {
			var loyalCheck = breakMatch[line].match(/\[((-|\+)[0-9]+)]/);
			if(loyalCheck) {
				tempScript = automagicalScripts(card,breakMatch[line]);
				counterChange = "/ccgreen" + loyalCheck[1];
				if(tempScript != ""){
					tempScript = tempScript.replace("<l>","<l>" + loyalCheck[1] + ", ");
					tempScript = tempScript.replace("<f>","<f>" + counterChange + ";");
					initScript += tempScript;
				}else{
					initScript += "<s><l>" + loyalCheck[1] + "</l><f>" + counterChange + "</f></s>";
				}
			}else{
				initScript += automagicalScripts(card,breakMatch[line]);
			}
		}
	}else{
		initScript += automagicalScripts(card,card.rulesText);
		if(card.shape == "doubleface" || card.shape == "adventure") {
			if(card.typeLine2.match("Planeswalker")) {
				initScript += "<s><l>Ascend</l><f>/cf;/ccgreen=" + card.loyalty2 + "</f></s>";
				var breakMatch2 = card.rulesText2.match(/[^\n]*\n/g);
				for(let line in breakMatch2) {
					var loyalCheck2 = breakMatch2[line].match(/\[((-|\+)[0-9]+)]/);
					if(loyalCheck2) {
						tempScript2 = automagicalScripts(card,breakMatch2[line]);
						counterChange2 = "/ccgreen" + loyalCheck2[1];
						if(tempScript2 != ""){
							tempScript2 = tempScript2.replace("<l>","<l>" + loyalCheck2[1] + ", ");
							tempScript2 = tempScript2.replace("<f>","<f>" + counterChange2 + ";");
							initScript += tempScript2;
						}else{
							initScript += "<s><l>" + loyalCheck2[1] + "</l><f>" + counterChange2 + "</f></s>";
						}
					}else{
						initScript += automagicalScripts(card,breakMatch2[line]);
					}
				}
			}else{
				initScript += automagicalScripts(card,card.rulesText2);
			}			
		}
	}
	//specific cards
	//for when problems/special situations arise
	if(card.script != undefined && card.script != null && typeof card.script == 'object') {
		if(card.script[1] == "r") //replace with override script
			initScript = card.script[0];
		if(card.script[1] == "l") //add a leading script
			initScript = card.script[0] + initScript;
		if(card.script[1] == "t") //add a trailing script
			initScript += card.script[0];
	}
	initScript = initScript.replace("<s><l>Spawn Masterpiece</l><f>/spawn Masterpiece DOA</f></s>","");
	return initScript;
}
function automagicalScripts (card, textBox) { //generates scripts from card text
	var scripts = "";
	//Tokens
	var tokensgrab = textBox.match(/reates? ([\S\s])+/);
	if(tokensgrab) {
		var tokensMatch = tokensgrab[0].match(/(([A-Za-z,'-]+(,? [A-Za-z,' -]+)?), )?(X|a number of|a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)( tapped)?( and attacking)?( legendary)?( snow)? ?([XYZ0-9]+\/[XYZ0-9]+ )?(colorless|white|blue|black|red|green|Treasure|Gold)?( and white| and blue| and black| and red| and green)? ?([A-Z][a-z]+)?( [A-Z][a-z]+)?( [A-Z][a-z]+)? ?(enchantment )?(artifact )?(land )?(creature )?tokens?( with [^\n]+)?( named ([^\n]+))?( with)?/g);
		if(tokensMatch) {
			for(let i in tokensMatch) {
				var tokenMatch = tokensMatch[i].match(/(([A-Za-z,'-]+(,? [A-Za-z,' -]+)?), )?(X|a number of|a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)( tapped)?( and attacking)?( legendary)?( snow)? ?([XYZ0-9]+\/[XYZ0-9]+ )?(colorless|white|blue|black|red|green)?( and white| and blue| and black| and red| and green)? ?([A-Z][a-z]+)?( [A-Z][a-z]+)?( [A-Z][a-z]+)? ?(enchantment )?(artifact )?(land )?(creature )?tokens?( with [^\n]+)?( named ([^\n]+))?( with)?/);
				var legendName = "";
				var tokenCount = "";
				var tokenPT = "";
				var tokenColors = "";
				var tokenTypes = "";
				var tokenSpawnName = "";
				var tokenLabelName = "";
				var skipFlag = 0;
				if(tokenMatch[2] != undefined)
					legendName = tokenMatch[2];
					//or tokenMatch[19] (named X with?)
				if(tokenMatch[4] != undefined)
					tokenCount = tokenMatch[4];
				if(tokenMatch[9] != undefined)
					tokenPT = tokenMatch[9];
				if(toolbox.hasValue(tokenMatch[10]))
					tokenColors += tokenMatch[10];
				if(toolbox.hasValue(tokenMatch[11]))
					tokenColors += tokenMatch[11];
				for(i=12;i<15;i++) {
					if(tokenMatch[i] != undefined)
						tokenTypes += tokenMatch[i];
				}
				//tokens without subtypes
				if(!tokenMatch[12]) {
					if(tokenMatch[20]){
						tokenTypes = tokenMatch[21].replace(/ with [\S\s]+/,"");
						tokenTypes = tokenTypes.replace(/\./,"");
						legendName = tokenTypes;
					}else{
						if(!textBox.match(/(that's a copy|that is a copy|that are copies|(that's the chosen|of those) types)/) && !textBox.match(/(If|When)[^,]*token/i))
							console.log("Warning: Possible broken token on " + card.cardName + "(" + card.setID +")");
						skipFlag = 1;
					}
				}
				if(skipFlag == 0){
					tokenSpawnName = tokenColors + " " + tokenTypes + " ";
					if(!tokenPT.match("X"))
						tokenSpawnName = tokenPT + " " + tokenSpawnName;
					tokenLabelName = tokenTypes;
					if(legendName != "") {
						tokenSpawnName = legendName + " ";
						tokenLabelName = legendName;
					}
					if(card.setID == "tokens") {
						tokenSpawnName += pullTokenSet(card, setsArray);
					}else{
						tokenSpawnName += card.setID;
					}
					var tokenNumber = convertNumbers(tokenCount);
					var forMatch  = textBox.match(/(token[^\n(]+for each|for each[^\n(]+create)/i);
					if(tokenNumber == "X" || forMatch)
						scripts += "<s><l>Spawn " + tokenLabelName + "</l><f>/spawn " + tokenSpawnName + "</f></s>" + "<s><l>Spawn five " + tokenLabelName + " tokens</l><f>/spawnx5 " + tokenSpawnName + "</f></s>";
					if(tokenNumber == "1" && !forMatch)
						scripts += "<s><l>Spawn " + tokenLabelName + "</l><f>/spawn " + tokenSpawnName + "</f></s>";
					if(tokenNumber != "X" && tokenNumber != "1")
						scripts += "<s><l>Spawn " + tokenCount + " " + tokenLabelName + " tokens</l><f>/spawnx" + tokenNumber + " " + tokenSpawnName + "</f></s>";
					
					var addsMatch = textBox.match(/reates? (two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty) of those tokens/);
					if(addsMatch){
						var newSpawn = "<s><l>Spawn " + addsMatch[1] + " " + tokenLabelName + " tokens</l>";
						newSpawn += "<f>/spawnx" + convertNumbers(addsMatch[1]) + " " + tokenSpawnName + "</f></s>";
						scripts += newSpawn;
					}
				}
			}
			//javascript nonsense fixes
			scripts = scripts.replace(/ [ ]+/g," ");
			scripts = scripts.replace(/X\/X /g,"");
			scripts = scripts.replace(/[Cc]?reates? /g,"");
			//Investigate
			scripts = scripts.replace("<s><l>Spawn Clue","<s><l>Investigate");
			if(textBox.match("vestigate twice"))
				scripts = scripts.replace("<s><l>Investigate</l><f>/spawn","<s><l>Investigate twice</l><f>/spawnx2");
			if(textBox.match("vestigate three"))
				scripts = scripts.replace("<s><l>Investigate</l><f>/spawn","<s><l>Investigate three times</l><f>/spawnx3");
			//Idolize
			scripts = scripts.replace("<s><l>Spawn Idol","<s><l>Idolize");
			if(textBox.match("dolize twice"))
				scripts = scripts.replace("<s><l>Idolize</l><f>/spawn","<s><l>Idolize twice</l><f>/spawnx2");
			if(textBox.match("dolize seven"))
				scripts = scripts.replace("<s><l>Idolize</l><f>/spawn","<s><l>Idolize seven times</l><f>/spawnx7");
			if(textBox.match(/dolize (for|X)/))
				scripts += "<s><l>Idolize five times</l><f>/spawnx5 Idol GNJ</f></s>";
			//Adjudicate
			scripts = scripts.replace("<s><l>Spawn Aura</l><f>/spawn white Aura MIS</f></s>","<s><l>Adjudicate</l><f>/spawn white Aura MIS</f></s>");
			//Land Bundle fixes
			scripts = scripts.replace(/Clue L[23]?/,"Clue VTM");
			scripts = scripts.replace(/Treasure L[23]?/,"Treasure TOJ");
			scripts = scripts.replace(/Gold L[23]?/,"Gold HI12");
			//Entirely necessary
			scripts = scripts.replace(">Spawn Kraken<",">Release the Kraken<");
		}
	}
	//Scry
	var scryMatch = textBox.match(/[Ss]cry ([0-9]+)/);
	var fateMatch = textBox.match(/fateseal ([0-9]+)/i);
	if(scryMatch)
		scripts += "<s><l>Scry " + scryMatch[1] + "</l><f>/vp1pt" + scryMatch[1] + "</f></s>";
	var scryTrimmed = textBox.replace(/To scry [0-9]+, look/,"");
	//Look top
	var looktopMatch = scryTrimmed.match(/[Ll]ook at the top ?(and bottom )?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)? ?cards?/);
	if(looktopMatch && !fateMatch) {
		cardStack = "one";
		if(looktopMatch[2] != undefined)
			cardStack = looktopMatch[2];
		scripts += "<s><l>Look at top " + cardStack + "</l><f>/vp1pt" + convertNumbers(cardStack) + "</f></s>";
	}
	//Show top
	var showtopMatch = textBox.match(/(reveal|shuffle|exile) the top ?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)? cards?/i);
	if(showtopMatch){
		cardStack = "one";
		if(showtopMatch[2] != undefined)
			cardStack = showtopMatch[2];
		scripts += "<s><l>Reveal top " + cardStack + "</l><f>/vp1at" + convertNumbers(cardStack) + "</f></s>";
	}
	//Look bottom
	var lookbotMatch = textBox.match(/(look at|put|exile) the (top and )?bottom ?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)? cards?/i);
	if(lookbotMatch){
		cardStack = "one";
		if(lookbotMatch[3] != undefined)
			cardStack = lookbotMatch[3];
		scripts += "<s><l>Look at bottom " + cardStack + "</l><f>/vp1pb" + convertNumbers(cardStack) + "</f></s>";
	}
	//Show bottom
	var showbotMatch = textBox.match(/([Rr]eveal|[Ee]xile) the bottom ?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)? cards?/);
	if(showbotMatch){
		cardStack = "one";
		if(showbotMatch[2] != undefined)
			cardStack = showbotMatch[2];
		scripts += "<s><l>Reveal bottom " + cardStack + "</l><f>/vp1ab" + convertNumbers(cardStack) + "</f></s>";
	}
	//Revive
	var reviveMatch = textBox.match(/(\n|^)Revive/);
	if(reviveMatch)
		scripts += "<s><l>Revive token</l><f>/spawn revived " + card.cardName + " " + card.setID + "</f></s>";
	//Shimmer
	var shimmerMatch = textBox.match(/(Shimmer |shimmer.)/);
	if(shimmerMatch)
		scripts += "<s><l>Shimmer token</l><f>/spawn Shimmer ORP</f></s>";
	//MSEMAR Copy
	var copyMatch = textBox.match(/(that's a copy|that is a copy|that are copies)/);
	if(!reviveMatch && !shimmerMatch && copyMatch)
		scripts += "<s><l>Copy reminder</l><f>/spawn Copy</f></s>";
	//MSEMAR Exile
	var exileMatch = textBox.match(/(play|cast) [^\n.]+ (from exile|exiled)/);
	if(exileMatch)
		scripts += "<s><l>Cast from Exile reminder</l><f>/spawn Can Be Cast From Exile</f></s>";
	//MSEMAR Archive
	var archMatch = textBox.match(/Archive \d/);
	if(archMatch)
		scripts += "<s><l>Additional library reminder</l><f>/spawn Additional Library</f></s>";
	//MSEMAR Research
	var archMatch = textBox.match(/Eureka \d/);
	if(archMatch)
		scripts += "<s><l>Research counter</l><f>/spawn Research Counter</f></s>";
	//Glory
	var gloryMatch = textBox.match(/glory counter/);
	if(gloryMatch)
		scripts += "<s><l>Glory counter</l><f>/spawn Glory Counter OPH</f></s>";
	//Morph
	var morphMatch = textBox.match(/((^|\n)Metamorph |(^|\n)Morph |[Mm]anifest)/);
	if(morphMatch)
		scripts += "<s><l>Morph overlay</l><f>/spawn Morph MIS</f></s>";
	//Submerge
	var submergeMatch = textBox.match(/[Ss]ubmerge/);
	if(submergeMatch)
		scripts += "<s><l>Submerge overlay</l><f>/spawn Submerge GNJ</f></s>";
	//Primal
	var primalMatch = textBox.match(/(^|\n)Primal /);
	if(primalMatch)
		scripts += "<s><l>Primal reminder</l><f>/spawn Primal NVA</f></s>";
	//Emblem
	var emblemCheck = textBox.match(/gets? an emblem/);
	if(emblemCheck) {
		scripts += "<s><l>Emblem Get</l><f>/spawn ";
		if(card.typeLine.match("Planeswalker")) {
			scripts += card.typeLine.replace(/(Legendary )?Planeswalker — /,"");
		}else{
			scripts += card.cardName;
		}
		scripts += " Emblem " + card.setID + "</f></s>";
	}
	scripts = scripts.replace(/  /g," "); //remove any double spaces
	scripts = scripts.replace(/(colorless )?Idol/g,"Idol") //trim Idol
	return scripts;
}

function cardURLsBuilder () { //builds the Card_URLs file
	let urls = "CardImageURLs:\n"
	for(let card in cards) {
		if(cards[card].setID != "BOT") {
			if(cards[card].shape == "doubleface") {
				urls += urlWriter(cards[card], "a");
				urls += urlWriter(cards[card], "b");
			}else{
				urls += urlWriter(cards[card], "");
			}
		}
	}
	fs.writeFile('plugin/CardImageURLs1.txt', urls, (err) => {
		if(err) throw err;
		console.log('CardImageURLs1 written');
	});
}
function urlWriter(card, add) {
	let code = card.setID + "/" + card.cardID + add + ".jpg";
	let url = code + "	http://mse-modern.com/msem2/images/" + code + "\r\n";
	return url;
}	

function formatsBuilder () {
	let output = "\r\n<formatdefinitions>\r\n\r\n";
	
	output += "<format><label>MSE Modern</label>\r\n";
	for(let set in setsArray) {
		output += "<set>" + set + "</set>\r\n";
	}
	output += "</format>\r\n";
	output += "</formatdefinitions>";
	fs.writeFile('plugin/formats.txt', output, (err) => {
		if(err) throw err;
		console.log('formats written');
	});
}

function versionBuilder () {
	let output = "<version>\r\n\r\n";
	output += "<lastupdateYYMMDD>" + timeArray[0] + timeArray[1] + timeArray[2] + "</lastupdateYYMMDD>";
	output += "<versionurl>http://mse-modern.com/msem2/version.txt</versionurl>\r\n";
	output += "<updateurl>http://mse-modern.com/msem2/updatelist.txt</updateurl>\r\n";
	output += "<message>" + updateMessage + "To avoid update bugs, delete uninstall.txt, then update twice. Delete your setimages folder to make sure you're not playing with outdated versions of cards.</message>\r\n\r\n";
	output += "</version>";
	fs.writeFile('plugin/version.txt', output, (err) => {
		if(err) throw err;
		console.log('version written');
	});
}

function updatelistFixer () {
	fs.readFile('plugin/updatelistNEW.txt', "utf8", function read(err, data) {
		if (err) throw err;
		let list = data;
		let dateMatch = list.match(/([0-9-]*)\r\n/);
		let the_date = timeArray[1] + "-" + timeArray[2] + "-" + timeArray[0];
		list = list.replace(dateMatch[1], the_date);
		list = list.split("CardImageURLs:");
		list = list[0] + "CardURLFiles:" + list[1];
		fs.writeFile('plugin/updatelist.txt', list, (err) => {
			if(err) throw err;
			console.log('updatelist fixed');
		});
	});
}

function uninstallBuilder () { //builds the uninstall file
	//version control
	let temp = "";
	let output = "<uninstall>\r\n\r\n";
	output += "<dateYYMMDD>" + timeArray[0] + timeArray[1] + timeArray[2] + "</dateYYMMDD>\r\n";
	//default updates
	output += "<removepath>CardImageURLs1.txt</removepath>\r\n";
	output += "<removepath>CardImageURLs2.txt</removepath>\r\n";
	output += "<removepath>updateinstructions.txt</removepath>\r\n";
	output += "<removepath>updatelist.txt</removepath>\r\n";
	output += "<removepath>formats.txt</removepath>\r\n";
	output += "<removepath>sets/allcards.txt</removepath>\r\n";
	output += "<removepath>uninstall.txt</removepath>\r\n";
	output += "<removepath>version.txt</removepath>\r\n";
	output += "<removepath>ListOfCardDataFiles.txt</removepath>\r\n";
	output += "<removepath>packs/packdefinitions1.xml</removepath>\r\n\r\n";
	for(let thisCard in uninstallArray) { //changed cards
		temp = "<removepath>sets/setimages/" + uninstallArray[thisCard].setID + "/" + uninstallArray[thisCard].cardID;
		if(cards[uninstallArray[thisCard].name] != undefined && cards[uninstallArray[thisCard].name].shape == "doubleface")
			temp = temp + "a.jpg</removepath>\r\n" + temp + "b";
		output += temp + ".jpg</removepath>\r\n"
		
	}
	output += "</uninstall>";
	fs.writeFile('plugin/uninstall.txt', output, (err) => {
		if(err) throw err;
		console.log('uninstall written');
		let end = new Date().getTime();
		let seconds = (end - start) / 1000;
		console.log('plugin writen in ' + seconds + ' seconds.');
	});
}
