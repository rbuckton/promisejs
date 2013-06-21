/// <reference path="../lib/node.d.ts" />
import events = module("events");
import assert = module("assert");
import domain = module("domain");
import tests_promises = module("tests.promises");
import tests_httpclient = module("tests.httpclient");

// needed to make sure TS doesn't optimize away the test
var _tests_promises = tests_promises.name,
    _tests_httpclient = tests_httpclient.name;

class TestCase extends events.EventEmitter {
    public test: () => void;
    public name: string;
    public requested: number = 0;
    public completed: number = 0;
    public nextTick: Function;
    public domain: domain.Domain;
    
    constructor(test: () => void) {
        super();
        this.test = test;
        this.name = (<any>test).name;
    }
    
    public run(): void {
        this.domain = domain.create();
        this.domain.on("error", e => { 
            this.emit("fail", e);
            this.emit("done");
        });
        this.domain.run(() => {
            this.nextTick = process.nextTick;
            process.nextTick = (task: () => void) => {
                this.requested++;
                this.nextTick.call(process, () => {
                    this.completed++;
                    this.exec(task);
                });
            }

            this.emit("start");
            this.exec(this.test);
        });
    }

    public exec(task: () => void) {
        task();
        if (this.completed === this.requested) {
            this.emit("pass");
            this.emit("done");
        }
    }
}

class TestRun {
    public errors = [];
    public requested = 0;
    public started = 0;
    public completed = 0;
    public passed = 0;
    public failed = 0;
    public testCases: TestCase[];
    
    constructor(tests: any[]) {        
        this.testCases = tests
            .reduce((list, module) => list
                .concat(Object.getOwnPropertyNames(module)
                    .map(name => module[name])
                    .filter(test => typeof test === "function")), [])
            .map(test => {
                var testCase = new TestCase(test);
                testCase.on("start", () => { 
                    this.started++; 
                });
                testCase.on("pass", () => { 
                    this.passed++; 
                });
                testCase.on("fail", (e) => {
                    this.failed++;
                    this.errors.push("Test failed: " + testCase.name + ". Message:", (e && e.stack) ? e.stack : e, "");                
                });
                testCase.on("done", () => {
                    this.completed++;
                    if (this.requested === this.completed) {
                        this.done();
                    }
                });
                return testCase;
            });
    }

    public run() {
        this.requested = this.testCases.length;
        this.testCases.forEach(testCase => testCase.run());
    }

    public done() {
        console.log("\r\n%sdone. succeeded: %s, failed: %s, total: %s\r\n", this.errors.concat("").join("\r\n"), this.passed, this.failed, this.requested);
    }

    public static run(tests: any[]) {
        var list = new TestRun(tests)
        list.run();
    }
}

TestRun.run([tests_promises, tests_httpclient]);