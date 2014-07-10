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
        reply("Hello, world!");
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
    ]);
    yield server.start();
  });

  after(function*(){
    yield server.stop();
  });

  it("should allow to use generators as route handler", function*(){
    yield supertest(server.listener).get("/").expect(200).expect("Hello, world!").end();
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

});
