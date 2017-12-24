const net = require('net');
const level = require('level');
const chalk = require('chalk');
const helpers = require('./helpers.js');
const keygen = require('./keygen.js');
const fs = require('fs');
const exec = require('child_process').execFile;

const difficulty = 6;
const target = "0".repeat(difficulty) + "f".repeat(64-difficulty);

const checkTime = 1; //amount of time between hashrate displays

const merkleTreeHashDispLength = 4;
const indexMerkleTreeHashOne = true;

var fakeTransactions = 16;

var serverPort = parseInt(process.argv[2]);
var serverVerbose = false;
var clientVerbose = false;

var neighborPort = parseInt(process.argv[3]);
var neighborAddress = process.argv[4];

var blocks = [];

var neighbors = [{port: neighborPort, address: neighborAddress}];
var unconfirmedTX = [];
var blockHeight = "EMPTY";
var address = "";

var UTXODB = level('./DB/UTXODB' + serverPort);
var BLOCKDB = level('./DB/BLOCKDB' + serverPort);
var CLIENTDB = level('./DB/CLIENTDB' + serverPort);

var server = null;
var miningProc = null;

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
			CLIENTDB.put('blockHeight', "EMPTY", function (err) {
				if (err) return console.log('Ooops!', err);
			});
		}else{
			blockHeight = value;
			getBlocksFromDB(blockHeight);
		}
		startUp();
	});
});

class MerkleNode {
	constructor(parentNode, childNode0, childNode1, transaction) {
		this.parentNode = parentNode;
		this.childNodes = [];
		this.childNodes[0] = childNode0;
		this.childNodes[1] = childNode1;
		this.transaction = transaction;
	}
	computeHash() {
		if(this.transaction != null){
			this.hash = helpers.sha256(JSON.stringify(this.transaction));
		}else{
			this.hash = helpers.sha256(this.childNodes[0].hash + this.childNodes[1].hash);
		}
	}
	setParentNode(parentNode){
		this.parentNode = parentNode;
	}
	setChildNode(index, childNode){
		this.childNodes[index] = childNode;
	}
	getHash() {
		return this.hash;
	}
}

const compareNode = function(a, b){
	if (a.getHash() < b.getHash())
		return -1;
	if (a.getHash() > b.getHash())
		return 1;
	return 0;
}

var genTree = function(block){
	var leveledHashes = [];
	var transactions = block.transactions;
	transactions.sort();
	let cL = 0;
	
	let root = false;
	leveledHashes[cL] = [];
	for(let i = 0; i < transactions.length; i++){ //go through each transaction,
		let newNode = new MerkleNode(null, null, null, transactions[i]); //add each one to a new merkle node
		newNode.computeHash(); //compute the hash
		leveledHashes[cL].push(newNode); //push to the current (bottom) level of the tree
	}
	leveledHashes[cL].sort(compareNode); //sort the base row
	var count = 0;
	while(!root){ //while we're below the root node
		cL++; //increase our current level
		leveledHashes[cL] = [];
		if(leveledHashes[cL-1].length % 2 != 0){ //if the number of hashes in the previous level is not even
			leveledHashes[cL-1].push(leveledHashes[cL-1][leveledHashes[cL-1].length-1]); //duplicate the last hash
		}
		for(let i = 0; i < leveledHashes[cL-1].length; i++){ //loop through the hashes in the previous level
			if(i%2 == 0){ //if the index is even
				var newNode = new MerkleNode(null, leveledHashes[cL-1][i], leveledHashes[cL-1][i+1], null); //make a new node at the current level, with children of the two below nodes.
				newNode.computeHash(); //compute hash from children
				leveledHashes[cL-1][i].setParentNode(newNode); //set children to ref parent
				leveledHashes[cL-1][i+1].setParentNode(newNode); //set children to ref parent
				leveledHashes[cL].push(newNode); //add the new node to the current level
			}
		}
		if(leveledHashes[cL].length == 1){
			root = true;
			block.hashedData.merkleRoot = leveledHashes[cL][0].getHash();
		}
	}
	process.stdout.write(" ".repeat(4));
	for(var i = 0; i < leveledHashes[0].length; i++){
		var index = i;
		if(indexMerkleTreeHashOne){ //let's make this ez
			index++;
		}
		var spaceCount = merkleTreeHashDispLength-(index.toString().length-1);
		var spaceString = " ".repeat(spaceCount);
		process.stdout.write(chalk.gray(index + spaceString));
	}
	process.stdout.write("\n");
	
	for(var i = 0; i < leveledHashes.length; i++){ //print tree
		var lastHash = "";
		process.stdout.write("L" + i + ": ");
		for(var j = 0; j < leveledHashes[i].length; j++){
			var curHash = leveledHashes[i][j].getHash();
			var curHashReady = curHash.substring(0, merkleTreeHashDispLength) + " ";
			if(curHash == lastHash){
				process.stdout.write(chalk.cyan(curHashReady));
			}else{
				process.stdout.write(curHashReady);
			}
			lastHash = curHash;
		}
		process.stdout.write("\n");
	}
	process.stdout.write("\n");
}

