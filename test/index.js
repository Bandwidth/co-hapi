"use strict";
let supertest = require("co-supertest");
let Hapi = require("../");

function tick(){
  return function(callback){
    setTimeout(callback, 0);
  };
}


describe("handlers", function(){
  let server;
  before(function*(){
    server = new Hapi.Server(3001);
    server.route({
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
    });
    debugger;
    yield server.start();
  });

  after(function*(){
    yield server.stop();
  });

  it("should", function*(){
    yield supertest(server.listener).get("/").expect(200).expect("Hello, world!").end();
  });
});
