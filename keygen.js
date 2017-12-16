const crypto = require('crypto');
const RIPEMD160 = require('ripemd160');
const bigInt = require("big-integer");

const keypair = crypto.createECDH('secp256k1');

var debug = false;

keypair.generateKeys();

var privateString = keypair.getPrivateKey().toString('hex');
var publicString = keypair.getPublicKey().toString('hex');

//const privateString = "18E14A7B6A307F426A94F8114701E7C8E774E7F9A47E2C2035DB29A206321725";
//const publicString = "0450863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B23522CD470243453A299FA9E77237716103ABC11A1DF38855ED6F2EE187E9C582BA6";

const privateBuffer = new Buffer(privateString, "hex");
const publicBuffer = new Buffer(publicString, "hex");

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

console.log("=================================================");
console.log("Private key: " + privateBuffer.toString('hex'));
console.log("Public key: " + publicBuffer.toString('hex'));
if(debug){
    console.log("Hash: " + hashBuffer.toString('hex'));
    console.log("Ripe: " + ripeBuffer.toString('hex'));
    console.log("RipeV: " + ripeBufferV.toString('hex'));
    console.log("Hash2: " + hash2Buffer.toString('hex'));
    console.log("Hash3: " + hash3Buffer.toString('hex'));
    console.log("Checksum: " + checksum.toString('hex'));
    console.log("Hex address: " + address.toString('hex'));
}
console.log("Address: " + finalAddress);
console.log("=================================================");

