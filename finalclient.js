const WebSocket = require("ws");
const level = require("level");
const chalk = require("chalk");
const fs = require("fs");

const config = require("./modules/config.js");
const helpers = require("./modules/helpers.js");

const Block = require("./modules/Block.js");
const Transaction = require("./modules/Transaction.js");
const Account = require("./modules/Account.js");

//const UTXODB = level("./DB/UTXODB" + config.clientIdentifier);
const BLOCKDB = level("./DB/BLOCKDB" + config.clientIdentifier);
const CLIENTDB = level("./DB/CLIENTDB" + config.clientIdentifier);

let blocks = [];
let currentBlock = null;

let blockHeight = "EMPTY";
let account = null;

let minerProc = null;

let globServer = null;
let globClient = null;

CLIENTDB.get("privateKey", function (err, value) {
	if(err && err.type == "NotFoundError"){
		console.log("Generating new address!");
		account = Account.randomAccount();
		CLIENTDB.put("privateKey", account.getPrivateKey(), function (err) {
			if (err) return console.log("Ooops!", err);
		});
	}else{
		account = new Account(value);
	}
	CLIENTDB.get("blockHeight", function (err, value) {
		if(err && err.type == "NotFoundError"){
			CLIENTDB.put("blockHeight", "EMPTY", function (err) {
				if (err) return console.log("Ooops!", err);
			});
		}else{
			blockHeight = value;
			getBlocksFromDB(blockHeight);
		}
		startUp();
	});
});

const makeEmptyBlock = function(){
	let block = new Block(blocks[blocks.length-1].hash, blocks.length, [], config.target);

	const minerTransaction = Transaction.makeRewardTransaction(account.getAddress(), 25000000);
	minerTransaction.sign(account);
	block.addTransaction(minerTransaction);

	return block;
};

const startUp = function(){
	helpers.logSolo("DrakeCoin client initialization...\n");
	console.log("Client running with address: " + account.getAddress());
	console.log("Current height: " + blockHeight);
	startServer();
	synch(0);
};

const synch = function(index){
	if(config.clientVerbose){
		console.log("Connecting to " + "ws://" + config.neighbors[index].address + ":" + config.neighbors[index].port);
	}
	globClient = new WebSocket("ws://" + config.neighbors[index].address + ":" + config.neighbors[index].port);

	globClient.on("open", function open() {
		const request = {type: "blockCountRequest"};
		if(config.clientVerbose){
			console.log("--------------CLI.SEND: " + request.type);
			console.log(JSON.stringify(request));
			console.log("/-------------CLI.SEND");
		}
		globClient.send(JSON.stringify(request));
	});

	globClient.on("message", function incoming(data) {
		let pData = null;
		try{
			pData = JSON.parse(data);
			if(config.clientVerbose){
				console.log("--------------CLI.RECV: " + pData.type);
				console.log(data);
				console.log("/-------------CLI.RECV");
			}
		}catch(e){
			console.log(chalk.magenta(e));
		}
		try{
			switch(pData.type){
				case "blockCount": {
					console.log("Remote block count: " + pData.blockCount);
					if(blockHeight == "EMPTY" || blocks.length < pData.blockCount){
						const request = {type: "blockRequest", height: blocks.length};
						globClient.send(JSON.stringify(request));
						if(config.clientVerbose){
							console.log("--------------CLI.SEND: " + request.type);
							console.log(JSON.stringify(request));
							console.log("/-------------CLI.SEND");
						}
					}else{
						clientReady();
					}
					break;
				}
				case "blockDataArray": {
					for(let i = 0; i < pData.blockDataArray.length; i++){
						let recievedBlock = Block.makeCompletedBlock(pData.blockDataArray[i]);
						if(recievedBlock.isMined()){
							addBlock(recievedBlock);
						}
					}
					clientReady();
					break;
				}
				case "minedBlockData": {
					let recievedBlock = Block.makeCompletedBlock(pData.blockData);
					var result = gotNewMinedBlock(recievedBlock);
					let response = {type: "blockReceipt", stat: result};
					globClient.send(JSON.stringify(response));
					break;
				}
			}
		}catch(e){
			console.log(chalk.green(e));
		}
	});

	globClient.on("close", function close() {
		if(config.clientVerbose){
			console.log("------------------CLIENT CLOSED!");
		}
	});

	globClient.on("error", function error(e) {
		setTimeout(function(){
			if(index != config.neighbors.length-1){
				synch(index+1);
			}else{
				synch(0);
			}
		}, 1000);
		console.log(chalk.red(e));
	});
};

