var crypto = require('crypto');

var sha256 = function(string){
	return crypto.createHash('sha256').update(string).digest('base16').toString('hex');
}

class MerkleNode {
	constructor(transaction, parentNode, childNode0, childNode1, transaction) {
		this.parentNode = parentNode;
		this.childNodes[0] = childNode0;
		this.childNodes[1] = childNode1;
		this.transaction = transaction;
	}
	computeHash() {
		if(this.childNodes[0] == null){
			this.hash = sha256(JSON.stringify(transaction));
		}else{
			this.hash = sha256(childNodes[0].hash + childNodes[1].hash);
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

//var preGenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
//var time = Math.round((new Date()).getTime() / 1000);
//var testBlock = new Block(preGenesisHash, transactions, time);

//console.log(JSON.stringify(testBlock));
