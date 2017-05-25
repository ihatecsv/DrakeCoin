var crypto = require('crypto');

var base = "Drake";
var nonce = 0;
var found = false;

while(!found){
	var hash = crypto.createHash('sha256').update(base + nonce).digest('base16').toString('hex');
	console.log(nonce + ": " + hash);
	if(hash.substring(0,4) == "0000"){
		console.log("--------FOUND!--------");
		console.log(base + nonce);
		console.log(hash);
		found = true;
	}
	nonce++;
}