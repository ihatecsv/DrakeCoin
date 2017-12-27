const helpers = require("./helpers.js");

class Transaction {
	constructor(input, output, amount, timestamp, sig){
		this.input = input;
		this.output = output;
		this.amount = amount;
		this.timestamp = timestamp;
		this.sig = sig;
	}

	verify(){ //TODO: check UTXOs to make sure it's spendable
		if(this.amount <= 0){ 
			return false;
		}
		if(!this.sig){ //TODO: actually verify the sig
			return false;
		}
		return true;
	}

	getHashableData(){
		return [this.input, this.output, this.amount, this.timestamp, this.sig].toString();
	}

	getHash(){
		return helpers.sha256(this.getHashableData());
	}

	static makeRewardTransaction(output, amount){ //TODO: determine reward amount
		const timestamp = Date.now();
		return new this(null, output, amount, timestamp, null);
	}

	static convertObjToTransaction(obj){
		return new this(obj.input, obj.output, obj.amount, obj.timestamp, obj.sig);
	}
}

module.exports = Transaction;