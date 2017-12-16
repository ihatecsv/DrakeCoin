const net = require('net');
const helpers = require('./helpers.js');
const keygen = require('./keygen.js');
const fs = require('fs');

var difficulty = 5; //currently in # of zeroes
const checkTime = 1; //amount of time between hashrate displays

var port = 5000;
var fakeBlocks = 5;

var blocks = [
	{
		hash: "",
		block: {
			previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
			height: 1,
			timestamp: 1513445082,
			transactions: [
				{
					reciever: "DL9fSHaRHYhLw5kiYNMDU9wJaPVKxSM4KT",
					amount: 25000000	,
					timestamp: 1513445082,
					sig: "aaa"
				}
			],
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
	var transactions = blocks[block].block.transactions;
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
			blocks[block].block.merkleRoot = leveledHashes[cL][0].getHash();
		}
	}
}

var normalize = function(block){
	blocks[block].data = JSON.stringify(blocks[block].block);
	delete blocks[block].block;
}

var mine = function(block){
	let found = false;
	let nonce = 0;
	let hashesPerSec = 0;
	let lastTime = Math.round((new Date()).getTime() / 1000);
	const data = blocks[block].data;
	while(!found){
		const hash = helpers.sha256(data+nonce);
		if(hash.substring(0,difficulty) == new Array(difficulty + 1).join("0")){
			found = true;
			blocks[block].hash = hash;
			blocks[block].data += nonce;
			return;
		}
		nonce++;
		hashesPerSec++;
		const time = Math.round((new Date()).getTime() / 1000);
		if(time - lastTime == checkTime){
			console.log("Mining " + block + " at " + ((hashesPerSec/checkTime)/1000000).toFixed(2) + "MH/s");
			lastTime = time;
			hashesPerSec = 0;
		}
	}
}

var genFakeTransactions = function(){
	var transactions = [];
	var numOfTransactions = Math.floor(Math.random()*5);
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

genTree(0);
normalize(0);
mine(0);

while(fakeBlocks != 0){
	var time = Math.round((new Date()).getTime() / 1000);
	blocks.push({
		hash: "",
		block: {
			previousHash: blocks[blocks.length-1].hash,
			height: blocks.length,
			timestamp: time,
			transactions: genFakeTransactions(),
			merkleRoot: ""
		}
	});
	genTree(blocks.length-1);
	normalize(blocks.length-1);
	mine(blocks.length-1);
	fakeBlocks--;
}

console.log("Starting server!");

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
					response = {type: "blockHeight", blockHeight: blocks.length};
					break;
				case "blockRequest":
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