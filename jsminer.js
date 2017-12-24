let crypto = require('crypto');

var target = Buffer.from(process.argv[2], 'hex');
var data = Buffer.from(process.argv[3] + "", 'utf8');

var nonce = 0;
var hash = null;
while(hash == null || hash.compare(target) > 0){
    nonce++;
    var noncedData = Buffer.concat([data, Buffer.from(nonce+"", 'utf8')]);
	var hash = crypto.createHash('sha256').update(noncedData).digest();
}
console.log(nonce);