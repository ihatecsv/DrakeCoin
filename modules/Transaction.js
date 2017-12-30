const crypto = require("crypto");
const secp256k1 = require("secp256k1");

const helpers = require("./helpers.js");

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
		const pubKey = secp256k1.publicKeyCreate(privKey);

		const msgHash = crypto.createHash("sha256").update(this.getSignableData()).digest();

		const sigObj = secp256k1.sign(msgHash, privKey);

		this.sig = sigObj.signature.toString("hex");

		this.publicKey = pubKey.toString("hex");

		return this.sig;
	}

	verify(){
		const verify = crypto.createVerify("SHA256");
		verify.update();

		if(this.amount <= 0){ //Verify that there's no negative spending
			return false;
		}

		if(verify.verify(this.publicKey, this.sig)){ //Verify that the sig is valid
			return false;
		}
		/*
		if(Account.getAddressFromPublicKey(this.publicKey) == ){

		}
		*/
		return true;
	}

	getSignableData(){
		return [this.input, this.output, this.amount, this.timestamp].toString();
	}

	getSig(){
		return this.sig;
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