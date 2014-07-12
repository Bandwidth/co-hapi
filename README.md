# co-hapi

[![Build](https://travis-ci.org/avbel/co-hapi.png)](https://travis-ci.org/avbel/co-hapi)
[![Dependencies](https://david-dm.org/avbel/co-hapi.png)](https://david-dm.org/avbel/co-hapi)


This module lets you use powered by [co](https://github.com/visionmedia/co) generators inside [hapi](http://hapijs.com/) applications. Node 0.11+ is required. Forget aboout callback hell.


## Install

    $ npm install co-hapi co hapi

## Usage

Use

```
let Hapi = require("co-hapi");
```

instead of

```
var Hapi = require("hapi");
```

See a demo bellow to see abilities of this module

```
"use strict";
let Hapi = require("co-hapi");
let co = require("co");

co(function*(){
  let server = new Hapi.Server(8080);
  server.ext("onRequest", function*(request){
    request.setUrl("/test");
    //return nothing <=> next()
    //throw error <=> next(err)
    //return value <=> next(null, value)
  });

  server.handler("myHandler", function(route, options){
    return function*(request, reply){
      //'reply' is optional. You can return value (<=> reply(value)) or throw an error (<=> reply(errorObject)) here instead of using 'reply' directly
      return {data: [1, 2, 3]};
    };
  });

  server.method("add", function*(a, b){
    return a + b; //use 'return' or 'throw' instead of 'next'
  });

  let result = yield server.methods.add(2, 3); //calling server's method via yield (the way with callback is supported too)

  yield server.pack.register(require("my-plugin")); //registering of plugin

  server.route({
    method: "GET",
      path: "/",
      config: {
        pre: [{method: function*(request, reply){
          //'reply' is optional here too
        }, assign: "pre1"}]
      },
      handler: function* (request, reply) {
        //'reply' is optional here too
        let result = yield someOperation();
        reply(result); //or use 'return result;' instead of it
      }
  });
  let v = yield Hapi.state.prepareValue("name", val, {});
  let pack = yield Hapi.Pack.compose(manifest); //composing a pack
  yield server.start();
  //the server will be started here. Use 'yield server.stop()' to stop it
})(function(err){
  if(err){
    console.error(err);
  }
});


```

Inside plugin

```
module.exports.register = function*(plugin, options){ // plugins with function(plugin, options, next){} are supported too
  //do plugins operations here
  plugin.ext("onRequest", function*(request){

  });

  plugin.dependency("my-plugin1", function*(plugin){
    //actions after loading my-plugin1
  });

  plugin.route({...}); //like server.route()

  plugin.handler(...); //like server.handler()
};

module.exports.register.attributes = {
  name: "name",
  version: "1.0.0"
};
```