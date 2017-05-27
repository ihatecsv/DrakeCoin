var crypto = require('crypto');

function compareNode(a, b) {
  if (a.getHash() < b.getHash())
    return -1;
  if (a.getHash() > b.getHash())
    return 1;
  return 0;
}

var sha256 = function(string){
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
		this.rootHash = "";
	}
	getRootHash(){
		return this.rootHash;
	}
	genTree(transactions){
		transactions.sort();
		var cL = 0;
		
		var root = false;
		
		this.leveledHashes[cL] = [];
		for(var i = 0; i < transactions.length; i++){ //go through each transaction,
			var newNode = new MerkleNode(null, null, null, transactions[i]); //add each one to a new merkle node
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
				this.rootHash = this.leveledHashes[cL][0].getHash();
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

class Block {
	constructor(previousHash, previousDepth, transactions, timestamp) {
		this.common = 121374;
		this.previousHash = previousHash;
		this.previousDepth = previousDepth + 1;
		this.transactions = transactions;
		this.timestamp = timestamp;
	}
}
var genFakeTransactions = function(){
	var transactions = [];
	var numOfTransactions = Math.floor(Math.random()*100);
	for(var i = 0; i < numOfTransactions; i++){
		var time = Math.round((new Date()).getTime() / 1000);
		var trans = new Transaction(sha256(Math.random()*10000 + ""), sha256(Math.random()*10000 + ""), Math.random(), time, false);
		transactions.push(trans);
	}
	return transactions;
}

var exampleTransactions = genFakeTransactions();

var time = Math.round((new Date()).getTime() / 1000);
var awardTrans = new Transaction(null, "me, the miner", 50, time, true);

exampleTransactions.unshift(awardTrans);

console.log(exampleTransactions);

//var preGenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";

var newTree = new MerkleTree();
newTree.genTree(exampleTransactions);
console.log(newTree.getRootHash());

//var time = ;
//var testBlock = new Block(preGenesisHash, transactions, time);

//console.log(JSON.stringify(testBlock));
