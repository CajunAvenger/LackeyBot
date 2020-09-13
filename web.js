/* Web
 LackeyBot website, under a lot of testing.
*/
const express = require('express');
const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const Server = require('ws').Server;
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 1000);


/*
const http = require('http');
const express = require('express');
const app = express();
const port = process.env.PORT || 4000;
const INDEX = '/index.html'
var Server = require('ws').Server;
const wss = new Server({port:5000});

app.set('view engine', 'ejs');
app.use(express.static(__dirname));


app.use(function(req, res) {
	res.sendFile(INDEX, {root: __dirname})
})
app.listen(port, () => {
    // will echo 'Our app is running on http://localhost:5000 when run locally'
    console.log('Our app is running on http://localhost:' + port);
});
app.get('/public', function (req, res) {
	res.send('Hello world')
})
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});
setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 1000);
*/