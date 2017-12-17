const crypto = require('crypto');

let difficulty = 5;
let hashesPerSec = 0;
let lastTime = Math.round((new Date()).getTime() / 1000);
let checkTime = 1; //amount of time between hashrate displays

while(true){
	const hash = crypto.createHash('sha256').update("Drake").digest();
	
	hashesPerSec++;
	const time = Math.round((new Date()).getTime() / 1000);
	if(time - lastTime == checkTime){
		console.log("Mining at " + ((hashesPerSec/checkTime)/1000000).toFixed(2) + "MH/s");
		lastTime = time;
		hashesPerSec = 0;
	}
}