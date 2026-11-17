"""Mock GenLayer host for deterministic unit tests; not a network simulator."""
import types,sys,importlib.util,copy
class Collection:
    def __class_getitem__(cls, _): return cls
class Return:
    def __init__(self,value): self.calldata=value
class Decorator:
    def __getattr__(self,_): return lambda fn:fn
A=['0x'+str(i)*40 for i in range(1,4)]
gl=types.SimpleNamespace(Contract=object,public=Decorator(),message=types.SimpleNamespace(sender_address=A[0]),message_raw={'datetime':'2026-11-17T00:00:00+00:00'},vm=types.SimpleNamespace(Return=Return),nondet=types.SimpleNamespace())
shim=types.ModuleType('genlayer');shim.gl=gl;shim.TreeMap=Collection;shim.DynArray=Collection;sys.modules['genlayer']=shim
spec=importlib.util.spec_from_file_location('contract','contracts/contract.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def tx(c,actor,method,*args):
    gl.message.sender_address=A[actor];before=copy.deepcopy(c.__dict__)
    try:return getattr(c,method)(*args)
    except Exception:
        c.__dict__.clear();c.__dict__.update(before);raise
