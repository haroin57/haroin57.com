#!/usr/bin/env python3
"""Create private Mac E2E fixtures from the actual distributed workflow generator."""
import argparse
import copy
import importlib.util
import hashlib
import json
from pathlib import Path
import plistlib
import urllib.parse

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('shortcut_builder',ROOT/'scripts/gen-shortcuts.py')
builder=importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
args=parser.parse_args()
config=json.loads((args.directory/'config.json').read_text())
origin=config['origin']
parsed=urllib.parse.urlsplit(origin)
if parsed.scheme!='http' or parsed.hostname!='127.0.0.1': raise SystemExit('Fixture server must be loopback HTTP.')
# Production generation remains HTTPS-only. Only private test fixtures replace the origin.
config['origin']='https://becs-e2e.invalid'
workflows=builder.build(config,(args.directory/'token').read_text())
def replace(value):
    if isinstance(value,str): return value.replace('https://becs-e2e.invalid',origin)
    if isinstance(value,list): return [replace(v) for v in value]
    if isinstance(value,dict): return {k:replace(v) for k,v in value.items()}
    return value
out=args.directory/'unsigned'; out.mkdir(mode=0o700,exist_ok=True)
manifest={}
for name,workflow in workflows.items():
    workflow=replace(workflow)
    workflow['WFWorkflowName']='BECS-E2E-'+name+'-setup3'
    # Force the native import questions to populate the values; prefilled actions would hide setup bugs.
    for question in workflow.get('WFWorkflowImportQuestions', []):
        workflow['WFWorkflowActions'][question['ActionIndex']]['WFWorkflowActionParameters']['WFTextActionText']=''
    data=plistlib.dumps(workflow,fmt=plistlib.FMT_BINARY,sort_keys=False)
    file=out/('BECS-E2E-'+name+'-'+hashlib.sha256(data).hexdigest()[:8]+'.shortcut')
    file.write_bytes(data)
    manifest[name]=file.name
    file.chmod(0o600)
guards=[]
for index,field in enumerate(['device_id','tag_id','token']):
    variants=[''] if field!='token' else ['', 'CONFIGURE_DEVICE_SCOPED_TOKEN']
    for value in variants:
        workflow=replace(copy.deepcopy(workflows['wake']))
        questions=workflow.pop('WFWorkflowImportQuestions')
        workflow['WFWorkflowActions'][questions[index]['ActionIndex']]['WFWorkflowActionParameters']['WFTextActionText']=value
        workflow['WFWorkflowName']='BECS-E2E-unset-'+field
        data=plistlib.dumps(workflow,fmt=plistlib.FMT_BINARY,sort_keys=False)
        file=out/('BECS-E2E-unset-'+field+'-'+hashlib.sha256(data).hexdigest()[:8]+'.shortcut')
        file.write_bytes(data); file.chmod(0o600)
        guards.append({'field':field,'kind':'blank' if not value else 'placeholder','file':file.name})
(args.directory/'guard-workflows.json').write_text(json.dumps(guards,indent=2)+'\n')
(args.directory/'workflows.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Created six private localhost E2E workflows from the production generator.')
