/* Magic Module (aka mod_magic)
 Contains global Magic scripts
*/
var fs = require ('fs');
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
	showCard += "**" + thisCard.cardName.replace(/'/g, "’") + "**    " + thisCard.manaCost + "\n";
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
	if(!thisCard.notes.includes("secretface") && (thisCard.shape == "split" || thisCard.shape == "adventure" || thisCard.shape == "aftermath" || thisCard.shape == "doubleface")) {
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
function arrangeColors (colorArray) {	//converts array of colors to array in mana order
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

//mtgjson/instigator
function mtgjsonSetsBuilder(user, library) {				//build jsons for instigator or trice
	let ASA = {};//require('./triceFiles/AllCanonSets.json');
	for(let set in library.setData) {
		ASA[set] = mtgjsonBuilder(set,user,library)
	}
	let v5ASA = {meta:{}, data:ASA};
	let words = JSON.stringify(v5ASA).replace(/’/g, "'");
	fs.writeFile('triceFiles/AllSets.json', words, (err) => {
		if (err) throw err;
		console.log('AllSets.json written');
	});
}
function mtgjsonBuilder (thisSet, user, library) {			//builds an mtgjson file for the given set
	let cardsArray = [];
	let leng = 0;
	//create an array of sets and an object of sets with name arrays
	//goal is object of unkeyed objects, ie {{stuff},{stuff},{stuff}}
	let database = library.cards
	for(let thisCard in database) {
		if(database[thisCard].setID != "BOT") {
			if(library.name == "msem" && library.legal.masterpiece.includes(database[thisCard].fullName)) {
				//skip illegal masterpieces
			}else if(database[thisCard].setID == thisSet && checkPromo(thisCard, database[thisCard])){ //if its trice, skip promos
				cardsArray.push(thisCard);
				leng++;
			}
		}
	}
	//create the set object for each set
	//pass along the array of names to create the cards array
	let thisEntry = {};
	thisEntry.name = library.setData[thisSet].longname;
	thisEntry.code = thisSet;
	thisEntry.gathererCode = thisSet;
	thisEntry.magicCardsInfoCode = thisSet;
	thisEntry.releaseDate = library.setData[thisSet].releaseDate;
	thisEntry.border = "black";
	thisEntry.type = "expert";
	thisEntry.booster = [];
	thisEntry.mkm_name = library.setData[thisSet].longname;
	thisEntry.mkm_id = library.setData[thisSet].releaseNo;
	thisEntry.cards = mtgjsonCardsBuilder(cardsArray, library);
	return thisEntry;
}
function mtgjsonCardsBuilder(nameArray, library) {			//creates the cards array for a set's mtgjson file
	let leng = nameArray.length;
	let thisCardArray = [];
	nameArray.sort();
	for(let thisName in nameArray){
		let thisCard = library.cards[nameArray[thisName]];
		let thisEntry = {};
		let reprint = library.name == "msem" && thisCard.notes.includes("reprint") && thisCard.setID != "SHRINE" && thisCard.setID != "LAIR";
		let cardNames = [thisCard.cardName, ""];
		if(thisCard.hasOwnProperty("cardName2"))
			cardNames[1] = thisCard.cardName2;
		if(thisCard.hasOwnProperty("hidden")) {
			cardNames = thisCard.hidden.split("//")
			cardNames.push("");
		}

		//TODO redo this
		thisEntry.artist = thisCard.artist.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
		thisEntry.convertedManaCost = thisCard.cmc;
		thisEntry.cmc = thisCard.cmc;
		thisEntry.colors = arrayifyColors(thisCard.color);
		for(let color in thisEntry.colors)
			thisEntry.colors[color] = flipColors(thisEntry.colors[color]);
		thisEntry.color_identity = thisEntry.colors;
		thisEntry.colorIdentity = thisEntry.colors;
		thisEntry.designer = "";
		if(thisCard.designer != "") {
			thisEntry.designer = thisCard.designer;
		}else{
			//console.log(thisCard);
		}
		if(thisCard.flavorText != "")
			thisEntry.flavor = thisCard.flavorText.replace(/[*]/g, "");
		thisEntry.id = nameArray[thisName];
		thisEntry.imageName = cardNames[0].toLowerCase().replace(/’/g,"'");
		thisEntry.layout = thisCard.shape.replace("doubleface", "double-faced").replace("adventure", "normal");
		if(thisCard.shape == "doubleface")
			thisEntry.layout = "transform";
		thisEntry.legalities = arrayifyLegal(cardNames[0].replace(/’/g,"'"), library);
		if(thisCard.loyalty !== "")
			thisEntry.loyalty = thisCard.loyalty;
		thisEntry.manaCost = thisCard.manaCost;
		if(thisCard.shape == "doubleface") {
			thisEntry.mciNumber = thisCard.cardID + "a";
		}else{
			thisEntry.mciNumber = thisCard.cardID;
		}
		if(thisCard.hasOwnProperty('instigatorID')){
			thisEntry.multiverseid = thisCard.instigatorID;
		}else if(thisCard.hasOwnProperty('multiverseid')){
			thisEntry.multiverseid = thisCard.multiverseid;
		}
		thisEntry.name = cardNames[0].replace(/’/g,"'");
		if(thisCard.shape == "split")
			thisEntry.name = thisCard.fullName.replace(/’/g,"'").replace("//", " // ");
		(thisCard.shape == "doubleface")
			thisEntry.name = cardNames[0].replace(/’/g,"'")
		if(reprint) {
			thisEntry.name += "_" + thisCard.setID;
		}
		let two_names = [];
		two_names.push(thisEntry.name)
		if(thisCard.shape == "doubleface" || thisCard.shape == "split") {
			thisEntry.names = [thisEntry.name, thisEntry.name.replace(cardNames[0].replace("’","'"), cardNames[1].replace("’","'"))];
			if(thisCard.shape == "doubleface")
				thisEntry.name = cardNames[0] + (reprint ? "_" + thisCard.setID:"") + " // " + cardNames[1] + (reprint ? "_" + thisCard.setID:"")
			thisEntry.id = cardNames[0] + "_" + thisCard.setID;
			thisEntry.uuid = cardNames[0] + "_" + thisCard.setID;
			thisEntry.otherFaceIds = [cardNames[1] + "_" + thisCard.setID];
			thisEntry.side = "a";
			thisEntry.faceName = cardNames[0] + (reprint ? "_" + thisCard.setID:"");
		}
		if(thisCard.shape == "doubleface") { //|| thisCard.shape == "split") { //instigatorchange
			thisEntry.number = thisCard.cardID + "a";
			if(library.name == "msem" && thisCard.setID == "FLP")
				thisEntry.number = thisCard.cardID + "sa";
		}else{
			thisEntry.number = thisCard.cardID;
		}
		thisEntry.number = thisEntry.number.replace(/s/g, "");
		if(thisCard.power !== "")
			thisEntry.power = thisCard.power.toString();
		thisEntry.rarity = thisCard.rarity.replace(/(masterpiece|bonus)/, "special");
		if(thisEntry.rarity == "special")
			thisEntry.rarity = "s";
		if(thisCard.setID == "MPS_MSE")
			thisEntry.rarity = "special";
		if(thisCard.typeLine.match("—"))
			thisEntry.subtypes = arrayifyTypes(thisCard.typeLine.replace(/[A-Z ]+—/i, ""));
		let supertypes = thisCard.typeLine.split(" — ")[0];
		supertypes = supertypes.replace(thisCard.cardType, "");
		if(supertypes != "")
			thisEntry.supertypes = arrayifyTypes(supertypes);
		if(thisCard.rulesText != "\n")
			thisEntry.text = thisCard.rulesText.replace(/[*]/g, "");
		if(thisCard.toughness !== "")
			thisEntry.toughness = thisCard.toughness.toString();
		thisEntry.type = thisCard.typeLine.replace(/ $/, "");
		thisEntry.types = arrayifyTypes(thisCard.cardType);
		thisCardArray.push(thisEntry);
		
		if(thisCard.shape == "doubleface" || thisCard.shape == "split") {
			let thisEntry = {};
			if(thisCard.artist2 != undefined) {
				thisEntry.artist = thisCard.artist2.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
			}else{
				thisEntry.artist = thisCard.artist.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
			}
			if(thisCard.shape == "doubleface") {
				thisEntry.convertedManaCost = thisCard.cmc;
			}else{
				thisEntry.convertedManaCost = thisCard.cmc2;
			}
			thisEntry.colors = arrayifyColors(thisCard.color2);
			for(let color in thisEntry.colors)
				thisEntry.colors[color] = flipColors(thisEntry.colors[color]);
			thisEntry.color_identity = thisEntry.colors;
			thisEntry.colorIdentity = thisEntry.colors;
			thisEntry.designer = "";
			if(thisCard.designer != undefined)
				thisEntry.designer = thisCard.designer;
			if(thisCard.flavorText2 != "")
				thisEntry.flavor = thisCard.flavorText2.replace(/[*]/g, "");
			thisEntry.id = cardNames[0] + "_" + thisCard.setID + "b";
			thisEntry.imageName = cardNames[1].toLowerCase().replace(/’/g,"'");
			thisEntry.layout = thisCard.shape.replace("doubleface", "double-faced");
			thisEntry.legalities = arrayifyLegal(thisCard.cardName.replace(/’/g,"'"), library);
			if(thisCard.loyalty !== "")
				thisEntry.loyalty = thisCard.loyalty2;
			thisEntry.manaCost = thisCard.manaCost2;
			thisEntry.mciNumber = thisCard.cardID + "b";
			if(thisCard.shape == "split") //instigatorchange
				thisEntry.mciNumber = thisCard.cardID;
			if(thisCard.hasOwnProperty('instigatorID')){
				thisEntry.multiverseid = thisCard.instigatorID;
			}else if(thisCard.hasOwnProperty('multiverseid')){
				thisEntry.multiverseid = thisCard.multiverseid;
			}
			
			thisEntry.name = cardNames[1].replace(/’/g,"'");
			if(thisCard.shape == "split")
				thisEntry.name = thisCard.fullName.replace(/’/g,"'").replace("//", " // ");
			if(thisCard.shape == "doubleface") {
				thisEntry.name = cardNames[1].replace(/’/g,"'");
				thisEntry.layout = "transform";
			}
			if(reprint) {
				thisEntry.name += "_" + thisCard.setID;
			}
			thisEntry.side = "b";
			if(thisCard.shape == "doubleface") {//cockatrice
				if(thisCard.shape == "doubleface")
					thisEntry.name = cardNames[0] + (reprint ? "_" + thisCard.setID:"") + " // " + cardNames[0] + (reprint ? "_" + thisCard.setID:"")
			}
			two_names.push(thisEntry.name)
			thisEntry.names = two_names;
			thisEntry.number = thisCard.cardID + "b";
			if(library.name == "msem" && thisCard.setID == "FLP")
				thisEntry.number = thisCard.cardID + "sb";
			if(thisCard.shape == "split") //instigatorchange
				thisEntry.number = thisCard.cardID;
			thisEntry.number = thisEntry.number.replace(/s/g, "");
			thisEntry.id = cardNames[1] + "_" + thisCard.setID;
			thisEntry.uuid = cardNames[1] + "_" + thisCard.setID;
			thisEntry.otherFaceIds = [cardNames[0] + "_" + thisCard.setID];
			thisEntry.faceName = cardNames[1] + (reprint ? "_" + thisCard.setID : "");
			if(thisCard.power2 !== "")
				thisEntry.power = thisCard.power2.toString();
			
			thisEntry.rarity = thisCard.rarity.replace(/(masterpiece|bonus)/, "special");
			if(thisEntry.rarity == "special")
				thisEntry.rarity = "s"
			if(thisCard.setID == "MPS_MSE")
				thisEntry.rarity = "special";
			if(thisCard.typeLine2.match("—"))
				thisEntry.subtypes = arrayifyTypes(thisCard.typeLine2.replace(/[A-Z ]+—/i, ""));
			supertypes = thisCard.typeLine2.split(" — ")[0];
			supertypes = supertypes.replace(thisCard.cardType2, "");
			if(supertypes != "")
				thisEntry.supertypes = arrayifyTypes(supertypes);
			if(thisCard.rulesText2 != "\n")
				thisEntry.text = thisCard.rulesText2.replace(/[*]/g, "");;
			if(thisCard.toughness2 !== "")
				thisEntry.toughness = thisCard.toughness2.toString();
			thisEntry.type = thisCard.typeLine2.replace(/ $/, "");
			thisEntry.types = arrayifyTypes(thisCard.cardType2);

			thisCardArray.push(thisEntry);
		}
	}
	return thisCardArray;
}
function wtfjsonBuilder (thisSet, user, library) {			//builds an mtg.wtf file for the given set
	let cardsArray = [];
	let leng = 0;
	//create an array of sets and an object of sets with name arrays
	//goal is object of unkeyed objects, ie {{stuff},{stuff},{stuff}}
	let database = library.cards
	for(let thisCard in database) {
		if(library.name == "msem" && library.legal.masterpiece.includes(database[thisCard].fullName)) {
			//skip illegal masterpieces
		}else if(database[thisCard].setID == thisSet) {
			cardsArray.push(thisCard);
			leng++;
		}
	}
	//create the set object for each set
	//pass along the array of names to create the cards array
	let thisEntry = {};
	thisEntry.name = library.setData[thisSet].longname;
	thisEntry.code = thisSet;
	thisEntry.gathererCode = thisSet;
	thisEntry.magicCardsInfoCode = thisSet;
	thisEntry.releaseDate = library.setData[thisSet].releaseDate;
	thisEntry.border = "black";
	thisEntry.type = "expert";
	thisEntry.booster = [];
	thisEntry.mkm_name = library.setData[thisSet].longname;
	thisEntry.mkm_id = library.setData[thisSet].releaseNo;
	thisEntry.cards = wtfjsonCardsBuilder(cardsArray, library);

	let words = JSON.stringify(thisEntry).replace(/’/g, "'");
	fs.writeFile('jsons/'+thisSet + '.json', words, (err) => {
		if (err) throw err;
		console.log(thisSet + '.json written');
		});
	user.send(thisSet + " jsonified:", {
		files: [{attachment:'jsons/' + thisSet + '.json'}]
	});

}
function wtfjsonCardsBuilder(nameArray, library) {			//creates the cards array for a set's mtg.wtf json file
	let leng = nameArray.length;
	let thisCardArray = [];
	nameArray.sort();
	for(let thisName in nameArray){
		let thisCard = library.cards[nameArray[thisName]];
		let thisEntry = {};
		let reprint = library.name == "msem" && thisCard.notes.includes("reprint") && thisCard.setID != "SHRINE" && thisCard.setID != "LAIR";
		let cardNames = [thisCard.cardName, ""];
		if(thisCard.notes.includes("secretface"))
			thisCard.shape = "normal"
		if(thisCard.hasOwnProperty("cardName2"))
			cardNames[1] = thisCard.cardName2;
		/*if(thisCard.hasOwnProperty("hidden")) {
			cardNames = thisCard.hidden.split("//")
			cardNames.push("");
		}*/

		//TODO redo this
		thisEntry.artist = thisCard.artist.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
		thisEntry.convertedManaCost = thisCard.cmc;
		thisEntry.cmc = thisCard.cmc;
		thisEntry.colors = arrayifyColors(thisCard.color);
		thisEntry.color_identity = thisEntry.colors;
		thisEntry.colorIdentity = thisEntry.colors;
		thisEntry.designer = "";
		if(thisCard.designer != "") {
			thisEntry.designer = thisCard.designer;
		}else{
			//console.log(thisCard);
		}
		if(thisCard.flavorText != "")
			thisEntry.flavor = thisCard.flavorText.replace(/[*]/g, "");
		thisEntry.id = nameArray[thisName];
		thisEntry.imageName = cardNames[0].toLowerCase().replace(/’/g,"'");
		thisEntry.layout = thisCard.shape.replace("doubleface", "double-faced").replace("adventure", "normal");
		thisEntry.legalities = arrayifyLegal(cardNames[0].replace(/’/g,"'"), library);
		if(thisCard.loyalty !== "")
			thisEntry.loyalty = thisCard.loyalty;
		thisEntry.manaCost = thisCard.manaCost;
		if(thisCard.shape == "doubleface") {
			thisEntry.mciNumber = thisCard.cardID + "a";
		}else{
			thisEntry.mciNumber = thisCard.cardID;
		}
		if(thisCard.hasOwnProperty('instigatorID')){
			thisEntry.multiverseid = thisCard.instigatorID;
		}else if(thisCard.hasOwnProperty('multiverseid')){
			thisEntry.multiverseid = thisCard.multiverseid;
		}
		thisEntry.name = cardNames[0].replace(/’/g,"'");
		let two_names = [];
		two_names.push(thisEntry.name)
		if(thisCard.shape == "doubleface" || thisCard.shape == "split") {
			thisEntry.names = [thisEntry.name, thisEntry.name.replace(cardNames[0].replace("’","'"), cardNames[1].replace("’","'"))];
			thisEntry.id = cardNames[0] + "_" + thisCard.setID;
			thisEntry.uuid = cardNames[0] + "_" + thisCard.setID;
			thisEntry.otherFaceIds = [cardNames[1] + "_" + thisCard.setID];
			thisEntry.side = "a";
			thisEntry.faceName = cardNames[0] + (reprint ? "_" + thisCard.setID:"");
		}
		if(thisCard.shape == "doubleface") { //|| thisCard.shape == "split") { //instigatorchange
			thisEntry.number = thisCard.cardID + "a";
		}else{
			thisEntry.number = thisCard.cardID;
		}
		if(thisCard.rulesText != "\n")
			thisEntry.originalText = thisCard.rulesText.replace(/[*]/g, "");
		thisEntry.originalType = thisCard.typeLine.replace(/ $/, "");
		if(thisCard.power !== "")
			thisEntry.power = thisCard.power.toString();
		thisEntry.rarity = thisCard.rarity.replace(/(masterpiece|bonus)/, "special");
		if(thisCard.setID == "MPS_MSE")
			thisEntry.rarity = "special";
		if(library.oracle.hasOwnProperty(cardNames[0].replace(/’/g,"'")))
			thisEntry.rulings = arrayifyRulings(library, cardNames[0].replace(/’/g,"'"));
		if(thisCard.typeLine.match("—"))
			thisEntry.subtypes = arrayifyTypes(thisCard.typeLine.replace(/[A-Z ]+—/i, ""));
		let supertypes = thisCard.typeLine.split(" — ")[0];
		supertypes = supertypes.replace(thisCard.cardType, "");
		if(supertypes != "")
			thisEntry.supertypes = arrayifyTypes(supertypes);
		if(thisCard.rulesText != "\n")
			thisEntry.text = thisCard.rulesText.replace(/[*]/g, "");
		if(thisCard.toughness !== "")
			thisEntry.toughness = thisCard.toughness.toString();
		thisEntry.type = thisCard.typeLine.replace(/ $/, "");
		thisEntry.types = arrayifyTypes(thisCard.cardType);
		thisCardArray.push(thisEntry);
		
		if(thisCard.shape == "doubleface" || thisCard.shape == "split") {
			let thisEntry = {};
			if(thisCard.artist2 != undefined) {
				thisEntry.artist = thisCard.artist2.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
			}else{
				thisEntry.artist = thisCard.artist.replace(/ ?(on |—|-|[(]) ?(DeviantArt|DA|ArtStation|pixiv|pivix)[)]?/i, "");
			}
			if(thisCard.shape == "doubleface") {
				thisEntry.convertedManaCost = thisCard.cmc;
			}else{
				thisEntry.convertedManaCost = thisCard.cmc2;
			}
			thisEntry.colors = arrayifyColors(thisCard.color2);
			thisEntry.color_identity = thisEntry.colors;
			thisEntry.colorIdentity = thisEntry.colors;
			thisEntry.designer = "";
			if(thisCard.designer != undefined)
				thisEntry.designer = thisCard.designer;
			if(thisCard.flavorText2 != "")
				thisEntry.flavor = thisCard.flavorText2.replace(/[*]/g, "");
			thisEntry.id = cardNames[0] + "_" + thisCard.setID + "b";
			thisEntry.imageName = cardNames[1].toLowerCase().replace(/’/g,"'");
			thisEntry.layout = thisCard.shape.replace("doubleface", "double-faced");
			thisEntry.legalities = arrayifyLegal(thisCard.cardName.replace(/’/g,"'"), library);
			if(thisCard.loyalty !== "")
				thisEntry.loyalty = thisCard.loyalty2;
			thisEntry.manaCost = thisCard.manaCost2;
			thisEntry.mciNumber = thisCard.cardID + "b";
			if(thisCard.shape == "split") //instigatorchange
				thisEntry.mciNumber = thisCard.cardID;
			if(thisCard.hasOwnProperty('instigatorID')){
				thisEntry.multiverseid = thisCard.instigatorID;
			}else if(thisCard.hasOwnProperty('multiverseid')){
				thisEntry.multiverseid = thisCard.multiverseid;
			}
			
			thisEntry.name = cardNames[1].replace(/’/g,"'");
			two_names.push(thisEntry.name)
			thisEntry.names = two_names;
			thisEntry.number = thisCard.cardID + "b";
			if(thisCard.shape == "split") //instigatorchange
				thisEntry.number = thisCard.cardID;
			if(thisCard.rulesText2 != "\n")
				thisEntry.originalText = thisCard.rulesText2.replace(/[*]/g, "");
			thisEntry.originalType = thisCard.typeLine2.replace(/ $/, "");
			if(thisCard.power2 !== "")
				thisEntry.power = thisCard.power2.toString();
			
			thisEntry.rarity = thisCard.rarity.replace(/(masterpiece|bonus)/, "special");
			if(thisCard.setID == "MPS_MSE")
				thisEntry.rarity = "special";
			if(library.oracle.hasOwnProperty(thisCard.cardName.replace(/’/g,"'")))
				thisEntry.rulings = arrayifyRulings(library, thisCard.cardName.replace(/’/g,"'"));
			if(thisCard.typeLine2.match("—"))
				thisEntry.subtypes = arrayifyTypes(thisCard.typeLine2.replace(/[A-Z ]+—/i, ""));
			supertypes = thisCard.typeLine2.split(" — ")[0];
			supertypes = supertypes.replace(thisCard.cardType2, "");
			if(supertypes != "")
				thisEntry.supertypes = arrayifyTypes(supertypes);
			if(thisCard.rulesText2 != "\n")
				thisEntry.text = thisCard.rulesText2.replace(/[*]/g, "");;
			if(thisCard.toughness2 !== "")
				thisEntry.toughness = thisCard.toughness2.toString();
			thisEntry.type = thisCard.typeLine2.replace(/ $/, "");
			thisEntry.types = arrayifyTypes(thisCard.cardType2);

			thisCardArray.push(thisEntry);
		}
		if(thisCard.notes.includes("secretface"))
			thisCard.shape = "doubleface"
	}
	return thisCardArray;
}
function arrayifyColors(theseColors) {						//creates the color array for mtgjson
	if(!theseColors)
		return [];
	let colormatch = theseColors.match(/[{]([A-Z]+)\/?([A-Z]+)?\/?([A-Z]+)?\/?([A-Z]+)?\/?([A-Z]+)?\/?[}]/i);
	let colorArray = [];
	for(var c = 1; c < 6; c++) {
		if(colormatch !== null && colormatch[c] !== undefined)
			colorArray.push(colormatch[c]);
	}
	return colorArray;
}
function flipColors(theseColors) {							//converts Blue <-> U etc
	let refArray = ["W", "U", "B", "R", "G"];
	let nameArray = ["White", "Blue", "Black", "Red", "Green"];
	let newArray = [], stringFlag = false;
	if(typeof theseColors == "string") {
		theseColors = [theseColors];
		stringFlag = true;
	}
	for(let e in theseColors) {
		let thisColor = theseColors[e]
		let index = refArray.indexOf(thisColor); //check if WUBRG
		if(index != -1) { 						 //if it is
			newArray.push(nameArray[index]);	 //use its name
		}else{
			index = nameArray.indexOf(thisColor); //check if name
			if(index == -1) {					  //if it's not
				newArray.push("");				  //use ""
			}else{
				newArray.push(refArray[index]);	  //otherwise use its letter
			}
		}
	}
	if(stringFlag)
		return newArray[0];
	return newArray;
}
function calculateColorIdentity(card) {						//creates the color identity array from card data
	let refArray = ["W", "U", "B", "R", "G"];
	let nameArray = ["White", "Blue", "Black", "Red", "Green"];
	let baseColors = arrayifyColors(card.color);
	let backColors = []
	if(card.hasOwnProperty('color2'))
		backColors = arrayifyColors(card.color2)
	for(let color in backColors) {
		if(!baseColors.includes(backColors[color]))
			baseColors.push(backColors[color])
	}
	let textLine = card.rulesText;
	if(card.hasOwnProperty('rulesText2'))
		textLine += card.rulesText2;
	let colorTest = textLine.match(/\{[WUBRG]\}/g);
	if(colorTest) {
		for(let color in colorTest) {
			let colorLetter = colorTest[color].match(/[WUBRG]/);
			let colorName = nameArray[refArray.indexOf(colorLetter[0])]
			if(!baseColors.includes(colorName))
				baseColors.push(colorName);
		}
	}
	return baseColors;
}
function arrayifyLegal (thisName, library) {				//creates the legality array for mtgjson
	let legalArray = [];
	let legalEntry = {};
	if(library.name == "myriad"){
		return [{format: "Myriad", legality: "Legal"}];
	}
	if(library.name == "revolution") {
		if(library.legal.banned.includes(thisName))
			return [{format: "Revolution", legality:"Banned"}];
		return [{format: "Revolution", legality:"Legal"}];
	}
	if(library.name == "msem" && library.legal.masterpiece.includes(thisName)) {
		legalEntry.format = "MSEDH";
		if(library.legal.edhBan.includes(thisName)){
			legalEntry.legality = "Banned";
		}else{
			legalEntry.legality = "Legal";
		}
		legalArray.push(legalEntry);
	}else{
		legalEntry.format = "MSEM2";
		if(library.legal.modernBan.includes(thisName)) {
			legalEntry.legality = "Banned";
		}else{
			legalEntry.legality = "Legal";
		}
		legalArray.push(legalEntry);
		legalEntry = {};
		legalEntry.format = "MSEDH";
		if(library.legal.edhBan.includes(thisName)){
			legalEntry.legality = "Banned";
		}else{
			legalEntry.legality = "Legal";
		}
		legalArray.push(legalEntry);
	}
	return legalArray;
}
function arrayifyRulings (library, thisName) { 						//creates the legality array for mtgjson
	let theseRules = library.oracle[thisName];
	let rulMatch = theseRules.match(/([^_]+)(_ |$)/ig);
	let leng = rulMatch.length;
	let ruleArray = [];
	for(var i = 0; i < leng; i++) {
		let thisRule = {};
		thisRule.date = "2018-09-03";
		let thisRulMatch = rulMatch[i].match(/([^_]+)(_ |$)/i);
		thisRule.text = thisRulMatch[1].replace("\n", "");
		ruleArray.push(thisRule);
	}
	return ruleArray;
}
function arrayifyTypes (theseTypes) {						//creates type arrays for mtgjson
	let subtypeMatch = theseTypes.match(/([A-Z][a-z]+)( |$)/g)
	let subtypeArray = [];
	if(subtypeMatch !== null) {
		let leng = subtypeMatch.length;
		for(let type in subtypeMatch) {
			subtypeMatch[type] = subtypeMatch[type].replace(/ $/, "");
			subtypeArray.push(subtypeMatch[type]);
		}
	}
	return subtypeArray;
}
function checkPromo(dataName, cardData) {					//checks if a card is a skipped promo
	if(dataName.match(/_PRO/) && !cardData.typeLine.match(/Basic/))
		return false;
	return true;
}

//v3 database stuff if i ever get around to finishing it
/*
function lackeyv3ifier (cardName, library) {	//converts lackeybot v2 database entry to v3 database (for devDex)
	let oldCard = library.cards[cardName];
	let thisName = oldCard.fullName;
	if(oldCard.setID == "tokens") { //tokens need to keep set codes
		thisName = cardName;
	}else if (oldCard.typeLine.match(/Basic/)) { //fix for Mountain a b c, etc
		thisName = oldCard.cardName;
	}
	thisName = thisName.replace(/ ?\/\/ ?/, " // "); //standardize multipart cards
	//add the baseline details
	let newCard = {
		fullName: thisName,
		notes: oldCard.notes,
		shape: oldCard.shape,
		formats: oldCard.formats,
		prints: [],
		rarities: [],
		faces: [],
		versions: {}
	}
	if(oldCard.hasOwnProperty('faces')) { //if it already has faces for some reason keep that
		newCard.faces = oldCard.faces;
	}else{ //otherwise build it
		let face = {
			cardName: oldCard.cardName,
			manaCost: oldCard.manaCost,
			typeLine: oldCard.typeLine,
			rulesText: oldCard.rulesText,
			flavorText: oldCard.flavorText,
			power: oldCard.power,
			toughness: oldCard.toughness,
			loyalty: oldCard.loyalty,
			color: oldCard.color,
			cmc: oldCard.cmc,
			cardType: oldCard.cardType
		}
		newCard.faces.push(face);
		if(oldCard.hasOwnProperty('cardName2')) {
			face = {
				cardName: oldCard.cardName2,
				manaCost: oldCard.manaCost2,
				typeLine: oldCard.typeLine2,
				rulesText: oldCard.rulesText2,
				flavorText: oldCard.flavorText2,
				power: oldCard.power2,
				toughness: oldCard.toughness2,
				loyalty: oldCard.loyalty2,
				color: oldCard.color2,
				cmc: oldCard.cmc2,
				cardType: oldCard.cardType2
			}
			newCard.faces.push(face);
		}
	}
	//then add the version specifics
	let thisSet = oldCard.setID;
	if(newCard.versions.hasOwnProperty(thisSet)) { //cards with variations
		let thisV = newCard.versions[thisSet];
		if(!thisV.hasOwnProperty('variations')) //variants and promos
			thisV.variations = true;
		thisV.rarity.push(oldCard.rarity);
		thisV.cardID.push(oldCard.cardID);
		thisV.artists.push(oldCard.artist);
		if(oldCard.hasOwnProperty('artist2')) {
			thisV.artists.push(oldCard.artist2);
		}else if(oldCard.shape != "adventure" && oldCard.hasOwnProperty('cardName2')) {
			thisV.artists.push(oldCard.artist);
		}
		if(oldCard.hasOwnProperty('scryID'))
			thisV.scryID.push(oldCard.scryID);
		if(oldCard.hasOwnProperty('scryID2'))
			thisV.scryID.push(oldCard.scryID2);
	}else{ //first card of this set
		newCard.versions[thisSet] = {
			rarity: [oldCard.rarity],
			setID: thisSet,
			cardID: [oldCard.cardID],
			artists: [oldCard.artist],
			notes: []
		}
		if(oldCard.hasOwnProperty("scryID"))
			newCard.versions[thisSet].scryID = [oldCard.scryID]
		if(oldCard.hasOwnProperty('scrydID2'))
			newCard.versions[thisSet].scryID.push(oldCard.scryID2);
		if(oldCard.hasOwnProperty('artist2')) {
			newCard.versions[thisSet].artists.push(oldCard.artist2);
		}else if(oldCard.shape != "adventure" && oldCard.hasOwnProperty('cardName2')) {
			newCard.versions[thisSet].artists.push(oldCard.artist);
		}
	}
	return newCard;
}
function coordinateCard(cardCoords, libName) {	//standardizes cardCoords
	if(typeof cardCoords == "string")
		cardCoords = [cardCoords];
	if(!cardCoords[1])
		cardCoords[1] = libName;
	if(!cardCoords[2])
		cardCoords[2] = arcana[libName].cards[cardCoords[0]].prints[0]; //if none specified, use first
	if(!cardCoords[3])
		cardCoords = 0; //if none specified, use first
	return cardCoords;
}
function allNotes (cardCoords) {				//returns array of global and local notes
	let thisCard = arcana[cardCoords[1]].cards[cardCoords[0]];
	let notes = card.notes;
	let thisPrint = thisCard.versions[cardCoords[2]][cardCoords[3]];
	for(let n in thisPrint.notes) {
		notes.push(thisPrint.notes[n])
	}
	return notes;
}
function upDex(cardName) {						//quick update devDex -> v3
	return mod_magic.lackeyv3ifier(cardName, arcana.devDex);
}
*/

exports.symbolize = symbolize;
exports.unsymbolize = unsymbolize;
exports.italPseudo = italPseudo;
exports.writeCard = writeCard;
exports.writeCardError = writeCardError;
exports.findReprints = findReprints;

exports.writeManaCost = writeManaCost;
exports.arrangeColors = arrangeColors;

exports.mtgjsonSetsBuilder = mtgjsonSetsBuilder
exports.mtgjsonBuilder = mtgjsonBuilder
exports.wtfjsonBuilder = wtfjsonBuilder
exports.arrayifyColors = arrayifyColors
exports.calculateColorIdentity = calculateColorIdentity
exports.flipColors = flipColors
