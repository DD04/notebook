// Run with Node and Playwright installed: node tests/browser-regression.cjs
// All remote services are mocked; no real account or database is modified.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

const mockClient = `
export function createClient() {
 const state = window.testState = {
  writes: 0, reads: {}, fail: false, lostResponse: false, delay: 1200,
  transactions: [], group_transactions: [],
  groups: [{id:'group-1', name:'Test Group', created_by:'user-1', created_at:'2026-10-01'}],
  group_members: [{id:'member-1',group_id:'group-1', user_id:'user-1', nickname:'Tester'}]
 };
 const auth = {
  onAuthStateChange() { return {data:{subscription:{unsubscribe(){}}}}; },
  async getSession() { return {data:{session:{user:{id:'user-1',email:'test@notebook.local'}}}}; },
  getUser() { throw Error('Unnecessary network auth call'); }
 };
 function from(table) {
  let operation='read', payload, filters=[], single=false, fields='*';
  const query = {
   select(value) { if(value) fields=value; return query; },
   order() { return query; }, limit() { return query; },
   eq(k,v) { filters.push([k,v]); return query; },
   single() { single=true; return query; }, maybeSingle() { single=true; return query; },
   insert(value) { operation='insert'; payload=value[0]; return query; },
   update(value) { operation='update'; payload=value; return query; },
   delete() { operation='delete'; return query; },
   then(resolve,reject) { return run().then(resolve,reject); }
  };
  async function run() {
   const matches = row => filters.every(([k,v]) => row[k]===v);
   if (operation !== 'read') {
    state.writes++;
    await new Promise(r=>setTimeout(r,state.delay));
    if(state.fail) { state.fail=false; return {error:{message:'Simulated failure'}}; }
    let result;
    if(operation==='insert') {
     if(state[table].some(r=>r.id===payload.id)) return {error:{code:'23505',message:'Duplicate ID'}};
     result={...payload,created_at:new Date().toISOString()}; state[table].push(result);
    } else if(operation==='update') {
     result=state[table].find(matches); if(result) Object.assign(result,payload);
    } else {state[table]=state[table].filter(r=>!matches(r));}
    if(state.lostResponse) { state.lostResponse=false; return {error:{message:'Response lost'}}; }
    return {data:single ? result : (result ? [result] : []), error:null};
   }
   state.reads[table]=(state.reads[table]||0)+1;
   let rows=table==='profiles' ? [{id:'user-1',nickname:'Tester',superuser:false}] : (state[table]||[]);
   rows=rows.filter(matches).map(row => table==='group_members' && fields==='groups(*)' ? {groups:state.groups.find(g=>g.id===row.group_id)} : {...row});
   if(table==='transactions'||table==='group_transactions') rows.sort((a,b)=>b.date.localeCompare(a.date)||b.created_at.localeCompare(a.created_at));
   return {data:single ? rows[0] : rows, error:null};
  }
  return query;
 }
 return {auth,from};
}`;

