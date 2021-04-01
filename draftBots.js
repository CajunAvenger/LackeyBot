/*
	draftBots
	contains the AI profiles for the draftBots
*/
const toolbox = require('./toolbox');
function meetTheBots() {
	let hello = "LackeyBot has the following bot profiles that can be added with `$addbot name`\n";
	hello += "LackeyBot, the standard bot. Tries to draft on-color and on-curve.\n";
	hello += "LowkeyBot, who prefers drafting cheaper cards.\n";
	hello += "LargeBot, who prefers drafting expensive cards.\n";
	hello += "Clyde, who prefers drafting strange cards.\n";
	hello += "LilacBot, who prefers drafting many colors.\n";
	hello += "LuigiBot, who prefers jumping colors when they're available.\n";
	hello += "LonelyBot, who rarely ever changes colors.\n";
	hello += "LarryBot, who prefers drafting big creatures.\n";
	hello += "LightningBot, who prefers drafting aggro.\n";
	hello += "LoyalBot, who prefers drafting multiples of cards.\n";
	hello += "LunchBot, who prefers drafting grindier decks.\n";
	hello += "l33t_draft_haxxor, who doesn't draft the colors its neighbors are.\n";
	hello += "SusBot, who intentionlly drafts the same colors its neighbors are.\n";
	return hello;
}
function profileBaseline() {	//standard AI, bots should scale off this where possible to reduce code changes
	return {
		stayInYourLane: 6,									//at this pick, aggressively pick your core colors
		laneGolds: 3,										//score for multicolor cards in your lane
		hotMulti: 1,										//multiplier for staying in lane
		coldScore: -2,										//score for your coldest color
		mythicScore: 1.2, rareScore: 1, uncScore: 0.5,		//scores by rarity
		checkForPivot: 8,									//at this many cards left, pick colors that are overrepresented
		glutMulti: 0.4,										//score per card of excess of second color
		lowCMCs: [1, 2, 5, 4, 3, 2, 1, 1],					//once you have this many of a cmc, slightly reduce score
		highCMCs: [2, 4, 7, 6, 5, 3, 2, 1],					//once you have this many of a cmc, reduce score more
		tooHighCMCs: [4, 7, 9, 9, 7, 4, 2, 2],				//once you have this many of a cmc, reduce score greatly
		cmcScore: [-0.3, -0.8, -2],							//score for passing low, high, tooHigh cmc limits
		fancyWords: /(Flying|destroy|deals \d+ damage)/,	//key words to pick higher
		fancyScore: function(){return Math.random()+0.3},	//score for cards with fancy words
		variance: function(){return Math.random()/2}		//variation to base score
	}
}
var blankDraftData = {			//example data to be given to bot functions
	round: 1,
	cardName: "",
	thisCard: {},
	colorOrder: [],
	colorGlut: [],
	poolDeets: {},
	packDeets: {}
}
function profileLackeyBot() {	//default AI
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(data){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: base.variance
	}
}
function profileLowkeyBot() {	//AI that prefers lower cmcs
	let base = profileBaseline();
	for(let i = 1; i<4; i++) {
		base.lowCMCs[i] *= 2;
		base.highCMCs[i] *= 2;
		base.tooHighCMCs[i] *= 2;
	}
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore*1.5},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot/1.5},
		glutMulti: function(){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: base.variance
	}
}
function profileLargeBot() {	//AI that prefers higher cmcs
	let base = profileBaseline();
	for(let i = 4; i<8; i++) {
		base.lowCMCs[i] *= 2;
		base.highCMCs[i] *= 2;
		base.tooHighCMCs[i] *= 2;
	}
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore*.5},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: base.variance
	}
}
function profileClyde() {		//AI that fancies strange words
	let base = profileBaseline();
	let clydesInterests = [
		"Draw a card", "Return target", "Wall", "rather than", "instead",
		"win the game", "20", "smaller", "Trebuchet", "artifact or enchantment",
		"planeswalker", "7 or greater", "whichever", "unless you pay", "storm",
		"where X is", "take an extra turn", "Squirrel", "flip a coin"
	]
	let clydesFriends = /(Squirrel|Wall|Plant)/i
	let regString = "(";
	for(let f in clydesInterests)
		regString += clydesInterests[f] + "|";
	regString = regString.replace(/\|$/, ")");
	let fancy = new RegExp(regString, 'i');
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore*.5},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return fancy},
		fancyScore: function(){return 3},
		variance: function(data){
			let score = 0.8*Math.random();
			if(data.thisCard.typeLine.match(clydesFriends))
				score += 1.5;
			return score;
		}
	}
}
function profileLilacBot() {	//AI that prefers fixing and gold cards
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return /(mana of any color|search your library for a land|Add {[WUBRG]} or {[WUBRG]}|Add {[WUBRG]}, {[WUBRG]}, or {[WUBRG]})/},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = 0.5*Math.random();
			if(data.packDeets.bank[data.cardName]) {
				let colors = data.packDeets.bank[data.cardName];
				if(colors.length > 1 && colors.includes(data.colorOrder[0]))
					score += 1;
				return score
			}
		}
	}
}
function profileLuigiBot() {	//AI that switches more aggressively
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti*0.5},
		coldScore: function(){return base.coldScore*0},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot*1.5},
		glutMulti: function(){return base.glutMulti*1.5},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: base.variance
	}
}
function profileLonelyBot() {	//AI that stays in its lane more aggressively
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return (base.stayInYourLane/data.round)-2},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti+2},
		coldScore: function(){return base.coldScore-2},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot/2},
		glutMulti: function(){return base.glutMulti},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: base.variance
	}
}
function profileLarryBot() {	//AI that picks chonky bois
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = 0.3*Math.random();
			if(parseInt(data.thisCard.power) > parseInt(data.thisCard.cmc))
				score += 2;
			return score;
		}
	}
}
function profileLightningBot(){ //AI that forces aggro
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = Math.min(0.3, 0.8*Math.random());
			if(data.thisCard.rulesText.match(/(damage|haste)/))
				score += 0.5;
			if(data.thisCard.cmc < 4)
				score += 0.5;
			if(parseInt(data.thisCard.power) < parseInt(data.thisCard.toughness))
				score += 0.3;
		}
	}
}
function profileLoyalBot() {	//AI that likes multiples
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(data){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = 0.5*Math.random();
			if(data.poolDeets.bank[data.cardName])
				score += 1.5;
		}
	}
}
function profileLunchBot() {	//AI that likes tokens and life gain
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = 0.5*Math.random();
			if(data.thisCard.rulesText.match(/(lifelink|gains? (\d+|X)? ?life|create|graveyard|sacrifice)/i))
				score += 1;
			return score;
		}
	}
}
function profilel33t_haxxor() {	//AI that cheats for profit
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(data){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = 0.5*Math.random();
			if(data.packDeets.bank[data.cardName]) {
				let colors = data.packDeets.bank[data.cardName];
				if(colors.includes(data.previousPlayer.colorOrder[0]) || colors.includes(data.previousPlayer.colorOrder[1]))
					score -= 2;
				}
				return score
		},
		sendMe: function(){ //extra data to include in data
			return ["previousPlayer"];
		}
	}
}
function profileSusBot() {		//AI that cheats for lulz
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(data){return base.glutMulti/data.round},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: function(data) {
			let score = 0.5*Math.random();
			if(data.packDeets.bank[data.cardName]) {
				let colors = data.packDeets.bank[data.cardName];
				if(colors.includes(data.nextPlayer.colorOrder[0]) || colors.includes(data.nextPlayer.colorOrder[1]))
					score += 2;
				}
				return score
		},
		sendMe: function(){ //extra data to include in data
			return ["nextPlayer"];
		}
	}
}

