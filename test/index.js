"use strict";
let supertest = require("co-supertest");
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
