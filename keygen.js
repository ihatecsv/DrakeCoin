const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');
const bigInt = require("big-integer");

const keypair = crypto.createECDH('secp256k1');

var genPair = function(){
	var debug = false;
	
	keypair.generateKeys();

	var privateBuffer = keypair.getPrivateKey();
	var publicBuffer = keypair.getPublicKey();

	const hashBuffer = crypto.createHash('sha256').update(publicBuffer).digest(); //2
	const ripeBuffer = new RIPEMD160().update(hashBuffer).digest(); //3
	const ripeBufferV = Buffer.concat([Buffer.from([0x00]), ripeBuffer]); //4
	const hash2Buffer = crypto.createHash('sha256').update(ripeBufferV).digest(); //5
	const hash3Buffer = crypto.createHash('sha256').update(hash2Buffer).digest(); //6
	const checksum = hash3Buffer.slice(0, 4); //7
	const address = Buffer.concat([ripeBufferV, checksum]); //8

	baseString = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	var bigStuff = bigInt(address.toString('hex'), 16);

	var output_string = "";

	while(bigStuff.compare(0) == 1) {
		var result = bigStuff.divmod(58);
		bigStuff = result.quotient;
		var remainder = result.remainder;
		output_string += baseString[remainder];
	}

	var doneLeading = false;
	for(var i = 0; i < address.length; i++){
		if(address[i] == 0 && !doneLeading){
			output_string += baseString[12]; //12 is the first character of each address. In Bitcoin, this is 0
		}else{
			doneLeading = true;
		}
	}

	const finalAddress = output_string.split("").reverse().join("");
	if(debug){
		console.log("=================================================");
		console.log("Private key: " + privateBuffer.toString('hex').toUpperCase());
		console.log("Public key: " + publicBuffer.toString('hex').toUpperCase());
		console.log("Hash: " + hashBuffer.toString('hex').toUpperCase());
		console.log("Ripe: " + ripeBuffer.toString('hex').toUpperCase());
		console.log("RipeV: " + ripeBufferV.toString('hex').toUpperCase());
		console.log("Hash2: " + hash2Buffer.toString('hex').toUpperCase());
		console.log("Hash3: " + hash3Buffer.toString('hex').toUpperCase());
		console.log("Checksum: " + checksum.toString('hex').toUpperCase());
		console.log("Hex address: " + address.toString('hex').toUpperCase());
		console.log("Address: " + finalAddress);
		console.log("=================================================");
	}
	return {address: finalAddress, privateKey: privateBuffer.toString('hex').toUpperCase()};
}

module.exports.genPair = genPair;