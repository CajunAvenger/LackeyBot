/* Extractor
 Extracts set skeleton data from a set
*/
var fs = require('fs');
var toolbox = require('./toolbox.js');
var cards = require('./canon/cards.json');
var ptHold = {pt:{}, power:{}, toughness:{}};
var commonWords = []//["flying", "flash", "destroy"];
var keyWords = {
	rulesText: [],
	typeLine: []
};
let setCode = "MH1"

function skeletonExtraction(set) {
	let skeletonArray = [];
	for(let card in cards){
		if(cards[card].setID == set) {
			let skeletonBits = [];
			skeletonBits.push(extractRarity(cards[card]));
			skeletonBits.push(extractColor(cards[card]));
			skeletonBits.push(extractCMC(cards[card]));
			let pt = extractPT(cards[card])
			skeletonBits.push(pt[3]);
			skeletonBits.push(pt[0]);
			skeletonBits.push(pt[1]);
			skeletonBits.push(extractCommonEffects(cards[card]));
			skeletonBits.push(extractKeyWords(cards[card]));
			//C,R,3,Creature,2,1,Flying,Devotion
			skeletonArray.push(skeletonBits);
		}
	}
	skeletonArray = adjustForBaseline(skeletonArray);
	let fullSkeletonText = sortSkeletonArray(skeletonArray)
	return fullSkeletonText;
}
function extractRarity(card) { //returns rarity code
	return card.rarity.replace("basic ", "").charAt(0).toUpperCase();
}
function extractColor(card) { //returns color code
	if(card.manaCost.match(/[WUBRG]\/[WUBRG]/)) //hybrid
		return "Z";
	if(card.color.match(/\//)) //multicolor
		return "M";
	let colorSnag = card.manaCost.match(/([WUBRG])/);
	if(colorSnag) //monocolor
		return colorSnag[1];
	let typeSnag = card.typeLine.match(/(Land|Artifact)/);
	if(typeSnag) //Land or Artifact
		return typeSnag[1].charAt(0);
	return "X"; //unknown colorless card
}
function extractCMC(card) { //returns cmc
	return String(card.cmc);
}
function extractPT(card) { //returns [power, toughness, pt, creature?] and banks for later
	let tokenSnag = card.rulesText.match(/(\d+)\/(\d+) [^\n]+ creature token/);
	if(!card.typeLine.match(/Creature/) && !tokenSnag)
		return ["", "", "", "Noncreature"];
	let power = parseInt(card.power);
	let toughness = parseInt(card.toughness)
	if(tokenSnag) {
		power = tokenSnag[1];
		toughness = tokenSnag[2];
	}
	if(isNaN(power))
		power = "V";
	if(isNaN(toughness))
		toughness = "V"
	let pt = power + "/" + toughness;
	if(card.rarity == "common" || card.rarity == "common") { //bank the common PTs to determine baseline creature
		if(power != "V" && toughness != "0") {
			if(!ptHold.power.hasOwnProperty(power))
				ptHold.power[power] = 0;
			ptHold.power[power]++
		}
		if(toughness != "V" && toughness != "0") {
			if(!ptHold.toughness.hasOwnProperty(toughness))
				ptHold.toughness[toughness] = 0
			ptHold.toughness[toughness]++;
		}
		if(power != "V" && toughness != "V" && toughness != "0") {
			if(!ptHold.pt.hasOwnProperty(pt))
				ptHold.pt[pt] = 0
			ptHold.pt[pt]++;
		}
	}
	return [power, toughness, pt, "Creature"]
}
function extractWords(field, array) { //generic wordchecker
	let extractString = "";
	for(let word in array) {
		let wordMatch = new RegExp(array[word], 'i');
		if(field.match(wordMatch))
			extractString += array[word] + " ";
	}
	return extractString;
}
function extractCommonEffects(card) { //returns string of matches from commonWords
	return extractWords(card.rulesText, commonWords)
}
function extractKeyWords(card) { //returns string of matches from keyWords
	let kwString = "";
	for(let field in keyWords) {
		kwString += extractWords(card[field], keyWords[field])
	}
	return kwString;
}
function adjustForBaseline(arrays) { //determine baseline PT and Small/Medium/Large/Wall creatures
/*	let bestMatches = [[],0];
	let baseP = arrayMax(bestMatch(ptHold.power, bestMatches));
	let baseT = arrayMax(bestMatch(ptHold.toughness, bestMatches));
	let basePT = bestMatch(ptHold.pt, bestMatches);
	console.log(ptHold);
	console.log(baseP);
	console.log(baseT);
	console.log(basePT);*/
	for(let cardArray in arrays) {
		let type = "";
		let card = arrays[cardArray];
		let power = card[4], toughness = card[5];
		if(power !== "") {
			if(parseInt(power)+parseInt(toughness) > 8) {
				type += "CLarge";
			}else if(parseInt(power)+parseInt(toughness) < 5) {
				type += "ASmall";
			}else{
				type += "BMedium"
			}
			if(toughness >= parseInt(power+3))
				type += "Wall";
			type += " ";
		}
		arrays[cardArray] = card[0] + card[1] + "ReplaceMeImTheIndex " + type + card[3] + " " + card[2] + " " + card[6] + card[7];
	}
	return arrays;
}
function arrayMax(array) {
	let max = array[0];
	for(let ele in array) {
		if(array[ele] > max)
			max = array[ele];
	}
	return max;
}
function bestMatch(obj, base) { //returns array of greatest key in a map {f:v}
	for(let entry in obj) {
		if(obj[entry] > base[1]) //if greater than, overwrite and set as top
			base = [[], obj[entry]]
		if(obj[entry] == base[1])
			base[0].push(entry);
	}
	return base[0];
}
function parsePrefix(string) { //pulls the setcode prefix
	return string.match(/([A-Z])([A-Z])/);
}
function sortSkeletonArray(array) { //sorts the skeleton array nicely and returns as text
	let map = {};
	let rareOrder = ["C", "U", "R", "M", "L", "B"];
	let colorOrder = ["W", "U", "B", "R", "G", "M", "Z", "A", "L", "X"];
	array.sort();
	array.sort(function(a,b) {
		let prefixA = parsePrefix(a);
		let prefixB = parsePrefix(b);
		let result = rareOrder.indexOf(prefixA[1]) - rareOrder.indexOf(prefixB[1]);
		if(result == 0)
			result = colorOrder.indexOf(prefixA[2]) - colorOrder.indexOf(prefixB[2]);
		return result;
	});
	let allSkeletonText = "";
	let i = 0;
	let heldPrefix = "";
	for(let card in array) {
		array[card] = array[card].replace("ASmall", "Small").replace("BMedium", "Medium").replace("CLarge", "Large");
		let prefix = parsePrefix(array[card])
		if(prefix && prefix[2] != heldPrefix)
			i = 0;
		heldPrefix = prefix[2];
		i++;
		array[card] = array[card].replace("ReplaceMeImTheIndex", toolbox.fillLength(String(i), 2, "0"));
		allSkeletonText += array[card] + "\n";
	}
	return allSkeletonText;
}
//skeletonExtraction("CN2");
console.log(skeletonExtraction(setCode));