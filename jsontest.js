var testObj1 = {
	1: "Drake Luce",
	2: "5065550129",
	3: 20
};

var testObj2 = {
	2: "5065550129",
	1: "Drake Luce",
	3: 20
};

var testStr1 = JSON.stringify(testObj1);
var testStr2 = JSON.stringify(testObj2);

console.log(testStr1);
console.log(testStr2);

var parseObj1 = JSON.parse(testStr1);
var parseObj2 = JSON.parse(testStr2);

console.log(parseObj1[2]);
console.log(parseObj2[2]);