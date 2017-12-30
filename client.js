const WebSocket = require("ws");
const level = require("level");
const chalk = require("chalk");
const fs = require("fs");
var readline = require("readline");

const config = require("./modules/config.js");
const helpers = require("./modules/helpers.js");

const Block = require("./modules/Block.js");
const Transaction = require("./modules/Transaction.js");
const Account = require("./modules/Account.js");

const UTXODB = level("./DB/"  + config.identifier + "/UTXODB");
const BLOCKDB = level("./DB/"  + config.identifier + "/BLOCKDB");
const CLIENTDB = level("./DB/"  + config.identifier + "/CLIENTDB");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

let blocks = [];
let currentBlock = null;

let transactionQueue = [];

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
	if(config.clientverbose){
		console.log("Connecting to " + "ws://" + config.neighbors[index]);
	}
	globClient = new WebSocket("ws://" + config.neighbors[index]);

	globClient.on("open", function open() {
		const request = {type: "blockCountRequest"};
		if(config.clientverbose){
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
			if(config.clientverbose){
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
						if(config.clientverbose){
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
							blockFound(recievedBlock);
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
				case "unconfirmedTransaction": {
					let recievedTransaction = Transaction.makeCompletedTransaction(pData.transactionData);
					let result = gotNewUnconfirmedTransaction(recievedTransaction);
					let response = {type: "transactionReciept", stat: result};
					globClient.send(JSON.stringify(response));
					break;
				}
			}
		}catch(e){
			console.log(chalk.green(e));
		}
	});

	globClient.on("close", function close() {
		if(config.clientverbose){
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
		blockFound(recievedBlock);
		return true;
	}else{
		return false;
	}
};

const gotNewUnconfirmedTransaction = function(recievedTransaction){
	if (transactionQueue.filter(function(item){return item.sig === recievedTransaction.sig;}).length == 0) {
		if(recievedTransaction.verify()){
			transactionFound(recievedTransaction);
			return true;
		}else{
			return false;
		}
	}
};

const startServer = function(){
	globServer = new WebSocket.Server({ port: config.serverport });
	globServer.on("connection", function connection(ws) {
		ws.on("message", function incoming(message) {
			try{
				let pData = JSON.parse(message);
				if(config.serververbose){
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
						let result = gotNewMinedBlock(recievedBlock);
						let response = {type: "blockReceipt", stat: result};
						ws.send(JSON.stringify(response));
						break;
					}
					case "unconfirmedTransaction": {
						let recievedTransaction = Transaction.makeCompletedTransaction(pData.transactionData);
						let result = gotNewUnconfirmedTransaction(recievedTransaction);
						let response = {type: "transactionReciept", stat: result};
						globClient.send(JSON.stringify(response));
						break;
					}
					default: {
						response = {type: "unknownRequest"};
						break;
					}
				}
				
				ws.send(JSON.stringify(response));
				if(config.serververbose){
					console.log("--------------SERVSEND: " + response.type);
					console.log(JSON.stringify(response));
					console.log("/-------------SERVSEND");
				}
				
			}catch(e){
				console.log(chalk.cyan(e));
			}
			
		});
		ws.on("error", function error(e) {
			//console.log(chalk.red(e));
			//quitClient();
		});
	});
};

let alreadyReadied = false;
const clientReady = function(){
	if(!alreadyReadied){
		alreadyReadied = true;
		console.log(chalk.green("SYNCH COMPLETE"));
		if(blocks.length == 0){
			blockFound(Block.getGenesisBlock());
		}
		if(config.m){
			currentBlock = makeEmptyBlock().mine(updateMinerProc, blockFound);
		}
	}
};

const blockFound = function(block){
	if(block != null){
		if(config.m){
			process.stdout.write("\r\x1b[K"); //clear "mining block" message
			console.log(chalk.red("SNIPED\n"));

			console.log("Target:  " + block.target);
			console.log("Nonce: " + block.nonce);
			console.log("Hash:  " + block.hash);

			console.log(chalk.red("--------------------------------/ " + block.height + " /--------------------------------\n"));
		}
		if(minerProc){
			minerProc.kill();
		}
		addBlock(block);
		broadcastBlock(block);
		removeBlockTransactionsFromQueue(block);
		if(config.m){
			mineNewBlock();
		}
	}
};

const transactionFound = function(transaction){
	if(transaction != null){
		if(minerProc){
			minerProc.kill();
		}
		addTransaction(transaction);
		broadcastTransaction(transaction);
		if(config.m){
			mineNewBlock();
		}
	}
};

const mineNewBlock = function(){
	currentBlock = makeEmptyBlock();
	for(let i = 0; i < transactionQueue.length; i++){
		currentBlock.addTransaction(transactionQueue[i]);
	}
	currentBlock.mine(updateMinerProc, blockFound);
};

const updateMinerProc = function(iMinerProc){
	minerProc = iMinerProc;
};

const addBlock = function(block){
	blocks[block.height] = block;
	BLOCKDB.put(block.height, JSON.stringify(block.getBlockData()), function (err) {
		if(err){
			console.log(err);
		}
	});
	CLIENTDB.put("blockHeight", block.height, function (err) {
		if(err){
			console.log(err);
		}
	});
	block.transactions.forEach(function(transaction){
		UTXODB.put(transaction.sig, JSON.stringify(transaction.getTransactionData()), function (err) {
			if(err){
				console.log(err);
			}
		});
	});
};

const removeBlockTransactionsFromQueue = function(block){
	for(let i = 0; i < block.transactions.length; i++){
		const index = transactionQueue.map(function(transaction){return transaction.sig;}).indexOf(block.transactions[i].sig);
		transactionQueue.splice(index);
	}
};

const addTransaction = function(transaction){
	console.log(chalk.cyan("Added transaction " + transaction.sig + " to queue"));
	transactionQueue.push(transaction); //more?
};

const broadcastBlock = function(block){
	const request = {type: "minedBlockData", blockData: block.getBlockData()};
	broadcastRequest(request);
};

const broadcastTransaction = function(transaction){
	const request = {type: "unconfirmedTransaction", transactionData: transaction.getTransactionData()};
	broadcastRequest(request);
};

const broadcastRequest = function(request){
	if(globClient.OPEN){
		globClient.send(JSON.stringify(request)); //send to first neighbor
	}

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
	fs.writeFileSync("./debug/" + config.identifier + "testBlocks.html", helpers.makeHTML(blockDatas));
};

const quitClient = function(){
	saveBlocksDebugFile();
	process.stdout.write("\r\x1b[K"); //clear "mining block" message
	console.log(chalk.yellow("Quit! Blocks dumped to log."));
	process.exit();
};
if(!config.m){
	rl.on("line", function(line){
		switch(line){
			case "bT": {
				let newTrans = new Transaction("someTrans", account.getAddress(), Math.floor(Math.random()*100), Date.now(), null, null);
				newTrans.sign(account);
				transactionFound(newTrans);
			}
		}
	});
}

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