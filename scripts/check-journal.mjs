// Offline integrity check of stored actual receipts; does not claim a fresh RPC read.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {abi} from 'genlayer-js';
const j=JSON.parse(fs.readFileSync('evidence/live.json')),d=JSON.parse(fs.readFileSync('deployment.json'));
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const digest=crypto.createHash('sha256').update(fs.readFileSync('contracts/contract.py')).digest('hex');
check(digest===j.source_sha256&&digest===d.source_sha256&&d.chain_id===61999,'SOURCE_OR_CHAIN_MISMATCH');
let success=0,rejected=0,pending=0;
for(const e of j.transactions){
 const r=e.receipt;
 if(!r){pending++;check(/^0x[0-9a-fA-F]{64}$/.test(e.hash),'BAD_PENDING_HASH');continue;}
 check(r.status==='FINALIZED'&&(r.execution==='SUCCESS')===!e.expected_error,'UNEXPECTED_STORED_RESULT '+e.label);
 check(r.from.toLowerCase()===e.sender&&r.to.toLowerCase()===d.contract.toLowerCase()&&r.leader_only===false,'RECEIPT_IDENTITY '+e.label);
 if(e.method!=='deploy'){
  let decoded=abi.calldata.decode(Buffer.from(r.data.calldata.base64,'base64'));if(decoded instanceof Map)decoded=Object.fromEntries(decoded);
  const encode=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?Number(x):x);
  check(decoded.method===e.method&&encode(decoded.args)===encode(e.args),'CALLDATA_MISMATCH '+e.label);
 }
 if(e.expected_error){check(r.rounds.some(x=>x.leaders.some(v=>v.mode==='leader'&&v.error==='Exception: '+e.expected_error)),'REJECTION_REASON '+e.label);rejected++;}else success++;
}
console.log(JSON.stringify({mode:'offline stored-receipt integrity only',success,rejected,pending,completed:!!j.completed_at},null,2));
