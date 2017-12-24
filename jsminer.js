const crypto = require('crypto');

const target = Buffer.from(process.argv[2], 'hex');
const data = Buffer.from(process.argv[3] + "", 'utf8');

let nonce = 0;
let hash = null;
while(hash == null || hash.compare(target) > 0){
    nonce++;
    const noncedData = Buffer.concat([data, Buffer.from(nonce+"", 'utf8')]);
	hash = crypto.createHash('sha256').update(noncedData).digest();
}
console.log(nonce);