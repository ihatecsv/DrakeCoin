const crypto = require("crypto");
const RIPEMD160 = require("ripemd160");
const bigInt = require("big-integer");

class Account {
	constructor(privateKey){
		this.keypair = crypto.createECDH("secp256k1");
		this.debug = false;
		if(privateKey != null){
			this.keypair.setPrivateKey(privateKey, "hex");
		}else{
			this.keypair.generateKeys();
		}
		this.generateAddress();
	}

	static randomAccount(){
		return new this(null);
	}

	setDebug(value){
		this.debug = value;
	}

	getAddress(){
		return this.address;
	}

	getPrivateKey(){
		return this.keypair.getPrivateKey().toString("hex").toUpperCase();
	}

	generateAddress(){
		const privateBuffer = this.keypair.getPrivateKey();
		const publicBuffer = this.keypair.getPublicKey();

		const hashBuffer = crypto.createHash("sha256").update(publicBuffer).digest(); //2
		const ripeBuffer = new RIPEMD160().update(hashBuffer).digest(); //3
		const ripeBufferV = Buffer.concat([Buffer.from([0x00]), ripeBuffer]); //4
		const hash2Buffer = crypto.createHash("sha256").update(ripeBufferV).digest(); //5
		const hash3Buffer = crypto.createHash("sha256").update(hash2Buffer).digest(); //6
		const checksum = hash3Buffer.slice(0, 4); //7
		const hexAddress = Buffer.concat([ripeBufferV, checksum]); //8

		const baseString = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

		let bigStuff = bigInt(hexAddress.toString("hex"), 16);

		let outputString = "";

		while(bigStuff.compare(0) == 1) {
			const result = bigStuff.divmod(58);
			bigStuff = result.quotient;
			const remainder = result.remainder;
			outputString += baseString[remainder];
		}

		var doneLeading = false;
		for(var i = 0; i < hexAddress.length; i++){
			if(hexAddress[i] == 0 && !doneLeading){
				outputString += baseString[12]; //12 is the first character of each address. In Bitcoin, this is 0
			}else{
				doneLeading = true;
			}
		}

		this.address = outputString.split("").reverse().join("");

		if(this.debug){
			console.log("=================================================");
			console.log("Private key: " + privateBuffer.toString("hex").toUpperCase());
			console.log("Public key: " + publicBuffer.toString("hex").toUpperCase());
			console.log("Hash: " + hashBuffer.toString("hex").toUpperCase());
			console.log("Ripe: " + ripeBuffer.toString("hex").toUpperCase());
			console.log("RipeV: " + ripeBufferV.toString("hex").toUpperCase());
			console.log("Hash2: " + hash2Buffer.toString("hex").toUpperCase());
			console.log("Hash3: " + hash3Buffer.toString("hex").toUpperCase());
			console.log("Checksum: " + checksum.toString("hex").toUpperCase());
			console.log("Hex address: " + hexAddress.toString("hex").toUpperCase());
			console.log("Address: " + this.address);
			console.log("=================================================");
		}
	}
}

module.exports = Account;