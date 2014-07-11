"use strict";
let supertest = require("co-supertest");
let path = require("path");
let Hapi = require("../");

function tick(){
  return function(callback){
    setTimeout(callback, 0);
  };
}

describe("Server", function(){
  describe("#start", function(){
    let server;
    beforeEach(function(){
      server = new Hapi.Server(3001);
    });
    afterEach(function(done){
      server.stop(done);
    });
    it("should be called via yield", function*(){
      yield server.start();
    });
    it("should be called with callback", function(done){
      server.start(done);
    });
  });

  describe("#stop", function(){
    let server;
    beforeEach(function(done){
      server = new Hapi.Server(3001);
      server.start(done);
    });
    it("should be called via yield", function*(){
      yield server.stop();
    });
    it("should be called with callback", function(done){
      server.stop(done);
    });
  });
});


describe("route handlers", function(){
  let server;
  before(function*(){
    server = new Hapi.Server(3001);
    server.handler("test", function(route, options){
      return function*(request, reply){
        yield tick();
        options.option1.should.equal(1);
        reply("Named handler");
      };
    });
    server.handler("standard", function(route, options){
      return function(request, reply){
        options.option1.should.equal(2);
        reply("Standard named handler");
      };
    });
    server.route([{
      method: "GET",
      path: "/",
      config: {
        pre: [{method: function*(request, reply){
          yield tick();
          reply("Pre");
        }, assign: "pre1"}]
      },
      handler: function* (request, reply) {
        yield tick();
        request.pre.pre1.should.equal("Pre");
        reply("Handler");
      }
    },
    {
      method: "GET",
      path: "/namedHandler",
      handler: {"test": {option1: 1}}
    },
    {
      method: "GET",
      path: "/standard",
      config: {
        pre: [{method: function(request, reply){
          reply("Pre");
        }, assign: "pre1"}]
      },
      handler: function(request, reply){
        request.pre.pre1.should.equal("Pre");
        reply("Standard handler");
      }
    },
    {
      method: "GET",
      path: "/standardNamedHandler",
      handler: {"standard": {option1: 2}}
    },
    {
      method: "GET",
      path: "/withoutReply",
      handler: function*(request){
        return "Without reply";
      }
    },
    {
      method: "GET",
      path: "/withError",
      handler: function*(request){
        throw new Error("Some error");
      }
    },
    {
      method: "GET",
      path: "/withHapiError",
      handler: function*(request){
        throw Hapi.error.notFound("Hapi error");
      }
    }
    ]);
    yield server.start();
  });

  after(function*(){
    yield server.stop();
  });

  it("should allow to use generators as route handler", function*(){
    yield supertest(server.listener).get("/").expect(200).expect("Handler").end();
  });

  it("should allow to use generators inside named route handler", function*(){
    yield supertest(server.listener).get("/namedHandler").expect(200).expect("Named handler").end();
  });

  it("should allow to use standard route handler", function*(){
    yield supertest(server.listener).get("/standard").expect(200).expect("Standard handler").end();
  });

  it("should allow to use standard named route handler", function*(){
    yield supertest(server.listener).get("/standardNamedHandler").expect(200).expect("Standard named handler").end();
  });

  it("should allow to use generators as route handler without reply", function*(){
    yield supertest(server.listener).get("/withoutReply").expect(200).expect("Without reply").end();
  });

  it("should handle generator's exceptions", function*(){
    yield supertest(server.listener).get("/withError").expect(500).end(); //actual error message is hidden
  });

  it("should handle generator's exceptions of type hapi.error", function*(){
    let r = yield supertest(server.listener).get("/withHapiError").expect(404).end();
    r.body.message.should.equal("Hapi error");
  });

});


describe("server events", function(){
  let server, rootCalled = false, standardRootCalled = false;
  before(function*(){
    server = new Hapi.Server(3001);
    server.ext("onRequest", function*(request){
      if(request.url.path == "/"){
        yield tick();
        rootCalled = true;
        return;
      }
      if(request.url.path == "/withError"){
        throw Hapi.error.badRequest();
      }
      if(request.url.path == "/withData"){
        return "Test data";
      }
    });

    server.ext("onRequest", function(request, next){
      if(request.url.path == "/"){
        standardRootCalled = true;
        next();
        return;
      }
      if(request.url.path == "/standardWithError"){
        return next(Hapi.error.badRequest());
      }
      if(request.url.path == "/standardWithData"){
        return next(null, "Test data");
      }
    });
    server.route({
      method: "GET",
      path: "/",
      handler: function* (request, reply) {
        reply("Handler");
      }
    });
    yield server.start();
  });

  after(function*(){
    yield server.stop();
    rootCalled = false;
    standardRootCalled = false;
  });

  it("should allow to use generator as handler of server's events", function*(){
    yield supertest(server.listener).get("/").expect(200).expect("Handler").end();
    rootCalled.should.be.true;
    rootCalled = false;
  });

  it("should allow to event handler generators throw error", function*(){
    yield supertest(server.listener).get("/withError").expect(400).end();
  });

  it("should allow to event handler generators return data", function*(){
    yield supertest(server.listener).get("/withData").expect(200).expect("Test data").end();
  });

  it("should allow to use standard handler of server's events", function*(){
    yield supertest(server.listener).get("/").expect(200).expect("Handler").end();
    standardRootCalled.should.be.true;
    standardRootCalled = false;
  });

  it("should allow to standard handler throw error", function*(){
    yield supertest(server.listener).get("/standardWithError").expect(400).end();
  });

  it("should allow to standard handler return data", function*(){
    yield supertest(server.listener).get("/standardWithData").expect(200).expect("Test data").end();
  });
});

