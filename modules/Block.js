const chalk = require("chalk");
const exec = require("child_process").execFile;

const config = require("./config.js");
const helpers = require("./helpers.js");

const Transaction = require("./Transaction.js");

class MerkleNode {
	constructor(parentNode, childNode0, childNode1, transactionHash) {
		this.parentNode = parentNode;
		this.childNodes = [];
		this.childNodes[0] = childNode0;
		this.childNodes[1] = childNode1;
		this.hash = transactionHash;
	}

	computeHash() {
		if(this.hash == null){
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

	static compareNode (a, b){
		if (a.hash < b.hash){
			return -1;
		}
		if (a.hash > b.hash){
			return 1;
		}
		return 0;
	}
}

class Block {
	constructor(previousHash, height, transactions, target){
		this.previousHash = previousHash;
		this.height = height;
		this.transactions = transactions;
		this.target = target;

		this.merkleRoot = null;
		this.nonce = null;
		this.hash = null;
		this.timestamp = null;
		this.miningState = {};
		
		this.makeMerkleTree();
	}

	static makeCompletedBlock(blockData){
		if(typeof blockData.transactions[0].getHash !== "function"){ 
			for(let i=0; i < blockData.transactions.length; i++){
				let realTransaction = Transaction.convertObjToTransaction(blockData.transactions[i]);
				blockData.transactions[i] = realTransaction;
			}
		}
		let block = new this(blockData.previousHash, blockData.height, blockData.transactions, blockData.target);
		block.merkleRoot = blockData.merkleRoot;
		block.nonce = blockData.nonce;
		block.hash = blockData.hash;
		block.timestamp = blockData.timestamp;
		return block;
	}

	static getGenesisBlock(){
		const genesisBlockData = {
			previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
			height: 0,
			transactions: [
				new Transaction(
					null, //input
					"DKcuMc1rQ4GK3yQUubrZrbMkTtPvWEuhoa", //output
					25000000, //reward
					1514599004624, //timestamp
					"ed4810d4588935f69664f6cef27b84f4f62f1167422661d6f5ff568779c6df297b7fa91d91d27e796ac97bb1ab95a1cd0dc31fc4f35b8578104a63d4dcd6dfe6", //sig
					"02901eff56e89e82cc8cd4b125bdfbd6d600227b87883d30d3a1dc94d6b5d5b415" //pubkey
				)
			],
			target: "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			merkleRoot: "5c96b78b095d1817b45ea775594c42f41c992bc2ba2d143768e9a221448fdf2f",
			nonce: 870536,
			hash: "00000b921a32e7425ae6bb6c272bca800895291f7c99824dabc7415e7a86ebf7",
			timestamp: 1514599004679
		};
		return this.makeCompletedBlock(genesisBlockData);
	}

	isMined(){ //TODO: check difficulty
		return this.hash == helpers.sha256(this.getHashableData() + this.nonce);
	}

	getBlockData(){
		if(this.isMined()){
			const blockData = {
				previousHash: this.previousHash,
				height: this.height,
				transactions: this.transactions,
				target: this.target,
				merkleRoot: this.merkleRoot,
				nonce: this.nonce,
				hash: this.hash,
				timestamp: this.timestamp
			};
			return blockData;
		}else{
			return null;
		}
	}

	resetMiner(){
		this.nonce = null;
		this.hash = null;
		this.timestamp = null;
		if(this.miningState.miningProc != null){
			this.miningState.miningProc.kill();
		}
	}
	
	addTransaction(transaction){
		this.transactions.push(transaction);
		this.resetMiner();
		this.makeMerkleTree();
	}

	getHashableData(){
		return [this.height, this.previousHash, this.timestamp, this.merkleRoot].toString() + "|";
	}
	
	makeMerkleTree(){
		this.leveledHashes = [];
		var transactions = this.transactions;
		transactions.sort();
		let cL = 0;

		if(transactions.length == 0){
			this.merkleRoot = null;
			return;
		}
		
		this.leveledHashes[cL] = [];
		for(let i = 0; i < transactions.length; i++){ //go through each transaction,
			const sig = transactions[i].getSig();
			const hash = helpers.sha256(sig);
			const newNode = new MerkleNode(null, null, null, hash); //add each one to a new merkle node
			newNode.computeHash(); //compute the hash
			this.leveledHashes[cL].push(newNode); //push to the current (bottom) level of the tree
		}
		this.leveledHashes[cL].sort(MerkleNode.compareNode); //sort the base row
		for(;;){ //while we're below the root node
			if(this.leveledHashes[cL].length == 1){
				this.merkleRoot = this.leveledHashes[cL][0].getHash();
				break;
			}
			cL++; //increase our current level
			this.leveledHashes[cL] = [];
			if(this.leveledHashes[cL-1].length % 2 != 0){ //if the number of hashes in the previous level is not even
				this.leveledHashes[cL-1].push(this.leveledHashes[cL-1][this.leveledHashes[cL-1].length-1]); //duplicate the last hash
			}
			for(let i = 0; i < this.leveledHashes[cL-1].length; i++){ //loop through the hashes in the previous level
				if(i%2 == 0){ //if the index is even
					var newNode = new MerkleNode(null, this.leveledHashes[cL-1][i], this.leveledHashes[cL-1][i+1], null); //make a new node at the current level, with children of the two below nodes.
					newNode.computeHash(); //compute hash from children
					this.leveledHashes[cL-1][i].setParentNode(newNode); //set children to ref parent
					this.leveledHashes[cL-1][i+1].setParentNode(newNode); //set children to ref parent
					this.leveledHashes[cL].push(newNode); //add the new node to the current level
				}
			}
		}
	}

	printMerkleTree(){
		process.stdout.write(" ".repeat(4));
		for(let i = 0; i < this.leveledHashes[0].length; i++){
			let index = i;
			if(config.indexMerkleTreeHashOne){ //let's make this ez
				index++;
			}
			var spaceCount = config.merkleTreeHashDispLength-(index.toString().length-1);
			var spaceString = " ".repeat(spaceCount);
			process.stdout.write(chalk.gray(index + spaceString));
		}
		process.stdout.write("\n");
		
		for(let i = 0; i < this.leveledHashes.length; i++){ //print tree
			let lastHash = "";
			process.stdout.write("L" + i + ": ");
			for(let j = 0; j < this.leveledHashes[i].length; j++){
				const curHash = this.leveledHashes[i][j].getHash();
				const curHashSnipped = curHash.substring(0, config.merkleTreeHashDispLength) + " ";
				if(curHash == lastHash){ //if a duplicate hash
					process.stdout.write(chalk.cyan(curHashSnipped));
				}else{
					process.stdout.write(curHashSnipped);
				}
				lastHash = curHash;
			}
			process.stdout.write("\n");
		}
		process.stdout.write("\n");
	}
	
	mine(minerProcCallback, minedCallback){
		console.log(chalk.red("--------------------------------# " + this.height + " #--------------------------------"));
		this.timestamp = new Date().getTime();
		let minerParams = [];
		let minerLoc = "";

		this.printMerkleTree();
		process.stdout.write(chalk.magenta("Mining block (" + process.platform + ")..."));
		switch(process.platform){
			case "win32":
				minerParams = [this.target, this.getHashableData()];
				minerLoc = "DCSHA256/bin/Release/DCSHA256.exe";
				break;
			case "linux":
				minerParams = [this.target, this.getHashableData()];
				minerLoc = "DCSHA256/bin/Release/DCSHA256";
				break;
			case "android":
				minerParams = [this.target, this.getHashableData()];
				minerLoc = "DCSHA256/bin/Release/DCSHA256Android";
				break;
			default:
				minerParams = ["jsminer.js", this.target, this.getHashableData()];
				minerLoc = "node";
				break;
		}
		const outerThis = this;
		this.miningState.miningProc = exec(minerLoc, minerParams, function(err, nonce) {
			if(err){ //TODO: is this right?
				return null;
			}

			outerThis.nonce = parseInt(nonce);
			outerThis.hash = helpers.sha256(outerThis.getHashableData() + outerThis.nonce);
			
			const now = new Date().getTime();
			process.stdout.write("\r\x1b[K"); //clear "mining block" message
			console.log(chalk.blue("Block mined!\n"));
			console.log("Rate:  " + ((outerThis.nonce/((now-outerThis.timestamp)/1000))/1000000).toFixed(2) + chalk.gray(" MH/s"));
			console.log("Target:  " + outerThis.target);
			console.log("Nonce: " + outerThis.nonce);
			console.log("Hash:  " + outerThis.hash);
			console.log(chalk.red("--------------------------------/ " + outerThis.height + " /--------------------------------\n"));
			minedCallback(outerThis);     		
		});
		minerProcCallback(this.miningState.miningProc);
	}
}

module.exports = Block;