var normalize = function(block){
	block.data = JSON.stringify(block.hashedData);
	delete block.hashedData;
}

var currentBlockHeight;
var currentBlock;
var prevTime;

var mine = function(block){
	var height = block.hashedData.height;
	console.log(chalk.green("--------------------------------# " + height + " #--------------------------------"));
	prevTime = new Date().getTime();
	genTree(block);
	normalize(block);
	const data = block.data;
	currentBlock = block;
	currentBlockHeight = height;
	process.stdout.write(chalk.magenta("Mining block..."));
	var minerParams = [];
	var minerLoc = "";
	if(process.platform == "win32"){
		var minerParams = [target, data];
		var minerLoc = "DCSHA256/bin/Release/DCSHA256.exe";
	}else{
		var minerParams = ["jsminer.js", target, data];
		var minerLoc = "node";
	}
	miningProc = exec(minerLoc, minerParams, function(err, nonce) {
		if(err){
			return;
		}
		
		var nonce = parseInt(nonce);
		currentBlock.data += nonce;
		currentBlock.hash = helpers.sha256(currentBlock.data);
		
		blocks[currentBlockHeight] = block;
		addBlock(block, currentBlockHeight);
		broadcastBlock(block, currentBlockHeight);
		
		var now = new Date().getTime();
		process.stdout.write("\r\x1b[K"); //clear "mining block" message
		console.log(chalk.blue("Mined block!\n"));
		console.log("Rate:  " + ((nonce/((now-prevTime)/1000))/1000000).toFixed(2) + chalk.gray(" MH/s"));
		console.log("Diff:  " + difficulty);
		console.log("Nonce: " + nonce);
		console.log("Hash:  " + currentBlock.hash);

		console.log(chalk.green("--------------------------------/ " + currentBlockHeight + " /--------------------------------\n"));
		mine(makeFakeBlock());
	});
}

var genFakeTransactions = function(){
	var transactions = [];
	var numOfTransactions = Math.floor(Math.random()*fakeTransactions);
	for(let i = 0; i < numOfTransactions; i++){
		var time = Math.round((new Date()).getTime() / 1000);
		var trans = {
			reciever: keygen.genPair().address,
			amount: Math.ceil(Math.random()*1000000),
			timestamp: time,
			prevOut: "someid",
			sig: "aaa"
		};
		transactions.push(trans);
	}
	return transactions;
}

var makeFakeBlock = function(){
	var time = Math.round((new Date()).getTime() / 1000);
	var block = {
		hash: "",
		transactions: genFakeTransactions(),
		hashedData: {
			previousHash: blocks[blocks.length-1].hash,
			height: blocks.length,
			timestamp: time,
			merkleRoot: ""
		}
	}
	
	block.transactions.unshift( //Miner gotta get paid!
		{
			reciever: address,
			amount: 25000000,
			timestamp: time
		}
	);
	return block;
}

var verifyBlock = function(block){ //expand, of course
	var checkHash = helpers.sha256(block.data);
	var blockHash = block.hash;
	if(checkHash == blockHash){
		return true;
	}
	return false;
}

var startUp = function(){
	helpers.logSolo("DrakeCoin client initialization...\n");
	console.log("Client running with address: " + address);
	console.log("Current height: " + blockHeight);
	server = net.createServer(function(socket) {
		socket.pipe(socket);
		socket.on('data', function(data) {
			try{
				pData = JSON.parse(data.toString());
				if(serverVerbose){
					console.log("------------------RECV: " + pData.type);
					console.log(pData);
					console.log("/-----------------RECV");
				}
				var response = {};
				switch(pData.type){
					case "blockHeightRequest":
						response = {type: "blockHeight", blockHeight: blocks.length-1};
						break;
					case "blockRequest":
						if(pData.height == "EMPTY"){
							pData.height = 0;
						}
						var blockArray = [];
						for(var i = parseInt(pData.height); i < blocks.length; i++){
							blockArray.push(blocks[i]);
						}
						response = {type: "blockArray", blockArray: blockArray};
						break;
					case "minedBlock":
						//var request = {type: "minedBlock", block: block, height: height};
						if(verifyBlock(pData.block)){
							process.stdout.write("\r\x1b[K"); //clear "mining block" message
							console.log(chalk.red("SNIPED\n"));
							if(miningProc != null){
								miningProc.kill();
							}
							addBlock(pData.block, pData.height);
							
							var expandedNewBlock = helpers.expandBlock(pData.block);
							console.log("Diff:  " + difficulty);
							console.log("Nonce: " + expandedNewBlock.nonce);
							console.log("Hash:  " + expandedNewBlock.hash);
							console.log(chalk.green("--------------------------------/ " + expandedNewBlock.hashedData.height + " /--------------------------------\n"));
							
							mine(makeFakeBlock());
							response = {type: "blockReceipt", stat: true};
						}else{
							response = {type: "blockReceipt", stat: false};
						}
						break;
					default:
						response = {type: "unknownRequest"}
						break;
				}
				
				socket.write(JSON.stringify(response));
				if(serverVerbose){
					console.log("------------------SEND: " + response.type);
					console.log(JSON.stringify(response));
					console.log("/-----------------SEND");
				}
			}catch(e){
			}
		});
		
		socket.on('error', function(err) {
			return;
		});
	});
	server.listen(serverPort);
	
	synch();
}

