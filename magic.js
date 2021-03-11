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
function unsymbolize(card) { //converts emotes and symbols to letters
	//convert emotes
	//emotes are formatted <:M_:1234> or <:manam:1234>
	card = card.replace(/<:(?:mana)?([0-9CWUBRGSETQA]+)_?:\d+>/gi, function(v) {
		v = v.replace(/^<:(mana)?/, "");
		v = v.replace(/_?:\d+>$/, "");
		return "{" + v.toUpperCase() + "}"
	});
	
	card = card.replace(/} {/g, "}{"); //remove spaces between emotes
	card = card.replace(/\{([0-9CWUBRGS])([0-9CWUBRGS])}/g, "{$1/$2}") //add hybrid slashes to emotes
	card = card.replace(/[{}]/g, ""); //remove {s
	card = card.replace(/[([]([0-9WUBRGPHCSEAQ]\/?[WUBRGPHCSEAQ]?)[)\]]/g, "$1"); //remove () and [] but only around mana symbols
	return card;
}
function italPseudo(someText) { //italicizes pseudo abilities but not modals, anchors, Saga chapters, or harmony
	return someText.replace(/^([^•\n—\*]+) —/gm, function(v) {
		if(v.match(/(Choose|^Harmony|^First mate|^Discovery|^Forecast|^Companion|^Boast)/i) || v.match(/^[IV ,]+ —$/))
			return v;
		return "*" + v.replace(" —", "* —");
	});
}
function writeCard(cardName,database,setDatabase,shortFlag, extra, version) { //turns card data into card string
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
	if(thisCard.hasOwnProperty('faces')) {
		for(let face in thisCard.faces) {
			let thisFace = thisCard.faces[face];
			showCard += "**" + thisFace.cardName + "**    " + thisFace.manaCost + "\n";
			if(thisCard.hasOwnProperty('notes') && thisCard.notes.includes("italic"))
				showCard = showCard.replace(/\*\*/g,"***")
			let identMatch = thisFace.manaCost.match(/(W|U|B|R|G)/);
			if(identMatch == null && thisFace.color != "" && thisFace.color != "{} ")
				showCard += thisFace.color;
			if(!version)
				version = thisCard.prints[0];
			let rarityLine = writeRarityLine(version, thisCard.versions[version].rarity, database)[0];
			showCard += thisFace.typeLine + "     " + rarityLine + extra + "\n";
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
function writeRarityLine(set, rarity, database){
	if(database.name == "msem") {
		if(set == "MPS_MSE")
			return ["*MSEM Champion*", "MSP_MSE MSP"];
		if(set == "MPS_HI12")
			return ["*Daisite Outlaw*", "MSP_HI12 MSP"];
		if(set == "MPS_MIS")
			return ["*Mious Divinities*", "MSP_MIS MSP"];
		if(set == "MPS_OPO")
			return ["*Ophorio Sagas*", "MSP_OPO MSP"];
		if(set == "MPS_OPO")
			return ["*Ophorio Sagas*", "MSP_OPO MSP"];
	}else if(database.name == "magic") {
		if(set == "ZNE")
			return ["*Zendikar Rising Expeditions*", "ZNE M"];
		if(set == "EXP")
			return ["*Zendikar Expeditions*", "EXP MSP"];
		if(set == "MPS")
			return ["*Kaladesh Invention*", "MPS MSP"];
		if(set == "MP2")
			return ["*Amonkhet Invocation*", "MP2 MSP"];
	}
	let rareArray = ["basic land", "common", "uncommon", "rare", "mythic rare", "mythic", "bonus", "special", "masterpiece"];
	let RArray = ["L", "C", "U", "R", "M", "M", "Bonus", "S", "Masterpiece"];
	let RArray2 = ["L", "C", "U", "R", "M", "M", "B", "S", "MSP"];
	let line = "*" + set + " ";
	let index = rareArray.indexOf(rarity);
	if(index == -1)
		return [line + rarity.charAt(0).toUpperCase() + "*", line + rarity.charAt(0).toUpperCase() + "*"];
	return [line + RArray[index] + "*", line + RArray2[index] + "*"];
}
function findReprints(thisCard, database) { //finds other versions
	let printArray = [];
	let reprintString = "*(";
	let count = 0;
	for(let thisCode in thisCard.prints){
		if(thisCard.prints[thisCode] == "LAIR") {
			reprintString += "LAIR S, "
			count++;
			continue;
		}
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

function writeManaCost (symArray) {		//turns array into ordered array in mana symbol order
	if(!Array.isArray(symArray)) { //if we got a string, arraify it
		symArray = symArray.match(/[w|u|b|r|g|p|h|2]\/[w|u|b|r|g]|[w|u|b|r|g|c|s|x|y]|[0-9]{1,2}/ig)
	}
	let colorArray = [];
	for(let symbol in symArray) {//first fix hybrids and capitalization and make colorArray
		symArray[symbol] = symArray[symbol].toUpperCase()
		let hybridArray = symArray[symbol].match(/([WUBRG])\/([WUBRG])/);
		if(hybridArray) { //fix hybrids
			let sorted = arrangeColors([hybridArray[1],hybridArray[2]]);
			symArray[symbol] = sorted[0] + "/" + sorted[1];
		}else{ //get colors
			let colorMatch = symArray[symbol].match(/^[WUBRG]$/)
			if(colorMatch && !colorArray.includes(symArray[symbol]))
				colorArray.push(symArray[symbol])
		}
	}
	let sortedColors = arrangeColors(colorArray); //get color order
	symArray.sort(function(a,b) { //sort symbols
		let result = (b == "X") - (a == "X");
		if(result == 0)
			result = (b == "Y") - (a == "Y");
		if(result == 0)
			result = Boolean(b.match(/^[0-9]+$/)) - Boolean(a.match(/^[0-9]+$/));
		if(result == 0)
			result = Boolean(a.match(/^[WUBRG]$/)) - Boolean(b.match(/^[WUBRG]$/));
		if(result == 0)
			result = sortedColors.indexOf(a) - sortedColors.indexOf(b);
		return result;
	});
	return symArray;
}
function arrangeColors (colorArray) {		//converts array of colors to array in mana order
	let testArray= [];
	let refArray = ["W", "U", "B", "R", "G"];
	let assembly = "";
	while(testArray.length < colorArray.length) {
		for(var i = 0; i < refArray.length; i++) {
			if(colorArray.includes(refArray[i])) {
				assembly += "1";
				testArray.push(refArray[i]);
			}else if(testArray.length != 0){
				assembly += "0";
			}
			//break after two skips, two push+skip, or skip+two push
			if(assembly.match(/(00|110|011)/)) {
				refArray.push(refArray.splice(0,1)[0]) //shift
				testArray = [];
				i=-1; //and restart
				assembly = "";
			}
		}
	}
	return testArray;
}
exports.symbolize = symbolize;
exports.unsymbolize = unsymbolize;
exports.italPseudo = italPseudo;
exports.writeCard = writeCard;
exports.writeCardError = writeCardError;
exports.findReprints = findReprints;

exports.writeManaCost = writeManaCost;
exports.arrangeColors = arrangeColors;