async function main() {
 const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname==='/' ? '/index.html' : pathname));
  if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(error,body)=> {
   if(error) {res.writeHead(404).end();return;}
   res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
   res.end(body);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
  browser = await chromium.launch({headless:true, ...(process.env.TEST_BROWSER_CHANNEL ? {channel:process.env.TEST_BROWSER_CHANNEL} : {})});
  const context = await browser.newContext({serviceWorkers:'block'});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const optional=[];
  await context.route('https://**/*',async route => {
   const url=route.request().url();
   if(url.includes('esm.sh')) return route.fulfill({contentType:'text/javascript',body:mockClient});
   if(url.includes('lucide')) {await new Promise(resolve=>setTimeout(resolve,2000));return route.fulfill({contentType:'text/javascript',body:'window.lucide={createIcons(){},replace(){}};'});}
   if(url.includes('sweetalert')) {await new Promise(resolve=>setTimeout(resolve,2000));return route.fulfill({contentType:'text/javascript',body:'window.Swal={fire:async()=>({isConfirmed:true})};'});}
   if(url.includes('chart.js')) {optional.push(url);return route.fulfill({contentType:'text/javascript',body:'window.Chart=class {destroy(){}};'});}
   if(/exceljs|html2canvas|jspdf/.test(url)) {optional.push(url);return route.abort();}
   await new Promise(resolve=>setTimeout(resolve,2000));
   return route.fulfill({contentType:'text/css',body:''});
  });
  const url='http://127.0.0.1:'+server.address().port;
  const started=Date.now();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#profileNickname').textContent==='Tester');
  await page.waitForFunction(()=>window.testState.reads.transactions===1);
  assert.ok(Date.now()-started<1500,'Startup does not wait for 2-second font/icon/dialog downloads');
  assert.equal(optional.length,0,'No optional libraries on startup');
  assert.equal(await page.evaluate(()=>testState.reads.profiles),1,'Profile fetched once');

  async function fillPersonal(description) {
   await page.click('#addTxBtn');
   await page.fill('#txAmount','125');
   await page.fill('#txDescription',description);
  }
  const submitPersonal=()=>page.evaluate(()=> {
   const form=document.querySelector('#txForm');
   form.requestSubmit();form.dispatchEvent(new Event('submit',{cancelable:true}));
  });
  await fillPersonal('Immediate record');
  await submitPersonal();
  assert.equal(await page.locator('#ledgerTableBody .sync-pending').count(),1);
  assert.equal(await page.locator('#txModal').evaluate(el=>el.classList.contains('active')),false);
  assert.equal(await page.locator('#addTxBtn').isDisabled(),true);
  await page.waitForFunction(()=>!document.querySelector('#addTxBtn').disabled);
  assert.equal(await page.evaluate(()=>testState.writes),1,'Double submit sends one write');
  assert.equal(await page.evaluate(()=>testState.reads.transactions),1,'No ledger refetch after save');
  assert.equal(await page.locator('#ledgerTableBody .sync-pending').count(),0);

  // Edit appears immediately, without inserting a second record.
  await page.click('#ledgerTableBody .action-btn-edit');
  await page.fill('#txAmount','250');
  await submitPersonal();
  assert.match(await page.locator('#ledgerTableBody').textContent(),/250/);
  await page.waitForFunction(()=>!document.querySelector('#addTxBtn').disabled);
  assert.equal(await page.evaluate(()=>testState.transactions.length),1);

  await fillPersonal('Retry draft');
  await page.evaluate(()=>{testState.fail=true;});
  await submitPersonal();
  await page.waitForFunction(()=>!document.querySelector('#addTxBtn').disabled);
  assert.equal(await page.locator('#txDescription').inputValue(),'Retry draft');
  assert.equal(await page.locator('#txModal').evaluate(el=>el.classList.contains('active')),true);
  assert.doesNotMatch(await page.locator('#ledgerTableBody').textContent(),/Retry draft/);
  // Simulate a committed insert whose response is lost; retry uses the same UUID.
  await page.evaluate(()=>{testState.lostResponse=true;});
  await submitPersonal();
  await page.waitForFunction(()=>!document.querySelector('#addTxBtn').disabled);
  await page.fill('#txAmount','333');
  await submitPersonal();
  await page.waitForFunction(()=>!document.querySelector('#addTxBtn').disabled);
  assert.equal(await page.evaluate(()=>testState.transactions.filter(t=>t.description==='Retry draft').length),1);
  assert.equal(await page.evaluate(()=>testState.transactions.find(t=>t.description==='Retry draft').amount),333,'Retry applies draft corrections to the same record');
  assert.equal(await page.evaluate(()=>testState.reads.profiles),1,'Writes reuse the resolved profile request');

  await page.click('[data-view="groups"]');
  await page.click('#groupsList .group-item');
  await page.click('#addGroupTxBtn');
  await page.fill('#gtxAmount','75');
  await page.fill('#gtxDescription','Group immediate');
  const before=await page.evaluate(()=>({writes:testState.writes,reads:testState.reads.group_transactions}));
  const submitGroup=()=>page.evaluate(()=>{const form=document.querySelector('#groupTxForm');form.requestSubmit();form.dispatchEvent(new Event('submit',{cancelable:true}));});
  await submitGroup();
  assert.equal(await page.locator('#groupTxTableBody .sync-pending').count(),1);
  await page.waitForFunction(()=>!document.querySelector('#addGroupTxBtn').disabled);
  assert.equal(await page.evaluate(()=>testState.writes),before.writes+1);
  assert.equal(await page.evaluate(()=>testState.reads.group_transactions),before.reads);
  assert.equal(await page.locator('#groupTxTableBody .sync-pending').count(),0);
  await page.click('#addGroupTxBtn');
  await page.fill('#gtxAmount','99');
  await page.fill('#gtxDescription','Group failure');
  await page.evaluate(()=>{testState.fail=true;});
  await submitGroup();
  await page.waitForFunction(()=>!document.querySelector('#addGroupTxBtn').disabled);
  assert.equal(await page.locator('#gtxDescription').inputValue(),'Group failure');
  assert.doesNotMatch(await page.locator('#groupTxTableBody').textContent(),/Group failure/);
  await page.click('#groupTxModalCancel');

  // All app surfaces must cover desktop/mobile viewport heights.
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:375,height:667},{width:844,height:390}]) {
   await page.setViewportSize(viewport);
   for(const view of ['dashboard','groups','analytics']) {
    await page.evaluate(view=>document.querySelector('[data-view="'+view+'"]').click(),view);
    await page.waitForFunction(view=>document.querySelector('#view-'+view).classList.contains('active'),view);
    const bounds=await page.evaluate(()=>{
     const layout=document.querySelector('.app-layout').getBoundingClientRect();
     const panel=document.querySelector('.view-panel').getBoundingClientRect();
     const ledger=document.querySelector('.view-section.active .ledger-container');
     return {bottom:layout.bottom,panelBottom:panel.bottom,ledgerBottom:ledger?.getBoundingClientRect().bottom,height:innerHeight,width:document.documentElement.scrollWidth,viewportWidth:innerWidth};
    });
    assert.ok(Math.abs(bounds.bottom-viewport.height)<2,JSON.stringify(bounds));
    assert.ok(Math.abs(bounds.panelBottom-viewport.height)<2,JSON.stringify(bounds));
    assert.ok(bounds.width<=viewport.width,JSON.stringify(bounds));
    if(view==='dashboard'||view==='groups') assert.ok(bounds.ledgerBottom>=viewport.height-2,JSON.stringify(bounds));
   }
  }
  assert.ok(optional.some(url=>url.includes('chart.js')),'Charts load on opening analytics');
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log('PASS: deferred libraries, single profile lookup, optimistic personal/group saves, duplicate guards, edit, rollback, lost-response retry, and 12 viewport/view combinations.');
 } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
