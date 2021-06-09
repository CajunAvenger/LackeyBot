/* PackGen
 Generates pack codes for the LackeyBot pack generator
 Already incorporated into Cannon
 Could be incorporated into Stitch
*/
var toolbox = require('./toolbox.js');
var fuzzy = require('./fuzzy.js');
let docs = writeDocs();

/*
	Remove property, with index t
	RAV: {
		block: ["RAV", "GPT", "DIS"],
		draft: true,
		longname: "Ravnica: City of Guilds",
		masterpiece: null,
		packSlots: [
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=u"], chances: [1]},
			{filters: ["r=u"], chances: [1]},
			{filters: ["r=u"], chances: [1]},
			{filters: ["r=r"], chances: [1]},
			{replace: 0, replaceChance: 0.3334, filters:["r=c","r=u","r=r","r=m",("r=b"|"r=l")], chances:[0.6875,0.1875,0.0547,0.0078,0.0625], chanceFunction:"else", foil: true}
		],
		releaseDate: "2005-10-27",
		setType: "expansion", //box set, promo, funny, supplemental
	}
	THS: {
		block: ["THS", "BNG", "JOU"],
		draft: true,
		longname: "Theros",
		masterpiece: null,
		packSlots: [
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=c"], chances: [1]},
			{filters: ["r=u"], chances: [1]},
			{filters: ["r=u"], chances: [1]},
			{filters: ["r=u"], chances: [1]},
			{filters: ["r=r", "r=m"], chances: [0.875, 0.125], chanceFunction:"else"}, //rare or mythic, foil below
			{replace: 0, replaceChance: 0.3334, filters:["r=c","r=u","r=r","r=m",("r=b"|"r=l")], chances:[0.6875,0.1875,0.0547,0.0078,0.0625], chanceFunction:"else", foil: true},
			//godPack
			{replace: "all", replaceChance: 0.001, filters:["Heliod, God of the Sun","Thassa, God of the Sea",(etc)], chances:[1, 1, 1, 1, 1, 1...], chanceFunction:"and"},
		],
		releaseDate: "2005-10-27",
		setType: "expansion", //box set, promo, funny, supplemental
	}

	if(packSlots[j].hasOwnProperty("replace"))
		if Math.random() <= replaceChance
			remove packs[packSlots[j]]
			add Math.random()
	keep same i counter going for normal packs, array[i%array.length]
	
	for(let slot in pack) {
		let prob = 0;
		for(let filter in pack[slot].filters) {
			if(!filters[filter].match(/e:/))
				filters[filter] += " e:" + set
			let prob += pack[slot].chances[filter];
			let rand = Math.rand();
			if(rand <= prob) {
				add this card
				if(filters[filter].hasOwnProperty('chanceFunction') && chanceFunction == "else")
					continue; //move to next slot
			}
			
		}
	}
*/
function builtInSlots (slot) { //codes for built in slots
	let slotMachine = {}
	//rarity slots
	slotMachine["common"] = [["r=c"], [1]];
	slotMachine["uncommon"] = [["r=u"], [1]];
	slotMachine["rare"] = [["r=r"], [1]];
	slotMachine["mythic"] = [["r=m"], [1]];
	slotMachine["land"] = [["r=l","r=c"], [1,1]];
	slotMachine["any card"] = [[""], [1]];
	slotMachine["nonbasic"] = [["is:nbslot"], [1]];
	slotMachine["land replace"] = [["r=l"], [1], "else", 0, 1.00, false];
	slotMachine["bonus"] = [["r=b"], [1]];
	slotMachine["special"] = [["r=s"], [1]];
	slotMachine["old rare/mythic"] = [["r=m","r=r"], [0.125,0.875]];
	slotMachine["rare/mythic"] = [["r=m","r=r"], [0.135,0.865]];
	//dfc slots
	slotMachine["dfc"] = [["is:transform"], [1]];
	slotMachine["cudfc"] = [["(r=c or r=u) is:transform"], [1]]
	slotMachine["rmdfc"] = [["(r=r or r=m) is:transform"], [1], "else", 0, 0.125, false];
	//shifted slots
	slotMachine["shifted common"] = [["r=c is:shifted"], [1]];
	slotMachine["shifted unc/rare"] = [["r=u is:shifted", "r=r is:shifted"], [0.666, 0.333]]
	slotMachine["shifted"] = [["is:shifted"], [1]];
	//other canon slots
	slotMachine["unclegend"] = [["r=u t:Legendary"], [1]];
	slotMachine["uncwalker"] = [["r=u t:Planeswalker"], [1]];
	slotMachine["draft"] = [["(t:Conspiracy or o:draft)"], [1]];
	slotMachine["conspiracy"] = [["t:Conspiracy"], [1]];
	//foil slot
	slotMachine["foil"] = [["r=c","r=u","r=r","r=m","r=c"], [0.6875,0.1875,0.0547,0.0078,0.0625], "else", 0, 0.3334, true];
	slotMachine["old foil"] = [["r=c","r=u","r=r"], [0.6875,0.25,0.0625], "else", 0, 0.3334, true];
	slotMachine["master foil"] = [["r=c","r=u","r=r","r=m"], [0.6875,0.25,0.0547,0.0078,0.0625], "else", 0, 1, true];
	slotMachine["bonus foil"] = [["r=c","r=u","r=r","r=m","(r=b or r=l)"], [0.6875,0.1875,0.0547,0.0078,0.0625], "else", 0, 0.3334, true];
	slotMachine["god pack"] = [["Heliod, God of the Sun e:THS","Thassa, God of the Sea e:THS","Erebos, God of the Dead e:THS","Purphoros, God of the Forge e:THS","Nylea, God of the Hunt e:THS","Ephara, God of the Polis e:BNG","Phenax, God of Deception e:BNG","Mogis, God of Slaughter e:BNG","Xenagos, God of Revels e:BNG","Karametra, God of Harvests e:BNG","Athreos, God of Passage e:JOU","Keranos, God of Storms e:JOU","Pharika, God of Affliction e:JOU","Iroas, God of Victory e:JOU","Kruphix, God of Horizons e:JOU"], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "and", "all", 0.001, false];
	if(slotMachine.hasOwnProperty(slot))
		return slotMachine[slot]
	return [];
}
function builtInPacks(pack) { //codes for built in packs
	if(pack == "oldmythicratio")
		return genEighthMythicPack();
	if(pack == "old")
		return genOldPack();
	if(pack == "standard" || pack == "new")
		return genRegularPack();
	if(pack == "bonus")
		return genBonusPack();
	if(pack == "conspiracy")
		return genCNSPack();
	if(pack == "nonbasic")
		return genNBPack();
	if(pack == "shifted")
		return genShiftedPack();
	if(pack == "isd")
		return genISDPack();
	if(pack == "soi")
		return genSOIPack();
	if(pack == "dom")
		return genDOMPack();
	if(pack == "war")
		return genWARPack();
	if(pack == "2xm")
		return gen2XMPack();
	
	return [];
}
function buildPackSlotsFrom(string){ //encodes packSlots code
	/*string is everything after packSlots
	looks like packSlots: Standard
	
	packSlots: Custom
	10x Common
	1x UncLegend...
	
	packSlots: Custom
	1x filters: "filter1","filter2" chances:chance1,chance2 replaceChance:chance replace:index foil:true/false chanceFunction:else/and/independent
	*/
	string = string.replace(/style[^\n]+\n?/i, "");
	//first check for a built in pack
	let builtPackCheck = string.match(/^([^\n]+)/);
	if(builtPackCheck){
		let packCheck = builtPackCheck[1].toLowerCase();
		if(packCheck != "custom"){
			let packTest = builtInPacks(packCheck);
			if(packTest.length > 0) {
				return JSON.parse(JSON.stringify(packTest)); //send a built in pack
			}else{
				return ["Invalid packSlot structure: Unrecognized built-in pack type: " + builtPackCheck[1] + ". If you were trying to make a custom pack, use pack type 'Custom'."] //invalid pack structure
			}
		}
	}
	//otherwise, build by line
	let customizedPack = [];
	let builtLines = string.match(/\n[^\n]+/g)
	if(builtLines == null)
		return ["Invalid packSlot structure: Custom packSlot requires a list of slots after a linebreak."]; //invalid pack structure
	for(let line in builtLines){
		//try to fill built in slots
		let builtMatch = builtLines[line].match(/\n([0-9]+)x ?([^:]+)/i);
		if(!builtMatch || builtMatch[1] == "0")
			return ["Invalid packSlot structure: packSlots require a nonzero quantity per slot, ex: `1x Common`."]; //invalid pack structure
		let packTest = builtInSlots(builtMatch[2].toLowerCase());
		if(packTest.length > 0){
			customizedPack = genSlots(packTest, Math.min(25,builtMatch[1]), customizedPack);
		}else if(!builtMatch[2].match(/filters?/i)) {
				return ["Invalid packSlot structure: Unrecognized built-in slot type: " + builtMatch[2]]; //invalid pack structure
		}else{
			let progSlot = {filters: [], chances: []};
			let countMatch = builtLines[line].match(/\n([0-9]+)x/);
			let filterMatch = builtLines[line].match(/filters?: ?"([^\n]+)"/i);
			let chanceMatch = builtLines[line].match(/chances?: ?"?([0-9\.,]+)"?/i);
			if(!chanceMatch || !chanceMatch[1])
				chanceMatch = ["", "1.0"];
			if(!filterMatch || !chanceMatch || !filterMatch[1] || !chanceMatch[1])
				return ['Invalid packSlot structure: Programmed packSlots must have filters and chances fields ending in commas, ex: `1x filters:"r=r","r=m", chances:0.875,0.125,`.'] //invalid pack structure
			let quant = countMatch[1];
			let filterLines = filterMatch[1];
			filterLines = filterLines.replace(/", ?"/g, 'SPLITHERE');
			filterLines = filterLines.replace(/"/g, '\"');
			filterLines = filterLines.split('SPLITHERE')
			for(let split in filterLines)
				progSlot.filters.push(filterLines[split])
			let chanceLines = chanceMatch[1];
			chanceLines = chanceLines.replace(/"?, ?"?/g, "SPLITHERE");
			chanceLines = chanceLines.split('SPLITHERE');
			for(let split in chanceLines) {
				let num = parseFloat(chanceLines[split]);
				if(chanceLines[split] !== "") {
					if(isNaN(num))
						return ['Invalid packSlot structure: chances field only supports numbers.'];//invalid pack structure, shouldn't be triggerable
					progSlot.chances.push(num);
				}
			}
			if(progSlot.filters.length < progSlot.chances.length)
				return ['Invalid packSlot structure: Each filter must have an associated chance.']; //invalid pack structure
			let replaceMatch = builtLines[line].match(/replaceChance: ?"?([0-9\.]+)"?/i);
			let replaceIndexMatch = builtLines[line].match(/replace: ?"?([0-9]+|all)"?/i);
			let foilMatch = builtLines[line].match(/foil: ?"?(true|false)"?/i);
			let functionMatch = builtLines[line].match(/chanceFunction: ?"?(else|and|independent)"?/i);
			if(!replaceMatch && (replaceIndexMatch || foilMatch || functionMatch)){
				return ['Invalid packSlot structure: replace slots require a replaceChance field.']; //invalid pack structure
			}
			if(replaceMatch) {
				progSlot.replaceChance = parseFloat(replaceMatch[1]);
				progSlot.replace = 0;
				if(replaceIndexMatch) {
					progSlot.replace = replaceIndexMatch[1];
					if(progSlot.replace != "all")
						progSlot.replace = parseInt(progSlot.replace);
					if(isNaN(progSlot.replace))
						progSlot.replace = 0;
				}
				progSlot.foil = false;
				if(foilMatch && foilMatch[1] == "true")
					progSlot.foil = true;
				progSlot.chanceFunction = "else";
				if(functionMatch) {
					progSlot.chanceFunction = functionMatch[1].toLowerCase();
				}
			}
			for(let i=0; i<quant; i++)
				customizedPack.push(progSlot)
		}
	}
	customizedPack = JSON.parse(JSON.stringify(customizedPack));
	return customizedPack;
}
function testPackFilters(packSlots, library, setID) {										//tests pack filters are valid for devDex
	if(setID == "")
		return "packSlots have still been saved, but LackeyBot doesn't have set data, so can't test pack filters.";
	let filterArrays = {};
	let borkLine = "";
	let timeLine = "";
	for(let slot in packSlots) {
		for(let filter in packSlots[slot].filters) {
			let thisFilter = packSlots[slot].filters[filter];
			if(!thisFilter.match(/e:/))
				thisFilter += " e:" + setID //add set filter if it doesn't have a filter
			if(!filterArrays.hasOwnProperty(thisFilter)) {//add new filters to the object
				let scryResults = fuzzy.scryDatabase(library, thisFilter);
				filterArrays[thisFilter] = toolbox.shuffleArray(scryResults[0]);
				if(scryResults[2]) //lackeybot timed out
					timeLine += thisFilter + '\n';
				if(filterArrays[thisFilter].length == 0)
					borkLine += thisFilter + "\n";
			}
		}
	}
	if(borkLine != "")
		borkLine = "packSlots have still been saved, but the following filters match no cards. This may result in packs missing cards:\n" + borkLine;
	if(timeLine != "")
		borkLine += 'The following filters timed out. For best results, use a simpler filter:\n' + timeLine;
	return borkLine;
}

function genOldPack() { //Alpha thru Eventide
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("rare"), 1, packArray);
	packArray = genSlots(builtInSlots("old foil"), 1, packArray);
	return packArray;
}
function genEighthMythicPack() { //Shards thru M21, 1/8th chance of mythic
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genRegularPack() { //Zendikar Rising onwards, 1/7.4th chance of mythic
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genMastersPack() { //Masters sets guaranteed foil
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("master foil"), 1, packArray);
	return packArray;
}
function genJOUPack() { //JOU godpack
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	packArray = genSlots(builtInSlots("god pack"), 1, packArray);
	return packArray;
}
function genCNSPack() { //CNS & CN2
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("draft"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genISDPack() { //ISD/DKA
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("dfc"), 1, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genSOIPack() { //SOI/EMN
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("cudfc"), 1, packArray);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("rmdfc"), 1, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genTSPPack() { //TSP
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("rare"), 1, packArray);
	packArray = genSlots([["e:TSB"], [1]], 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genPLCPack() { //PLC
	let packArray = genSlots(builtInSlots("common"), 8, []);
	packArray = genSlots(builtInSlots("shifted common"), 3, packArray);
	packArray = genSlots(builtInSlots("uncommon"), 2, packArray);
	packArray = genSlots(builtInSlots("shifted unc/rare"), 1, packArray);
	packArray = genSlots(builtInSlots("rare"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genDOMPack() { //DOM
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 2, packArray);
	packArray = genSlots(builtInSlots("unclegend"), 1, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genDGMPack() { //DGM
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots([["t:Gate", "is:shockland"], [0.8, 0.2]], 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genFRFPack() { //FRF
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots([["r=c t:Land"], [1]], 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genGRNPack() { //GRN/RNA
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots([["r=c t:Gate"], [1]], 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genWARPack() { //WAR
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 2, packArray);
	packArray = genSlots(builtInSlots("uncwalker"), 1, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function gen2XMPack() { //2XM
	let packArray = genSlots(builtInSlots("common"), 8, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 2, packArray);
	packArray = genSlots(builtInSlots("master foil"), 2, packArray);
	return packArray;
}

function genMasterpiecePack(masterpiece) { //sets with a masterpiece set
	let packArray = genSlots(builtInSlots("common"), 11, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots([["e:" + masterpiece], [1], "else", 0, 0.00694, false], 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genBonusPack() { //TSPesque
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("bonus"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genMythiclessBonusPack() { //MS1/MS2
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("rare"), 1, packArray);
	packArray = genSlots(builtInSlots("bonus"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genNBPack() { //nonbasic
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("nonbasic"), 1, packArray);
	return packArray;
}
function genShiftedPack() { //Shifted
	let packArray = genSlots(builtInSlots("common"), 10, []);
	packArray = genSlots(builtInSlots("uncommon"), 3, packArray);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots(builtInSlots("shifted"), 1, packArray);
	packArray = genSlots(builtInSlots("land replace"), 1, packArray);
	packArray = genSlots(builtInSlots("foil"), 1, packArray);
	return packArray;
}
function genRaresPack() { //Rares
	let packArray = genSlots(builtInSlots("rare"), 9, []);
	packArray = genSlots(builtInSlots("old rare/mythic"), 1, packArray);
	packArray = genSlots([["r=r","r=m","r=l"], [0.875,0.0625,0.0625], "else", 0, 0.3334, true], 1, packArray);
	return packArray;
}
function genCubelikePack() { //Cubelike
	let packArray = genSlots(builtInSlots("rare"), 15, []);
	packArray = genSlots([["r=r"], [1], "else", 0, 0.3334, true], 1, packArray);
	return packArray;
}
function genSwappedPack() { //Swapped
	let packArray = genSlots(builtInSlots("rare"), 10, []);
	packArray = genSlots([["r=c", "r=u"], [0.875, 0.125]], 5, packArray);
	packArray = genSlots([["r=r","r=r","r=c","r=u","r=l"], [0.6875,0.1875,0.0547,0.0078,0.0625], "else", 0, 0.3334, true], 1, packArray);
	return packArray;
}
function genSlots(slotArray, iterate, array) {
	let filters = slotArray[0];
	let chances = slotArray[1];
	if(slotArray.length < 3) {
		for(let i = 0; i<iterate; i++)
			array.push({filters: filters, chances: chances});
	}else{
		let chanceFunction = slotArray[2];
		let replace = slotArray[3];
		let replaceChance = slotArray[4];
		let foil = slotArray[5];
		for(let i = 0; i<iterate; i++)
			array.push({filters: filters, chances: chances, chanceFunction: chanceFunction, replace: replace, replaceChance: replaceChance, foil: foil});
	}
	return array;
}
function assignCanonPack(setCode, release, masterpiece, setType) { //assigns built in packs to canon sets
	if(masterpiece)
		return genMasterpiecePack(masterpiece);
	if(setCode == "TSP")
		return genTSPPack();
	if(setCode == "PLC")
		return genPLCPack();
	if(setType == "masters")
		return genMastersPack();
	if(setCode == "CNS" || setCode == "CN2")
		return genCNSPack();
	if(setCode == "ISD" || setCode == "DKA")
		return genISDPack();
	if(setCode == "DGM")
		return genDGMPack();
	if(setCode == "JOU")
		return genJOUPack();
	if(setCode == "FRF")
		return genFRFPack();
	if(setCode == "SOI" || setCode == "EMN")
		return genSOIPack();
	if(setCode == "DOM")
		return genDOMPack();
	if(setCode == "GRN" || setCode == "RNA")
		return genGRNPack();
	if(setCode == "WAR")
		return genWARPack();
	if(setCode == "2XM")
		return gen2XMPack();
	if(release && release < 20081001)
		return genOldPack();
	if(release && release < 20200701)
		return genEighthMythicPack();
	return genRegularPack();
}
function writeDocs() { //writes packSlots documentation
	let pages = [];
	let ptPages = [];
	let line = "";
	//page 1
	line += "The uploadable database now supports ?open SET to open custom packs!";
	line += "\nBy default, packs use a default distribution (10C, 3U, 1R/M, 1L, 1/3 chance of foil), but this is highly customizable. ";
	line += "\nReact with ➡️ to see built-in distributions.";
	pages.push({header:"Introduction", page:line});
	ptPages.push({header:"Introduction", page:line});
	//page 2
	line = "There are three ways to set custom distributions. We will look over them in order of difficulty and control. ";
	line += "Pack distributions are set in ?fetch setup with the packSlots key, eg,\n";
	line += "`?fetch setup\npackSlots: Standard`\n";
	line += "LackeyBot supports the following:";
	line += "\n**Standard** (10C, 3U, 1R/M, 1L)";
	line += "\n**Bonus** (Replace L with Bonus rarity card)";
	line += "\n**Conspiracy** (Replace L with Conspiracy or draft-matters card)";
	line += "\n**Nonbasic** (Replace L with a card exported with `!note nbslot`)";
	line += "\n**Shifted** (Replace 1C with a card exported with `!note shifted`)";
	line += "\n**ISD** (Replaces a common with any DFC, like Innistrad.)";
	line += "\n**SOI** (Replace commons with a C/U and sometimes R/M DFCs, like SOI.)";
	line += "\n**DOM** (One uncommon guaranteed legendary, like Dominaria.)";
	line += "\n**WAR** (One uncommon guaranteed planeswalker, like War of the Spark.)";
	line += "\n**Custom** (See next page.)";
	line += "\nReact with ➡️ to see how to assign custom slots.";
	pages.push({header:"Built-in Packs", page:line});
	ptPages.push({header:"Built-in Packs", page:line});
	//page 3
	line = "Using `packSlots: Custom` allows you to adjust individual slots. "
	line += "This page will explain how to use built-in slots, the next will show how to program slots for even more power.\n";
	line += "Built-in slots use the structure [count]x Name, eg, `10x Common`\n";
	line += "LackeyBot supports the following:";
	line += "\n**Common**, **Uncommon**, **Rare**, **Mythic**, **Bonus**, **Special** (Guaranteed card of that rarity.)";
	line += "\n**Rare/Mythic** (Typical 1/7.4 mythic slot)";
	line += "\n**Any Card** (Equal chance to be any card in your set.)";
	line += "\n**UncLegend**, **UncWalker** (Uncommon Legend or Planeswalker like DOM and WAR)";
	line += "\n**DFC** (Guaranteed DFC of any rarity)";
	line += "\n**cuDFC** (Guaranteed common or uncommon DFC)";
	line += "\n**rmDFC** (1/8 chance of replacing a common with a rare or mythic DFC)";
	line += "\n**Nonbasic** (Guaranteed card exported with `!note nbslot`)";
	line += "\n**Shifted** (Guaranteed card exported with `!note shifted`)";
	line += "\n**Foil** (1/3 chance of replacing a common with a foil of any rarity)";
	line += "\n**Master Foil** (Replace a common with a foil of any rarity)";
	line += "\nReact with ➡️ to see advanced slot programming.";
	pages.push({header:"Built-in Slots", page:line})
	ptPages.push({header:"Built-in Slots", page:line})
	//page 4
	line = "Custom slots can be further customized by use of scryfall filters, chance probabilities, and replace functions. "
	line += "For example, the code to program the Rare/Mythic slot is:\n";
	line += "`1x filters: \"r=r\",\"r=m\" chances: 0.865,0.135`\n";
	line += "This slot will have a 86.5% chance to be a rare, and if that fails, it will have a 86.5+13.5 = 100% chance to be a mythic.\n";
	line += "The full structure is below. Parenthesis are not part of the command, and only show optional sections:\n";
	line += '`1x filters: "filter1"(,"filter2","filter3"...) chances:chance1(,chance2,chance3...) (replaceChance:chance) (replace:index) (foil:true/false) (chanceFunction:else/and/independent)`\n\n';
	line += "`filters` are scryfall queries in quotes and separated by commas, such as `\"r=r\",\"r=m\"`. Set filters will be automagically added.";
	line += "\n`chances` are the probability that each filter is chosen (with 1.0 being 100%). By default, these chances are additive, so `chances:0.5,0.5` will always get the second filter if the first fails.";
	//page 4.5
	ptPages.push({header:"Programmable Slots", page:line});
	var line2 = "\nThe following only apply to replacement slots, such as cards replacing a common:"
	line2 += "\n`replaceChance: chance` is the chance a replacement will happen.";
	line2 += "\n`replace: index` is the number of the card that should be replaced. This defaults to `replace:0` to replace the first card (generally a common). You can also do `replace: all` to do something like a Theros God Pack.";
	line2 += "\n`foil` marks if this card gets the foil star.";
	line2 += "\n`chanceFunction` takes one of three options: 'else' works like the rarity/mythic slot, where you're guaranteed to get exactly one. 'and' can replace one card with multiple cards. 'independent' gets at most one card, but might get nothing at all.";
	line2 += "\nReact with ➡️ to see further explanation of chanceFunction.";
	pages.push({header:"Programmable Slots", page:line, header2:"Replace Logic", page2:line2});
	ptPages.push({header:"Replace Logic", page:line2});
	//page 5 plain
	line = "Replace slots can use the chanceFunction key to modify how they replace cards.";
	line += "\n\n`chanceFunction: else` is the default. It gets a maximum of one card, making it best for 'cardA, or else cardB' effects like the rarity or mythic slot. A card is guaranteed if the chances sum to 1.";
	line += "\nExample, `chances:0.5,0.5` here means there is a 50% chance of card A, 50% chance of card B, and a 0% chance of no card or both cards.";
	line += "\n\n`chanceFunction: independent` gets a maximum of one card, but rerolls the chances each time, so a card is only guaranteed if one of the chances is 1.";
	line += "\nExample, `chances:0.5,0.5` here means there is a 50% chance of card A, 25% chance of card B, a 25% chance of no card, and a 0% chance of both cards.";
	line += "\n\n`chanceFunction: and` can get any number of cards, and rerolls the chances each time. This allows for pack distributions like Theros God Packs and Battlebond partners.";
	line += "\nExample, `chances:0.5,0.5` here means there is a 25% chance of just card A, 25% chance of just card B, a 25% chance of no card, and a 25% chance of both cards.";
	ptPages.push({header:"chanceFunction Details", page:line});
	//page 5 embed
	line = "Replace slots can use the chanceFunction key to modify how they replace cards.";
	line += "\n\n`chanceFunction: else` is the default. It gets a maximum of one card, making it best for 'cardA, or else cardB' effects like the rarity or mythic slot. A card is guaranteed if the chances sum to 1.";
	line += "\nExample, `chances:0.5,0.5` here means there is a 50% chance of card A, 50% chance of card B, and a 0% chance of no card or both cards.";
	line2 = "`chanceFunction: independent` gets a maximum of one card, but rerolls the chances each time, so a card is only guaranteed if one of the chances is 1.";
	line2 += "\nExample, `chances:0.5,0.5` here means there is a 50% chance of card A, 25% chance of card B, a 25% chance of no card, and a 0% chance of both cards.";
	let line3 = "`chanceFunction: and` can get any number of cards, and rerolls the chances each time. This allows for pack distributions like Theros God Packs and Battlebond partners.";
	line3 += "\nExample, `chances:0.5,0.5` here means there is a 25% chance of just card A, 25% chance of just card B, a 25% chance of no card, and a 25% chance of both cards.";
	pages.push({header:"chanceFunction Details", page:line, header2:"Independent", page2:line2, header3:"And", page3:line3});
	return [pages, ptPages];
}
function stringifyPackSlot(slot) {
	let out = "";
	for(let f in slot.filters)
		out += `${slot.chances[f]}: ${slot.filters[f]}|`
	out = out.replace(/\|$/, "");
	if(slot.chanceFunction)
		out += ` cf:${slot.chanceFunction}`;
	if(slot.hasOwnProperty("replace"))
		out += ` ${slot.replaceChance} chance to replace slot ${slot.replace}`
	if(slot.foii)
		out += " and is foil"
	return out;
}
exports.testPackFilters = testPackFilters;
exports.assignCanonPack = assignCanonPack;
exports.buildPackSlotsFrom = buildPackSlotsFrom;
exports.stringifyPackSlot = stringifyPackSlot;
exports.docs = docs;

var customSets = require('./msem/setData.json');
function formatThat (json) {
	json = json.replace(/"longname"/g, '\r\n\t"longname"');
	json = json.replace(/"Design"/g, '\r\n\t"Design"');
	json = json.replace(/"Link"/g, '\r\n\t"Link"');
	json = json.replace(/"releaseNo"/g, '\r\n\t"releaseNo"');
	json = json.replace(/"releaseDate"/g, '\r\n\t"releaseDate"');
	json = json.replace(/"Draft"/g, '\r\n\t"Draft"');
	json = json.replace(/"basics"/g, '\r\n\t"basics"');
	json = json.replace(/"masterpiece"/g, '\r\n\t"masterpiece"');
	json = json.replace(/"packSlots"/g, '\r\n\t"packSlots"');
	json = json.replace(/[}][\]][}],/g, '}]\r\n},\r\n');
	json = json.replace(/"packSlots":\[\]},/g, '"packSlots":[]},\r\n');
	return json;
}
function assignCustomPack(dist, masterpiece) { //assigns built in packs to msem sets
	if(dist == "Masterpiece")
		return genMasterpiecePack(masterpiece);
	if(dist == "Standard")
		return genRegularPack();
	if(dist == "Master")
		return genMythiclessBonusPack();
	if(dist == "Bonus")
		return genBonusPack();
	if(dist == "Swapped")
		return genSwappedPack();
	if(dist == "Rares")
		return genRaresPack();
	if(dist == "Cubelike")
		return genCubelikePack();
	if(dist == "Non")
		return [];
}
