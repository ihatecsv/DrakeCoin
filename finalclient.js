const net = require('net');
const level = require('level');
const chalk = require('chalk');
const helpers = require('./helpers.js');
const keygen = require('./keygen.js');
const fs = require('fs');
const exec = require('child_process').execFile;

let config = {};

if(fs.existsSync("config.json")){
	config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
}else{
	fs.createReadStream("sample-config.json").pipe(fs.createWriteStream("config.json"));
	console.log("Made configuration file! Please edit config.json before running again.");
	return;
}

let clientIdentifier = config.clientIdentifier;
let randomClientIdentifier = config.randomClientIdentifier;
if(randomClientIdentifier){
	clientIdentifier = Math.floor(Math.random()*10000);
}

const serverPort = config.serverPort;
const neighbors = config.neighbors;
const difficulty = config.difficulty;
const fakeTransactions = config.fakeTransactions;
const merkleTreeHashDispLength = config.merkleTreeHashDispLength;
const indexMerkleTreeHashOne = config.indexMerkleTreeHashOne;
const clientVerbose = config.clientVerbose;
const serverVerbose = config.serverVerbose;

const target = "0".repeat(difficulty) + "f".repeat(64-difficulty);

const UTXODB = level('./DB/UTXODB' + clientIdentifier);
const BLOCKDB = level('./DB/BLOCKDB' + clientIdentifier);
const CLIENTDB = level('./DB/CLIENTDB' + clientIdentifier);

let blocks = [];
let unconfirmedTX = [];
let blockHeight = "EMPTY";
let address = "";

let server = null;
let miningProc = null;

CLIENTDB.get('address', function (err, value) {
	if(err && err.type == 'NotFoundError'){
		console.log("Generating new address!");
		const keypair = keygen.genPair();
		CLIENTDB.put('address', keypair.address, function (err) {
			if (err) return console.log('Ooops!', err);
		});
		CLIENTDB.put('privateKey', keypair.privateKey, function (err) {
			if (err) return console.log('Ooops!', err);
		});
		address = keypair.address;
	}else{
		address = value;
	}
	CLIENTDB.get('blockHeight', function (err, value) {
		if(err && err.type == 'NotFoundError'){
			CLIENTDB.put('blockHeight', "EMPTY", function (err) {
				if (err) return console.log('Ooops!', err);
			});
		}else{
			blockHeight = value;
			getBlocksFromDB(blockHeight);
		}
		startUp();
	});
});

class MerkleNode {
	constructor(parentNode, childNode0, childNode1, transaction) {
		this.parentNode = parentNode;
		this.childNodes = [];
		this.childNodes[0] = childNode0;
		this.childNodes[1] = childNode1;
		this.transaction = transaction;
	}
	computeHash() {
		if(this.transaction != null){
			this.hash = helpers.sha256(JSON.stringify(this.transaction));
		}else{
			this.hash = helpers.sha256(this.childNodes[0].hash + this.childNodes[1].hash);
		}
	}
	setParentNode(parentNode){
		this.parentNode = parentNode;
	}
	setChildNode(index, childNode){
		this.childNodes[index] = childNode;
	}
	getHash() {
		return this.hash;
	}
}

const compareNode = function(a, b){
	if (a.getHash() < b.getHash())
		return -1;
	if (a.getHash() > b.getHash())
		return 1;
	return 0;
}

