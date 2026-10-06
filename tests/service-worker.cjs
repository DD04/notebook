const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function main() {
 const handlers={}, cached=new Map(), deleted=[], added=[];
 let networkCalls=0, skipped=false, claimed=false, installFailure=false;
 const cache={
  async addAll(requests) {if(installFailure) throw Error('Offline');added.push(...requests);},
  async match(request) {return cached.get(typeof request==='string' ? request : request.url);},
  async put() {}
 };
 const context=vm.createContext({
  URL, Request:class {constructor(url,options){this.url=url;this.cache=options.cache;}},
  self:{location:{origin:'https://notebook.example'},addEventListener(type,handler){handlers[type]=handler;},async skipWaiting(){skipped=true;},clients:{async claim(){claimed=true;}}},
  caches:{async open(){return cache;},async keys(){return ['notebook-shell-v4','notebook-shell-v5','other-app-cache'];},async delete(key){deleted.push(key);}},
  async fetch(){networkCalls++;throw Error('Offline');}
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
 let waiting;
 handlers.install({waitUntil(promise){waiting=promise;}});await waiting;
 assert.ok(skipped);
 assert.ok(added.every(request=>request.cache==='reload'),'Install bypasses stale browser cache');
 assert.ok(added.some(request=>request.url==='./js/transactions.js'));
 installFailure=true;skipped=false;
 handlers.install({waitUntil(promise){waiting=promise;}});
 await assert.rejects(waiting,/Offline/);assert.equal(skipped,false,'Incomplete release does not activate');
 handlers.activate({waitUntil(promise){waiting=promise;}});await waiting;
 assert.deepEqual(deleted,['notebook-shell-v4']);assert.ok(claimed);

 function request(url,mode='cors',method='GET') {return {url,mode,method};}
 function dispatch(req) {
  let response,background;
  handlers.fetch({request:req,respondWith(promise){response=promise;},waitUntil(promise){background=promise;}});
  return {response,background};
 }
 cached.set('./index.html','cached-page');
 assert.equal(await dispatch(request('https://notebook.example/index.html','navigate')).response,'cached-page');
 assert.equal(networkCalls,0,'Cached navigation opens without waiting for the network');
 cached.set('https://notebook.example/js/app.js','release-app');
 assert.equal(await dispatch(request('https://notebook.example/js/app.js')).response,'release-app');
 assert.equal(networkCalls,0,'App modules use the installed release snapshot');
 for(const url of ['https://project.supabase.co/rest/v1/transactions','https://database.custom.example/rest/v1/transactions']) {
  assert.equal(dispatch(request(url)).response,undefined,'Database requests are not intercepted');
 }
 assert.equal(dispatch(request('https://notebook.example/api','cors','POST')).response,undefined);
 cached.set('https://cdn.jsdelivr.net/npm/chart.js','cached-chart');
 const cdn=dispatch(request('https://cdn.jsdelivr.net/npm/chart.js'));
 assert.equal(await cdn.response,'cached-chart');await cdn.background;
 console.log('PASS: complete release installation, cache isolation, instant offline navigation, consistent app snapshot, API bypass, and CDN background lifetime.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