var synch = function(){
	var client = new net.Socket();
	if(clientVerbose){
		console.log("Connecting to " + neighbors[0].address + ":" + neighbors[0].port);
	}
	client.connect(neighbors[0].port, neighbors[0].address, function() {
		var request = {type: "blockHeightRequest"};
		client.write(JSON.stringify(request));
	});

	client.on('data', function(data) {
		try{
			var pData = JSON.parse(data.toString());
			if(clientVerbose){
				console.log("------------------RECV: " + pData.type);
				console.log(pData);
				console.log("/-----------------RECV");
			}
			switch(pData.type){
				case "blockHeight":
					console.log("Remote block height: " + pData.blockHeight);
					if(blockHeight == "EMPTY" || blockHeight < pData.blockHeight){
						var request = {type: "blockRequest", height: blockHeight};
						client.write(JSON.stringify(request));
					}else{
						client.destroy();
					}
					break;
				case "blockArray":
					for(var i = 0; i < pData.blockArray.length; i++){
						var data = pData.blockArray[i].data;
						var strippedData = data.substr(0, data.lastIndexOf("}")+1);
						var height = JSON.parse(strippedData).height;
						if(verifyBlock(pData.blockArray[i])){
							addBlock(pData.blockArray[i], height);
						}
					}
					client.destroy();
					break;
			}
		}catch(e){
		}
	});

	client.on('close', function() {
		if(clientVerbose){
			console.log("------------------CLIENT CLOSED!");
		}
		clientReady();
	});
	
	client.on('error', function(e) {
		if(clientVerbose){
			console.log("------------------CLIENT ERROR!");
		}
	});
}

var clientReady = function(){
	mine(makeFakeBlock());
}

var addBlock = function(block, height){
	var stringBlock = JSON.stringify(block);
	blocks[height] = block;
	BLOCKDB.put(height, stringBlock, function (err) {
		if (err) return console.log('Ooops!', err);
	});
	CLIENTDB.put('blockHeight', height, function (err) {
	});
}

var broadcastBlock = function(block, height){
	var client = new net.Socket();
	for(var i = 0; i < neighbors.length; i++){
		client.connect(neighbors[i].port, neighbors[i].address, function() {
			var request = {type: "minedBlock", block: block, height: height};
			client.write(JSON.stringify(request));
			client.destroy();
		});

		client.on('close', function() {
		});
		
		client.on('error', function(e) {
		});
	}
}

var getHeightFromBlock = function(block){
	var data = block.data;
	var strippedData = data.substr(0, data.lastIndexOf("}")+1);
	return JSON.parse(strippedData).height;
}

var getBlocksFromDB = function(height){
	for(var i = 0; i <= height; i++){
		BLOCKDB.get(i, function (err, value) {
			if(err && err.type == 'NotFoundError'){
				console.log('WTF?!', err);
			}else{
				var block = JSON.parse(value);
				var height = getHeightFromBlock(block);
				blocks[height] = block;
			}
		});
	}
}

if (process.platform === "win32") {
	var rl = require("readline").createInterface({
		input: process.stdin,
		output: process.stdout
	});
	
	rl.on("SIGINT", function () {
		process.emit("SIGINT");
	});
}

process.on("SIGINT", function () {
	var expandedBlocks = helpers.makeExpandedBlocksCopy(blocks);
	fs.writeFileSync("./debug/" + serverPort + "testBlocksExpanded.html", helpers.makeHTML(expandedBlocks));
	fs.writeFileSync("./debug/" + serverPort + "testBlocks.html", helpers.makeHTML(blocks));
	process.stdout.write("\r\x1b[K"); //clear "mining block" message
	console.log(chalk.yellow("Cancelled! Blocks dumped to log."));
	process.exit();
});