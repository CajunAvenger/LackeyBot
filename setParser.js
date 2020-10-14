var fs = require('fs');
var testcbs = function(name, fieldText, killNote){
	let newOutput = "";
	killNote = "https://discordapp.com/channels/190309853296590848/367816828287975425/765389191332626476";
	let mainFields = fieldText.split(/(?:^|\n)\t(?!\t)/); //things one tab in
	/*if(name == "set_info") {
		for(let f in mainFields)
			newOutput += "\t" + mainFields[f];
	}else if(name == "styling") {
		for(let f in mainFields) {
			let subFields = mainFields[f].split(/(?:^|\n)\t\t(?!\t)/); //things a second tab in
		}
	}else */
	if(name == "card") {
		if(!fieldText.match("note: " + killNote)) {
			newOutput = fieldText;
		}
	}else{
		return name + ":\n" + fieldText;
	}
	return name + ":\n" + newOutput;
}
var moxcbs = function(name, fieldText, killNote){
	let newOutput = "";
	killNote = "https://discordapp.com/channels/190309853296590848/367816828287975425/765388851161071616";
	let mainFields = fieldText.split(/(?:^|\n)\t(?!\t)/); //things one tab in
	/*if(name == "set_info") {
		for(let f in mainFields)
			newOutput += "\t" + mainFields[f];
	}else if(name == "styling") {
		for(let f in mainFields) {
			let subFields = mainFields[f].split(/(?:^|\n)\t\t(?!\t)/); //things a second tab in
		}
	}else */
	if(name == "card") {
		if(!fieldText.match("notes: " + killNote))
			newOutput = fieldText;
	}else{
		return name + ":\n" + fieldText;
	}
	if(!newOutput)
		return "";
	return name + ":\n" + newOutput;
}
function fieldParser(field, cbs) {
	let nameMatch = field.match(/^([A-z0-9_]+):\n([\s\S]*)/i);
	if(nameMatch) {
		let adding = cbs(nameMatch[1], nameMatch[2]);
		return adding;
	}else{
		return field; //some weird thing that we're not going to edit
	}
}
function fileParser(data, cbs) {
	let splits = data.split(/(?:^|\n)(?!\t)/);
	let newOutput = "";
	for(let f in splits) {
		newOutput += fieldParser(splits[f], cbs) + "\n";
	}
	return newOutput
}
exports.fileParser = fileParser;
exports.fieldParser = fieldParser;
exports.moxcbs = moxcbs;