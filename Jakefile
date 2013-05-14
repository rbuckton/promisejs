var fs = require("fs");
var path = require("path");
var opts = { module: "umd", obj: "obj", experimental: true };

directory("obj");
directory("built");

var dirs = ["obj", "built"];

var symbols = {
    target: "built/symbols.js",
    inputs: ["symbols.ts"],
    outputs: ["built/symbols.js"],
    deps: [dirs]
};

var lists = {
    target: "built/lists.js",
    inputs: ["lists.ts"],
    outputs: ["built/lists.js"],
    deps: [symbols]
};

var tasks = {
    target: "built/tasks.js",
    inputs: ["tasks.ts"],
    outputs: ["built/tasks.js"],
    deps: [symbols, lists]
};

var futures = {
    target: "built/futures.js",
    inputs: ["futures.ts"],
    outputs: ["built/futures.js"],
    deps: [symbols, lists, tasks]
};

var eventstream = {
    target: "built/eventstream.js",
    inputs: ["eventstream.ts"],
    outputs: ["built/eventstream.js"],
    deps: [symbols, lists, tasks, futures]
};

var httpclient = {
    target: "built/httpclient.js",
    inputs: ["httpclient.ts"],
    outputs: ["built/httpclient.js"],
    deps: [symbols, lists, tasks, futures]
};

var tests = {
    target: "built/tests.js",
    inputs: ["tests.ts"],
    outputs: ["built/tests.js"],
    deps: [symbols, lists, tasks, futures, httpclient]
}

var modules = [
    symbols,
    lists,
    tasks,
    futures,
    //eventstream, 
    httpclient, 
    tests
];

// register all modules
modules.forEach(function (module) {
    var deps = [];
    var depsmap = {};

    var depfind = function (dep) {
        var stack = [dep];
        while (stack.length) {
            dep = stack.pop();
            if (typeof dep === "string") {
                if (!depsmap.hasOwnProperty(dep)) {
                    deps.push(dep);
                    depsmap[dep] = true;
                }
            }
            else if (Array.isArray(dep)) {
                stack = stack.concat(dep);
            }
            else if (Object(dep) === dep) {
                stack = stack.concat(dep.outputs);
            }
        }
    };

    module.inputs.forEach(function (path) { 
        file(path); 
        depfind(path);
    });

    module.deps.forEach(depfind);

    tsc(module.target, deps, module.inputs, { module: "umd", obj: "obj", experimental: true });    
})

task("default", ["build", "test"]);
task("build", modules.map(function (module) { return module.target; }));
task("rebuild", ["clean", "build"]);
task("world", ["clean", "build" , "test"]);

clean("clean", [], modules.map(function (module) { return module.target; }));
test("test", ["build"], ["built/tests.js"]);

/** Copies properties from one object to another
  */
function copy(dest, source) {
    if (Object(dest) !== dest) {
        dest = {};
    }
    
    if (Object(source) === source) {
        Object
            .getOwnPropertyNames(source)
            .forEach(function (name) { 
                    Object.defineProperty(
                        dest, 
                        name, 
                        Object.getOwnPropertyDescriptor(source, name)); 
            });
    }
    
    return dest;
}

function trimExtension(file) {
    return path.basename(file, ".js");
}

/** Defines a compile task
  */
function tsc(target, prereqs, sources, options) {
    options = copy({ target: "ES5" }, options);
    
    if (!Array.isArray(sources)) {
        sources = [sources];
    }
    
    // set a prereq on the source files
    if (Array.isArray(prereqs)) {
        prereqs = prereqs.concat(sources);
    }
    else if (Array.isArray(sources)) {
        prereqs = sources;
    }
    
    
    file(target, prereqs, { async: true }, function () {
        
        var out = target;
        var cmd = "tsc";
        if (options.experimental) cmd = "node ./bin/tsc";
        
        if (options.declaration) cmd += " --declaration";
        if (options.cflowu) cmd += " --cflowu";
        if (options.comments) cmd += " --comments";
        if (options.declcomments) cmd += " --declcomments";
        if (options.target) cmd += " --target " + options.target;
        if (/^amd$/i.test(options.module)) cmd += " --module amd";
        if (/^umd$/i.test(options.module)) cmd += " --out " + (options.obj ? options.obj : "obj");
        if (options.debug) cmd += " --sourcemap";
        
        cmd += " " + sources.join(" ");

        console.log(cmd);
        
        var spawn = require('child_process').spawn;
            tsc = spawn("cmd", ["/c", cmd], { stdio: "inherit" });
            
        tsc.on("exit", function (code) {
            if (code == 0) {                
                if (/^umd$/i.test(options.module)) {
                    
                    // get the name of the module from its filename
                    var targetId = trimExtension(target);
                    var umd = copy({ }, options.umd);                
                    
                    // read the source
                    var targetSrc = fs.readFileSync("obj/" + path.basename(target)).toString();
                    
                    // find the imports
                    var imports = [];
                    var re = /^\s*var\s+([a-z0-9_$]+)\s*=\s*require\s*\(\s*((['"])[[a-z0-9_\.\\\/ ]+\3)\s*\)\s*/gi;
                    var m;
                    while (m = re.exec(targetSrc)) {
                        imports.push(m[2]);
                    }
                    
                    // load the umd template
                    var umdSrc = fs.readFileSync("txt/umd.pre.js").toString();
                    
                    // transform the template
                    var finalSrc = umdSrc.replace(/\${(\w+)}/gi, function (_, id) {
                        if (id === "imports") {
                            return imports.length ? ", " + imports.join(", ") : "";
                        }
                        else if (id === "content") {
                            return targetSrc.split(/\r\n|\n/).join("\r\n    ").trim();
                        }
                        else if (id === "id") {
                            return targetId;
                        }
                        return "";
                    });
                    
                    // write the file
                    fs.writeFileSync(target, finalSrc);                
                }
            }
            complete();
        });
    });
}

function test(name, prereqs, file) {
    task(name, prereqs, { async: true }, function() {
        
        var cmd = "node " + path.basename(file);
        console.log(path.dirname(file) + " > " + cmd);
 
        var spawn = require('child_process').spawn;
            test = spawn("cmd", ["/c", cmd], { cwd: path.dirname(file), stdio: "inherit" });
       
        test.on("exit", function (code) {
            complete();
        });
    });
}

function clean(name, prereqs, paths) {
    if (!Array.isArray(paths)) {
        paths = [paths];
    }
    
    paths.forEach(function (path) {
        task(name + "-" + path, prereqs, function() {
            if (fs.existsSync(path)) {
                if (fs.statSync(path).isDirectory()) {
                    jake.rmRf(path);
                } 
                else {
                    fs.unlinkSync(path);
                }
            }
        });
    });
    
    task(name, prereqs.concat(paths.map(function(path) { return name + "-" + path; })));
}