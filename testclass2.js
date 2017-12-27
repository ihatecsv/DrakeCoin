var TestClass1 = require("./testclass.js").TestClass1;

var obj1 = new TestClass1(10);
console.log(obj1.getA());

var obj2 = TestClass1.someMethod();
console.log(obj2.getA());