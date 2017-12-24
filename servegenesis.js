const net = require('net');
const chalk = require('chalk');
const helpers = require('./helpers.js');
const keygen = require('./keygen.js');
const fs = require('fs');
const exec = require('child_process').execFile;

const difficulty = 4;
const target = "0".repeat(difficulty) + "f".repeat(64-difficulty);

const checkTime = 1; //amount of time between hashrate displays

const merkleTreeHashDispLength = 4;
const indexMerkleTreeHashOne = true;

var port = 5555;
var fakeBlocks = 0;
var fakeTransactions = 32;

var blocks = [
	{
		hash: "",
		transactions: [
			{
				reciever: "DL9fSHaRHYhLw5kiYNMDU9wJaPVKxSM4KT",
				amount: 25000000,
				timestamp: 1513445082
			}
		],
		hashedData: {
			previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
			height: 0,
			timestamp: 1513445082,
			merkleRoot: ""
		}
	}
];

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
	var transactions = blocks[block].transactions;
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
			blocks[block].hashedData.merkleRoot = leveledHashes[cL][0].getHash();
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
	blocks[block].data = JSON.stringify(blocks[block].hashedData);
	delete blocks[block].hashedData;
}

var currentBlock;
var prevTime;
var lastNonce;

var mine = function(block){
	console.log(chalk.red("--------------------------------# " + block + " #--------------------------------"));
	prevTime = new Date().getTime();
	genTree(block);
	normalize(block);
	const data = blocks[block].data;
	currentBlock = block;
	process.stdout.write(chalk.blue("Mining block..."));
	exec('DCSHA256/bin/Release/DCSHA256.exe', [target, data], function(err, nonce) {
		lastNonce = parseInt(nonce);
		blocks[currentBlock].data += parseInt(nonce);
		blocks[currentBlock].hash = helpers.sha256(blocks[currentBlock].data);
		
		var now = new Date().getTime();
		process.stdout.write("\r\x1b[K"); //clear "mining block" message
		console.log(chalk.blue("Block mined!\n"));
		console.log("Rate:  " + ((lastNonce/((now-prevTime)/1000))/1000000).toFixed(2) + chalk.gray(" MH/s"));
		console.log("Diff:  " + difficulty);
		console.log("Nonce: " + lastNonce);
		console.log("Hash:  " + blocks[currentBlock].hash);
		console.log(chalk.red("--------------------------------/ " + currentBlock + " /--------------------------------\n"));
		
		if(currentBlock < blocks.length-1){
			blocks[currentBlock+1].hashedData.previousHash = blocks[currentBlock].hash;
			mine(currentBlock+1);
		}else{
			doneMining();
		}        		
	});
}

var genFakeTransactions = function(){
	var transactions = [];
	var numOfTransactions = Math.floor(Math.random()*fakeTransactions);
	var miner = keygen.genPair().address;
	transactions.push( //Miner gotta get paid!
		{
			reciever: keygen.genPair().address,
			amount: 25000000,
			timestamp: time,
			sig: "aaa"
		}
	);
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

while(fakeBlocks != 0){
	var time = Math.round((new Date()).getTime() / 1000);
	blocks.push({
		hash: "",
		transactions: genFakeTransactions(),
		hashedData: {
			previousHash: blocks[blocks.length-1].hash,
			height: blocks.length,
			timestamp: time,
			merkleRoot: ""
		}
	});
	fakeBlocks--;
}

helpers.logSolo("DrakeCoin serve-genesis initialization...\n");
mine(0);

var doneMining = function(){
	console.log("Starting server on port " + port);
	
	var expandedBlocks = helpers.makeExpandedBlocksCopy(blocks);
	fs.writeFileSync("./debug/testBlocksExpanded.html", helpers.makeHTML(expandedBlocks));
	fs.writeFileSync("./debug/testBlocks.html", helpers.makeHTML(blocks));

	var server = net.createServer(function(socket) {
		socket.pipe(socket);
		socket.on('data', function(data) {
			try{
				pData = JSON.parse(data.toString());
				console.log("------------------RECV: " + pData.type);
				console.log(pData);
				console.log("/-----------------RECV");
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
					default:
						response = {type: "unknownRequest"}
						break;
				}
				
				socket.write(JSON.stringify(response));
				console.log("------------------SEND: " + response.type);
				console.log(JSON.stringify(response));
				console.log("/-----------------SEND");
			}catch(e){
			}
		});
		
		socket.on('error', function(err) {
			return;
		});
	});
	server.listen(port, '127.0.0.1');
}