const genTree = function(block){
	let transactions = block.transactions;
	let leveledHashes = [];
	let cL = 0;
	
	transactions.sort();
	let root = false;
	leveledHashes[cL] = [];
	for(let i = 0; i < transactions.length; i++){ //go through each transaction,
		let newNode = new MerkleNode(null, null, null, transactions[i]); //add each one to a new merkle node
		newNode.computeHash(); //compute the hash
		leveledHashes[cL].push(newNode); //push to the current (bottom) level of the tree
	}
	leveledHashes[cL].sort(compareNode); //sort the base row
	let count = 0;
	while(!root){ //while we're below the root node
		cL++; //increase our current level
		leveledHashes[cL] = [];
		if(leveledHashes[cL-1].length % 2 != 0){ //if the number of hashes in the previous level is not even
			leveledHashes[cL-1].push(leveledHashes[cL-1][leveledHashes[cL-1].length-1]); //duplicate the last hash
		}
		for(let i = 0; i < leveledHashes[cL-1].length; i++){ //loop through the hashes in the previous level
			if(i%2 === 0){ //if the index is even
				let newNode = new MerkleNode(null, leveledHashes[cL-1][i], leveledHashes[cL-1][i+1], null); //make a new node at the current level, with children of the two below nodes.
				newNode.computeHash(); //compute hash from children
				leveledHashes[cL-1][i].setParentNode(newNode); //set children to ref parent
				leveledHashes[cL-1][i+1].setParentNode(newNode); //set children to ref parent
				leveledHashes[cL].push(newNode); //add the new node to the current level
			}
		}
		if(leveledHashes[cL].length == 1){
			root = true;
			block.hashedData.merkleRoot = leveledHashes[cL][0].getHash();
		}
	}
	process.stdout.write(" ".repeat(4));
	for(let i = 0; i < leveledHashes[0].length; i++){
		let index = i;
		if(indexMerkleTreeHashOne){ //let's make this ez
			index++;
		}
		let spaceCount = merkleTreeHashDispLength-(index.toString().length-1);
		let spaceString = " ".repeat(spaceCount);
		process.stdout.write(chalk.gray(index + spaceString));
	}
	process.stdout.write("\n");
	
	for(let i = 0; i < leveledHashes.length; i++){ //print tree
		let lastHash = "";
		process.stdout.write("L" + i + ": ");
		for(let j = 0; j < leveledHashes[i].length; j++){
			let curHash = leveledHashes[i][j].getHash();
			let curHashReady = curHash.substring(0, merkleTreeHashDispLength) + " ";
			if(curHash == lastHash){
				process.stdout.write(chalk.cyan(curHashReady));
			}else{
				process.stdout.write(curHashReady);
			}
			lastHash = curHash;
		}
		process.stdout.write("\n");
	}
	process.stdout.write("\n");
}

const normalize = function(block){
	block.data = JSON.stringify(block.hashedData);
	delete block.hashedData;
}

let currentBlockHeight;
let currentBlock;
let prevTime;

const mine = function(block){
	const height = block.hashedData.height;
	console.log(chalk.green("--------------------------------# " + height + " #--------------------------------"));
	prevTime = new Date().getTime();
	genTree(block);
	normalize(block);
	const data = block.data;
	currentBlock = block;
	currentBlockHeight = height;
	let minerParams = [];
	let minerLoc = "";
	process.stdout.write(chalk.magenta("Mining block (" + process.platform + ")..."));
	switch(process.platform){
		case "win32":
			minerParams = [target, data];
			minerLoc = "DCSHA256/bin/Release/DCSHA256.exe";
			break;
		case "linux":
			minerParams = [target, data];
			minerLoc = "DCSHA256/bin/Release/DCSHA256";
			break;
		default:
			minerParams = ["jsminer.js", target, data];
			minerLoc = "node";
			break;
	}
	miningProc = exec(minerLoc, minerParams, function(err, nonce) {
		if(err){
			return;
		}
		
		const parsedNonce = parseInt(nonce);
		currentBlock.data += parsedNonce;
		currentBlock.hash = helpers.sha256(currentBlock.data);
		
		blocks[currentBlockHeight] = block;
		addBlock(block, currentBlockHeight);
		broadcastBlock(block, currentBlockHeight);
		
		const now = new Date().getTime();
		process.stdout.write("\r\x1b[K"); //clear "mining block" message
		console.log(chalk.blue("Mined block!\n"));
		console.log("Rate:  " + ((parsedNonce/((now-prevTime)/1000))/1000000).toFixed(2) + chalk.gray(" MH/s"));
		console.log("Diff:  " + difficulty);
		console.log("parsedNonce: " + parsedNonce);
		console.log("Hash:  " + currentBlock.hash);

		console.log(chalk.green("--------------------------------/ " + currentBlockHeight + " /--------------------------------\n"));
		mine(makeFakeBlock());
	});
}

