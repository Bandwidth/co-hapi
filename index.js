"use strict";
let co = require("co");
let Hapi = require("hapi");
let Server = Hapi.Server;
let Pack = Hapi.Pack;


function wrapHandler(handler){
  if(typeof handler !== "function"){
    return handler;
  }
  let originalHandler = handler;
  let wrapper = function(request, reply){
    debugger;
    let result = originalHandler(request, reply);
    if(result && (typeof result.next === "function" /* generator */ ||
      typeof result.then === "function" /* promise */ ||
      typeof result === "function") /* thunk function */){
      co(result)(function(err, data){
        if(err){
          if(err.statusCode){
            return reply(err);
          }
          return reply(Hapi.error(err.message || err));
        }
        if(data){
          return reply(data);
        }
      });
    }
  };
  return wrapper;
}

function wrapPreItem(item){
  if(typeof item === "function"){
    return wrapHandler(item);
  }
  if(Array.isArray(item)){
    return item.map(wrapPreItem);
  }
  if(item && item.method){
    item.method = wrapHandler(item.method);
  }
  return item;
}

function wrapConfigs(configs){
  configs = configs || {};
  if(Array.isArray(configs)){
    configs.forEach(wrapConfigs);
  }
  else{
    configs.handler = wrapHandler(configs.handler);
    if(configs.config){
      configs.config.handler = wrapHandler(configs.config.handler);
      configs.config.pre = (configs.config.pre || []).map(wrapPreItem);
    }
  }
}

function shim(type, methodName){
  let original = type.prototype[methodName];
  type.prototype[methodName] = function(){
    let args =  Array.prototype.slice.call(arguments, 0);
    if(typeof args[args.length - 1] === "function"){
      return original.apply(this, args);
    }
    let self = this;
    return function(callback){
      args.push(callback);
      return original.apply(self, args);
    }
  };
}


let _route = Server.prototype._route;
Server.prototype._route = function (configs, env) {
  wrapConfigs(configs);
  return _route.call(this, configs, env);
};

let _handler = Pack.prototype._handler;
Pack.prototype._handler = function(name, fn){
  return _handler.call(this, name, function(route, options){
    return wrapHandler(fn(route, options));
  });
};

shim(Server, "start");
shim(Server, "stop");

//shim(Pack, "register");

module.exports = Hapi;