const chalk = require("chalk");

const Block = require("./modules/Block.js");
const Transaction = require("./modules/Transaction.js");
const Account = require("./modules/Account.js");

const account = Account.randomAccount();

const genesisTransaction = new Transaction(null, account.getAddress(), 25000000, Date.now(), null);
genesisTransaction.sign(account);

const genesisBlockData = {
	previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
	height: 0,
	transactions: [genesisTransaction],
	target: "00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
	merkleRoot: "",
	nonce: 0,
	hash: "00000d68643e39d16044d3e98707a0902139dd8984f9f960b55e3c1bd5d927e2",
	timestamp: 0
};

let genesisBlock = Block.makeCompletedBlock(genesisBlockData);

genesisBlock.makeMerkleTree();

genesisBlock.mine(function(){}, function(block){
	console.log(chalk.cyan(account.getPrivateKey()));

	console.log(block.getBlockData());
});