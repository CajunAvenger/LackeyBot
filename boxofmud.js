/* Box of Mud
 i really hate dropbox
*/
var config = require('./config/lackeyconfig.js').config;
var fetch = require('isomorphic-fetch');
var fs = require('fs');
var Dropbox = require('dropbox').Dropbox;
const dbx = new Dropbox({ accessToken: config.dropbox, fetch:fetch});
var download = require('download-file');

function dropboxUpload (path, contents, callback) {			//uploads to dropbox with optional callback
	dbx.filesUpload({ path: path, contents: contents, mode: 'overwrite'})
        .then(function (response) {
			console.log("dropboxUpload(): " + path + " uploaded to Dropbox");
			if(callback)
				callback();
		})
        .catch(function (error) {
			console.error(error);
		});
}
function dropboxDownload(path, downLink, callback, big) {	//downloads from dropbox with optional callback
	if(big) {
		dbx.filesGetTemporaryLink({path:downLink})
			.then(function(result) {
				download(result.link, {directory:"./", filename:path}, function(err) {
					if(err)
						console.log(err);
					if(callback)
						callback();
				});
			})
			.catch(e => console.log(e))
	}else{
		if(downLink.match(/^http/)) {
			dbx.sharingGetSharedLinkFile({url:downLink})
				.then(function(data) {
					if(big) {
						fs.writeFileSync(path, data.fileBinary, 'binary')
						if(callback)
							callback()
					}else{
						fs.writeFile(path, data.fileBinary, 'binary', function(err) {
							if (err) throw err;
							if(callback != undefined && callback != null)
								callback();
						});
					}
				})
				.catch(function(err){console.log(err)})
		}else{
			dbx.filesDownload({path:downLink})
				.then(function(data) {
					fs.writeFile(path, data.fileBinary, 'binary', function(err) {
						if(err) throw err;
						if(callback != undefined && callback != null)
							callback();
					});
				})
				.catch(function(err){console.log(err)})
		}
	}
}

exports.dbx = dbx;
exports.dropboxDownload = dropboxDownload;
exports.dropboxUpload = dropboxUpload;