const level = require('level');
const keygen = require('./keygen.js');
const net = require('net');
const helpers = require('./helpers.js');

//---------------
var port = 43329;
var neighbors = [];
var mine = true;
var difficulty = 4; //currently in # of zeroes
//---------------

var unconfirmedTX = [];
var currentBlock = {};
var previousBlock = {};
var blockHeight = 0;
var address = "";

var UTXODB = level('./DB/UTXODB');
var BLOCKDB = level('./DB/BLOCKDB');
var CLIENTDB = level('./DB/CLIENTDB');

CLIENTDB.get('address', function (err, value) {
	if(err && err.type == 'NotFoundError'){
		console.log("Generating new address!");
		var keypair = keygen.genPair();
		CLIENTDB.put('address', keypair.address, function (err) {
			if (err) return console.log('Ooops!', err);
		});
		CLIENTDB.put('privateKey', keypair.privateKey, function (err) {
			if (err) return console.log('Ooops!', err);
		});
		address = keypair.address;
	}else{
		address = value;
	}
	CLIENTDB.get('blockHeight', function (err, value) {
		if(err && err.type == 'NotFoundError'){
			CLIENTDB.put('blockHeight', 0, function (err) {
				if (err) return console.log('Ooops!', err);
			});
		}else{
			blockHeight = value;
		}
		clientReady();
	});
});

var clientReady = function(){
	console.log("Client running with address: " + address);
	
	var server = net.createServer(function(socket) {
		socket.pipe(socket);
		
		socket.on('data', function(data) {
			try{
				pData = JSON.parse(data.toString());
				switch(pData.type){
					case "blockHeightRequest":
						var response = {type: "blockHeight", blockHeight: blockHeight};
						socket.write(JSON.stringify(response));
						break;
					case "blockRequest":
						var blockArray = [];
						for(var i = pData.height; i < blockHeight; i++){
							BLOCKDB.get(i, function (err, value) {
								blockArray.push(value);
							});
						}
						while(blockArray.length < blockHeight-pData.height){
						}
						
						var response = {type: "blockArray", blockArray: blockArray};
						socket.write(JSON.stringify(response));
						break;
				}
			}catch(e){
			}
		});
		
		socket.on('error', function(err) {
			return;
		});
	});
	server.listen(port, '127.0.0.1');
	
	synch();
	
	if(mine){
		//mine();
	}
}

var synch = function(){
	var client = new net.Socket();
		
	client.connect(5555, '127.0.0.1', function() {
		var request = {type: "blockHeightRequest"};
		client.write(JSON.stringify(request));
	});

	client.on('data', function(data) {
		try{
			var pData = JSON.parse(data.toString());
			switch(pData.type){
				case "blockHeight":
					console.log("Current block height: " + blockHeight);
					console.log("Remote block height: " + pData.blockHeight);
					if(blockHeight < pData.blockHeight){
						var request = {type: "blockRequest", height: blockHeight};
						client.write(JSON.stringify(request));
					}
					break;
				case "blockArray":
					for(var i = 0; i < blockArray.length; i++){
						console.log("Recieved block " + i);
					}
					break;
			}
		}catch(e){
		}
	});

	client.on('close', function() {
		console.log('Connection closed');
	});
}

var mine = function(){
	if(!previousBlock){
		BLOCKDB.get(blockHeight, function (err, value) {
			previousBlock = JSON.parse(value);
			previousBlock.data = JSON.parse(previousBlock.data);
			mine();
		});
		return;
	}
	
	var previousHash = previousBlock.hash;
	var height = previousBlock.data.height + 1;
	var merkleRoot;
	var timestamp;
	var nonce = 0;
	
	let found = false;
	let hashesPerSec = 0;
	let lastTime = Math.round((new Date()).getTime() / 1000);
	while(!found){
		currentBlock.nonce = nonce;
		const data = JSON.stringify(currentBlock);
		const hash = helpers.sha256(data);
		if(hash.substring(0,difficulty) == new Array(difficulty + 1).join("0")){
			found = true;
			var completeBlock = {hash: hash, data: data};
			BLOCKDB.put('address', keypair.address, function (err) {
				if (err) return console.log('Ooops!', err);
			});
			hash
			mine();
			return;
		}
		nonce++;
		hashesPerSec++;
		const time = Math.round((new Date()).getTime() / 1000);
		if(time - lastTime == checkTime){
			process.stdout.write('\033c');
			console.log("Mining " + desc + " at " + ((hashesPerSec/checkTime)/1000000).toFixed(2) + "MH/s");
			lastTime = time;
			hashesPerSec = 0;
		}
	}
}