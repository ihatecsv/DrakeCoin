const net = require("net");
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

let server = null;

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

const genFakeTransactions = function(){
	let transactions = [];
	const numOfTransactions = Math.floor(Math.random()*config.fakeTransactions);
	for(let i = 0; i < numOfTransactions; i++){
		const time = Date.now();
		const trans = new Transaction("someInputTX", Account.randomAccount().getAddress(), Math.ceil(Math.random()*1000000), time, "aaa");
		transactions.push(trans);
	}
	return transactions;
};

const makeFakeBlock = function(){
	let block = new Block(blocks[blocks.length-1].hash, blocks.length, genFakeTransactions(), config.target);

	const minerTransaction = Transaction.makeRewardTransaction(account.getAddress(), 25000000);
	block.addTransaction(minerTransaction);

	return block;
};

const startUp = function(){
	helpers.logSolo("DrakeCoin client initialization...\n");
	console.log("Client running with address: " + account.getAddress());
	console.log("Current height: " + blockHeight);
	synch();
};

const startServer = function(){
	server = net.createServer(function(socket) {
		socket.pipe(socket);
		socket.on("data", function(data) {
			try{
				let pData = JSON.parse(data.toString());
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
						if(pData.height == "EMPTY"){
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
						if(recievedBlock.isMined() && blocks[recievedBlock.height] != null){
							process.stdout.write("\r\x1b[K"); //clear "mining block" message
							console.log(chalk.red("SNIPED\n"));
							if(currentBlock.miningState.miningProc != null){
								currentBlock.miningState.miningProc.kill();
								console.log("Killed miner!");
							}

							addBlock(recievedBlock);
							broadcastBlock(recievedBlock);

							console.log("Target:  " + recievedBlock.target);
							console.log("Nonce: " + recievedBlock.nonce);
							console.log("Hash:  " + recievedBlock.hash);
							console.log("Height:  " + recievedBlock.height);

							response = {type: "blockReceipt", stat: true};
						}else{
							response = {type: "blockReceipt", stat: false};
						}
						break;
					}
					default: {
						response = {type: "unknownRequest"};
						break;
					}
				}
				
				socket.write(JSON.stringify(response));
				if(config.serverVerbose){
					console.log("--------------SERVSEND: " + response.type);
					console.log(JSON.stringify(response));
					console.log("/-------------SERVSEND");
				}
			}catch(e){
			}
		});
		
		socket.on("error", function(err) {
			console.log(chalk.red(err));
			return;
		});
	});
	server.listen(config.serverPort);
};

const synch = function(){
	const client = new net.Socket();
	if(config.clientVerbose){
		console.log("Connecting to " + config.neighbors[0].address + ":" + config.neighbors[0].port);
	}
	client.connect(config.neighbors[0].port, config.neighbors[0].address, function() {
		const request = {type: "blockCountRequest"};
		client.write(JSON.stringify(request));
		if(config.clientVerbose){
			console.log("--------------CLI.SEND: " + request.type);
			console.log(JSON.stringify(request));
			console.log("/-------------CLI.SEND");
		}
	});

	client.on("data", function(data) {
		let pData = null;
		try{
			pData = JSON.parse(data.toString());
			if(config.clientVerbose){
				console.log("--------------CLI.RECV: " + pData.type);
				console.log(pData);
				console.log("/-------------CLI.RECV");
			}
		}catch(e){
			//console.log(chalk.magenta(e));
		}
		try{
			switch(pData.type){
				case "blockCount":
					console.log("Remote block count: " + pData.blockCount);
					if(blockHeight == "EMPTY" || blocks.length < pData.blockCount){
						const request = {type: "blockRequest", height: blocks.length};
						client.write(JSON.stringify(request));
						console.log("--------------CLI.SEND: " + request.type);
						console.log(JSON.stringify(request));
						console.log("/-------------CLI.SEND");
					}else{
						client.end();
					}
					break;
				case "blockDataArray":
					for(let i = 0; i < pData.blockDataArray.length; i++){
						let recievedBlock = Block.makeCompletedBlock(pData.blockDataArray[i]);
						if(recievedBlock.isMined()){
							addBlock(recievedBlock);
						}
					}
					client.end();
					break;
			}
		}catch(e){
			//console.log(chalk.green(e));
		}
	});

	client.on("close", function() {
		if(config.clientVerbose){
			console.log("------------------CLIENT CLOSED!");
		}
		if(blocks.length == 0){
			blocks.push(Block.getGenesisBlock());
		}
		clientReady();
	});
	
	client.on("error", function(e) {
		if(config.clientVerbose){
			console.log("------------------CLIENT ERROR!");
		}
	});
};

const clientReady = function(){
	console.log(chalk.green("SYNCH COMPLETE"));
	startServer();
	currentBlock = makeFakeBlock().mine(blockMined);
};

const blockMined = function(block){
	addBlock(block);
	broadcastBlock(block);
	currentBlock = makeFakeBlock().mine(blockMined);
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
	for(let i = 0; i < config.neighbors.length; i++){
		client.connect(config.neighbors[i].port, config.neighbors[i].address, function() {
			const request = {type: "minedBlockData", blockData: block.getBlockData()};
			console.log(chalk.cyan("Sending block " + block.height + " to " + config.neighbors[i].address + ":" + config.neighbors[i].port));
			console.log(chalk.green(JSON.stringify(request)));
			client.write(JSON.stringify(request));
			client.end();
		});

		client.on("close", function() {
		});
		
		client.on("error", function(e) {
			console.log(chalk.cyan("BROADCAST ERR"));
			console.log(chalk.cyan(e));
		});
	}
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
	const blockDatas = helpers.blockArrayToBlockDataArray(blocks);
	fs.writeFileSync("./debug/" + config.clientIdentifier + "testBlocks.html", helpers.makeHTML(blockDatas));
	process.stdout.write("\r\x1b[K"); //clear "mining block" message
	console.log(chalk.yellow("Cancelled! Blocks dumped to log."));
	process.exit();
});