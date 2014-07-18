"use strict";
let co = require("co");
let Hapi = require("hapi");
let Server = Hapi.Server;
let Pack = Hapi.Pack;

function canUseCo(result){
 return result && (typeof result.next === "function" /* generator */ ||
      typeof result.then === "function" /* promise */ ||
      typeof result === "function") /* thunk function */;
}

function wrapPluginRoot(plugin){
  let after = plugin.after;
  plugin.after = function(fn){
    return after.call(this, wrapHandler(fn, true));
  };
  let dependency = plugin.dependency;
  plugin.dependency = function(){
    let args = Array.prototype.slice.call(arguments, 0);
    let fn = args[1];
    if(typeof fn === "function"){
      args[1] = wrapHandler(fn, true);
    }
    return dependency.apply(this, args);
  };
  let handler = plugin.handler;
  plugin.handler = function(name, fn){
    return handler.call(this, name, function(route, options){
      return wrapHandler(fn(route, options));
    });
  };
  shim(plugin, "register", true);
}


function wrapHandler(handler, useReplyAsNext){
  if(typeof handler !== "function"){
    return handler;
  }
  let originalHandler = handler;
  let wrapper = function(request, reply){
    let handleError = function(err){
      if(err){
        if(err.isBoom){
          return reply(err);
        }
        return reply(Hapi.error.internal(err));
      }
    };
    let result = originalHandler(request, reply);
    if(canUseCo(result)){
      co(result)(function(err, data){
        if(err){
          return handleError(err);
        }
        if(useReplyAsNext){
          return reply(err, data);
        }
        if(data != null){
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

function wrapPluginRegister(plugin){
  let register = plugin.register;
  plugin.register = function(plugin, options, next){
    wrapPluginRoot(plugin);
    let result = register.apply(this, arguments);
    if(canUseCo(result)){
      co(result)(next);
    }
  };
  if(register.attributes){
    plugin.register.attributes = register.attributes;
  }
}

function shim(type, methodName, shimInstance){
  if(!shimInstance){
    type = type.prototype;
  }
  let original = type[methodName];
  type[methodName] = function(){
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

function wrapMethods(methods){
  for(let k in methods){
    let method = methods[k];
    if(typeof method === "function"){
      if(method.wrapped){
        continue;
      }
      methods[k] = function(){
        let args = Array.prototype.slice.call(arguments, 0);
        let next = args[args.length - 1];
        let self = this;
        if(typeof next === "function"){
          return method.apply(self, args);
        }
        return function(callback){
          args.push(callback);
          return method.apply(self, args);
        };
      };
      methods[k].wrapped = true;
    }
    else{
      wrapMethods(method);
    }
  }
}

let _route = Server.prototype._route;
Server.prototype._route = function (configs, env) {
  wrapConfigs(configs);
  return _route.call(this, configs, env);
};

let _ext = Server.prototype._ext || Server.prototype.ext;
Server.prototype._ext = Server.prototype.ext = function(){
  let args =  Array.prototype.slice.call(arguments, 0);
  let fn = args[1];
  if(typeof fn === "function"){
    args[1] = wrapHandler(fn, true);
  }
  _ext.apply(this, args);
}

let _handler = Pack.prototype._handler;
Pack.prototype._handler = function(name, fn){
  return _handler.call(this, name, function(route, options){
    return wrapHandler(fn(route, options));
  });
};

let _register = Pack.prototype._register;
Pack.prototype._register = function(plugins){
  if(plugins.plugin){
    wrapPluginRegister(plugins.plugin);
  }
  else{
    plugins = Array.isArray(plugins)? plugins: [plugins];
    plugins.forEach(function(plugin){
      wrapPluginRegister(plugin.plugin?plugin.plugin:plugin);
    });
  }
  _register.apply(this, arguments);
};

let Methods = new Pack({})._methods.__proto__.constructor;
let _add = Methods.prototype._add;
Methods.prototype._add = function (){
  let args = Array.prototype.slice.call(arguments, 0);
  let fn = args[1];
  if(typeof fn === "function"){
    args[1] = function(){
      let result = fn.apply(this, arguments);
      if(canUseCo(result)){
        let next = arguments[arguments.length - 1];
        co(result)(next);
      }
    };
  }
  let result = _add.apply(this, args);
  wrapMethods(this.methods);
  return result;
};

shim(Server, "start");
shim(Server, "stop");

shim(Pack, "compose", true);

shim(Hapi.state, "prepareValue", true);

let register = Pack.prototype.register;
Pack.prototype.register = function(){
  let args =  Array.prototype.slice.call(arguments, 0);
  if((args.length <= 3 && typeof args[args.length - 1] === "function") || (args.length > 3) ){
    return register.apply(this, args);
  }
  let self = this;
  return function(callback){
    args.push(callback);
    return register.apply(self, args);
  }
};

module.exports = Hapi;
