//------------------------- Method 1

class TestClass1{
	constructor(a){
		this.a = a;
	}
	
	static someMethod(){
		return new this(5);
	}
	
	getA(){
		return this.a;
	}
}

var obj1 = new TestClass1(10);
console.log(obj1.getA());

var obj2 = TestClass1.someMethod();
console.log(obj2.getA());

//------------------------- Method 2

class TestClass2{
	makeFromNumber(a){
		this.a = a;
		return this;
	}
	
	someMethod(){
		this.a = 5;
		return this;
	}
	
	getA(){
		return this.a;
	}
}

var obj3 = new TestClass2().makeFromNumber(10);
console.log(obj3.getA());

var obj4 = new TestClass2().someMethod();
console.log(obj4.getA());