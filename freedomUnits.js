/*
 Freedom Units
 convert between metric and silly us units
*/
//unit matches
let prefixes = "(pico|nano|micro|milli|centi|deci|deca|deka|hecto|kilo|mega|giga|tera|p|n|μ|m|c|d|dk|da|h|k|M|G|T)"
let metric = "(gram|meter|celsius|liter|litre|g|m|C|L)"
let imperial = "(ounce|pound|ton|inch|foot|feet|yard|mile|farenheit|cup|quart|gallon|oz|lb|in|ft|yd|mi|F|q|gal)";
let regString = new RegExp(`([0-9\.-]+)? ?((${imperial}|${prefixes}?${metric}))`, 'i')
let regString2 = new RegExp(`to ((${imperial}|${prefixes}?${metric}))`, 'i')
let regMetric = new RegExp(`${prefixes}?${metric}`, 'i')
let regImperial = new RegExp(`${imperial}`, 'i');
//imperial to metric
function in_to_m (num) {			//return [in->m, m->in]
	return [num*.0254, num/.0254];
}
function faren_to_cel (num) {		//return [F->C, C->F]
	return [(num-32)*5/9, (9/5*num)+32];
}
function lb_to_g (num) {			//return [lb->g, g->lb]
	return [num*453.59237,num/453.59237];
}
function cup_to_L (num) {			//return [cup->L, L->cup]
	return [num*0.236588, num/0.236588];
}
//imperial subunits
function lb_to_oz (num) {			//return [oz->lb, lb->oz]
	return [num*16, num/16];
}
function lb_to_ton (num) {			//return [lb->ton, ton->lb]
	return [num/2000, num*2000];
}
function in_to_ft (num) {			//return [in->ft, ft->in]
	return [num/12, num*12];
}
function in_to_yd (num) {			//return [in->yd, yd->in]
	return [num/36, num*36]
}
function in_to_mi (num) {			//return [in->mi, mi->in]
	return [num/63360, num*63360]
}
function cup_to_q (num) {			//return [cup->q, q->cup]
	return [num/4, num*4];
}
function cup_to_gal (num) {			//return [cup->gal, gal->cup]
	return [num/16, num*16];
}
//metric subunits
function metricMulti(prefix) {				//return multiplier, ie cm => 0.01
	let multis = {
		"pico": 0.000000000001,
		"p": 0.000000000001,
		"nano": 0.000000001,
		"n": 0.000000001,
		"micro": 0.000001,
		"μ": 0.000001,
		"milli": 0.001,
		"m": 0.001,
		"centi": 0.01,
		"c": 0.01,
		"deci": 0.1,
		"d": 0.1,
		"deka": 10,
		"dk": 10,
		"deca": 10,
		"da": 10,
		"hecto": 100,
		"h": 100,
		"kilo": 1000,
		"k": 1000,
		"mega": 1000000,
		"giga": 1000000000,
		"g": 1000000000,
		"tera": 1000000000000,
		"t": 1000000000000
	}
	if(prefix === "M")
		return 1000000;
	if(multis[prefix.toLowerCase()])
		return multis[prefix.toLowerCase()];
	return 1;
}
//manager
let funcs = {
	"foot": [in_to_ft, "in"],
	"feet": [in_to_ft, "in"],
	"ft": [in_to_ft, "in"],
	"yard": [in_to_yd, "in"],
	"yd": [in_to_yd, "in"],
	"mile": [in_to_mi, "in"],
	"mi": [in_to_mi, "in"],
	"ounce": [lb_to_oz,"lb"],
	"oz": [lb_to_oz,"lb"],
	"ton": [lb_to_ton,"lb"],
	"quart": [cup_to_q,"cup"],
	"q": [cup_to_q,"cup"],
	"gallon": [cup_to_gal,"cup"],
	"gal": [cup_to_gal,"cup"],
	"meter": [in_to_m,"in"],
	"m": [in_to_m,"in"],
	"gram": [lb_to_g,"lb"],
	"g": [lb_to_g,"lb"],
	"liter": [cup_to_L,"cup"],
	"litre": [cup_to_L,"cup"],
	"l": [cup_to_L,"cup"],
	"c": [faren_to_cel,"f"]
}
function convertToBaseline (deets) {		//convert to consistent units
	if(deets[2]) { //change to meters/grams/liters
		deets[0] = deets[0] * metricMulti(deets[2]);
		deets[1] = deets[1].replace(deets[2], "")
		deets[2] = "";
	}
	//convert to inches/pounds/cups
	if(funcs[deets[1].toLowerCase()]) {
		deets[0] = funcs[deets[1].toLowerCase()][0](deets[0])[1];
		deets[1] = funcs[deets[1].toLowerCase()][1];
	}
	return deets;
}
function convertReader(string) {			//parse command
	let convertMatch = string.match(regString);
	let outputMatch = string.match(regString2);
	let outArray = [];
	if(convertMatch) {
		let num = parseFloat(convertMatch[1] || 1);
		let startUnit = convertMatch[2];
		outArray.push(num);
		outArray.push(startUnit);
		let startPrefix = convertMatch[5];
		if(startUnit.match(regImperial))
			startPrefix = "";
		let deets = [num, startUnit, startPrefix];
		let metricStart = startUnit.match(regMetric);
		//convert to baseline
		deets = convertToBaseline(deets) //[N, 'in'/'cup'/'lb'/'f']
		let outs = [], outFix;
		if(outputMatch) {				//convert to a specific thing
			if(outputMatch[5] && outputMatch[5].toLowerCase() != deets[1].toLowerCase()) {
				outs = [outputMatch[5]];
				outFix = outputMatch[4];
			}else if(outputMatch[4] && outputMatch[4].toLowerCase() != deets[1].toLowerCase()){
				outs = [outputMatch[4]];
				outFix = outputMatch[4];
			}else if(outputMatch[3] && outputMatch[3].toLowerCase() != deets[1].toLowerCase()){
				outs = [outputMatch[3]];
				outFix = "";
			}
		}
		else if(startUnit.match(regMetric)) {			//metric is done
			
		}
		else if(deets[1].toLowerCase() == "in") {		//imperial length to meters
			outs = ["m"];
		}
		else if(deets[1].toLowerCase() == "cup") {		//imperial volume to liters
			outs = ["l"];
		}
		else if(deets[1].toLowerCase() == "lb") {		//imperial mass to grams
			outs = ["g"];
		}else if(deets[1].toLowerCase() == "f") {		//farenheit to celsius
			outs = ["c"];
		}
		//console.log(deets);
		//console.log(outs);
		for(let u in outs) {
			let thisU = outs[u];
			let thisFunc = funcs[thisU.toLowerCase()];
			deets[0] = thisFunc[0](deets[0])[0];
			deets[1] = thisU;
			if(outFix) {
				deets[0] = deets[0] / metricMulti(outFix)
				deets[1] = outFix + deets[1]
			}
		}
		outArray.push(parseFloat(deets[0].toPrecision(6)))
		outArray.push(deets[1]);
	}
	return outArray;
}
function unitFormat(string) {				//fix up oddballs
	let outs = string.match(/^(f|c|(m)L)$/i);
	if(outs) {
		if(string == "f")
			return "F";
		if(string == "c")
			return "C";
		if(string.match(/L$/i))
			return outs[2] + "L";
	}
	return string;
}
function convertWriter (cA) {
	return `${cA[0]} ${unitFormat(cA[1])} is equal to ${cA[2]} ${unitFormat(cA[3])}.`
}
function convertUnits (string) {
	let cA = convertReader(string);
	return convertWriter(cA);
}
function unitTests() {
	let strings = {
		//metric conversion
		"100cm to m":			[100, "cm", 1, "m"],
		"2m to cm":				[2, "m", 200, "cm"],
		"27mL to L":			[27, "mL", 0.027, "L"],
		"27L to mL":			[27, "L", 27000, "mL"],
		"5000g to kg":			[5000, "g", 5, "kg"],
		".5kg to g":			[0.5, "kg", 500, "g"],
		//imperial conversions
		"24in to ft":			[24, "in", 2, "ft"],
		"36in to yd":			[36, "in", 1, "yd"],
		"63360in to mi":		[63360, "in", 1, "mi"],
		"1yd to ft":			[1, "yd", 3, "ft"],
		"1mi to yd":			[1, "mi", 1760, "yd"],
		"4cup to quart":		[4, "cup", 1, "quart"],
		"4cup to gal":			[4, "cup", 0.25, "gal"],
		"4quart to gal":		[4, "quart", 1, "gal"],
		"16oz to lb":			[16, "oz", 1, "lb"],
		"16oz to ton":			[16, "oz", 0.0005, "ton"],
		"1ton to oz":			[1, "ton", 32000, "oz"],
		"1ton to lb":			[1, "ton", 2000, "lb"],
		//cross conversion
		"1in to cm":			[1, "in", 2.54, "cm"],
		"30.48cm to ft":		[30.48, "cm", 1, "ft"],
		"0C to F":				[0, "C", 32, "F"],
		"32F to C":				[32, "F", 0, "C"],
		"-40F to C":			[-40, "F", -40, "C"],
		"1gal to L":			[1, "gal", 3.78541, "L"],
		"1gal to mL":			[1, "gal", 3785.41, "mL"]
	}
	for(let s in strings) {
		let check = convertWriter(strings[s]);
		let output = convertUnits(s);
		if(output != check) {
			console.log(`Error at ${s}`);
			console.log(`Expected value ${check}`);
			console.log(`Calculated value ${output}`);
		}
	}
	console.log("Tests complete");
}
//unitTests();
exports.convertUnits = convertUnits;