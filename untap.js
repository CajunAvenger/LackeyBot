/* Untap
 Builds the MSEM untap database.
*/
var cards = require('./msecards.json');
var fs = require('fs');
function writeLink (card) {
	let linkString = "http://mse-modern.com/msem2/images/" + card.setID + "/" + card.cardID + ".jpg";
	if(card.shape == "doubleface")
		linkString = "http://mse-modern.com/msem2/images/" + card.setID + "/" + card.cardID + "a.jpg,http://mse-modern.com/msem2/images/" + card.setID + "/" + card.cardID + "b.jpg";
	return linkString
}
let output = "Name,Set,Rarity,Type,Language,Link,BackLink\r\n";
for(let card in cards) {
	if(cards[card].setID != "BOT") {
		let tokenValue = "custom";
		if(cards[card].setID == "tokens")
			tokenValue = "token";
		output += "\"" + cards[card].fullName + "\",";
		output += cards[card].setID + ",";
		output += cards[card].rarity.replace("masterpiece", "special") + ",";
		output += tokenValue + ",";
		output += "EN,";
		output += writeLink(cards[card]) + "\r\n";
	}
}
fs.writeFile('untapdata.csv', output, (err) => {
  if (err) throw err;
  console.log('untapdata.csv written.');
});