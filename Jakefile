var fs = require("fs");
var path = require("path");

directory("obj");

// future0
file("Future0/futures.ts");
file("Future0/tests.ts");
directory("obj/Future0", ["obj"]);
tsc("Future0/futures.js", ["obj/Future0"], "Future0/futures.ts", { module: "umd", obj: "obj/Future0" });
tsc("Future0/tests.js", ["obj/Future0", "Future0/futures.js"], "Future0/tests.ts", { module: "umd", obj: "obj/Future0" });
task("Future0-build", ["Future0/futures.js", "Future0/tests.js"]);
test("Future0-test", ["Future0-build"], "Future0/tests.js");
clean("Future0-clean", [], ["Future0/futures.js", "Future0/tests.js", "obj/Future0"]);

// future1
file("Future1/futures.ts");
file("Future1/tests.ts");
directory("obj/Future1", ["obj"]);
tsc("Future1/futures.js", ["obj/Future1"], "Future1/futures.ts", { module: "umd", obj: "obj/Future1" });
tsc("Future1/tests.js", ["obj/Future1", "Future1/futures.js"], "Future1/tests.ts", { module: "umd", obj: "obj/Future1" });
task("Future1-build", ["Future1/futures.js", "Future1/tests.js"]);
test("Future1-test", ["Future1/"], "Future1/tests.js");
clean("Future1-clean", [], ["Future1/futures.js", "Future1/tests.js", "obj/Future1"]);

// future2
file("Future2/symbols.ts");
file("Future2/futures.ts");
file("Future2/tests.ts");
directory("obj/Future2", ["obj"]);
tsc("Future2/symbols.js", ["obj/Future2"], "Future2/symbols.ts", { module: "umd", obj: "obj/Future2" });
tsc("Future2/futures.js", ["obj/Future2", "Future2/symbols.js"], "Future2/futures.ts", { module: "umd", obj: "obj/Future2"  });
tsc("Future2/tests.js", ["obj/Future2", "Future2/futures.js"], "Future2/tests.ts", { module: "umd", obj: "obj/Future2"  });
task("Future2-build", ["Future2/symbols.js", "Future2/futures.js", "Future2/tests.js"]);
test("Future2-test", ["Future2-build"], "Future2/tests.js");
clean("Future2-clean", [], ["Future2/symbols.js", "Future2/futures.js", "Future2/tests.js", "obj/Future2"]);

task("default", ["test"]);
task("build", ["Future0-build", "Future1-build", "Future2-build"]);
task("clean", ["Future0-clean", "Future1-clean", "Future2-clean"]);
task("rebuild", ["clean", "build"]);
task("test", ["Future0-test", "Future1-test", "Future2-test"]);
task("world", ["clean", "build", "test"]);

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

function trimExtension(path) {
    return String(path).replace(/\.[a-z_\-0-9]+$/i, "");
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
                    var targetSrc = fs.readFileSync("obj/" + target).toString();
                    
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