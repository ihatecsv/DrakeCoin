const crypto = require("crypto");
const secp256k1 = require("secp256k1");
const chalk = require("chalk");

const helpers = require("./helpers.js");
const database = require("./database.js");

const Account = require("./Account.js");

class Transaction {
	constructor(input, output, amount, timestamp, sig, publicKey){
		this.input = input;
		this.output = output;
		this.amount = amount;
		this.timestamp = timestamp;
		this.sig = sig;
		this.publicKey = publicKey;
	}

	sign(account){
		// get the public key in a compressed format
		const privKey = account.keypair.getPrivateKey();

		const msgHash = crypto.createHash("sha256").update(this.getSignableData()).digest();

		const sigObj = secp256k1.sign(msgHash, privKey);

		this.sig = sigObj.signature.toString("hex");

		this.publicKey = account.getPublicKey();

		return this.sig;
	}

	verify(temporaryUTXOObj, verifiedCallback){
		if(this.amount <= 0){ //Verify that there's no negative spending
			verifiedCallback(false, "Zero or negative amount!");
			return;
		}

		const msgHash = crypto.createHash("sha256").update(this.getSignableData()).digest();
		let buffSig = Buffer.from(this.sig, "hex");
		let buffPubKey = Buffer.from(this.publicKey, "hex");
		if(!secp256k1.verify(msgHash, buffSig, buffPubKey)){
			verifiedCallback(false, "Signature invalid!");
			return;
		}
		if(this.input == null){
			verifiedCallback(true, null);
		}

		const outerThis = this;

		const checkInput = function(){
			if(temporaryUTXOObj[outerThis.input].output != Account.getAddressFromPublicKey(outerThis.publicKey)){
				verifiedCallback(false, "Transaction not signed by input owner!");
				return;
			}

			if(temporaryUTXOObj[outerThis.input].balance == null){
				temporaryUTXOObj[outerThis.input].balance = temporaryUTXOObj[outerThis.input].amount;
			}

			if(outerThis.amount > temporaryUTXOObj[outerThis.input].balance){
				verifiedCallback(false, "Spending more than UTXO balance!");
				return;
			}

			verifiedCallback(true, null);
			return;
		};

		if(temporaryUTXOObj[this.input] == null){
			database.UTXODB.get(this.input, function (err, inputTransactionString) {
				if(err){
					verifiedCallback(false, "UTXO input doesn't exist!");
					return;
				}
				let inputTransactionData = JSON.parse(inputTransactionString);
				let inputTransaction = Transaction.makeCompletedTransaction(inputTransactionData);
				temporaryUTXOObj[outerThis.input] = inputTransaction;
				checkInput();
			});
		}else{
			checkInput();
		}
	}

	execute(){ //Update UTXO to solidify TX
		if(this.input == null){ //miner trans, doesn't need to execute
			return;
		}
		const outerThis = this;
		database.UTXODB.get(this.input, function (err, inputTransactionString) {
			let inputTransactionData = JSON.parse(inputTransactionString);
			let inputTransaction = Transaction.makeCompletedTransaction(inputTransactionData);

			if(inputTransaction.balance == null){
				inputTransaction.balance = inputTransaction.amount;
			}

			if(outerThis.amount > inputTransaction.balance){
				console.log(chalk.red("5521 THIS SHOULD NEVER HAPPEN!"));
				return;
			}

			inputTransaction.balance -= outerThis.amount;

			if(inputTransaction.balance != 0){
				let updatedInputTransactionData = inputTransaction.getTransactionData();

				database.UTXODB.put(inputTransaction.sig, JSON.stringify(updatedInputTransactionData), function (err) {
					if(err){
						console.log(err);
					}
				});
			}else{
				database.UTXODB.del(inputTransaction.sig, function (err) {
					if(err){
						console.log(err);
					}
				});
			}
		});
	}

	getSignableData(){
		return [this.input, this.output, this.amount, this.timestamp].toString();
	}

	getSig(){
		return this.sig;
	}

	getTransactionData(){
		if(this.getSig() != null){
			const transactionData = {
				input: this.input,
				output: this.output,
				amount: this.amount,
				timestamp: this.timestamp,
				sig: this.sig,
				publicKey: this.publicKey
			};
			if(this.balance != null){
				transactionData.balance = this.balance;
			}
			return transactionData;
		}else{
			return null;
		}
	}

	static makeCompletedTransaction(transactionData){ //For expansion?
		let transaction = new this(transactionData.input, transactionData.output, transactionData.amount, transactionData.timestamp, transactionData.sig, transactionData.publicKey);
		if(transactionData.balance != null){
			transaction.balance = transactionData.balance;
		}
		return transaction;
	}

	static makeRewardTransaction(output, amount){ //TODO: determine reward amount
		const timestamp = Date.now();
		return new this(null, output, amount, timestamp, null, null);
	}

	static convertObjToTransaction(obj){
		return new this(obj.input, obj.output, obj.amount, obj.timestamp, obj.sig, obj.publicKey);
	}
}

module.exports = Transaction;