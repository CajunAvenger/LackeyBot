/* ZipTech
 Edit MSE files with jszip
*/

var toolbox = require('./toolbox.js');
var fs = require('fs')
var cards = require('./msem/cards.json')

var JSZip = require("jszip");

function writeZip(zip, zipName, cb) {
	zip
	.generateNodeStream({type:'nodebuffer',streamFiles:false})
	.pipe(fs.createWriteStream(zipName))
	.on('finish', function () {
		console.log(zipName + " written.");
		if(cb)
			cb()
	});
}
function dataFromZip(zipName, cb) {
	fs.readFile(zipName, function(err, data) {
		if (err) throw err;
		JSZip.loadAsync(data).then(async function (zip) {
			cb(zip);
		});
	})
}
function addToZip(zipName, fileName, fileContent, cb) { //add a file to an existing zip
	fs.readFile(zipName, function(err, data) {
		if (err) throw err;
		JSZip.loadAsync(data).then(async function (zip) {
			zip.file(fileName, fileContent, {binary:false})
			//console.log(zip.files.set._data)
			//zip.files.set._data.compression.magic = '\b\u0000'
			writeZip(zip, zipName, cb);
		});
	});
}
function editZip(zipName, fileName, cb, cb2) { //edit an existing file in the zip
	fs.readFile(zipName, function(err, data) {
		if (err) throw err;
		JSZip.loadAsync(data).then(async function (zip) {
			let content = await zip.file(fileName).async("string");
			content = cb(content);
			zip.file('set', content, {binary:false})
			//console.log(zip.files.set._data)
			//zip.files.set._data.compression.magic = '\b\u0000'
			writeZip(zip, zipName, cb2);
		});
	});
}
//editZip("ziptest2/101 test.mse-set", "set");

exports.editZip = editZip;
exports.addToZip = addToZip;
exports.dataFromZip = dataFromZip;