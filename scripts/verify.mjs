import fs from 'node:fs';
import crypto from 'node:crypto';
import {abi} from 'genlayer-js';
import {client,rpc,stringify} from './network.mjs';
import {executionOf,verifyReceiptIdentity} from './receipt.mjs';
import {check,compact} from './runner.mjs';
const j=JSON.parse(fs.readFileSync('evidence/live.json')),d=JSON.parse(fs.readFileSync('deployment.json'));
check(!!j.completed_at,'ACCEPTANCE_INCOMPLETE');
check(Number(await rpc('eth_chainId',[]))===61999&&d.chain_id===61999&&d.rpc==='https://studio.genlayer.com/api','WRONG_CHAIN');
const source=fs.readFileSync('contracts/contract.py','utf8'),digest=crypto.createHash('sha256').update(source).digest('hex');
check(digest===d.source_sha256&&digest===j.source_sha256&&await client.getContractCode(d.contract)===source,'SOURCE_MISMATCH');
const protocol=JSON.parse(await client.readContract({address:d.contract,functionName:'get_protocol',args:[],transactionHashVariant:'latest-final'}));
check(protocol.version===d.protocol&&protocol.chain_id===61999,'PROTOCOL_MISMATCH');
const output={protocol,verified_at:new Date().toISOString(),chain_id:61999,contract:d.contract,source_sha256:digest,transactions:[],final_reads:[],state_variant:'latest-final'};
for(const e of j.transactions){
 const raw=await client.getTransaction({hash:e.hash}),r=compact(raw);
 check(raw.value!==undefined&&BigInt(raw.value)===0n,'NONZERO_ATTACHED_VALUE '+e.label);
 check(r.status==='FINALIZED'&&(r.execution==='SUCCESS')===!e.expected_error,'BAD_FINALITY_EXECUTION '+e.label);
 const votes=Object.values(r.votes??{}),agree=votes.filter(v=>v==='agree').length,disagree=votes.filter(v=>v==='disagree').length;
 check(r.leader_only===false&&agree>=2&&agree>disagree,'NO_FULL_CONSENSUS '+e.label);
 if(e.method==='deploy')check(r.from.toLowerCase()===e.sender&&r.data.contract_address.toLowerCase()===d.contract.toLowerCase(),'DEPLOY_BINDING');
 else{const decoded=abi.calldata.decode(Buffer.from(raw.data.calldata.base64,'base64'));verifyReceiptIdentity(raw,{...e,contract:d.contract},decoded instanceof Map?Object.fromEntries(decoded):decoded);}
 if(e.expected_error)check(r.rounds.some(x=>x.leaders.some(v=>v.mode==='leader'&&v.error==='Exception: '+e.expected_error)),'WRONG_REJECTION '+e.label);
 output.transactions.push({label:e.label,expected_error:e.expected_error,...r});console.log(e.label,r.status,r.execution);
}
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
for(const item of j.final_reads){const value=JSON.parse(await client.readContract({address:d.contract,functionName:item.method,args:item.args,transactionHashVariant:'latest-final'}));check(canonical(value)===canonical(item.value),'STATE_CHANGED '+item.method);output.final_reads.push({...item,value});}
output.success_count=output.transactions.filter(x=>x.execution==='SUCCESS').length;output.expected_rejection_count=output.transactions.filter(x=>!!x.expected_error).length;
fs.writeFileSync('evidence/verification.json',stringify(output));console.log('INDEPENDENT RECEIPTS AND FINAL STATE VERIFIED');
