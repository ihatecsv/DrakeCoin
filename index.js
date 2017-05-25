var crypto = require('crypto');

var base = "Drake";
var nonce = 0;
var found = false;

var suffix = "abcd";

while(!found){
	var hash = crypto.createHash('sha256').update(base + nonce).digest('base16').toString('hex');
	console.log(nonce + ": " + hash);
	if(hash.substring(0,suffix.length) == suffix){
		console.log("--------FOUND!--------");
		console.log(base + nonce);
		console.log(hash);
		found = true;
	}
	nonce++;
}