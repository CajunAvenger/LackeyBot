/* Boom
 Used for small script testing 
*/

var toolbox = require('./toolbox.js');
var fs = require('fs')
var cards = require('./msem/cards.json')

var JSZip = require("jszip");

function writeZip(zip, zipName) {
	zip
	.generateNodeStream({type:'nodebuffer',streamFiles:false})
	.pipe(fs.createWriteStream(zipName))
	.on('finish', function () {
		console.log(zipName + " written.");
	});
}
function readZip(zipName, fileName) {
	fs.readFile(zipName, function(err, data) {
		if (err) throw err;
		JSZip.loadAsync(data).then(async function (zip) {
			let content = await zip.file(fileName).async("string");
			content = content.replace(/Azamir/g, "Rimaza");
			zip.file('set', content, {binary:false})
			//console.log(zip.files.set._data)
			//zip.files.set._data.compression.magic = '\b\u0000'
			writeZip(zip, zipName);
		});
	});
}
readZip("ziptest2/101 test.mse-set", "set");