import fs from 'node:fs';
import crypto from 'node:crypto';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {rpc,stringify} from './network.mjs';
import {executionOf} from './receipt.mjs';
export const check=(ok,message)=>{if(!ok)throw Error(message)};
export const compact=r=>({hash:r.hash,status:r.statusName,execution:executionOf(r),from:r.from_address,to:r.to_address,value:r.value,
 data:{contract_address:r.data?.contract_address,calldata:r.data?.calldata},leader_only:r.leader_only,votes:r.votes??r.consensus_data?.votes,
 rounds:r.consensus_history?.consensus_results?.map(x=>({round:x.consensus_round,leaders:(x.leader_result??[]).map(v=>({mode:v.mode,vote:v.vote,execution:v.execution_result,error:v.genvm_result?.stderr?.trim().split('\n').at(-1)||v.genvm_result?.error_description||undefined})),validators:(x.validator_results??[]).map(v=>({address:v.node_config?.address,vote:v.vote,execution:v.execution_result}))}))});
export async function open(protocol){
 fs.mkdirSync('artifacts',{recursive:true});fs.mkdirSync('evidence',{recursive:true});
 const source=fs.readFileSync('contracts/contract.py','utf8'),sourceHash=crypto.createHash('sha256').update(source).digest('hex');
 const path='evidence/live.json',keyfile='artifacts/test-signers.json';
 const prior=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):null;
 if(prior?.completed_at){console.log('Completed acceptance journal; npm run verify is read-only.');process.exit(0)}
 if(prior)check(prior.source_sha256===sourceHash&&fs.existsSync(keyfile),'Original source/signers required; refusing replacement');
 const keys=fs.existsSync(keyfile)?JSON.parse(fs.readFileSync(keyfile)):[generatePrivateKey(),generatePrivateKey(),generatePrivateKey()];
 if(!fs.existsSync(keyfile))fs.writeFileSync(keyfile,JSON.stringify(keys),{mode:0o600});
 const accounts=keys.map(privateKeyToAccount),actors=accounts.map(x=>x.address.toLowerCase()),clients=accounts.map(account=>createClient({chain:studionet,account}));
 const j=prior??{chain_id:61999,protocol,source_sha256:sourceHash,actors,transactions:[],snapshots:{},started_at:new Date().toISOString()};
 const save=()=>fs.writeFileSync(path,stringify(j));save();
 check(Number(await rpc('eth_chainId',[]))===61999,'CHAIN_MISMATCH');
 if(!j.funded){for(const a of actors)await rpc('sim_fundAccount',[a,10000]);j.funded=true;save();}
 async function tx(label,actor,method,args,expected_error=null){
  let e=j.transactions.find(x=>x.label===label);
  if(!e){const hash=method==='deploy'?await clients[actor].deployContract({code:source,args:[],leaderOnly:false}):await clients[actor].writeContract({address:j.contract,functionName:method,args,value:0n,leaderOnly:false});e={label,sender:actors[actor],method,args,expected_error,hash,submitted_at:new Date().toISOString()};j.transactions.push(e);save();console.log('SUBMITTED',label,hash);}
  if(!e.receipt)for(let i=0;i<450;i++){
   let r;try{r=await clients[0].getTransaction({hash:e.hash})}catch(err){if(i>440)throw err;await new Promise(r=>setTimeout(r,4000));continue}
   e.observed_status=r.statusName;save();
   if(['FINALIZED','UNDETERMINED','CANCELED'].includes(r.statusName)){e.receipt=compact(r);save();break}
   await new Promise(r=>setTimeout(r,4000));
  }
  check(e.receipt?.status==='FINALIZED','NOT_FINALIZED '+label);
  check((e.receipt.execution==='SUCCESS')===!e.expected_error,'UNEXPECTED_EXECUTION '+label+' '+stringify(e.receipt));
  if(e.expected_error)check(e.receipt.rounds?.some(x=>x.leaders.some(v=>v.mode==='leader'&&v.error==='Exception: '+e.expected_error)),'WRONG_REJECTION '+label);
  console.log('VERIFIED',label,e.receipt.status,e.receipt.execution);return e.receipt;
 }
 const deployed=await tx('deployment',0,'deploy',[]);j.contract??=deployed.data.contract_address;save();
 check(await clients[0].getContractCode(j.contract)===source,'SOURCE_BYTES_MISMATCH');
 fs.writeFileSync('deployment.json',stringify({chain_id:61999,rpc:'https://studio.genlayer.com/api',protocol,contract:j.contract,source_sha256:sourceHash,deploy_tx:j.transactions[0].hash}));
 async function read(method,args=[]){return JSON.parse(await clients[0].readContract({address:j.contract,functionName:method,args,transactionHashVariant:'latest-final'}))}
 async function snap(label,method,args=[]){if(Object.hasOwn(j.snapshots,label))return j.snapshots[label];j.snapshots[label]=await read(method,args);save();return j.snapshots[label]}
 async function finish(reads){j.final_reads=[];for(const item of reads)j.final_reads.push({...item,value:await read(item.method,item.args)});j.completed_at=new Date().toISOString();save();fs.unlinkSync(keyfile);console.log('ACCEPTANCE COMPLETE',j.contract)}
 return {j,actors,tx,read,snap,finish};
}
