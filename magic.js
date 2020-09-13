/* Magic Module (aka mod_magic)
 Contains global Magic scripts
*/
var writeCardError = "LackeyBot couldn't find anything! Either your filters are too strict or you've found a rare ordering of letters that don't appear in a card name yet.\n";
function symbolize(card) { //converts symbols to emotes
	var symArray = ["W","U","B","R","G","0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","20","X","T","Q","S","E","C","2/W","2/U","2/B","2/R","2/G","W/U","U/B","B/R","R/G","G/W","W/B","U/R","B/G","R/W","G/U","W/P","U/P","B/P","R/P","G/P","A","2W","2U","2B","2R","2G","WU","UB","BR","RG","GW","WB","UR","BG","RW","GU","HW","HU","HB","HR","HG","UT"];
	var emoArray = ["<:W:233094502640910336>","<:U:233094523012644864>","<:B:233094539970084864>","<:R:233094555346403328>","<:G:233094570705944576>","<:0:233087928111333376>","<:1:233087941465997312>","<:2:233087976723185665>","<:3:233087977377628160>","<:4:233087977855778826>","<:5:233087978300243968>","<:6:233087978342187008>","<:7:233087978350706688>","<:8:233087978409426944>","<:9:233087978413621251>","<:10:233087978417815552>","<:11:233095414390194176>","<:12:233095464222851074>","<:13:233095464428240896>","<:14:585567535794225167>","<:15:233095536889036803>","<:mana16:372421580942213120>","<:mana20:372421581101858824>","<:X:233088003591897098>","<:T:233088054674456577>","<:Q:341473311869501440>","<:S:592564384824295426>","<:E:233094452661583872>","<:C_:233094585830735872>","<:2W:624281333824356379>","<:2U:624281333350268929>","<:2B:624281333740339210>","<:2R:624281334948298752>","<:2G:624281333769961514>","<:WU:233082066831409162>","<:UB:233082236444868618>","<:BR:233082275330392064>","<:RG:233082296717017099>","<:GW:233082340417601537>","<:WB:233095081316319244>","<:UR:233095125914484737>","<:BG:233095174572605440>","<:RW:233095204649828352>","<:GU:233095244332138497>","<:PW:233095689058517002>","<:PU:233095720033452033>","<:PB:233095745371111424>","<:PR:233095765919006720>","<:PG:233095788140560385>","<:acorn:702603027621740615>","<:2W:624281333824356379>","<:2U:624281333350268929>","<:2B:624281333740339210>","<:2R:624281334948298752>","<:2G:624281333769961514>","<:WU:233082066831409162>","<:UB:233082236444868618>","<:BR:233082275330392064>","<:RG:233082296717017099>","<:GW:233082340417601537>","<:WB:233095081316319244>","<:UR:233095125914484737>","<:BG:233095174572605440>","<:RW:233095204649828352>","<:GU:233095244332138497>","<:PW:233095689058517002>","<:PU:233095720033452033>","<:PB:233095745371111424>","<:PR:233095765919006720>","<:PG:233095788140560385>","<:Q:341473311869501440>"];
	for(let sym in symArray) {
		let symRegex = new RegExp('\\{' + symArray[sym] + '}','g');
		card = card.replace(symRegex, emoArray[sym]);
	}
	return card;
}
function italPseudo(someText) { //italicizes pseudo abilities but not modals, anchors, Saga chapters, or harmony
	let pseudoMatch = someText.match(/([^\n—\*]+) —/);
	if(pseudoMatch == null || pseudoMatch[1].match(/(Choose|Harmony|Forecast|Companion)/i) || pseudoMatch[1] == "I" || pseudoMatch[1].match(/I,/))
		return someText;
	return someText.replace(pseudoMatch[1], "*"+pseudoMatch[1]+"*")
}
function writeCard(cardName,database,setDatabase,shortFlag, extra) { //turns card data into card string
	let showCard = "";
	let thisCard = cardName; //can be name or card object
	if(typeof thisCard == 'string') //if is name, finds it in the database
		if(database.hasOwnProperty(cardName)) {
			thisCard = database[cardName];
		}else{
			return writeCardError;
		}
	try{
		thisCard.shape;
	}catch(e){
		console.log(e)
		console.log('Failed to read:')
		console.log(thisCard)
	}
	if(thisCard.shape == "command") {
		return thisCard.rulesText;
	}
	if(thisCard.hasOwnProperty('manyFaces')) {
		for(let face in thisCard.manyFaces) {
			let thisFace = thisCard.manyFaces[face];
			showCard += "**" + thisFace.cardName + "**    " + thisFace.manaCost + "\n";
			if(thisCard.hasOwnProperty('notes') && thisCard.notes.includes("italic"))
				showCard = showCard.replace(/\*\*/g,"***")
			let identMatch = thisCard.manaCost.match(/(W|U|B|R|G)/);
			if(identMatch == null && thisFace.color != "" && thisFace.color != "{} ")
				showCard += thisFace.color;
			showCard += thisFace.typeLine + "     " + thisFace.rarityLine + extra + "\n";
			showCard += italPseudo(thisFace.rulesText) + thisFace.flavorText.replace(/\*\*\n$/,"\n");
			let cardPT = ""
			if(thisFace.power !== "" || thisFace.toughness !== "") {
				cardPT += thisCard.power;
				if(thisFace.power !== "" && thisFace.toughness !== "")
					cardPT += "/";
				cardPT += thisFace.toughness;
				cardPT = cardPT.replace(/[*]/g, "★");
			}
			if(thisFace.loyalty !== "" && thisFace.cardType.match("Planeswalker"))
				cardPT = "[" + thisFace.loyalty + "]";
			if(cardPT !== "")
				showCard += "**" + cardPT + "**\n";
			showCard += "---\n";
		}
		showCard = showCard.replace(/---\n$/, "");
		showCard = symbolize(showCard);
		if(thisCard.hasOwnProperty('prints') && thisCard.prints.length > 0)
			showCard += findReprints(thisCard, database)
		return showCard;
	}
	showCard += "**" + thisCard.cardName + "**    " + thisCard.manaCost + "\n";
	if(thisCard.hasOwnProperty('notes') && thisCard.notes.includes("italic"))
		showCard = showCard.replace(/\*\*/g,"***")
	let identMatch = thisCard.manaCost.match(/(W|U|B|R|G)/);
	if(identMatch == null && thisCard.color != "" && thisCard.color != "{} ")
		showCard += thisCard.color;
	showCard += thisCard.typeLine + "     " + thisCard.rarityLine + extra + "\n";
	showCard += italPseudo(thisCard.rulesText) + thisCard.flavorText.replace(/\*\*\n$/,"\n");
	let cardPT = ""
	if(thisCard.power !== "" || thisCard.toughness !== "") {
		cardPT += thisCard.power;
		if(thisCard.power !== "" && thisCard.toughness !== "")
			cardPT += "/";
		cardPT += thisCard.toughness;
		cardPT = cardPT.replace(/[*]/g, "★");
	}
	if(thisCard.loyalty !== "" && thisCard.cardType.match("Planeswalker"))
		cardPT = "[" + thisCard.loyalty + "]";
	if(cardPT !== "")
		showCard += "**" + cardPT + "**\n";
	if(shortFlag) {
		showCard = symbolize(showCard);
		return showCard;
	}
	if(thisCard.shape == "split" || thisCard.shape == "adventure" || thisCard.shape == "aftermath" || thisCard.shape == "doubleface") {
		showCard += "---\n";
		showCard += "**" + thisCard.cardName2 + "**    " + thisCard.manaCost2 + "\n";
	identMatch = null;
	if(thisCard.manaCost2 != undefined)
		identMatch = thisCard.manaCost2.match(/(W|U|B|R|G)/);
	if(identMatch == null && thisCard.color2 != "" && thisCard.color2 != undefined)
		showCard += thisCard.color2;
	showCard += thisCard.typeLine2 + "     " + thisCard.rarityLine2 + "\n";
	showCard += thisCard.rulesText2 + thisCard.flavorText2.replace(/\*\*\n$/,"\n");
	cardPT = ""
	if(thisCard.power2 !== "" || thisCard.toughness2 !== "") {
		cardPT += thisCard.power2;
		if(thisCard.power2 !== "" && thisCard.toughness2 !== "")
			cardPT += "/";
		cardPT += thisCard.toughness2;
	}
	if(thisCard.loyalty2 !== "" && thisCard.cardType2 !== undefined && thisCard.cardType2.match("Planeswalker"))
		cardPT = "[" + thisCard.loyalty2 + "]";
	if(cardPT !== "")
		showCard += "**" + cardPT + "**\n";
	}
	let tempID = thisCard.setID;
	if(thisCard.rarity == "special")
		tempID = "PRO_" + tempID;
	showCard = symbolize(showCard);
	if(thisCard.hasOwnProperty('prints') && thisCard.prints.length > 0)
		showCard += findReprints(thisCard, database)
	return showCard;
}
function findReprints(thisCard, database) { //finds other versions
	let printArray = [];
	let reprintString = "*(";
	let count = 0;
	for(let thisCode in thisCard.prints){
		let tempName = thisCard.fullName + "_" + thisCard.prints[thisCode];
		if(database.hasOwnProperty(tempName)) {
			reprintString += database[tempName].rarityLine.replace(/\*/g, "") + ", ";
			count++;
		}
		tempName = thisCard.fullName + "_PRO_" + thisCard.prints[thisCode];
		if(database.hasOwnProperty(tempName)) {
			reprintString += database[tempName].rarityLine.replace(/\*/g, "") + ", ";
			count++;
		}
	}
	if(count < 2)
		return "";
	reprintString += ")*\n";
	reprintString = reprintString.replace(", )", ")");
	reprintString = reprintString.replace(/Promo/g, "S");
	reprintString = reprintString.replace(/Bonus/g, "B");
	reprintString = reprintString.replace("Land Bundle", "L");
	reprintString = reprintString.replace("Mana Pool", "L2");
	return reprintString;
}

exports.symbolize = symbolize;
exports.italPseudo = italPseudo;
exports.writeCard = writeCard;
exports.writeCardError = writeCardError;
exports.findReprints = findReprints;