const gotNewMinedBlock = function(recievedBlock){
	if(recievedBlock.isMined() && blocks[recievedBlock.height] == null){
		process.stdout.write("\r\x1b[K"); //clear "mining block" message
		console.log(chalk.red("SNIPED\n"));

		console.log("Target:  " + recievedBlock.target);
		console.log("Nonce: " + recievedBlock.nonce);
		console.log("Hash:  " + recievedBlock.hash);

		console.log(chalk.red("--------------------------------/ " + recievedBlock.height + " /--------------------------------\n"));

		if(minerProc){
			minerProc.kill();
		}

		addBlock(recievedBlock);

		currentBlock = makeEmptyBlock().mine(updateMinerProc, blockMined);

		broadcastBlock(recievedBlock);
		return true;
	}else{
		return false;
	}
};

const startServer = function(){
	globServer = new WebSocket.Server({ port: config.serverPort });
	globServer.on("connection", function connection(ws) {
		ws.on("message", function incoming(message) {
			try{
				let pData = JSON.parse(message);
				if(config.serverVerbose){
					console.log("--------------SERVRECV: " + pData.type);
					console.log(pData);
					console.log("/-------------SERVRECV");
				}
				let response = {};
				switch(pData.type){
					case "blockCountRequest": {
						response = {type: "blockCount", blockCount: blocks.length};
						break;
					}
					case "blockRequest": {
						if(pData.height == 	"EMPTY"){
							pData.height = 0;
						}
						let blockDataArray = [];
						for(let i = parseInt(pData.height); i < blocks.length; i++){
							blockDataArray.push(blocks[i].getBlockData());
						}
						response = {type: "blockDataArray", blockDataArray: blockDataArray};
						break;
					}
					case "minedBlockData": {
						let recievedBlock = Block.makeCompletedBlock(pData.blockData);
						var result = gotNewMinedBlock(recievedBlock);
						let response = {type: "blockReceipt", stat: result};
						ws.send(JSON.stringify(response));
						break;
					}
					default: {
						response = {type: "unknownRequest"};
						break;
					}
				}
				
				ws.send(JSON.stringify(response));
				if(config.serverVerbose){
					console.log("--------------SERVSEND: " + response.type);
					console.log(JSON.stringify(response));
					console.log("/-------------SERVSEND");
				}
			}catch(e){
				console.log(chalk.red(e));
			}
		});
		ws.on("error", function error(e) {
			console.log(chalk.red(e));
			console.log("");
			quitClient();
		});
	});
};

let alreadyReadied = false;
const clientReady = function(){
	if(!alreadyReadied){
		alreadyReadied = true;
		console.log(chalk.green("SYNCH COMPLETE"));
		if(blocks.length == 0){
			blocks.push(Block.getGenesisBlock());
		}
		currentBlock = makeEmptyBlock().mine(updateMinerProc, blockMined);
	}
};

const blockMined = function(block){
	if(block != null){
		addBlock(block);
		broadcastBlock(block);
		currentBlock = makeEmptyBlock().mine(updateMinerProc, blockMined);
	}
};

const updateMinerProc = function(iMinerProc){
	minerProc = iMinerProc;
};

const addBlock = function(block){
	blocks[block.height] = block;
	BLOCKDB.put(block.height, block.getBlockData(), function (err) {
		if (err) return console.log("Ooops!", err);
	});
	CLIENTDB.put("blockHeight", block.height, function (err) {
	});
};

const broadcastBlock = function(block){
	const request = {type: "minedBlockData", blockData: block.getBlockData()};

	globClient.send(JSON.stringify(request)); //send to first neighbor

	globServer.clients.forEach(function each(client) { //send to connected clients
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(request));
		}
	});
};

const getBlocksFromDB = function(height){
	for(let i = 0; i <= height; i++){
		BLOCKDB.get(i, function (err, value) {
			if(err && err.type == "NotFoundError"){
				console.log("WTF?!", err);
			}else{
				const blockData = JSON.parse(value);
				const block = Block.makeCompletedBlock(blockData);
				blocks[block.height] = block;
			}
		});
	}
};

const saveBlocksDebugFile = function(){
	const blockDatas = helpers.blockArrayToBlockDataArray(blocks);
	fs.writeFileSync("./debug/" + config.clientIdentifier + "testBlocks.html", helpers.makeHTML(blockDatas));
};

const quitClient = function(){
	saveBlocksDebugFile();
	process.stdout.write("\r\x1b[K"); //clear "mining block" message
	console.log(chalk.yellow("Quit! Blocks dumped to log."));
	process.exit();
};

if(process.platform === "win32"){ //Thanks https://stackoverflow.com/a/14861513
	const rl = require("readline").createInterface({
		input: process.stdin,
		output: process.stdout
	});
	
	rl.on("SIGINT", function () {
		process.emit("SIGINT");
	});
}

process.on("SIGINT", function () {
	quitClient();
});