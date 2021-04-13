/* Crunch
 Converts the canon CR text file into a json.
 Could use some cleanup, currently processes the file twice:
 Once to a now outdated json, then again with a translation script to the current
 Made a translator rather than a whole new processor and isn't hugely worth to recode
*/

var fs = require('fs')
var ruleJson = {}//require('./canon/cr.json');
var format = "canon";
var patch = false;
if(process.argv[2] != undefined) {
	format = process.argv[2];
	if(format == "revolution")
		patch = './revCRPatch.txt';
	if(format == "msem")
		patch = './msemCRPatch.txt';
}
const bigAZArray = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"]
const azArray = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"]

function fuzzySearch (needle,thread,needlescore) { //scoring function for the search
	let charScore = 1; stringBonus = 0.5; newstart = 0;
	if(thread.length > 65) { //for very long names, reduce the score
		charScore = 0.5; stringBonus = 1;
	}
	needleLine: for (var i = 0; i < needle.length; i++) { //for each character in the search string
		for (var j = newstart; j < thread.length; j++){ //
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
function matchCommand(string, array) {
	let bestMatch = ["",0];
	for(let thisElement in array) {
		let i = fuzzySearch(string, array[thisElement], 0);
		if(i>bestMatch[1])
			bestMatch = [array[thisElement], i]
	}
	return bestMatch[0];
}
function processFile(datum) {
	ruleJson = {};
	ruleJson.glossary = {};
	for(let d in datum) {
		let data = datum[d];
		data = data.replace(/\r\n/g, "\n");
		let splits = data.split("Glossary");
		let testString = splits[1];
		let glossary = splits[2].split("Credits")[0];
		var ruleBlocks = testString.match(/[A-Z]?[0-9]{3}\.[0-9]*(\.|[a-z])? [^\n]*(\nExample:[^\n]+)?/g);
		for(let block in ruleBlocks) {
			let ruleName = ruleBlocks[block].match(/([A-Z]?[0-9]{3})\.([0-9]*)(\.|[a-z])? ([\s\S]*)/);
			let ruleCategory = ruleName[1]; //101
			let ruleNumber = ruleName[2]; //2
			let ruleSub = ruleName[3]; //b
			if(ruleSub == ".")
				ruleSub = "";
			let ruleText = ruleName[4];
			//console.log(ruleCategory + "." + ruleNumber + ruleSub);
			let ruleLetter = ruleBlocks[block].match(/^[A-Z]/);
			if(ruleLetter) { //custom rule
				if(!ruleJson.hasOwnProperty(ruleCategory))
					ruleJson[ruleCategory] = {rule:"", subrules:{}}
				if(ruleNumber && !ruleJson[ruleCategory].subrules.hasOwnProperty(ruleNumber))
					ruleJson[ruleCategory].subrules[ruleNumber] = {rule:"", subrules:{}}
				if(ruleSub && !ruleJson[ruleCategory].subrules[ruleNumber].subrules.hasOwnProperty(ruleSub))
					ruleJson[ruleCategory].subrules[ruleNumber].subrules[ruleSub] = {rule:""}
				if(ruleSub) {
					ruleJson[ruleCategory].subrules[ruleNumber].subrules[ruleSub].rule = ruleText;
					ruleJson[ruleCategory].subrules[ruleNumber].subrules[ruleSub].letter = ruleLetter;
				}
				else if(ruleNumber) {
					ruleJson[ruleCategory].subrules[ruleNumber].rule = ruleText;
					ruleJson[ruleCategory].subrules[ruleNumber].letter = ruleLetter;
				}
				else{
					ruleJson[ruleCategory].rule = ruleText;
					ruleJson[ruleCategory].letter = ruleLetter;
				}
			}
			else if(!ruleJson.hasOwnProperty(ruleCategory)) {
				ruleJson[ruleCategory] = {rule: ruleText, subrules:{}};
			}
			else if(!ruleJson[ruleCategory].subrules.hasOwnProperty(ruleNumber)){
				ruleJson[ruleCategory].subrules[ruleNumber] = {rule: ruleText, subrules:{}};
			}
			else if(!ruleJson[ruleCategory].subrules[ruleNumber].subrules.hasOwnProperty(ruleSub)){
				ruleJson[ruleCategory].subrules[ruleNumber].subrules[ruleSub] = {rule: ruleText};
			}
			else{
				ruleJson[ruleCategory].subrules[ruleNumber].subrules[ruleSub] = {rule: ruleText};
			}
		}
		
		var glossaBlocks = glossary.split("\n\n");
		for(let block in glossaBlocks) {
			let glossMatch = glossaBlocks[block].match(/([^\n]+)\n([\s\S]+)/);
			if(glossMatch) {
				let glossName = glossMatch[1];
				let glossText = glossMatch[2];
					if(glossName.match(", “")){
						glossNames = glossName.match(/([^,]+), “([^”]+)/);
						ruleJson.glossary[glossNames[1]] = glossText;
						ruleJson.glossary[glossNames[2]] = glossText;
					}else{
						glossName = glossName.replace(/ ?\(Obsolete\)/, "");
						ruleJson.glossary[glossName] = glossText;
					}
			}
		}
	}
}
function splitter(rul) {
		let split = rul.match(/([A-Z]?)(\d+)\.?(\d*)([a-z]*)/);
		for(let s in split) {
			if(split[s] == undefined) {
				split[s] = 0;
			}else if(bigAZArray.includes(split[s])) {
				split[s] = bigAZArray.indexOf(split[s])
			}else if(azArray.includes(split[s])) {
				split[s] = azArray.indexOf(split[s])
			}else{
				split[s] = parseInt(split[s])
				if(isNaN(split[s]))
					split[s] = 0;
			}
		}
		split.splice(0, 1);
		return split;
	}
function reprocessFile() { //crunch2
	let newJson = {
		"rules": {},
		"glossary": {}
	}
	let extend = {
		"1": "100",
		"2": "200",
		"3": "300",
		"4": "400",
		"5": "500",
		"6": "600",
		"7": "700",
		"8": "800",
		"9": "900",
		"g": "glossary"
	}
	for(let mainRule in ruleJson) {
		if(mainRule == "glossary") {
			newJson.glossary = ruleJson.glossary;
		}else{
			let bucket = newJson['rules'];
			let l = "";
			//if(ruleJson[mainRule].letter)
				//l = ruleJson[mainRule].letter;
			bucket[l+mainRule] = [ruleJson[mainRule].rule];
			for(let subrule in ruleJson[mainRule].subrules) {
				let thisSubrule = ruleJson[mainRule].subrules[subrule];
				let sl = "";
				//if(thisSubrule.letter)
					//sl += thisSubrule.letter;
				bucket[l+mainRule].push(sl+mainRule+"."+subrule)
				bucket[sl+mainRule+"."+subrule] = [thisSubrule.rule];
				for(let subsubrule in thisSubrule.subrules) {
					let thisSubSubrule = thisSubrule.subrules[subsubrule];
					let ssl = "";
					//if(thisSubSubrule.letter)
						//ssl += thisSubSubrule.letter;
					bucket[l+mainRule].push(ssl+mainRule+"."+subrule+subsubrule)
					bucket[sl+mainRule+"."+subrule].push(ssl+mainRule+"."+subrule+subsubrule)
					bucket[ssl+mainRule+"."+subrule+subsubrule] = [thisSubSubrule.rule];
				}
			}
		}
	}
	let newerJson = {rules:{}, glossary:{}};
	let optiHold = {};
	let names = Object.keys(newJson.rules).sort(function(a, b) {
		let aA, bA;
		if(optiHold[a]) {
			aA = optiHold[a];
		}else{
			optiHold[a] = splitter(a);
			aA = optiHold[a];
		}
		if(optiHold[b]) {
			bA = optiHold[b];
		}else{
			optiHold[b] = splitter(b);
			bA = optiHold[b];
		}
		let result = aA[1] - bA[1];
		if(result)
			return result;
		result = aA[0] - bA[0];
		if(result)
			return result;
		result = aA[2] - bA[2];
		if(result)
			return result;
		result = aA[3] - bA[3];
		return result;
	});
	let objString = '{\r\n\t"rules": {'
	for(let name in names) {
		objString += '\r\n\t\t"' + names[name] + '":['
		let temp = "";
		for(let bit in newJson.rules[names[name]])
			temp += `"${newJson.rules[names[name]][bit]}",`;
		temp = temp.replace(/,$/,"").replace(/\n/g, "\\n");
		objString += temp;
		objString += "],";
	}
	objString = objString.replace(/,$/, "},");
	objString += '\r\n\t"glossary": {'
	for(let name in newJson.glossary) {
		objString += '\r\n\t\t"' + name + '":["' + newJson.glossary[name].replace(/\n/g, "\\n") + '"],'	
	}
	objString = objString.replace(/,$/, "\r\n\t}\r\n}")
	newerJson.glossary = newJson.glossary;
	fs.writeFile(format + '/cr.json', objString, function(err){
		if(err)
			console.log(err);
	});
}
function writeRule (testRul) {
	let output = "";
	let rulMatch = testRul.match(/([0-9]{3})\.?([0-9]*)(\.|[a-z])?/);
	if(rulMatch) {
		if(ruleJson.hasOwnProperty(rulMatch[1]) && (!rulMatch[2] || ruleJson[rulMatch[1]].subrules.hasOwnProperty(rulMatch[2])) && (!rulMatch[3] || ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules.hasOwnProperty(rulMatch[3]))) {
			if(rulMatch[3]) {
				output = "**" + rulMatch[1] + "." + rulMatch[2] + rulMatch[3] + "** " + ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules[rulMatch[3]].rule;
			}else if(rulMatch[2]) {
				output = "**" + rulMatch[1] + "." + rulMatch[2] + ".** " + ruleJson[rulMatch[1]].subrules[rulMatch[2]].rule;
				for(let sub in ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules)
					output += "\n**" + rulMatch[1] + "." + rulMatch[2] + sub + "** " + ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules[sub].rule;
			}else if(rulMatch[1]) {
				output = "**" + rulMatch[1] + ".** " + ruleJson[rulMatch[1]].rule;
				if(ruleJson[rulMatch[1]].hasOwnProperty('subrules'))
					output += "\n**" + rulMatch[1] + ".1** " + ruleJson[rulMatch[1]].subrules[1].rule;
			}
		}else{
			return "Rule not found.";
		}
	}else{
		let testArray = Object.keys(ruleJson.glossary);
		let bestMatch = matchCommand(testRul, testArray);
		output = "**" + bestMatch + "**\n" + ruleJson.glossary[bestMatch];
		let rulMatch = output.match(/([0-9]{3})\.([0-9]*)(\.|[a-z])?/);
		if(rulMatch) {
			if(rulMatch[3]) {
				output += "\n**" + rulMatch[1] + "." + rulMatch[2] + rulMatch[3] + "** " + ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules[rulMatch[3]].rule;
			}else if(rulMatch[2]) {
				output += "\n**" + rulMatch[1] + "." + rulMatch[2] + ".** " + ruleJson[rulMatch[1]].subrules[rulMatch[2]].rule;
				for(let sub in ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules)
					output += "\n**" + rulMatch[1] + "." + rulMatch[2] + sub + "** " + ruleJson[rulMatch[1]].subrules[rulMatch[2]].subrules[sub].rule;
			}
		}
	}
	output = output.replace(/(rule [0-9]{3}\.?[0-9]*\.?[a-z]?)/g, '`$1`')
	return output;
}
function writeCR() {
	fs.readFile('./cr.txt', "utf8", function read(err, data) {
		if(err) throw err;
		if(patch) {
			fs.readFile(patch, "utf8", function read2(err, data2) {
				if(err) throw err;
				processFile([data, data2]);
				reprocessFile(); //redid the database, made a translator, easier to autotranslate than recode to start there x.x
			})
		}else{
			processFile([data]);
			reprocessFile(); //redid the database, made a translator, easier to autotranslate than recode to start there x.x
		}
	});
}
writeCR()
var testStrings = ["!cr overload", "!cr 101.1"];
/*for(let string in testStrings) {
	let crMatch = testStrings[string].match(/!cr ([^!]+)/);
	writeRule(crMatch[1])
}*/

//remove card
//split bands and bands with other
//partner, partner with
//kill obsolete tags
//change ’