function profileBot() {	//AI that gets copy pasted
	let base = profileBaseline();
	return {
		stayInYourLane: function(data) {return base.stayInYourLane/data.round},
		laneGolds: function(){return base.laneGolds},
		hotMulti: function(){return base.hotMulti},
		coldScore: function(){return base.coldScore},
		mythicScore: function(){return base.mythicScore},
		rareScore: function(){return base.rareScore},
		uncScore: function(){return base.uncScore},
		checkForPivot: function(){return base.checkForPivot},
		glutMulti: function(){return base.glutMulti},
		lowCMCs: function(){return base.lowCMCs},
		highCMCs: function(){return base.highCMCs},
		tooHighCMCs: function(){return base.tooHighCMCs},
		cmcScore: function(){return base.cmcScore},
		fancyWords: function(){return base.fancyWords},
		fancyScore: base.fancyScore,
		variance: base.variance
	}
}


exports.meetTheBots = meetTheBots();
exports.LackeyBot = profileLackeyBot();
exports.LowkeyBot = profileLowkeyBot();
exports.LargeBot = profileLargeBot();
exports.Clyde = profileClyde();
exports.LilacBot = profileLilacBot();
exports.LuigiBot = profileLuigiBot();
exports.LonelyBot = profileLonelyBot();
exports.LarryBot = profileLarryBot();
exports.l33t_draft_haxxor = profilel33t_haxxor();
exports.SusBot = profileSusBot();
exports.LoyalBot = profileLoyalBot();
exports.LunchBot = profileLunchBot();
exports.LightningBot = profileLightningBot();