const genFakeTransactions = function(){
	let transactions = [];
	const numOfTransactions = Math.floor(Math.random()*fakeTransactions);
	for(let i = 0; i < numOfTransactions; i++){
		const time = Math.round((new Date()).getTime() / 1000);
		const trans = {
			reciever: keygen.genPair().address,
			amount: Math.ceil(Math.random()*1000000),
			timestamp: time,
			prevOut: "someid",
			sig: "aaa"
		};
		transactions.push(trans);
	}
	return transactions;
}

const makeFakeBlock = function(){
	const time = Math.round((new Date()).getTime() / 1000);
	let block = {
		hash: "",
		transactions: genFakeTransactions(),
		hashedData: {
			previousHash: blocks[blocks.length-1].hash,
			height: blocks.length,
			timestamp: time,
			merkleRoot: ""
		}
	}
	
	block.transactions.unshift( //Miner gotta get paid!
		{
			reciever: address,
			amount: 25000000,
			timestamp: time
		}
	);
	return block;
}

const verifyBlock = function(block){ //expand, of course
	const expandedBlock = helpers.expandBlock(block);
	const checkHash = helpers.sha256(block.data);
	const blockHash = block.hash;
	if(checkHash == blockHash && blocks[expandedBlock.height] == null){
		return true;
	}
	return false;
}

const startUp = function(){
	helpers.logSolo("DrakeCoin client initialization...\n");
	console.log("Client running with address: " + address);
	console.log("Current height: " + blockHeight);
	synch();
}

const startServer = function(){
	server = net.createServer(function(socket) {
		socket.pipe(socket);
		socket.on('data', function(data) {
			try{
				pData = JSON.parse(data.toString());
				if(serverVerbose){
					console.log("------------------RECV: " + pData.type);
					console.log(pData);
					console.log("/-----------------RECV");
				}
				let response = {};
				switch(pData.type){
					case "blockHeightRequest":
						response = {type: "blockHeight", blockHeight: blocks.length-1};
						break;
					case "blockRequest":
						if(pData.height == "EMPTY"){
							pData.height = 0;
						}
						let blockArray = [];
						for(let i = parseInt(pData.height); i < blocks.length; i++){
							blockArray.push(blocks[i]);
						}
						response = {type: "blockArray", blockArray: blockArray};
						break;
					case "minedBlock":
						if(verifyBlock(pData.block)){
							process.stdout.write("\r\x1b[K"); //clear "mining block" message
							console.log(chalk.red("SNIPED\n"));
							if(miningProc != null){
								miningProc.kill();
							}
							addBlock(pData.block, pData.height);
							broadcastBlock(pData.block, pData.height);
							
							let expandedNewBlock = helpers.expandBlock(pData.block);
							console.log("Diff:  " + difficulty);
							console.log("Nonce: " + expandedNewBlock.nonce);
							console.log("Hash:  " + expandedNewBlock.hash);
							console.log(chalk.green("--------------------------------/ " + expandedNewBlock.hashedData.height + " /--------------------------------\n"));
							
							mine(makeFakeBlock());
							response = {type: "blockReceipt", stat: true};
						}else{
							response = {type: "blockReceipt", stat: false};
						}
						break;
					default:
						response = {type: "unknownRequest"}
						break;
				}
				
				socket.write(JSON.stringify(response));
				if(serverVerbose){
					console.log("------------------SEND: " + response.type);
					console.log(JSON.stringify(response));
					console.log("/-----------------SEND");
				}
			}catch(e){
			}
		});
		
		socket.on('error', function(err) {
			console.log(chalk.red("SERVER ERROR"));
			return;
		});
	});
	server.listen(serverPort);
}

