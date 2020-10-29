/* Rick
 Builds the MSEM Cockatrice files.
*/
var cards = require('./msem/cards.json');
var setsArray = require("./msem/setData.json");
setsArray["MSEMAR"] = {longname:"MSEM Additional Resources"}
var bob = require('./bob');
var fs = require('fs');
var toolbox = require('./toolbox');
var tokensRelated = {};
var cardsFile = "";
var tokensFile = "";

function tokenName(card) { //generates a token's name
	if(card.fullName == "Revived " + card.cardName)
		return "revived " + card.cardName + " " + bob.pullTokenSet(card, setsArray);
	if(card.cardName == "Treasure")
		return "Treasure " + bob.pullTokenSet(card, setsArray);
	if(card.cardName == "Lotus Petal")
		return card.fullName;// + " " + bob.pullTokenSet(card, setsArray);
	if(card.cardName == "Idol")
		return "Idol " + bob.pullTokenSet(card, setsArray);
	if(bob.pullTokenSet(card, setsArray) == "MSEMAR")
		return card.cardName;
	if(card.fullName.match(/(Reminder|Emblem)/i))
		return card.fullName + " " + bob.pullTokenSet(card, setsArray);
 	//TODO figure out why this is here
	if(card == cards["Bessie Emblem._TKN_VTM"])
		return "Promo Bessie Emblem VTM";
	if(!card.typeLine.match(card.cardName.replace(/\*/g,"")))
		return card.cardName + " " + bob.pullTokenSet(card, setsArray);
	let waydualsarray = ["Plains Island","Island Swamp","Swamp Mountain","Mountain Forest","Forest Plains","Plains Swamp","Island Mountain","Swamp Forest","Mountain Plains","Forest Island"];
	if(waydualsarray.includes(card.cardName))
		return card.cardName;
	let tokenPT = card.power + "" + card.toughness;
	if(tokenPT == "/ " || tokenPT.match("★") || tokenPT.match("X"))
		tokenPT = "";
	let tokenColor = bob.lackeyColorCondenser(card.color);
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
				tokenColor = "blue and green ";
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
	let tokenName = tokenColor + tokenType.replace("— ","") + " " + tokenPT;

	if(card.typeLine.match("Legendary") || !card.typeLine.match("—"))
		tokenName = card.cardName + " ";
	if(card.typeLine.match("Emblem"))
		tokenName = tokenType.replace("— ","") + " Emblem ";
	tokenName = tokenName.replace(/  /g, " ");
	tokenName += bob.pullTokenSet(card, setsArray);
	if(tokenName == "colorless Scout 11WAY")
		tokenName = "Scout 11WAY";
	return tokenName;
}
function allsets(card, dfc) {
	let cardName = card.cardName;
	if(dfc)
		cardName = card.cardName2;
	cardName = cardName.replace(/\*/g,"");
	let linkLine = " <set rarity=\""+card.rarity.replace("masterpiece","special")+"\" picURL=\"/"+cardName+".jpg\" picURLSt=\"\" picURLHq=\"\">"+card.setID + "</set>\r\n";
	if(card.shape == "split")
		linkLine = linkLine.replace(cardName, cardName + card.cardName2);
	return linkLine;
}
function tokenSetBlock(card) {
	return " <set picURL=\"/"+tokenName(card).replace(/\//g,"")+".jpg\" picURLSt=\"\" picURLHq=\"\">" + bob.pullTokenSet(card, setsArray) + "</set>\r\n";
}
function triceTranslator(script, entry) {
	//two scripts we're looking for, tokens and cipt
	//for tokens, we bank those for later
	let tokensPull = script.match(/<f>[^<]*\/spawnx?[0-9]* [^<]*/ig);
	if(tokensPull && toolbox.hasValue(tokensPull)) {
		for(let i=0;i<tokensPull.length;i++) {
		let tokensMatch = tokensPull[i].match(/<f>[^<]*\/spawnx?([0-9]+)? ([^<]*)/i);
			if(tokensMatch && toolbox.hasValue(tokensMatch)) {
				for(j=1; j<tokensMatch.length; j++) {
					let tokenAmount = "1";
					if(tokensMatch[1] != undefined && tokensMatch[1] != null)
						tokenAmount = tokensMatch[1];
					let tokenName = tokensMatch[2] //TODO cull this
					let ptPull = tokenName.match(/^([0-9]+)\/([0-9]+) /)
					if(ptPull) {
						tokenName = tokenName.replace(ptPull[0], "");
						let setPull = tokenName.match(/([A-Z0-9_]+)$/)
						if(setPull)
							tokenName = tokenName.replace(setPull[0], "");
						tokenName += ptPull[1] + ptPull[2]
						if(setPull)
							tokenName += setPull[1];
					}
					tokenName = tokenName.replace("’", "'");
					let triceName = entry;						//normal reprint
					if(!cards[entry].notes.includes("reprint"))
						triceName = cards[entry].fullName 		//if normal original printing
					if(cards[entry].shape == "split") {
						triceName = cards[entry].cardName + " // " + cards[entry].cardName2; //split original printing
						if(cards[entry].notes.includes("reprint"))
							triceName = cards[entry].cardName + "_" + cards[entry].setID + " // " + cards[entry].cardName2  + "_" + cards[entry].setID; //split reprinting
					}
					if(cards[entry].shape == "doubleface" || cards[entry].shape == "adventure") {
						triceName = cards[entry].cardName + '_' + cards[entry].setID; //dfc reprint
						if(!cards[entry].notes.includes("reprint"))
							triceName = cards[entry].cardName 		//dfc original printing
					}
					if(!tokensRelated.hasOwnProperty(tokenName))
						tokensRelated[tokenName] = {};
					if(!tokensRelated[tokenName].hasOwnProperty(triceName))
						tokensRelated[tokenName][triceName] = [];
					if(!tokensRelated[tokenName][triceName].includes(tokenAmount))
						tokensRelated[tokenName][triceName].push(tokenAmount);
				}
			}
		}
	}
	//for cipt, we set that on the card itself
	//it's the only script we can add here, so we return it
	if(script.match("cr90"))
		return "<cipt>1</cipt>";
	return "";
}
function triceBlockWriter(entry) {
	let card = cards[entry];

	let setCheck = allsets(card, false);
	if(setCheck === false)
		return;
	cardsFile += "<card>\r\n";
	if(card.shape == "split") {
		cardsFile += " <name>"+card.cardName+" // "+card.cardName2 + "</name>\r\n";
	}else{
		cardsFile += " <name>"+card.cardName.replace(/\*/g, "")+"</name>\r\n";
	}
	cardsFile += setCheck;
	let cardColors = bob.lackeyColorCondenser(card.color);
	for(let i=0;i<cardColors.length;i++) {
		cardsFile += " <color>"+cardColors.charAt(i)+"</color>\r\n";
	}
	cardsFile += " <manacost>"+card.manaCost.replace(/[{}]/g,"");
	if(card.shape == "split")
		cardsFile += " // " + card.manaCost2.replace(/[{}]/g,"")
	cardsFile += "</manacost>\r\n";
	if(card.shape == "doubleface")
		cardsFile += " <related>" + card.cardName2.replace(/\*/g, "")+"</related>\r\n";
	cardsFile += " <cmc>"+card.cmc+"</cmc>\r\n";
	if(card.loyalty)
		cardsFile += " <loyalty>"+card.loyalty+"</loyalty>\r\n";
	if(card.power) {
		cardsFile += " <pt>" + card.power + "/" + card.toughness+"</pt>\r\n";
	}
	cardsFile += " <type>"+card.typeLine.replace(/ $/,"");
	if(card.shape == "split")
		cardsFile += " // " + card.typeLine2.replace(/ $/,"");
	cardsFile += "</type>\r\n";
	cardsFile += " <tablerow>";
	if(card.cardType.match(/(Instant|Sorcery)/)) {
		cardsFile += "3";
	}else if(card.cardType.match(/Land/)) {
		cardsFile += "0";
	}else if(card.cardType.match(/Creature/)) {
		cardsFile += "2";
	}else{
		cardsFile += "1";
	}
	cardsFile += "</tablerow>\r\n";
	if(card.shape == "split") {
		cardsFile += " <text>"+card.rulesText.replace(/\n/g," ")+"\r\n //\r\n " + card.rulesText2.replace(/\n/g," ") + "</text>\r\n";
	}else{
		cardsFile += " <text>"+card.rulesText.replace(/\n/g," ")+"</text>\r\n";
	}
	var cardScripts = triceTranslator(bob.lackeyScript(card), entry);
	if(cardScripts != "")
		cardsFile += " "+cardScripts+"\r\n";
	cardsFile += "</card>\r\n";
	if(card.shape == "doubleface") {
		let setCheck = allsets(card, true);
		if(setCheck === false)
			return;
		cardsFile += "<card>\r\n";
		cardsFile += " <name>"+card.cardName2+"</name>\r\n";
		cardsFile += setCheck;
		cardColors = bob.lackeyColorCondenser(card.color2);
		for(let i=0;i<cardColors.length;i++) {
			cardsFile += " <color>"+cardColors.charAt(i)+"</color>\r\n";
		}
		cardsFile += " <manacost>"+card.manaCost2.replace(/[{}]/g,"")+"</manacost>\r\n";
		cardsFile += " <cmc>"+card.cmc+"</cmc>\r\n";
		if(card.loyalty2)
			cardsFile += " <loyalty>"+card.loyalty2+"</loyalty>\r\n";
		if(card.power2) {
			cardsFile += " <pt>" + card.power2 + "/" + card.toughness2+"</pt>\r\n";
		}
		cardsFile += " <type>"+card.typeLine2.replace(/ $/,"")+"</type>\r\n";
		cardsFile += " <tablerow>";
		if(card.cardType2.match(/(Instant|Sorcery)/)) {
			cardsFile += "3";
		}else if(card.cardType2.match(/Land/)) {
			cardsFile += "0";
		}else if(card.cardType2.match(/Creature/)) {
			cardsFile += "2";
		}else{
			cardsFile += "1";
		}
		cardsFile += "</tablerow>\r\n";
		cardsFile += " <text>"+card.rulesText2.replace(/\n/g," ")+"</text>\r\n";
		var cardScripts = triceTranslator(bob.lackeyScript(card), entry);
		if(cardScripts != "")
			cardsFile += " "+cardScripts+"\r\n";
		cardsFile += "</card>\r\n";
	}
}
function triceTokenBlocker(entry) {

	let card = cards[entry];
	if(card.rulesText.match("make and shuffle")) //skip make tokens on trice //todo make this less bad
		return "";
	let thisToken = tokenName(card);
	tokensFile += "<card>\r\n";
	tokensFile += " <name>"+thisToken+"</name>\r\n";
	tokensFile += tokenSetBlock(card);
	let cardColors = bob.lackeyColorCondenser(card.color);
	for(let i=0;i<cardColors.length;i++) {
		tokensFile += " <color>"+cardColors.charAt(i)+"</color>\r\n";
	}
	tokensFile += " <manacost>"+card.manaCost.replace(/[{}]/g,"")+"</manacost>\r\n";
	tokensFile += " <cmc>"+card.cmc+"</cmc>\r\n";
	if(card.loyalty)
		tokensFile += " <loyalty>"+card.loyalty+"</loyalty>\r\n";
	if(card.power !== "") {
		tokensFile += " <pt>" + card.power + "/" + card.toughness+"</pt>\r\n";
	}
	tokensFile += " <type>"+card.typeLine.replace(/ $/,"")+"</type>\r\n";
	tokensFile += " <tablerow>";
	if(card.cardType.match(/(Instant|Sorcery)/)) {
		tokensFile += "3";
	}else if(card.cardType.match(/Land/)) {
		tokensFile += "0";
	}else if(card.cardType.match(/Creature/)) {
		tokensFile += "2";
	}else{
		tokensFile += "1";
	}
	tokensFile += "</tablerow>\r\n";
	tokensFile += " <text>"+card.rulesText.replace(/\n/g," ")+"</text>\r\n";
	tokensFile += " <token>1</token>\r\n";
	tokensFile += " <set num=\"" + card.cardID + "\" rarity=\"" + card.rarity + "\">" + card.setID + "</set>\r\n"
	var cardScripts = triceTranslator(bob.lackeyScript(card), entry);
	if(cardScripts != "")
		tokensFile += " "+cardScripts+"\r\n";
	let reverseTokens = reverseWriter(tokensRelated[thisToken]);
	if(reverseTokens)
		tokensFile += reverseTokens+"\r\n";
	tokensFile += "</card>\r\n";
}
function reverseWriter (token) { //given tokensRelated[tokenName]
	let output = "";
	//console.log(token);
	for(let ref in token) {
		let xFlag = 1;
		for(let amount in token[ref]) {
			if(token[ref][amount] == "1" && token[ref].includes("5") || token[ref][amount] == "3" && token[ref].includes("9")) {
				output += reverseLineWriter(ref, token[ref][amount]);
				output += reverseLineWriter(ref, "x");
				xFlag = 0;
			}else if(xFlag){
				output += reverseLineWriter(ref, token[ref][amount]);
			}
		}
	}
	output = output.replace(/\r\n$/,"");
	return output;
}
function reverseLineWriter (cardName, amount) {
	let output = "";
	output += " <reverse-related" //the beginning of each string
	if(amount != "1")
		output += " count=\""+amount+"\""; //the number of tokens to generate
	output += ">" //the middle of each string
	output += cardName; // the card to reverse-relate
	output += "</reverse-related>\r\n" //the end of each string;
	return output;
}

let tokenXML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<cockatrice_carddatabase version=\"3\">\r\n<cards>\r\n";
for(let set in setsArray) {
	cardsFile += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<cockatrice_carddatabase version=\"3\">\r\n<sets>\r\n";
	tokensFile += "<!-->Tokens</-->\r\n";
	cardsFile += "<set>\r\n";
	cardsFile += "<name>"+set+"</name>\r\n";
	cardsFile += "<longname>"+setsArray[set].longname+"</longname>\r\n";
	cardsFile += "<settype>MSEM</settype>\r\n";
	cardsFile += "</set>\r\n";
	cardsFile += "</sets>\r\n<cards>\r\n";
	for(let card in cards) {
		if(cards[card].setID == set) {
			triceBlockWriter(card);
		}else if (cards[card].setID == "tokens" && bob.pullTokenSet(cards[card], setsArray) == set){
			triceTokenBlocker(card);
		}
	}
	/*let fullFile = cardsFile + tokensFile + "</cards>\r\</cockatrice_carddatabase>";
	fullFile = fullFile.replace(/’/g, "'");
	fs.writeFile('./triceFiles/sets/'+set+'.xml',fullFile, (err) => {
		if(err) throw err
	});*/
	tokenXML += tokensFile;
	
	cardsFile = "";
	tokensFile = "";
}
tokenXML += "</cards>\r\n</cockatrice_carddatabase>";
fs.writeFile('./triceFiles/tokens.xml',tokenXML.replace(/’/g, "'"), (err) => {
	if (err) throw err;
});
//console.log(tokensRelated);