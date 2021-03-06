const crypto = require("crypto");
const fs = require("fs");

const syntaxHighlight = function(json) { //Thanks https://stackoverflow.com/a/7220510
	if (typeof json != "string") {
		json = JSON.stringify(json, undefined, 2);
	}
	json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
		var cls = "number";
		if (/^"/.test(match)) {
			if (/:$/.test(match)) {
				cls = "key";
			} else {
				cls = "string";
			}
		} else if (/true|false/.test(match)) {
			cls = "boolean";
		} else if (/null/.test(match)) {
			cls = "null";
		}
		return "<span class=\"" + cls + "\">" + match + "</span>";
	});
};

module.exports.logSolo = function(data) {
	process.stdout.write("\x1Bc");
	console.log(data);
};

module.exports.makeHTML = function(obj) {
	var finalHTML = fs.readFileSync("jsonHeader.html");
	finalHTML += "<pre>" + syntaxHighlight(obj) + "</pre>";
	finalHTML += fs.readFileSync("jsonFooter.html");
	return finalHTML;
};

module.exports.sha256 = function(string){
	return crypto.createHash("sha256").update(string).digest().toString("hex");
};

module.exports.blockArrayToBlockDataArray = function(blocks){
	return blocks.map(x => x.getBlockData());
};

module.exports.transactionArrayToTransactionDataArray = function(transactions){
	return transactions.map(x => x.getTransactionData());
};