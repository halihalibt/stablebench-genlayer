import unittest,itertools,json
from tests.host import m,gl,A,Return,tx

def row(ranked,excluded=(),status='KNOWN',quote='Explicit declared order.'):
    return {'status':status,'ranked':list(ranked),'excluded':list(excluded),'quote':quote}

def deferred(left,right):
    free=list(range(len(left)));next_choice=[0]*len(left);held={}
    while free:
        i=free.pop(0)
        if next_choice[i]>=len(left[i]):continue
        j=left[i][next_choice[i]];next_choice[i]+=1
        if i not in right[j]:free.append(i);continue
        old=held.get(j)
        if old is None or right[j].index(i)<right[j].index(old):
            held[j]=i
            if old is not None:free.append(old)
        else:free.append(i)
    return [next((j for j,i in held.items() if i==k),-1) for k in range(len(left))]

class SolverTests(unittest.TestCase):
    def test_two_stable_solutions_and_no_forced_pair(self):
        r=m.stable_certificate([[0,1],[1,0]],[[1,0],[0,1]])
        self.assertEqual(r['matchings'],[[0,1],[1,0]]);self.assertEqual(r['forced_pairs'],[]);self.assertEqual(r['checked'],7)
    def test_unacceptable_can_remain_unmatched(self):
        r=m.stable_certificate([[0],[]],[[0],[1]])
        self.assertEqual(r['matchings'],[[0,-1]]);self.assertEqual(r['forced_pairs'],[[0,0]])
        self.assertEqual(m.stable_certificate([[],[]],[[],[]])['matchings'],[[-1,-1]])
    def test_exhaustive_incomplete_two_by_two(self):
        options=[[],[0],[1],[0,1],[1,0]]
        for profile in itertools.product(options,repeat=4):
            left,right=list(profile[:2]),list(profile[2:]);r=m.stable_certificate(left,right)
            self.assertIn(deferred(left,right),r['matchings'])
            universe=[]
            for v in itertools.product(range(-1,2),repeat=2):
                assigned=[j for j in v if j>=0]
                if len(assigned)!=len(set(assigned)):continue
                if any(j>=0 and (j not in left[i] or i not in right[j]) for i,j in enumerate(v)):continue
                universe.append(list(v))
            self.assertEqual(r['checked'],len(universe))
            self.assertEqual(sorted(r['matchings']+[x['assignment'] for x in r['rejected']]),sorted(universe))
            for rejection in r['rejected']:
                i,j=rejection['blocking_pair'];v=rejection['assignment'];partner=next((k for k,x in enumerate(v) if x==j),-1)
                self.assertIn(j,left[i]);self.assertIn(i,right[j]);self.assertNotEqual(v[i],j)
                self.assertTrue(v[i]<0 or left[i].index(j)<left[i].index(v[i]))
                self.assertTrue(partner<0 or right[j].index(i)<right[j].index(partner))
    def test_maximum_four_by_four_enumeration(self):
        r=m.stable_certificate([list(range(4))]*4,[list(range(4))]*4)
        self.assertEqual(r['checked'],209);self.assertEqual(r['matchings'],[[0,1,2,3]])

