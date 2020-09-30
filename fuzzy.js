/* Fuzzy
 Contains fuzzy searching and scryquery scripts
*/

var toolbox = require('./toolbox.js');
var embedCache = {
	scries: {msem:{}, magic:{}, devDex:{}, myriad:{}},
	prices: {}
	};
var scryRegex = buildScryRegex();
function clearEmbedCache() { //clears cached data for embeds
	embedCache = {
		scries: {msem:{}, magic:{}, devDex:{}, myriad:{}, cajun_standard:{}},
		prices: {}
	};
}
function fuzzyCheck (searchTerm, testName, library) { //report score for test string @ test card and current best card
	let testScore = fuzzySearch(searchTerm, testName, 0);//, true); //debugging purposes
	let current = searchCards(library, searchTerm);
	let currentScore = fuzzySearch(searchTerm, current, 0);
	return "The card " + testName + " has a score of " + testScore + " for the searchstring " + searchTerm + ".\nThe current best score for " + searchTerm + " is " + current + " with a score of " + currentScore + ".";
}
function anglicizeLetters (string){ //convert non-English characters into English equivalents
	string = string.replace(/[âáà]/g,"a");
	string = string.replace(/é/g,"e");
	string = string.replace(/í/g,"i");
	string = string.replace(/ö/g,"o");
	string = string.replace(/[ûú]/g,"u");
	return string;
}
function fuzzySearch (needle,thread,needlescore, showMe) { //beta scoring function for the search
	let charScore = 1; stringBonus = 0.5; threadOffset = 0;
	if(thread.length > 65) { //for very long names, reduce the score
		charScore = 0.5; stringBonus = 1;
	}
	let needleBox = [needle];
	let threadBox = [thread];
	if(needle.match(/ /)) {
		needleBox = needle.split(/(?: |\/\/)/);
		threadBox = thread.split(/(?: |\/\/)/);
	}
	if(showMe) {
		console.log(needleBox)
		console.log(threadBox)
	}
	boxLine: for(var h = 0; h < needleBox.length; h++) { //for each word in the searchstring
		let newstart = 0;
		needleLine: for (var i = 0; i < needleBox[h].length; i++) { //for each character in the search string
			if(h+threadOffset >= threadBox.length)
				return needlescore;
			if(i == 0) {//try to match the first character
				let tempOffset = 0;
				tempOffset += threadOffset; //seperate so it's not a js reference
				while(h+tempOffset < threadBox.length){
					if(threadBox[h+tempOffset].toLowerCase().charAt(i) != needleBox[h].toLowerCase().charAt(i)) { //if this word doesn't start with it
						tempOffset++; //try the next one
					}else{
						break;
					}
				}
				if(h+tempOffset != threadBox.length) { //if something matched the first character
					threadOffset = tempOffset; //set threadOffset to the right word;
				}else{ //if not, try to find the first with the letter at all
					let tempOffset = 0;
					tempOffset += threadOffset; //seperate so it's not a js reference
					while(h+tempOffset < threadBox.length){
						if(!threadBox[h+tempOffset].toLowerCase().match(escapify(needleBox[h].toLowerCase().charAt(i)))) { //if this word doesn't have it
							tempOffset++; //try the next one
						}else{
							break;
						}
					}
					if(h+tempOffset != threadBox.length) //if something matched the first character
						threadOffset = tempOffset; //set threadOffset to the right word;
				}
			}//if the first character isn't matched, it will go with whatever the next threadBox in line is

			for (var j = newstart; j < threadBox[h+threadOffset].length; j++){ //for the characters in the checking string
				if(threadBox[h+threadOffset].toLowerCase().charCodeAt(j) === needleBox[h].toLowerCase().charCodeAt(i)){
					needlescore += charScore;
					if(showMe)
						console.log("needlescore to " + needlescore + " at " + needleBox[h].toLowerCase().charAt(i) + " matching " + threadBox[h+threadOffset].toLowerCase().charAt(j));
					if(j == newstart) {
						needlescore += stringBonus;
						if(showMe)
							console.log("and a string bonus to " + needlescore);
					}
					newstart = j+1;
					continue needleLine;
				}
			}
			/*if(i == 0 && j == threadBox[h+threadOffset].length) { //if none of the letters in a word match the first letter
				i--; //try again
				threadOffset++; //but on the next word in the test name
			}*/ //original 'find first letter' function, was too aggressive
		}
	}
	return needlescore;
}
function fuzzySearchSimple (needle,thread,needlescore) { //scoring function for the search
	if(!needlescore)
		needlescore = 0;
	let charScore = 1; stringBonus = 0.5; newstart = 0;
	if(thread.length > 65) { //for very long names, reduce the score
		charScore = 0.5; stringBonus = 1;
	}
	needleLine: for (var i = 0; i < needle.length; i++) { //for each character in the search string
		for (var j = newstart; j < thread.length; j++){
			if(thread.toLowerCase().charCodeAt(j) === needle.toLowerCase().charCodeAt(i)){
				needlescore += charScore;
				if(j == newstart)
					needlescore += stringBonus;
				newstart = j+1;
				continue needleLine;
			}
		}
	}
	return needlescore;
}
function scryDatabase(library, searchstring, exact) { //collects an array of all card names that pass the given scryfall search
	let database = library.cards;
	if(!exact || exact == undefined)
		exact = false;
	if(searchstring.match(/!["A-Za-z]/i))
		exact = true;
	let dataRef = library.name;
	if(embedCache.scries[dataRef].hasOwnProperty(searchstring)) {
		return [embedCache.scries[dataRef][searchstring], exact]
	} //if array is stashed, send that
	let scryFilter = stitchScryCode(searchstring, library);
	let valids = [];
	let matched = [];
	let timeout = false;
	for(let entry in database) {
		let startTime = new Date().getTime();
		if(!(database[entry].setID == "BOT" && (dataRef == "msem" || database == "magic"))) {
			if(scryFilter(database[entry])) {
				if(exact) {
					valids.push(entry); //all entries that match an exact name
				}else{
					if(!matched.includes(database[entry].fullName)) {
						valids.push(entry) //only the first of each unique card
						matched.push(database[entry].fullName);
					}
				}
			}
		}
		let timeSince = toolbox.timeSince(startTime)
		if(timeSince >= 2000) { //if it takes more than 2 seconds for a single card, time out
			embedCache.scries[dataRef][searchstring] = valids;
			return [valids, exact, true];
		}
	}
	embedCache.scries[dataRef][searchstring] = valids;
	return [valids, exact, false];
}
function searchCards(library,searchstring,needleWeight) {  //main search function
	let database = library.cards;
	searchstring = searchstring.replace(/[[\]<>]/g,"");
	searchstring = searchstring.replace(/ \/\/ /g,"//");
	let bestMatch = ["no",2];
	let splitString = searchstring.match(/^([^_|]*)_?([A-Z0-9_]+)?\|?([^\n]+)?/i); //check for set codes and scryfall filters
	if(splitString[2])
		splitString[2] = splitString[2].toUpperCase();
	if(library.nicks.hasOwnProperty(splitString[1].toLowerCase()))
		splitString[1] = library.nicks[splitString[1].toLowerCase()];
	if(splitString[2] && database.hasOwnProperty(splitString[1] + "_" + splitString[2]))
		return splitString[1] + "_" + splitString[2]; //if there is an exact match, it sends that
	if(splitString[3]) //save Scryfall function here so we only generate it once.
		var scryFilter = stitchScryCode(splitString[3], library);
	let startTime = new Date().getTime();
	for(let entry in database) {
		let timeSince = 0;
		//first check for exact names
		let name = database[entry].cardName;
		let commaMatch = false;
		let legendName = name.match(/^([A-Za-z0-9']+)(,)?/i);
		if(legendName) {
			commaMatch = (legendName[2] == ",") //only check noncreature/walkers for this if they have a comma in their name to avoid matching like "Storm the Vault" for "Storm"
			legendName = legendName[1]; //first word of a legendary's name
		}
		let narrowedFlag = false; //is this is a printing of the correct card?
		//if the search string exactly/i matches a name or legend name
		if(name.toLowerCase() === searchstring.toLowerCase() || (database[entry].typeLine.match(/Legendary/) && (commaMatch || database[entry].typeLine.match(/(Creature|Planeswalker)/)) && legendName && legendName.toLowerCase() === searchstring.toLowerCase()))
			narrowedFlag = true;
		//if the search string exactly/i matches a back name or back legend name
		if(!narrowedFlag && database[entry].cardName2 !== undefined) {
			name = database[entry].cardName2;
			legendName = name.match(/^([A-Za-z0-9']+)(,)?/i);
			if(legendName) {
				commaMatch = (legendName[2] == ",")
				legendName = legendName[1]; //first word of a legendary's name
			}
			if(name.toLowerCase() == searchstring.toLowerCase() || (database[entry].typeLine2.match(/Legendary/) && (commaMatch || database[entry].typeLine2.match(/(Creature|Planeswalker)/)) && legendName && legendName.toLowerCase() === searchstring.toLowerCase()))
				narrowedFlag = true;
		}
		//if the search string exactly/i matches a fullName
		name = database[entry].fullName;
		if(!narrowedFlag && name.toLowerCase() == searchstring.toLowerCase())
			narrowedFlag = true;
		if(narrowedFlag) { //if this is a printing
			if(splitString[2] && database[entry].setID != splitString[2]) { //and its not the right one
				if(bestMatch[1] != 1000000) 							//and its the first one
					bestMatch = [entry,1000000]; 					//hold it as the likely winner
			}else{															//and it is the right one
				return entry;											//send it
			}
		}
		if(bestMatch[1] == 1000000) //if we have a likely winner, skip the fuzzy search
			continue;
		var needlescore = 0 //otherwise, prepare to fuzzy search
		if(splitString[3]) {
			startTime = new Date().getTime();
			if(!scryFilter(database[entry])) //if it don't match the filter, skip
				continue;
			timeSince = toolbox.timeSince(startTime);
			needlescore += 2;
		}
		if(splitString[2] !== null && splitString[2] !== undefined) {
			if(splitString[2].toUpperCase().match(database[entry].setID))
				needlescore = 4;
			if(splitString[2].match(/PRO/i) && entry.match(/_PRO/))
				needlescore = 4;
			if(splitString[2].match(/MPS/i) && entry.match(/_MPS/))
				needlescore = 4;
			if(splitString[2].match(/TKN/i) && entry.match(/_TKN/))
				needlescore = 4;
		}
		if(splitString[1].match(/\.$/) && database[entry].rarity == "special") //check for promo dot
			needlescore += 1;
		if(needleWeight)
			needlescore += needleWeight(database[entry]); //evaluate a passed needleWeight function;
		var trimmedString = splitString[1].match(/^([ ]+)[A-Z]/);
		if(trimmedString !== null)
			splitString[1] = splitString[1].replace(trimmedString[1], "");
		name = anglicizeLetters(name).replace(/-/g," "); //prepare for non-exact matches
		splitString[1] = anglicizeLetters(splitString[1]).replace(/-/g," ");
		let i = 3 + needlescore; //score for filter-only queries
		let names = [name];
		if(database[entry].hasOwnProperty('hidden'))
			names.push(database[entry].hidden);
		if(database[entry].hasOwnProperty('alias'))
			names.push(database[entry].alias);
		for(let aName in names) {
			if(!(splitString[3] && !splitString[1])) //if not only a filter, fuzzy search
				i = fuzzySearch(splitString[1],names[aName],needlescore);
			if(i>bestMatch[1]) {
				bestMatch=[entry,i]; //whenever a better score is found, score and card name are recorded
			}
		}
		if(splitString[3] && timeSince >= 2000) {// if it takes 2+ seconds to run any card
			return bestMatch[0]; //time out
		}
	}
	return bestMatch[0];
}
function searchPack(pack,searchstring) { //pack search function
	pack = draft.packs[pack].cards
	if(pack.hasOwnProperty(searchstring))
		return searchstring; //if there is an exact match, it sends that
	let bestMatch = ["no",2];
	for(let entry in pack)
	{
		var needlescore = 0;
		let i = fuzzySearch(searchstring,pack[entry],needlescore);
		if(i>bestMatch[1])
			bestMatch=[pack[entry],i]; //whenever a better score is found, score and card name are recorded
	}
	return bestMatch[0];
}
function searchArray(string, array, scoreObj) { //fuzzy search arrary elements for string
	let minScore = 0;
	let minPercent = 0;
	if(scoreObj) {
		if(scoreObj.hasOwnProperty('score'))
			minScore = scoreObj.score
		if(scoreObj.hasOwnProperty('percent'))
			minPercent = scoreObj.percent;
	}
	let bestMatch = ["",minScore];
	for(let thisElement in array) {
		let i = fuzzySearchSimple(string, array[thisElement]);
		if(minPercent) {
			let p = (1.5*string.length); // max score
			if(p !== 0)
				p = i / p; //percentage	
			if(p < minPercent) //if less than min
				i = 0 //ignore score
		}
		if(i>bestMatch[1])
			bestMatch = [array[thisElement], i]
	}
	return bestMatch;
}
function buildScryRegex () { //builds the regexes for reading scryfall arguments
	let keys = '(name|mana|cmc|ft|power|toughness|type|pow|tou|loy|set|artist|art|lore|adds|produces|companion|comp|ci|color|id|in|is|fo|a|c|e|f|m|o|r|t|block|b|border|cube|display|direction|game|frame|lang|new|order|prefer|sort|unique|wm|usd|tix|eur)'
	let words = '("[^"]+"|\/[^\/]+\/|[^ ]+)';
	let standardMatch = '(?:-?' + keys + '(:| ?[=><]{1,2}) ?|!)' + words;
	let invalMatch = '(?:-?' + '[a-z]+' + '(:| ?[=><]{1,2}) ?|!)' + words;
	let tweakedMatch = '(?:-?[(]?' + keys + '(:| ?[=><]{1,2}) ?|!)' + words; //tweaked for minor array
	let fullRegex = '(-?[(]?(' + standardMatch + '( or )?)+[)]?|' + standardMatch + ')';
	let scryRegex = new RegExp(fullRegex,'ig'); // build major array
	let standardRegex = new RegExp(tweakedMatch, 'gi'); //buld minor array
	let indivRegex = new RegExp(standardMatch, 'i'); //pull individual checks out
	let invalRegex = new RegExp(invalMatch, 'g'); //pull individual checks out
	return [scryRegex, standardRegex, indivRegex, invalRegex];
}
function stitchScryCode (testString, library) { //combines the scryfall arguments into one function
	//first format for weird characters and things
	testString = testString.replace(/[”]/g, "\"")
	//then get major matches;
	var majorArray = testString.match(scryRegex[0]);
	if(!majorArray)
		majorArray = [];
	//then find the invalids
	var fakesArray = testString.match(scryRegex[3]);
	for(let key in majorArray)
		testString = testString.replace(majorArray[key], ""); //remove the real matches from the testString
	for(let key in fakesArray)
		testString = testString.replace(fakesArray[key], ""); //remove invalid keys from the testString
	testString = testString.replace(/ +/g, " "); //remove multispaces
	testString = testString.replace(/ $/g, ""); //remove trailing space
	let testArray = testString.split(" "); //split the remaining 
	if(testArray) {
		for(let bit in testArray) {
			if(testArray[bit] != "") //some empties were still getting through?
				majorArray.push("name:" + testArray[bit]) //add each of them as name checks
		}
	}
	//then build array of each check, leaving ors in arrays
	var minorArrays = [];
	for(let hit in majorArray) {
		majorArray[hit] = majorArray[hit].replace(/\)$/g,""); //remove last ), leave first ( for negation checks later
		minorArrays.push(majorArray[hit].match(scryRegex[1]))
	}
	if(minorArrays.length == 0) { //if no valid keys
		return function(){return true} //everything is true
	}
	let fullCodeArray = [];
	for(let anArray in minorArrays) {
		let codeArray = [];
		for(let check in minorArrays[anArray]) {
			let thisCheck = minorArrays[anArray][check];
			let bool = generateScryCode(thisCheck.replace(/^-/, ""), library);
			let snippit = bool; //needed to return !bool
			if(thisCheck.match(/^-/)) {
				snippit = function(card) {
					return !bool(card)
				};
			}
			codeArray.push(snippit);
		}
		let group = function(card) {
			for(let snip in codeArray) {
				if(codeArray[snip](card))
					return true;
			}
		};
		fullCodeArray.push(group);
	}
	let fullCode = function(card) {
		for(let snip in fullCodeArray) {
			if(!fullCodeArray[snip](card))
				return false;
		}
		return true;
	};
	return fullCode
}
function generateScryCode (thisCheck, library) { //makes the function for individual scryfall arguments
	thisCheck = String(thisCheck);
	thisCheck = thisCheck.replace(/^\(+/, ""); //remove leading (
	thisCheck = thisCheck.replace(/\)+$/, ""); //remove trailing )
	thisCheck = thisCheck.replace(/^f:/, "in:") //replace format searches with in searches
	thisCheck = thisCheck.replace(/^id/, "ci") //replace id searches with ci searches
	let matchCheck = thisCheck.match(scryRegex[2])[3]; //the word(s) to match
	if(matchCheck.match(/^"/) && matchCheck.match(/"$/))
		matchCheck = escapify(matchCheck);
	matchCheck = matchCheck.replace(/(^["\/]|["\/]$)/g,"") //remove quotes and regex slashes
	let operMatch = thisCheck.match(scryRegex[2])[2]; //the operators (:, >, =<, etc)
	if(operMatch.match(/^ ?= ?$/) && !thisCheck.match(/c(i|olor)?(:| ?[<>=]{1,2})/i)){
		thisCheck = thisCheck.replace(operMatch, ":")
		operMatch = ":";
	}
	//console.log(matchCheck)
	//console.log(thisCheck)
	//console.log(operMatch)
	if(thisCheck.match(/^(block|b|border|cube|display|direction|game|frame|lang|new|order|prefer|sort|unique|wm|usd|tix|eur)(:| ?[=><]{1,2})/i)) {
		return function(){return true} //don't bother checking scryfall-specific keys
	}

	var keyMatch = new RegExp ("^(!|name:|mana:|m:|cmc:|fo:|o:|ft:|type:|t:|pow:|power:|tou:|toughness:|loy:|e:|set:|artist:|art:|a:|lore:)", "i");
	var keyArray = ["!", "name:", "mana:", "m:", "cmc:", "fo:", "o:", "ft:", "type:", "t:", "pow:", "power:", "tou:", "toughness:", "loy:", "e:", "set:", "artist:", "art:", "a:", "lore:"];
	var fieldArray = ["cardName", "fullName", "manaCost", "manaCost", "cmc", "rulesText", "rulesText", "flavorText", "typeLine", "typeLine", "power", "power", "toughness", "toughness", "loyalty", "setID", "setID", "artist", "artist", "artist", "fullName"];
	var fieldArray2 = ["cardName2", "fullName", "manaCost2", "manaCost2", "cmc2", "rulesText2", "rulesText2", "flavorText2", "typeLine2", "typeLine2", "power2", "power2", "toughness2", "toughness2", "loyalty2", "setID", "setID", "artist2", "artist2", "artist2", "fullName"];
	var keyPull = thisCheck.match(keyMatch);
	if(keyPull) { //check all the easy keys first
		matchCheck = addScryfallExtensions(matchCheck)
		return function (card) {
			let i = keyArray.indexOf(keyPull[1].toLowerCase())
			if(keyArray[i] == "!") {
				let checkLine3 = "^" + matchCheck + "$";
				if(card.fullName.match(checkLine3)) {
					return true; //if fullName is an exact, send true, else rely on card1 or card2
				}
			}
			let checkLine = matchCheck.replace(/~/g, card.cardName)
			if(keyArray[i] == "!") //exact match
				checkLine = "^" + checkLine + "$";
			let checkRegex = new RegExp(checkLine,'i') //replace ~ with cardName, make regex
			let checkCard;
			try {
				if(keyArray[i] == "lore:") {
					checkCard = (card.cardName.match(checkRegex) || card.flavorText.match(checkRegex))
				}else if(typeof card[fieldArray[i]] == "number" && matchCheck == "even") {
					checkCard = (card[fieldArray[i]]%2 == 0);
				}else if(typeof card[fieldArray[i]] == "number" && matchCheck == "odd") {
					checkCard = (card[fieldArray[i]]%2 != 0);
				}else if(typeof card[fieldArray[i]] == "number" && matchCheck == parseInt(matchCheck)) {
					checkCard = (card[fieldArray[i]] == parseInt(matchCheck));
				}else{
					checkCard = String(card[fieldArray[i]]).match(checkRegex); //apply regex
				}
			}catch(e) {checkCard = null;}
			let checkBack;
			if(card.hasOwnProperty('cardName2')) {//check back face too
				let checkLine2 = matchCheck.replace(/~/g, card.cardName2)
				if(keyArray[i] == "!") //exact match
					checkLine = "^" + checkLine2 + "$";
				let checkAgain = new RegExp(checkLine2,'i') //replace ~ with cardName2, make regex
				try {
					if(keyArray[i] == "lore") {
						checkBack = (card.cardName2.match(checkAgain) || card.flavorText2.match(checkAgain))
					}else if(typeof card[fieldArray2[i]] == "number" && matchCheck == parseInt(matchCheck)) {
							checkBack = (card[fieldArray2[i]] == parseInt(matchCheck));
					}else{
						checkBack = String(card[fieldArray2[i]]).match(checkAgain); //apply regex
					}
				}catch(e) {checkBack = null;}
			}
			if(checkCard || checkBack) { //true if one matches
				return true;
			}
			return false;
		};
	} //then the trickier ones
	if(thisCheck.match(/r: ?/i)) {
		thisCheck = thisCheck.replace(/: /, "=")
		operMatch = "=";
	}
	if(!operMatch.match(":") && (thisCheck.match(/cmc/) || !thisCheck.match(/c(:| ?[<>=]{1,2})/i))) { //rarity and power/toughness/loyalty/cmc
		//pow|tou|loy
		var numKeyArray = ["pow", "tou", "loy", "cmc"];
		var numFieldArray = ["power", "toughness", "loyalty","cmc"];
		var numFieldArray2 = ["power2", "toughness2", "loyalty2","cmc"];
		var checkCard;
		var checkBack;
		for(i = 0; i<numKeyArray.length; i++) {
			if(thisCheck.match(numKeyArray[i])) {
				let checkNum = parseInt(matchCheck);
				return function(card) {
					let refNum = parseInt(card[numFieldArray[i]]);
					if(refNum == NaN)
						refNum = 0;
					let dif = refNum - checkNum;
					if(dif == 0 && operMatch.match("=")) //refNum = checkNum
						return true;
					if(dif > 0 && operMatch.match(">")) // refNum > checkNum
						return true;
					if(dif < 0 && operMatch.match("<")) //refNum < checkNum
						return true;
						
					if(card.hasOwnProperty('cardName2')) { //check other side too
						refNum = parseInt(card[numFieldArray2[i]]);
						if(refNum == NaN)
							refNum = 0;
						let dif = refNum - checkNum;
						if(dif == 0 && operMatch.match("=")) //refNum = checkNum
							return true;
						if(dif > 0 && operMatch.match(">")) // refNum > checkNum
							return true;
						if(dif < 0 && operMatch.match("<")) //refNum < checkNum
							return true;
					}					
					return false; // has a failed pow/tou/loy check
				};
			}
		}
		//rarity
		var rareValue = ["basic land", "common", "uncommon", "rare", "mythic rare", "bonus", "special", "masterpiece"];
		var rValue = ["l", "c", "u", "r", "m", "b", "s", "mp"];
		let checkRare = rareValue.indexOf(matchCheck); // r > common
		if(checkRare < 0)
			checkRare = rValue.indexOf(matchCheck); // r > c
		if(checkRare >= 0) {
			return function(card) {
				let refRare = rareValue.indexOf(card.rarity);
				let dif = refRare - checkRare;
				if(dif == 0 && operMatch.match("=")) //refRare = checkRare
					return true;
				if(dif > 0 && operMatch.match(">")) //refRare > checkRare
					return true;
				if(dif < 0 && operMatch.match("<")) //refRare < checkRare
					return true;
				return false; //has failed a rarity check
			};
		}
	}
	if(thisCheck.match(/c(i|olor)?(:| ?[<>=]{1,2})/i)) { //colors
		thisCheck = thisCheck.replace(":", ">=");
		if(operMatch.match(":"))
			operMatch = ">="
		if(thisCheck.match(/c(i|olor)? ?>=[ wubrg]*m/i))
			matchCheck = 2; //multicolor
		if(thisCheck.match(/c(i|olor)? ?>=[ wubrg]*c/i))
			matchCheck = 0; //colorless
		let identCheck = thisCheck.match(/ci/i);
		return function(card) {
			let refColors = arrayifyColors(card.color);
			if(identCheck)
				refColors = calculateColorIdentity(card);
			if(parseInt(matchCheck) >= 0) { //multicolor
				let dif = refColors.length - parseInt(matchCheck);
				if(dif == 0 && operMatch.match("="))
					return true;
				if(dif > 0 && operMatch.match(">"))
					return true;
				if(dif < 0 && operMatch.match("<"))
					return true;
				return false;
			}
			var colornameArray = ["white","blue","black","red","green"];
			var colorletArray = ["w", "u", "b", "r", "g"];

			let findColor = colornameArray.indexOf(matchCheck.toLowerCase());
			if(findColor < 0) {
				findColor = [];
				for(let i=0; i<matchCheck.length; i++) {
					let letterNo = colorletArray.indexOf(matchCheck.charAt(i).toLowerCase());
					findColor.push(toolbox.toTitleCase(colornameArray[letterNo]));
				}
			}else{
				findColor = [toolbox.toTitleCase(colornameArray[findColor])];
			}
			let flag = false;
			let crossoverArray = toolbox.arrayDuplicates(findColor, refColors);
			
			let cal = crossoverArray.length, fcl = findColor.length, rcl = refColors.length;
			let le = (operMatch == "<=" || operMatch == "=<");
			let ge = (operMatch == "=>" || operMatch == ">=");
			let l = (operMatch == "<"), g = (operMatch == ">"), e = (operMatch == "=");
			if(rcl == 0 && (l||le))
				return true; // colorless < color
			if(ge && rcl >= cal && cal >= fcl)
				return true; // colors >= color
			if(g && rcl > fcl && fcl == cal)
				return true; // colors > color
			if(le && rcl <= fcl && cal != 0)
				return true; // colors <= color, GW gets G, W, C, not U, B, or R
			if(l && rcl < fcl && cal != 0)
				return true; // colors <= color, GW gets G, W, C, not U, B, or R
			if(e && rcl == fcl && fcl == cal)
				return true; // colors = color
			return false;
			/*if(crossoverArray.length == findColor.length && operMatch.match("="))
				return true; //if colors are exactly the same
			if(crossoverArray.length == findColor.length && operMatch.match("<"))
				return false; //if too many colors match a less than
			if(crossoverArray.length <= findColor.length && (operMatch.match(">") || operMatch == "="))
				return false; //if not enough colors match a greater than or equals
			if(crossoverArray.length >= findColor.length && operMatch.match("="))
				return false; //if too many colors match an equal
			if(crossoverArray.length != 0 && crossoverArray.length < findColor.length)
				return true; //example, a red card against <rg
			return true;*/
		};
	}
	if(thisCheck.match("in:")) {//in
		
		let formatMatch = matchCheck.match(/(vintage|legacy|commander|pauper|modern|pioneer|standard|brawl|historic|h|v|type1.5|type1|type2|edh|pi|p|1.5|1|2)$/);
		if(library.name == "magic" && formatMatch) {
			formatMatch = formatMatch[1];
			let formats = { //format aliases
				vintage: ["vintage", "v", "1", "type1"],
				legacy: ["legacy", "l", "1.5", "type1.5"],
				commander: ["commander", "c", "edh"],
				pauper: ["pauper", "p"],
				modern: ["modern", "m"],
				pioneer: ["pioneer","pi"],
				standard: ["standard", "s", "2", "type2"],
				brawl: ["brawl"],
				historic: ["historic","h"],
			}
			for(let thisFormat in formats) {
				if(formats[thisFormat].includes(formatMatch)) {
					return function(card) {
						if(card.formats.includes(thisFormat))
							return true;
						return false;
					};
				}
			}
		}
		
		var rareValue = ["basic land", "common", "uncommon", "rare", "mythic", "mythic rare", "bonus", "special", "masterpiece"];
		var rValue = ["l", "c", "u", "u", "m", "m", "b", "s", "mp"];
		let checkRare = rareValue.indexOf(matchCheck); // r > common
		if(checkRare < 0)
			checkRare = rValue.indexOf(matchCheck); // r > c
		if(checkRare > 0) {
			let matchRare = rareValue[checkRare];
			if(matchRare == "mythic")
				matchRare = "mythic rare";
			return function(card) {
				if(card.rarities.includes(matchRare))
					return true;
				return false;
			};
		}else{// in:SET
			return function(card) {
				if(card.prints.includes(matchCheck.toUpperCase()))
					return true;
				return false;
			}
		}
	}
	if(thisCheck.match(/^(adds|produces)/i)) {//adds
		matchCheck = matchCheck.toUpperCase();
		let checkArray = matchCheck.match(/([0-9]+|W+|U+|B+|R+|G+|C+|M+N?O?P?Q?)/g);
		return function(card) {
			let string = card.rulesText;
			let diffLine = null;
			if(card.hasOwnProperty('rulesText2'))
				string += card.rulesText2;
			let abilities = generateManaArrays(string);
			if(card.cardName == "Irrigation Trawler")
				console.log(abilities);
			if(!abilities)
				return false;
			let diffArray = [];
			for(let symb in checkArray) {
				if(checkArray[symb].match(/^[WUBRG]$/) && !diffArray.includes(checkArray[symb]))
					diffArray.push(checkArray[symb]);
			}
			if(diffArray.length > 1) {
				diffLine = diffArray.join("");
				let diffLetters = ["M", "N", "O", "P", "Q"];
				for(let i=0; i<diffArray.length; i++) {
					diffLine = diffLine.replace(diffLine.charAt(i), diffLetters[i]);
				}
				diffLine = new RegExp('^'+diffLine);
			}
			checkEach: for(let sym in checkArray) { //check if each of the called mana can be produced
				checkAbility: for(let ar in abilities) { //check each of the mana abilities
					if(abilities[ar].includes(checkArray[sym]))
						continue checkEach; //has the exact call
					if((abilities[ar].includes(checkArray[sym].length) || abilities[ar].includes('X')) && abilities[ar].includes(checkArray[sym].charAt(0)))
						continue checkEach; //adds:RR, add in any combo R and/or G
					let singleCheck = checkArray[sym].match(/^[WUBRG]$/);
					if(singleCheck){
						for(let hit in abilities[ar]) {
							if(abilities[ar][hit].match(singleCheck[0]))
								continue checkEach;
						}
					}
					if(!checkArray[sym].match(/[0-9NOPQ]/)) {
						let skip = false;
						for(let i=1; i<checkArray.length; i++) {
							if(checkArray[sym] != checkArray[0])
								skip = true;
						}
						if(!skip) {
							let mLine = "";
							for(i=0; i<checkArray[sym].length; i++)
								mLine += "M";
							if(abilities[ar].includes(mLine))
								continue checkEach; //Black Lotus @ adds:RRR
						}
					}
					if(diffLine) {
						for(let hits in abilities[ar]) {
							if(abilities[ar][hits].match(diffLine))
								continue checkEach; // adds:BR, add two different
						}
					}
				}
				return false; //if it gets through all the abilities without producing the color
			}
			return true; //if it gets through all the colors
		};
	}
	if(thisCheck.match("is:")) {//is
		if(matchCheck.match(/funny/i)) {// is:funny
			return function(card) {
				if(card.rarityLine.match(/Playtest/) || library.name == "magic" && library.setData[card.setID].type == "funny")
					return true;
				return false;
			}
		}
		if(matchCheck.match(/spell/i)) {// is:spell
			return function(card) {
				if(card.typeLine.match(/Instant|Sorcery/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/permanent/i)) {// is:permanent
			return function(card) {
				if(card.typeLine.match(/Artifact|Creature|Enchantment|Land|Planeswalker/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/historic/i)) {// is:historic
			return function(card) {
				if(card.typeLine.match(/Artifact|Legendary|Saga/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/storied/i)) {// is:storied
			return function(card) {
				if(card.typeLine.match(/Enchantment|Legendary/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/split/i)) {// is:split
			return function(card) {
				if(card.shape.match(/split/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/transform/i)) {// is:transform
			return function(card) {
				if(card.shape.match(/doubleface/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/leveler/i)) {// is:leveler
			return function(card) {
				if(card.shape.match(/leveler/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/saga/i)) {// is:saga
			return function(card) {
				if(card.typeLine.match(/Saga/i))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/vanilla/i)) {// is:vanilla
			return function(card) {
				if(card.rulesText == "")
					return true;
				return false;
			};
		}
		if(matchCheck.match(/hybrid/i)) {// is:hybrid
			return function(card) {
				if(card.color.match("/") && card.manaCost.match("/"))
					return true;
				return false;
			};
		}
		if(matchCheck.match(/useless/i)) { //is:useless island
			return function(card) {
				if(card.cardName.match("Island") && card.setID.match("XLN"))
					return true;
				return false;
			};
		}
		// is:banned
		return function(card) { //is:notes
			if(card.hasOwnProperty("notes") && card.notes.includes(matchCheck))
				return true;
			return false;
		}
	}
	return function() {return true} //if something else slipped through, call it true (ignore the key, otherwise nothing will match)
}
function addScryfallExtensions(string) {
	string = string.replace(/\\sm/g, "{[½XYZ0-9SPHCWUBRGET]\/?[0-9PCWUBRGHAOS]*}");
	string = string.replace(/\\ss/g, "{[½XYZ0-9SPHCWUBRGET]\/?[0-9PCWUBRG]*}");
	string = string.replace(/\\spt/g, "(?<!(\+|-))[XYZ0-9]+\/[XYZ0-9]+");
	string = string.replace(/\\spp/g, "\+[XYZ0-9]+\/\+[XYZ0-9]+");
	string = string.replace(/\\smm/g, "-[XYZ0-9]+\/-[XYZ0-9]+");
	string = string.replace(/\\smp/g, "-[XYZ0-9]+\/\+[XYZ0-9]+");
	string = string.replace(/\\spm/g, "\+[XYZ0-9]+\/-[XYZ0-9]+");
	string = string.replace(/\\sbd/g, "(-|\+)[XYZ0-9]+\/(-|\+)[XYZ0-9]+");
	return string;
}
function formatScryfallKeys (string) {
	string = string.replace(/comp(anion)?: ?gyruda/ig, "cmc:even");
	string = string.replace(/comp(anion)?: ?obosh/ig, "cmc:odd");
	string = string.replace(/comp(anion)?: ?jegantha/ig, "-mana:{c}{c} -mana:{x}{x} -mana:{s}{s} -mana:{w}{w} -mana:{u}{u} -mana:{b}{b} -mana:{r}{r} -mana:{g}{g} -mana:{b/r}{b/r} -mana:{r/g}{r/g} -mana:{u/r}{u/r} -mana:{b/g}{b/g} -mana:{u/b}{u/b} -mana:{w/b}{w/b} -mana:{w/u}{w/u} -mana:{r/w}{r/w} -mana:{g/w}{g/w} -mana:{g/u}{g/u} -mana:{2/w}{2/w} -mana:{2/u}{2/u} -mana:{2/b}{2/b} -mana:{2/r}{2/r} -mana:{2/g}{2/g} -mana:{w/p}{w/p} -mana:{u/p}{u/p} -mana:{b/p}{b/p} -mana:{r/p}{r/p} -mana:{g/p}{g/p}");
	string = string.replace(/comp(anion)?: ?kaheera/ig, "type:creature (type:cat or type:elemental or type:nightmare or type:dinosaur or type:beast)");
	string = string.replace(/comp(anion)?: ?keruga/ig, "cmc>=3");
	string = string.replace(/comp(anion)?: ?lurrus/ig, "(cmc<=2 or -is:permanent)");
	string = string.replace(/comp(anion)?: ?zirda/ig, '(t:equipment or fo:/^[^"]*:[^"]*$/ or o:/^Cycling/ or t:"Land Creature") is:permanent');
	return string
}
function escapify(string) {return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');}
function arrayifyColors(theseColors) { //creates the color array for mtgjson
	let colormatch = theseColors.match(/[{]([A-Z]+)\/?([A-Z]+)?\/?([A-Z]+)?\/?([A-Z]+)?\/?([A-Z]+)?\/?[}]/i);
	let colorArray = [];
	for(var c = 1; c < 6; c++) {
		if(colormatch !== null && colormatch[c] !== undefined)
			colorArray.push(colormatch[c]);
	}
	return colorArray;
}
function calculateColorIdentity(card) { //creates the color identity array from card data
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
function generateManaArrays(thisString) {
	if(thisString.match(/adds? [^\n]*?(mana|({H?[0-9CWUBRG]})+)/i)) {
		let manaArrays = [];
		//adds specific mana (Add W; Add W or U; Add W, U, or B)
		let mat1 = toolbox.globalCapture(/adds? (?:((?:{H?[0-9CWUBRG]})+),? )?(?:((?:{H?[0-9CWUBRG]})+),? )?(?:((?:{H?[0-9CWUBRG]})+),? )?(?:((?:{H?[0-9CWUBRG]})+),? )*(?:or )?((?:{H?[0-9CWUBRG]})+)/, thisString)
		//adds gold mana 
		let mat2 = toolbox.globalCapture(/adds? ([^\n]*?) ?mana (?:of|in|equal to) (different|[^\n{]+)? ?(color|type|[^\n]*?mana cost|(?:{H?[0-9CWUBRG]}, )?{H?[0-9CWUBRG]},? and\/or {H?[0-9CWUBRG]})/, thisString)
		//adds extra or lots of one mana (Add seven R, add an additional G)
		let mat3 = toolbox.globalCapture(/adds? (an amount of|an additional|five|six|seven|eight|nine|ten|that much) ((?:{H?[0-9CWUBRG]})+)/, thisString)
		let nope = true;
		if(mat1.length) {
			for(let mat in mat1)
				manaArrays.push(pullStandardMana(mat1[mat]));
			nope = false;
		}
		if(mat2.length) {
			for(let mat in mat2)
				manaArrays.push(pullGoldMana(mat2[mat]));
			nope = false;
		}
		if(mat3.length) {
			for(let mat in mat3)
				manaArrays.push(pullNonstandardMana(mat3[mat]));
			nope = false;
		}
		if(nope){
				manaArrays.push(['X', 'W', 'U', 'B', 'R', 'G'])
		}
		return manaArrays;
	}
}
function pullStandardMana(mat) {
	let manArray = [];
	for(let i=1; i<6; i++) {
		if(mat[i] != undefined) {
			let syms = mat[i].replace(/[{}]/g, "");
			if(!manArray.includes(syms.length))
				manArray.push(String(syms.length))
			manArray.push(syms);
		}
	}
	return manArray;
}
function pullNonstandardMana(mat) {
	let manArray = [];
	let count = toolbox.convertNumbers(mat[1]);
	if(isNaN(count)) {
		if(mat[1] == "an additional") {
			let syms = mat[2].replace(/[{}]/g, "")
			manArray.push(String(syms.length));
			manArray.push(syms);
			return manArray;
		}else{
			count = 5;
			manArray.push("X");
		}
	}else{
		manArray.push(String(count));
	}
	manArray.push(mat[2].replace(/[{}]/g, ""));
	return manArray;
}
function pullGoldMana(mat) {
	let manArray = [];
	let count = toolbox.convertNumbers(mat[1]);
	if(isNaN(count)) {
		count = 5
		manArray.push("X")
	}else{
		manArray.push(String(count));
	}
	if(mat[3] && mat[3].match("{")) {
		let temp = pullAndorMana(mat[3]);
		for(let mana in temp)
			manArray.push(temp[mana].match(/H?[0-9CWUBRG]/)[0]);
		return manArray;
	}
	if(mat[2] == "different") {
		let diffmana = ["M", "N", "O", "P", "Q"];
		let string = ""
		for(let i=0; i<count; i++)
			string += diffmana[i]
		manArray.push(string);
	}else if(mat[2].match(/combination/)) {
		manArray.push("W");
		manArray.push("U");
		manArray.push("B");
		manArray.push("R");
		manArray.push("G");
	}else if(mat[2].match(/any/)) {
		let string = "";
		for(i=0; i<count; i++) {
			string += "M"
			manArray.push(string)
		}
	}else{
		let string = "";
		for(let i=0; i<count; i++)
			string += "W";
		manArray.push(string)
		manArray.push(string.replace(/W/g, "U"))
		manArray.push(string.replace(/W/g, "B"))
		manArray.push(string.replace(/W/g, "R"))
		manArray.push(string.replace(/W/g, "G"))
		if(mat[2].match('type'))
			manArray.push(string.replace(/W/g, "C"))
	}
	return manArray;
}
function pullAndorMana(mat) {return mat.match(/{H?[0-9CWUBRG]}/g)}

exports.fuzzyCheck = fuzzyCheck;
exports.anglicizeLetters = anglicizeLetters;
exports.fuzzySearch = fuzzySearch;
exports.fuzzySearchSimple = fuzzySearchSimple;
exports.scryDatabase = scryDatabase;
exports.searchCards = searchCards;
exports.searchPack = searchPack;
exports.searchArray = searchArray;

exports.buildScryRegex = buildScryRegex;
exports.stitchScryCode = stitchScryCode;
exports.generateScryCode = generateScryCode;
exports.formatScryfallKeys = formatScryfallKeys;
exports.escapify = escapify;

exports.clearEmbedCache = clearEmbedCache;
exports.embedCache = embedCache;
exports.scryRegex = scryRegex;