const level = require("level");

const config = require("./config.js");

module.exports.UTXODB = level("./DB/"  + config.identifier + "/UTXODB");
module.exports.BLOCKDB = level("./DB/"  + config.identifier + "/BLOCKDB");
module.exports.CLIENTDB = level("./DB/"  + config.identifier + "/CLIENTDB");