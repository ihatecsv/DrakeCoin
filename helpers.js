let crypto = require('crypto');
let fs = require('fs');

var syntaxHighlight = function(json) { //Thanks https://stackoverflow.com/a/7220510
    if (typeof json != 'string') {
         json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

module.exports.logSolo = function(data) {
	process.stdout.write('\033c');
	console.log(data);
}

module.exports.makeHTML = function(obj) {
	var beautyJSON = JSON.stringify(obj, null, 2);
	var finalHTML = fs.readFileSync('jsonHeader.html');
	finalHTML += "<pre>" + syntaxHighlight(beautyJSON) + "</pre>";
	finalHTML += fs.readFileSync('jsonFooter.html');
	return finalHTML;
}

module.exports.sha256 = function(string){
	return crypto.createHash('sha256').update(string).digest('base16').toString('hex');
}