const synch = function(){
	const client = new net.Socket();
	if(clientVerbose){
		console.log("Connecting to " + neighbors[0].address + ":" + neighbors[0].port);
	}
	client.connect(neighbors[0].port, neighbors[0].address, function() {
		const request = {type: "blockHeightRequest"};
		client.write(JSON.stringify(request));
	});

	client.on('data', function(data) {
		try{
			const pData = JSON.parse(data.toString());
			if(clientVerbose){
				console.log("------------------RECV: " + pData.type);
				console.log(pData);
				console.log("/-----------------RECV");
			}
			switch(pData.type){
				case "blockHeight":
					console.log("Remote block height: " + pData.blockHeight);
					if(blockHeight == "EMPTY" || blockHeight < pData.blockHeight){
						const request = {type: "blockRequest", height: blockHeight};
						client.write(JSON.stringify(request));
					}else{
						client.destroy();
					}
					break;
				case "blockArray":
					for(let i = 0; i < pData.blockArray.length; i++){
						const data = pData.blockArray[i].data;
						const strippedData = data.substr(0, data.lastIndexOf("}")+1);
						const height = JSON.parse(strippedData).height;
						if(verifyBlock(pData.blockArray[i])){
							addBlock(pData.blockArray[i], height);
						}
					}
					client.destroy();
					break;
			}
		}catch(e){
		}
	});

	client.on('close', function() {
		if(clientVerbose){
			console.log("------------------CLIENT CLOSED!");
		}
		clientReady();
	});
	
	client.on('error', function(e) {
		if(clientVerbose){
			console.log("------------------CLIENT ERROR!");
		}
	});
}

const clientReady = function(){
	console.log(chalk.green("SYNCH COMPLETE"));
	startServer();
	mine(makeFakeBlock());
}

const addBlock = function(block, height){
	const stringBlock = JSON.stringify(block);
	blocks[height] = block;
	BLOCKDB.put(height, stringBlock, function (err) {
		if (err) return console.log('Ooops!', err);
	});
	CLIENTDB.put('blockHeight', height, function (err) {
	});
}

const broadcastBlock = function(block, height){
	const client = new net.Socket();
	for(let i = 0; i < neighbors.length; i++){
		client.connect(neighbors[i].port, neighbors[i].address, function() {
			const request = {type: "minedBlock", block: block, height: height};
			console.log(chalk.cyan("Sending block " + height + " to " + neighbors[i].address + ":" + neighbors[i].port));
			client.write(JSON.stringify(request));
			client.destroy();
		});

		client.on('close', function() {
		});
		
		client.on('error', function(e) {
		});
	}
}

const getHeightFromBlock = function(block){
	const data = block.data;
	const strippedData = data.substr(0, data.lastIndexOf("}")+1);
	return JSON.parse(strippedData).height;
}

const getBlocksFromDB = function(height){
	for(let i = 0; i <= height; i++){
		BLOCKDB.get(i, function (err, value) {
			if(err && err.type == 'NotFoundError'){
				console.log('WTF?!', err);
			}else{
				const block = JSON.parse(value);
				const height = getHeightFromBlock(block);
				blocks[height] = block;
			}
		});
	}
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
	const expandedBlocks = helpers.makeExpandedBlocksCopy(blocks);
	fs.writeFileSync("./debug/" + clientIdentifier + "testBlocksExpanded.html", helpers.makeHTML(expandedBlocks));
	fs.writeFileSync("./debug/" + clientIdentifier + "testBlocks.html", helpers.makeHTML(blocks));
	process.stdout.write("\r\x1b[K"); //clear "mining block" message
	console.log(chalk.yellow("Cancelled! Blocks dumped to log."));
	process.exit();
});