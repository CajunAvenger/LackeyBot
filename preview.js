/* Preview
 Downloads still-previewing sets from Scryfall
*/
const rp = require("request-promise-native");
const fs = require('fs');
let set_code = "";

async function download() { //loop scryfall pages
	let data = await scryCard("https://api.scryfall.com/cards/search?q=e%3A"+set_code)
	let cardObj = writeMiniJson(data.data, {})
	while(data.has_more) {
		data = await scryCard(data.next_page)
		cardObj = writeMiniJson(data.data, cardObj)
	}
	finalJson(cardObj);
}
async function scryCard(testurl) { //get scryfall data for a search
	let requestPromise;
	requestPromise = new Promise((resolve, reject) => {
		rp({url: testurl, json: true}).then(body => {
			resolve(body);
		}, () => {
			console.log('Falling back to fuzzy search for ');
			rp({url: testurl, json: true})
				.then(response => resolve({data: [response]}), reject);
		});
	});
	theData = await requestPromise;
	return theData;
}
function writeMiniJson(cards, temp) { //generates the preview json
	for(let card in cards) {
		let setcode = cards[card].set.toUpperCase();
		cards[card].name = cards[card].name.replace(" // ","//");
		let data_name = cards[card].name + "_" + setcode;
		temp[data_name] = {};
		temp[data_name].fullName = cards[card].name;
		if(!cards[card].hasOwnProperty('oracle_text')) {
			temp[data_name].cardName = cards[card].card_faces[0].name;
			temp[data_name].manaCost = cards[card].card_faces[0].mana_cost;
			temp[data_name].typeLine = cards[card].card_faces[0].type_line;
			temp[data_name].rarityLine = "*" + setcode + " " + cards[card].rarity.charAt(0).toUpperCase() + "*";
			temp[data_name].rulesText = cards[card].card_faces[0].oracle_text.replace(/\(/g,"*(").replace(/\)/g,")*") + "\n";
			if(cards[card].hasOwnProperty('flavor_text')) {
				temp[data_name].flavorText = "*" + cards[card].card_faces[0].flavor_text + "*\n";
			}else{
				temp[data_name].flavorText = "";
			}
			if(cards[card].card_faces[0].hasOwnProperty('power')) {
				let num = cards[card].card_faces[0].power;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].power = num;
			}else{
				temp[data_name].power = "";
			}
			if(cards[card].card_faces[0].hasOwnProperty('toughness')) {
				let num = cards[card].card_faces[0].toughness;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].toughness = num;
			}else{
				temp[data_name].toughness = "";
			}
			if(cards[card].card_faces[0].hasOwnProperty('loyalty')) {
				let num = cards[card].card_faces[0].loyalty;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].loyalty = num;
			}else{
				temp[data_name].loyalty = "";
			}
			temp[data_name].color = colorArranger(cards[card].colors);
			temp[data_name].cmc = cards[card].cmc;
			temp[data_name].cardType = "";
			temp[data_name].scryID = cards[card].id;
			temp[data_name].rarity = cards[card].rarity;
			temp[data_name].artist = cards[card].card_faces[0].artist;

			temp[data_name].cardName2 = cards[card].card_faces[1].name;
			temp[data_name].manaCost2 = cards[card].card_faces[1].mana_cost;
			temp[data_name].typeLine2 = cards[card].card_faces[1].type_line;
			temp[data_name].rarityLine2 = "*" + setcode + " " + cards[card].rarity.charAt(0).toUpperCase() + "*";
			temp[data_name].rulesText2 = cards[card].card_faces[1].oracle_text.replace(/\(/g,"*(").replace(/\)/g,")*") + "\n";
			if(cards[card].hasOwnProperty('flavor_text')) {
				temp[data_name].flavorText2 = "*" + cards[card].card_faces[1].flavor_text + "*\n";
			}else{
				temp[data_name].flavorText2 = "";
			}
			if(cards[card].card_faces[1].hasOwnProperty('power')) {
				let num = cards[card].card_faces[1].power;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].power2 = num;
			}else{
				temp[data_name].power2 = "";
			}
			if(cards[card].card_faces[1].hasOwnProperty('toughness')) {
				let num = cards[card].card_faces[1].toughness;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].toughness2 = num;
			}else{
				temp[data_name].toughness2 = "";
			}
			if(cards[card].card_faces[1].hasOwnProperty('loyalty')) {
				let num = cards[card].card_faces[1].loyalty;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].loyalty2 = num;
			}else{
				temp[data_name].loyalty2 = "";
			}
			temp[data_name].color2 = colorArranger(cards[card].colors);
			temp[data_name].cmc2 = cards[card].cmc;
			temp[data_name].cardType2 = "";
			temp[data_name].artist2 = cards[card].card_faces[1].artist;
		}else{
			temp[data_name].cardName = cards[card].name;
			temp[data_name].manaCost = cards[card].mana_cost;
			temp[data_name].typeLine = cards[card].type_line;
			temp[data_name].rarityLine = "*" + setcode + " " + cards[card].rarity.charAt(0).toUpperCase() + "*";
			if(!cards[card].hasOwnProperty('oracle_text'))
				console.log(cards[card].name);
			temp[data_name].rulesText = cards[card].oracle_text.replace(/\(/g,"*(").replace(/\)/g,")*") + "\n";
			if(cards[card].hasOwnProperty('flavor_text')) {
				temp[data_name].flavorText = "*" + cards[card].flavor_text + "*\n";
			}else{
				temp[data_name].flavorText = "";
			}
			if(cards[card].hasOwnProperty('power')) {
				let num = cards[card].power;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].power = num;
			}else{
				temp[data_name].power = "";
			}
			if(cards[card].hasOwnProperty('toughness')) {
				let num = cards[card].toughness;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].toughness = num;
			}else{
				temp[data_name].toughness = "";
			}
			if(cards[card].hasOwnProperty('loyalty')) {
				let num = cards[card].loyalty;
				let hold = parseInt(num);
				if(hold == num)
					num = hold;
				temp[data_name].loyalty = num;
			}else{
				temp[data_name].loyalty = "";
			}
			temp[data_name].color = colorArranger(cards[card].colors);
			temp[data_name].cmc = cards[card].cmc;
			temp[data_name].cardType = "";
			temp[data_name].scryID = cards[card].id;
			temp[data_name].rarity = cards[card].rarity;
			temp[data_name].artist = cards[card].artist;
		}
		temp[data_name].shape = cards[card].layout;
		temp[data_name].notes = [];
		temp[data_name].setID = setcode;
		temp[data_name].cardID = cards[card].collector_number;
		temp[data_name].formats = [];
		temp[data_name].prints = [setcode];
		temp[data_name].rarities = [cards[card].rarity];
	}
	return temp;
}
function finalJson(cardObj) { //writes the preview json at the end
		fs.writeFile('./previewcards.json', JSON.stringify(cardObj).replace(/},\"/g, "},\r\n	\""), function(err) {
		if(err) throw err
		console.log('done');
	});
}
function colorArranger (theseColors) { //writes the colors field
	let newArray = [];
	if(theseColors == undefined)
		return "";
	let colorWords ="";
	if(theseColors.includes("W"))
		newArray.push("White");
	if(theseColors.includes("U"))
		newArray.push("Blue");
	if(theseColors.includes("B"))
		newArray.push("Black");
	if(theseColors.includes("R"))
		newArray.push("Red");
	if(theseColors.includes("G"))
		newArray.push("Green");
	if(newArray.length < 1)
		return "";
	colorWords = "{"
	for(var i=0; i<newArray.length; i++) {
		colorWords += newArray[i];
		if(i != newArray.length-1)
			colorWords += "/";
	}
	colorWords += "} ";
	return colorWords;
}
if(process.argv[2] != undefined) {
	set_code = process.argv[2];
	download();
}else{
	console.log('No set code given.')
}