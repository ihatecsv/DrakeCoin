const fs = require("fs-extra");

let config = {};	
if(fs.existsSync("sample-config.json")){
	if(fs.existsSync("config.json")){
		config = JSON.parse(fs.readFileSync("config.json", "utf8"));

		if(config.randomClientIdentifier){
			config.clientIdentifier = Math.floor(Math.random()*10000);
		}

		config.target = "0".repeat(config.difficulty) + "f".repeat(64-config.difficulty);
	}else{
		fs.copySync("sample-config.json", "config.json");
		console.log("Made configuration file! Please edit config.json before running again.");
		process.exit(0);
	}
}else{
	console.log("sample-config.json missing!");
	process.exit(1);
}

module.exports = config;