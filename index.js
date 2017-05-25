var crypto = require('crypto');

//crypto.createHash('sha256').update(base + nonce).digest('base16').toString('hex');

class Transaction {
	constructor(sender, reciever, amount, isReward) {
		this.sender = sender;
		this.reciever = reciever;
		this.amount = amount;
		this.isReward = isReward;
	}
}

class Block {
	constructor(previousHash, transactions, timestamp) {
		this.previousHash = previousHash;
		this.transactions = transactions;
		this.timestamp = timestamp;
	}
}

var transactions = [
	new Transaction("testsender1", "testreciever1", 0.005, false),
	new Transaction("testsender2", "testreciever2", 0.002, false),
	new Transaction("testsender3", "testreciever3", 0.008, false)
];

var preGenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
var time = Math.round((new Date()).getTime() / 1000);
var testBlock = new Block(preGenesisHash, transactions, time);

console.log(JSON.stringify(testBlock));
