import fs from 'node:fs';
import {open,check} from './runner.mjs';
const {actors,tx,read,snap,finish}=await open('stablebench-1');
const roster={left:[{id:'job-alpha',description:'Alpha: a small documentation test workload.'},{id:'job-beta',description:'Beta: a CPU-heavy compiler test workload.'}],right:[{id:'bench-quiet',description:'Quiet: a low-noise test bench.'},{id:'bench-fast',description:'Fast: a high-speed test bench.'}]};
const statements={left:['Both benches are acceptable. Prefer the low-noise Quiet bench first, then the high-speed Fast bench.','Both benches are acceptable. Prefer the high-speed Fast bench first, then the low-noise Quiet bench.'],right:['Both workloads are acceptable. Prefer the CPU-heavy Beta compiler workload first, then the small Alpha documentation workload.','Both workloads are acceptable. Prefer the small Alpha documentation workload first, then the CPU-heavy Beta compiler workload.']};
fs.writeFileSync('examples/preferences.json',JSON.stringify({roster,statements},null,2));
const mid=actors[0]+':stable-lab';
const get=()=>read('get_market',[mid]);
await tx('create-market',0,'create_market',['stable-lab',actors[1],JSON.stringify(roster)]);
let market=await get();await tx('outsider-cannot-seal',2,'seal_preferences',[mid,market.revision,'left',JSON.stringify(statements.left)],'SIDE_OWNER_ONLY');
for(const [actor,side] of [[0,'left'],[1,'right']]){market=await get();await tx('seal-'+side,actor,'seal_preferences',[mid,market.revision,side,JSON.stringify(statements[side])]);}
market=await get();await tx('cannot-solve-uncompiled',0,'solve',[mid,market.revision],'PREFERENCES_NOT_READY');
for(const side of ['left','right']){market=await get();await tx('compile-'+side,0,'compile_side',[mid,market.revision,side]);}
const compiled=await snap('compiled','get_market',[mid]);check(compiled.state==='READY','Expected fully known preferences');
check(JSON.stringify(compiled.compiled.left.rows.map(x=>x.ranked))==='[["bench-quiet","bench-fast"],["bench-fast","bench-quiet"]]','Unexpected left ranks');
check(JSON.stringify(compiled.compiled.right.rows.map(x=>x.ranked))==='[["job-beta","job-alpha"],["job-alpha","job-beta"]]','Unexpected right ranks');
market=await get();await tx('solve-all-matchings',0,'solve',[mid,market.revision]);
const solved=await snap('solved','get_market',[mid]);check(JSON.stringify(solved.certificate.matchings)==='[[0,1],[1,0]]'&&solved.certificate.checked===7,'Stable certificate mismatch');
market=await get();await tx('select-assignment',0,'select',[mid,market.revision,0,solved.certificate_hash]);
const selected=await snap('selected','get_market',[mid]);
market=await get();await tx('reject-wrong-selection-digest',1,'approve',[mid,market.revision,'0'.repeat(64)],'SELECTION_BINDING');
market=await get();await tx('left-approval',0,'approve',[mid,market.revision,selected.selection.digest]);
market=await get();await tx('reject-duplicate-approval',0,'approve',[mid,market.revision,selected.selection.digest],'ALREADY_APPROVED');
market=await get();await tx('right-approval',1,'approve',[mid,market.revision,selected.selection.digest]);
market=await get();await tx('reject-committed-replay',1,'approve',[mid,market.revision,selected.selection.digest],'SELECTION_NOT_PENDING');
await tx('reject-stale-cancellation',0,'cancel',[mid,0],'STALE_REVISION');
const final=await snap('committed','get_market',[mid]);check(final.state==='COMMITTED'&&final.approvals.length===2,'Commitment failure');
const unknown=actors[0]+':uncertain-lab';
await tx('create-uncertain-market',0,'create_market',['uncertain-lab',actors[1],JSON.stringify(roster)]);
for(const [actor,side] of [[0,'left'],[1,'right']]){const state=await read('get_market',[unknown]);const prefs=side==='left'?['Choose whatever is appropriate; I have not specified any ordering or acceptability of these benches.',statements.left[1]]:statements.right;await tx('uncertain-seal-'+side,actor,'seal_preferences',[unknown,state.revision,side,JSON.stringify(prefs)]);}
let state=await read('get_market',[unknown]);await tx('compile-uncertain-side',0,'compile_side',[unknown,state.revision,'left']);
const unclear=await snap('uncertain','get_market',[unknown]);check(unclear.state==='NEEDS_CLARIFICATION'&&unclear.compiled.left.rows[0].status==='UNKNOWN','Expected uncertainty gate');
state=await read('get_market',[unknown]);await tx('unknown-cannot-solve',0,'solve',[unknown,state.revision],'PREFERENCES_NOT_READY');
state=await read('get_market',[unknown]);await tx('cancel-uncertain-market',1,'cancel',[unknown,state.revision]);
await finish([{method:'get_market',args:[mid]},{method:'get_market',args:[unknown]}]);
