/* Freshen
 Converts sms entries from fresh.txt to a json
*/

var fs = require('fs');
fs.readFile('./fresh.txt', 'utf8', function(err,data) {
	if(err) throw err;
	data = data.replace(/"/g, "\\\"");
	data = data.replace(/\r\n\r\n/g, '```",\n"```');
	data = data.replace(/\r\n/g, "\\n");
	data = '[\r\n"```' + data + '```"\r\n]'
	fs.writeFile('./fresh.json', data, function(err) {
		if(err) throw err;
	});
});