"""Offline recomputation of real finalized certificates, not new network evidence."""
import sys,json,pathlib,hashlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from tests.host import m
root=pathlib.Path(__file__).resolve().parents[1]
raw=json.loads((root/'evidence/verification.json').read_text())
assert raw['chain_id']==61999 and raw['state_variant']=='latest-final'
count=0
for item in raw['final_reads']:
    market=item['value']
    binding={'id':market['id'],'owners':market['owners'],'roster':market['roster']}
    assert m.sha(binding)==market['roster_hash']
    for side,result in market['compiled'].items():
        other='right' if side=='left' else 'left'
        data={'subjects':[{**person,'statement':statement} for person,statement in zip(market['roster'][side],market['statements'][side])], 'candidates':market['roster'][other]}
        m.parse_ranks(result,data)
    if market['certificate'] is None:
        assert market['state']=='CANCELLED'
        assert any(row['status']=='UNKNOWN' for result in market['compiled'].values() for row in result['rows'])
        continue
    ranks={}
    for side in ['left','right']:
        other='right' if side=='left' else 'left';ids=[x['id'] for x in market['roster'][other]]
        ranks[side]=[[ids.index(x) for x in row['ranked']] for row in market['compiled'][side]['rows']]
    rebuilt=m.stable_certificate(ranks['left'],ranks['right'])
    assert rebuilt==market['certificate']
    assert m.sha({'roster_hash':market['roster_hash'],'statements':market['statements'],'certificate':rebuilt})==market['certificate_hash']
    selection=market['selection']
    assert selection['assignment']==rebuilt['matchings'][selection['index']]
    assert m.sha({'market':market['id'],'certificate':market['certificate_hash'],'assignment':selection['assignment']})==selection['digest']
    assert market['state']=='COMMITTED' and set(market['approvals'])==set(market['owners'].values())
    count+=1
assert count>=1
print('Recomputed all stable assignments, blocking witnesses, signatures and hashes from finalized evidence.')
