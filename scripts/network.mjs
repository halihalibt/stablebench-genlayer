import fs from 'node:fs';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
export const RPC='https://studio.genlayer.com/api';
export const client=createClient({chain:studionet});
export const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
export async function rpc(method,params){const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`RPC HTTP ${r.status}`);const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;}
if(process.argv[2]==='schema'){
 console.log('Chain',await rpc('eth_chainId',[]));
 const source=fs.readFileSync('contracts/contract.py','utf8');
 const schema=await client.getContractSchemaForCode(source);
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('schema.json',stringify(schema));console.log(stringify(schema));
}
