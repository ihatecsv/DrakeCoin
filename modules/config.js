const config = require("minimist")(process.argv.slice(2));

if(config.m == null){
	config.m = false;
}

if(config.identifier == null){
	config.identifier = Math.floor(Math.random()*1000000);
}

if(config.difficulty == null){
	config.difficulty = 6; //TODO: make dynamic difficulty
}else{
	config.difficulty = parseInt(config.difficulty);
}
config.target = "0".repeat(config.difficulty) + "f".repeat(64-config.difficulty);

if(config.serverport == null){
	config.serverport = 43330; //TODO: make dynamic difficulty
}else{
	config.serverport = parseInt(config.serverport);
}

if(config.merkletreehashdisplength == null){
	config.merkletreehashdisplength = 2;
}else{
	config.merkletreehashdisplength = parseInt(config.merkletreehashdisplength);
}

if(config.indexmerkletreehashone == null){
	config.indexmerkletreehashone = true;
}else{
	config.indexmerkletreehashone = config.indexmerkletreehashone == "true";
}

if(config.clientverbose == null){
	config.clientverbose = false;
}else{
	config.clientverbose = config.clientverbose == "true";
}

if(config.serververbose == null){
	config.serververbose = false;
}else{
	config.serververbose = config.serververbose == "true";
}

if(config.neighbors == null){
	config.neighbors = ["drakeluce.com:43330"];
}else{
	config.neighbors = config.neighbors.split(",");
}

module.exports = config;

// -m / launch as miner
// --identifier
// --difficulty
// --serverport
// --merkletreehashdisplength // default 2
// --indexmerkletreehashone // default true
// --clientverbose // default false
// --serververbose // default false
// --neighbors // default drakeluce.com:43330