describe("methods", function(){
  let server;
  before(function*(){
    server = new Hapi.Server(3001);
    server.method("add", function*(a, b){
      yield tick();
      return a + b;
    });

    server.method("stdAdd", function(a, b, next){
      next(null, a + b);
    });

  });

  it("should add ability to use generators as server's method", function(done){
    server.methods.add(2, 3, function(err, result){
      if(err){
        return done(err);
      }
      result.should.equal(5);
      done();
    });
  });

  it("should also support standart functions as server's method", function(done){
    server.methods.stdAdd(5, 3, function(err, result){
      if(err){
        return done(err);
      }
      result.should.equal(8);
      done();
    });
  });

});

describe("registering of plugins", function(){
  let server, plugin1, plugin1Registered = false,
    plugin2, plugin2Registered = false, plugin3, plugin3Registered = false;
  before(function*(){
    plugin1 = {
      register: function(plugin, options, next){
        plugin1Registered = true;
        next();
      }
    };
    plugin2 = {
      register: function(plugin, options, next){
        plugin2Registered = true;
        next();
      }
    };
    plugin3 = {
      register: function*(plugin, options){
        yield tick();
        plugin3Registered = true;
      }
    };
    plugin1.register.attributes = {
      name: "plugin1",
      version: "1.0.0"
    };
    plugin2.register.attributes = {
      name: "plugin2",
      version: "1.0.0"
    };
    plugin3.register.attributes = {
      name: "plugin3",
      version: "1.0.0"
    };
    server = new Hapi.Server(3001);
  });

  it("should add ability to use pack.register with yield", function*(){
    plugin1Registered = false;
    yield server.pack.register(plugin1);
    plugin1Registered.should.be.true;
  });

  it("should add ability to use pack.register with callback", function(done){
    plugin2Registered = false;
    server.pack.register(plugin2, function(err){
      if(err){
        return done(err);
      }
      plugin2Registered.should.be.true;
      done();
    });
  });

  it("should add ability to use generator as plugin's register", function*(){
    plugin3Registered = false;
    yield server.pack.register(plugin3);
    plugin3Registered.should.be.true;
  });
});

describe("plugin's actions", function(){
  let server, afterCalled = false, dependencyCalled = false, plugin2Registered = false;
  before(function*(){
    server = new Hapi.Server(3001);
    let plugin1 =  {
      register: function*(plugin, options){
        plugin.after(function*(p){
          yield tick();
          p.should.equal(plugin);
          afterCalled = true;
        });
        plugin.method("sum", function*(a,b){return a+b;});
        plugin.handler("pluginHandler", function(route, options){
          return function*(request){
            options.option1.should.equal(1);
            return "Plugin Handler";
          };
        });
        plugin.route([
          {
            method: "GET",
            path: "/handler",
            handler: function* (request, reply) {
              yield tick();
              reply("Handler");
            }
          },
          {
            method: "GET",
            path: "/namedHandler",
            handler: {"pluginHandler": {option1: 1}}
          }
        ]);
        yield plugin.register({
          register: function*(){
            plugin2Registered = true;
          },
          name: "plugin2"
        });
        plugin.dependency("plugin2", function*(p){
          yield tick();
          p.should.equal(plugin);
          dependencyCalled = true;
        });
        plugin.ext("onRequest", function*(request){
          if(request.url.path == "/ext"){
            return "Ext";
          }
        });
      },
      name: "plugin1"
    };
    yield server.pack.register(plugin1);
    yield server.start();
  });

  after(function*(){
    yield server.stop();
  });

  it("should allow to use generators inside plugin.server()", function(done){
    server.methods.sum(1, 2, function(err, result){
      if(err){
        return done(err);
      }
      result.should.equal(3);
      done();
    });
  });

  it("should allow to use generators inside plugin.after()", function(){
    afterCalled.should.be.true;
  });

  it("should allow to use generators inside plugin.route()", function*(){
    yield supertest(server.listener).get("/handler").expect(200).expect("Handler").end();
  });

  it("should allow to use generators inside plugin.handler()", function*(){
    yield supertest(server.listener).get("/namedHandler").expect(200).expect("Plugin Handler").end();
  });

  it("should allow to use yield plugin.register()", function(){
    plugin2Registered.should.be.true;
  });

  it("should allow to use generators inside plugin.dependency()", function(){
    dependencyCalled.should.be.true;
  });

  it("should allow to use generators inside plugin.ext()", function*(){
    yield supertest(server.listener).get("/ext").expect(200).expect("Ext").end();
  });
});

describe("Pack.compose()", function(){
  it("should allow to be called with yield", function*(){
    let manifest = {
      pack: {
        cache: "catbox-memory"
      },
      servers: [{
        port: 3001,
        options: {
          labels: ["web"]
        }
      }],
      plugins:{
      }
    };
    manifest.plugins[path.join(__dirname, "test_plugin.js")] = {};
    let pack = yield Hapi.Pack.compose(manifest);
    pack.should.be.ok;
  });
});