class LifecycleTests(unittest.TestCase):
    def setUp(self):
        gl.message.sender_address=A[0];self.c=m.StableBench();self.c.markets={};self.c.ids=[]
        self.roster={'left':[{'id':'job-one','description':'Small build'},{'id':'job-two','description':'Large build'}], 'right':[{'id':'bench-one','description':'Quiet bench'},{'id':'bench-two','description':'Fast bench'}]}
        self.mid=self.c.create_market('lab-test',A[1],m.pack(self.roster));self.original=m.compile_preferences
        def compile(data):
            ids=[x['id'] for x in data['candidates']];return {'rows':[row(ids,quote=s['statement']) for s in data['subjects']]}
        m.compile_preferences=compile
    def tearDown(self):m.compile_preferences=self.original
    def market(self):return json.loads(self.c.get_market(self.mid))
    def invoke(self,actor,method,*args):return tx(self.c,actor,method,self.mid,self.market()['revision'],*args)
    def ready(self):
        for actor,side in [(0,'left'),(1,'right')]:self.invoke(actor,'seal_preferences',side,m.pack(['Explicit declared order.']*2))
        for side in ['left','right']:self.invoke(0,'compile_side',side)
    def test_side_ownership_and_immutable_inputs(self):
        with self.assertRaisesRegex(Exception,'SIDE_OWNER_ONLY'):self.invoke(1,'seal_preferences','left','[]')
        self.invoke(0,'seal_preferences','left',m.pack(['Explicit declared order.']*2))
        with self.assertRaisesRegex(Exception,'SIDE_SEALED'):self.invoke(0,'seal_preferences','left','[]')
    def test_both_signature_bindings_and_replay(self):
        self.ready();self.invoke(0,'solve');r=self.market();self.invoke(0,'select',0,r['certificate_hash']);digest=self.market()['selection']['digest']
        with self.assertRaisesRegex(Exception,'SELECTION_BINDING'):self.invoke(0,'approve','wrong')
        self.invoke(0,'approve',digest)
        with self.assertRaisesRegex(Exception,'ALREADY_APPROVED'):self.invoke(0,'approve',digest)
        self.invoke(1,'approve',digest);self.assertEqual(self.market()['state'],'COMMITTED')
        with self.assertRaisesRegex(Exception,'SELECTION_NOT_PENDING'):self.invoke(1,'approve',digest)
        with self.assertRaisesRegex(Exception,'MARKET_TERMINAL'):self.invoke(0,'cancel')
    def test_unknown_prevents_solver(self):
        m.compile_preferences=lambda data:{'rows':[row([],status='UNKNOWN',quote='Explicit declared order.') for _ in data['subjects']]}
        self.ready();self.assertEqual(self.market()['state'],'NEEDS_CLARIFICATION')
        with self.assertRaisesRegex(Exception,'PREFERENCES_NOT_READY'):self.invoke(0,'solve')
    def test_outsider_stale_and_cancellation(self):
        with self.assertRaisesRegex(Exception,'PARTY_ONLY'):self.invoke(2,'cancel')
        self.invoke(1,'cancel')
        with self.assertRaisesRegex(Exception,'STALE_REVISION'):tx(self.c,0,'seal_preferences',self.mid,0,'left','[]')
        with self.assertRaisesRegex(Exception,'SIDE_SEALED'):self.invoke(0,'seal_preferences','left','[]')

class ConsensusTests(unittest.TestCase):
    def setUp(self):
        self.data={'subjects':[{'id':'job-one','description':'Job','statement':'First choice Alpha, then Beta.'}], 'candidates':[{'id':'alpha','description':'Alpha'},{'id':'beta','description':'Beta'}]}
        self.good={'rows':[row(['alpha','beta'],quote='First choice Alpha, then Beta.')]}
    def test_forged_or_incomplete_model_output(self):
        for r in [row(['alpha'],quote='First choice Alpha, then Beta.'),row(['alpha','alpha'],quote='First choice Alpha, then Beta.'),row(['alpha','beta'],quote='fabricated')]:
            with self.assertRaises(Exception):m.parse_ranks({'rows':[r]},self.data)
    def test_validator_recomputes_and_audits(self):
        gl.nondet.exec_prompt=lambda prompt,**kw:{'valid':True} if prompt.startswith('Independently audit') else self.good
        def run(leader,validate):
            candidate=leader();self.assertTrue(validate(Return(candidate)))
            bad={'rows':[row(['beta','alpha'],quote='First choice Alpha, then Beta.')]};self.assertFalse(validate(Return(bad)));return candidate
        gl.vm.run_nondet_unsafe=run;m.compile_preferences(self.data)
        gl.nondet.exec_prompt=lambda prompt,**kw:{'valid':False} if prompt.startswith('Independently audit') else self.good
        gl.vm.run_nondet_unsafe=lambda leader,validate:self.assertFalse(validate(Return(self.good))) or self.good
        m.compile_preferences(self.data)
if __name__=='__main__':unittest.main()
