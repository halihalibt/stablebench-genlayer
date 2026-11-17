import fs from 'node:fs';
import crypto from 'node:crypto';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {privateKeyToAccount} from 'viem/accounts';
import {client,rpc,stringify} from './network.mjs';
import {executionOf} from './receipt.mjs';
const [mode,method,raw='[]']=process.argv.slice(2),args=JSON.parse(raw);
if(!['read','write'].includes(mode)||!method||!Array.isArray(args))throw Error('Usage: node scripts/call.mjs read|write method JSON_ARRAY');
const d=JSON.parse(fs.readFileSync('deployment.json'));
if(Number(await rpc('eth_chainId',[]))!==61999||d.chain_id!==61999)throw Error('WRONG_CHAIN');
if(mode==='read'){const value=await client.readContract({address:d.contract,functionName:method,args,transactionHashVariant:'latest-final'});console.log(stringify(typeof value==='string'?JSON.parse(value):value));process.exit(0)}
const source=await client.getContractCode(d.contract);
if(crypto.createHash('sha256').update(source).digest('hex')!==d.source_sha256)throw Error('SOURCE_MISMATCH');
const key=process.env.CONTRACT_PRIVATE_KEY;
if(!key)throw Error('Set CONTRACT_PRIVATE_KEY in your environment; never place it in source or arguments.');
const signer=createClient({chain:studionet,account:privateKeyToAccount(key)});
const hash=await signer.writeContract({address:d.contract,functionName:method,args,value:0n,leaderOnly:false});
console.log('SUBMITTED',hash,'Save this hash; do not resubmit a pending transaction.');
for(let i=0;i<450;i++){
 const r=await client.getTransaction({hash});
 if(r.statusName==='FINALIZED'){console.log('FINALIZED',executionOf(r));if(executionOf(r)!=='SUCCESS')process.exitCode=1;process.exit();}
 if(['UNDETERMINED','CANCELED'].includes(r.statusName))throw Error('Transaction did not finalize successfully: '+hash+' '+r.statusName);
 await new Promise(r=>setTimeout(r,4000));
}
throw Error('Still pending: '+hash+'; inspect this hash, never automatically resubmit.');
