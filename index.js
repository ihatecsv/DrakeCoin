let crypto = require('crypto');
let fs = require('fs');

const difficulty = 6; //currently in # of zeroes
const commonVal = "f32xa4";
const checkTime = 1; //amount of time between hashrate displays

const awardAmount = 25; //the amount to grant to the succesful miner

const compareNode = function(a, b){
  if (a.getHash() < b.getHash())
    return -1;
  if (a.getHash() > b.getHash())
    return 1;
  return 0;
}

const sha256 = function(string){
	return crypto.createHash('sha256').update(string).digest('base16').toString('hex');
}

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
			this.hash = sha256(JSON.stringify(this.transaction));
		}else{
			this.hash = sha256(this.childNodes[0].hash + this.childNodes[1].hash);
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

class MerkleTree {
	constructor(){
		this.leveledHashes = [];
		this.merkleRoot = "";
	}
	getMerkleRoot(){
		return this.merkleRoot;
	}
	genTree(transactions){
		transactions.sort();
		let cL = 0;
		
		let root = false;
		
		this.leveledHashes[cL] = [];
		for(let i = 0; i < transactions.length; i++){ //go through each transaction,
			let newNode = new MerkleNode(null, null, null, transactions[i]); //add each one to a new merkle node
			newNode.computeHash(); //compute the hash
			this.leveledHashes[cL].push(newNode); //push to the current (bottom) level of the tree
		}
		
		this.leveledHashes[cL].sort(compareNode); //sort the base row
		
		while(!root){ //while we're below the root node
			cL++; //increase our current level
			this.leveledHashes[cL] = [];
			if(this.leveledHashes[cL-1].length % 2 != 0){ //if the number of hashes in the previous level is not even
				this.leveledHashes[cL-1].push(this.leveledHashes[cL-1][this.leveledHashes[cL-1].length-1]); //duplicate the last hash
			}
			for(var i = 0; i < this.leveledHashes[cL-1].length; i++){ //loop through the hashes in the previous level
				if(i%2 == 0){ //if the index is even
					var newNode = new MerkleNode(null, this.leveledHashes[cL-1][i], this.leveledHashes[cL-1][i+1], null); //make a new node at the current level, with children of the two below nodes.
					newNode.computeHash(); //compute hash from children
					this.leveledHashes[cL-1][i].setParentNode(newNode); //set children to ref parent
					this.leveledHashes[cL-1][i+1].setParentNode(newNode); //set children to ref parent
					this.leveledHashes[cL].push(newNode); //add the new node to the current level
				}
			}
			if(this.leveledHashes[cL].length == 1){
				root = true;
				this.merkleRoot = this.leveledHashes[cL][0].getHash();
			}
		}
	}
}

class Transaction {
	constructor(sender, reciever, amount, timestamp, isReward) {
		this.sender = sender;
		this.reciever = reciever;
		this.amount = amount;
		this.timestamp = timestamp;
		this.isReward = isReward;
	}
}

class BlockHeader {
	constructor(previousHash, depth, merkleRoot, timestamp){
		this.common = commonVal;
		this.previousHash = previousHash;
		this.depth = depth;
		this.merkleRoot = merkleRoot;
		this.timestamp = timestamp;
	}
	getJSON(){
		return JSON.stringify(this);
	}
	updateNonce(nonce){
		this.nonce = nonce;
	}
}

class MinedBlockHeader {
	constructor(blockHeader, hash){
		this.blockHeader = blockHeader;
		this.hash = hash;
	}
	getHash(){
		return this.hash;
	}
}

var genFakeTransactions = function(){
	let transactions = [];
	const numOfTransactions = Math.floor(Math.random()*20);
	for(let i = 0; i < numOfTransactions; i++){
		const time = Math.round((new Date()).getTime() / 1000);
		let trans = new Transaction(sha256(Math.random()*10000 + ""), sha256(Math.random()*10000 + ""), Math.random(), time, false);
		transactions.push(trans);
	}
	return transactions;
}

const mineBlockHeader = function(blockHeader, desc){
	let found = false;
	let nonce = 0;
	let hashesPerSec = 0;
	let lastTime = Math.round((new Date()).getTime() / 1000);
	while(!found){
		blockHeader.updateNonce(nonce);
		const data = blockHeader.getJSON();
		const hash = sha256(data);
		if(hash.substring(0,difficulty) == new Array(difficulty + 1).join("0")){
			found = true;
			const mBH = new MinedBlockHeader(blockHeader, hash);
			return mBH;
		}
		nonce++;
		hashesPerSec++;
		const time = Math.round((new Date()).getTime() / 1000);
		if(time - lastTime == checkTime){
			console.log("Mining " + desc + " at " + ((hashesPerSec/checkTime)/1000000).toFixed(2) + "MH/s");
			lastTime = time;
			hashesPerSec = 0;
		}
	}
}

const preGenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
const genesisTransactions = [new Transaction(preGenesisHash, "me, the miner", 50, 0, true)];

const genesisMerkleTree = new MerkleTree();
genesisMerkleTree.genTree(genesisTransactions);

const genesisBlockHeader = new BlockHeader(preGenesisHash, 0, genesisMerkleTree.getMerkleRoot(), 0);

const genesisMinedBlockHeader = mineBlockHeader(genesisBlockHeader, "genesis hash"); //ehh

let globalMinedBlockHeaders = [];

globalMinedBlockHeaders.push(genesisMinedBlockHeader);

let globalTransactionArrays = [];

globalTransactionArrays.push(genesisTransactions);

while(true){
	let exampleTransactions = genFakeTransactions();
	
	const time = Math.round((new Date()).getTime() / 1000);
	let awardTrans = new Transaction(null, "me, the miner", awardAmount, time, true);
	
	exampleTransactions.unshift(awardTrans);
	
	globalTransactionArrays.push(exampleTransactions);
	
	let newTree = new MerkleTree();
	newTree.genTree(exampleTransactions);
	
	const previousHash = globalMinedBlockHeaders[globalMinedBlockHeaders.length-1].hash;
	
	const depth = globalMinedBlockHeaders[globalMinedBlockHeaders.length-1].blockHeader.depth + 1;
	
	let newBlockHeader = new BlockHeader(previousHash, depth, newTree.getMerkleRoot(), time);
	
	let minedBlockHeader = mineBlockHeader(newBlockHeader, "depth " + depth);
	globalMinedBlockHeaders.push(minedBlockHeader);
	console.log("-----Mined new block, depth: " + depth + "-----");
	fs.writeFileSync("./globalMinedBlockHeaders.json", JSON.stringify(globalMinedBlockHeaders));
	fs.writeFileSync("./globalTransactionArrays.json", JSON.stringify(globalTransactionArrays));
}
