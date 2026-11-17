export const executionOf=r=>r.txExecutionResultName??(Array.isArray(r.consensus_data?.leader_receipt)?r.consensus_data.leader_receipt.filter(x=>x.mode==='leader').at(-1)?.execution_result:r.consensus_data?.leader_receipt?.execution_result);
export function verifyReceiptIdentity(receipt,intent,decoded){
 if((receipt.from_address??receipt.sender)?.toLowerCase()!==intent.sender.toLowerCase())throw Error('Receipt sender mismatch');
 if((receipt.to_address??receipt.recipient)?.toLowerCase()!==intent.contract.toLowerCase())throw Error('Receipt target mismatch');
 if(decoded?.method!==intent.method)throw Error('Receipt method mismatch');
 const serial=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?Number(x):x);
 if(serial(decoded.args??[])!==serial(intent.args))throw Error('Receipt arguments mismatch');
 return {status:receipt.statusName??String(receipt.status),execution:executionOf(receipt)};
}
