#!/usr/bin/env python3
"""Run real macOS Shortcuts against the isolated Worker fixture; never use production credentials."""
import argparse
import hashlib
import platform
import json
from pathlib import Path
import plistlib
import subprocess
import sys
import time
import urllib.request

DIALOGS = r'''
tell application "System Events"
  if not (exists process "ShortcutsViewService") then return ""
  tell process "ShortcutsViewService"
    set report to ""
    repeat with itemRef in windows
      set w to contents of itemRef
      set windowName to name of w as text
      if windowName starts with "BECS-E2E-" or windowName is "プライバシー" then
        try
          set labels to value of every static text of group 1 of w
          try
            set labels to labels & (value of every static text of scroll area 1 of group 1 of w)
          end try
          set message to labels as text
          if windowName is not "プライバシー" or message contains "127.0.0.1" or (message contains "BECS-E2E-" and message contains "出力") then
            set report to report & windowName & ": " & message & linefeed
            set countButtons to count of buttons of group 1 of w
            if countButtons > 0 then click button countButtons of group 1 of w
          end if
        end try
      end if
    end repeat
    return report
  end tell
end tell
'''
IMPORT = r'''
tell application "System Events"
  tell process "Shortcuts"
    repeat with w in windows
      try
        get role of sheet 1 of w
        return "Waiting for setup sheet"
      end try
    end repeat
    repeat with w in windows
      try
        click button 2 of scroll area 1 of group 1 of w
        delay 1.5
        return "Import confirmed"
      end try
    end repeat
    return "Waiting for import preview"
  end tell
end tell
'''

def apple(script):
    result=subprocess.run(['osascript','-e',script],capture_output=True,text=True,timeout=10)
    if result.returncode: return 'AUTOMATION_ERROR: '+result.stderr.strip()
    return result.stdout.strip()

def installed():
    return subprocess.run(['shortcuts','list'],capture_output=True,text=True,check=True,timeout=15).stdout.splitlines()

def import_workflow(path, setup_values=()):
    name=path.stem
    if name in installed(): return name
    subprocess.run(['open',str(path)],check=True)
    deadline=time.monotonic()+45
    while time.monotonic()<deadline:
        if name in installed(): return name
        setup_result=''
        if setup_values:
            assignments='\n'.join(
                f'set targetField to text area 1 of scroll area 1 of group {i+1} of scroll area 1 of group 1 of sheet 1 of w\n'
                f'set focused of targetField to true\ndelay 0.15\n'
                f'set value of targetField to {json.dumps(value)}\nkey code 48\ndelay 0.15\n'
                f'if (value of targetField as text) is not {json.dumps(value)} then return "SETUP_VALUE_MISMATCH_{i}"'
                for i,value in enumerate(setup_values))
            setup_script='tell application "System Events" to tell process "Shortcuts"\nset frontmost to true\nrepeat with w in windows\ntry\nif (value of static text 1 of group 1 of sheet 1 of w as text) contains '+json.dumps(name)+' then\nperform action "AXRaise" of w\n'+assignments+'\nclick button 2 of group 1 of sheet 1 of w\nreturn "Setup completed"\nend if\nend try\nend repeat\nreturn "SETUP_PENDING"\nend tell'
            setup_result=apple(setup_script)
            if 'MISMATCH' in setup_result: raise RuntimeError(setup_result)
            if setup_result=='Setup completed': print(setup_result,flush=True)
        if setup_result!='Setup completed':
            import_result=apple(IMPORT)
            if import_result=='Import confirmed': print(import_result,flush=True)
        time.sleep(.5)
    raise RuntimeError('Shortcut import did not finish: '+name)

def sign(source,destination):
    for attempt in range(3):
        candidate=destination.with_name(destination.stem+f'.attempt-{attempt}.shortcut')
        subprocess.run(['shortcuts','sign','--mode','anyone','--input',str(source),'--output',str(candidate)],capture_output=True,timeout=90)
        if candidate.exists() and candidate.read_bytes()[:4]==b'AEA1':
            destination.write_bytes(candidate.read_bytes()); return
    raise RuntimeError('Apple signing did not produce a signed artifact: '+source.name)

def read_state(origin):
    with urllib.request.urlopen(origin+'/__e2e/state',timeout=5) as response: return json.load(response)

def execute(name,directory):
    output=directory/(name+'.output')
    log=directory/(name+'.log')
    captured=[]
    with log.open('w') as handle:
        process=subprocess.Popen(['shortcuts','run',name,'--output-path',str(output)],stdout=handle,stderr=handle)
        deadline=time.monotonic()+90
        while process.poll() is None and time.monotonic()<deadline:
            dialog=apple(DIALOGS)
            if dialog: captured.append(dialog)
            time.sleep(.3)
        if process.poll() is None:
            process.terminate(); process.wait(timeout=5)
            raise RuntimeError('Shortcut runtime timed out: '+name)
    result={'name':name,'exit_code':process.returncode,'dialogs':captured,'output':output.read_text(errors='replace') if output.exists() else '', 'log':log.read_text()}
    (directory/(name+'.result.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    if process.returncode: raise RuntimeError('Shortcut runtime failed: '+name+' / '+result['log'])
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path)
    args=parser.parse_args()
    root=args.directory.resolve()
    config=json.loads((root/'config.json').read_text())
    origin=config['origin']
    if not origin.startswith('http://127.0.0.1:'): raise SystemExit('Only the private loopback fixture is supported.')
    reset=urllib.request.Request(origin+'/__e2e/reset',method='POST',headers={'X-BECS-E2E-Reset':(root/'token').read_text()})
    with urllib.request.urlopen(reset,timeout=5) as response: assert json.load(response)['reset']
    signed=root/'signed'; signed.mkdir(mode=0o700,exist_ok=True)
    results=[]
    workflows=json.loads((root/'workflows.json').read_text())
    expected={'wake':'MORNING','departure':'TRANSIT','lab-arrival':'RESEARCH'}
    for key in ['wake','departure','lab-arrival','habit-public-log','control','focus']:
        source=root/'unsigned'/workflows[key]
        target=signed/source.name
        print('SIGN/IMPORT/RUN:',key,flush=True)
        if not target.exists(): sign(source,target)
        print('SIGNED:',key,flush=True)
        setup_values=[q['DefaultValue'] for q in plistlib.loads(source.read_bytes()).get('WFWorkflowImportQuestions',[])]
        name=import_workflow(target,setup_values)
        print('IMPORTED:',key,flush=True)
        result=execute(name,root)
        time.sleep(1)
        state=read_state(origin)
        if key in expected:
            assert state['state']['routinePhase']==expected[key],state
            assert len(state['scans'])==len(results)+1,state
            assert state['scans'][-1]['outcome']=='ACCEPTED',state
        else:
            route='/api/habit/stats' if key=='habit-public-log' else '/'+key
            deadline=time.monotonic()+10
            while not any(item['path']==route for item in state['requests']) and time.monotonic()<deadline:
                time.sleep(.5); state=read_state(origin)
            assert any(item['path']==route for item in state['requests']),state
            assert state['state']['revision']==3,state
        results.append({'name':key,'status':'PASS','exit_code':result['exit_code'],'phase':state['state']['routinePhase'],'revision':state['state']['revision']})
        print('PASS:',key,flush=True)
    guard_results=[]
    for case in json.loads((root/'guard-workflows.json').read_text()):
        source=root/'unsigned'/case['file']; target=signed/source.name
        if not target.exists(): sign(source,target)
        before=read_state(origin)
        name=import_workflow(target)
        result=execute(name,root)
        after=read_state(origin)
        assert after['state']['revision']==before['state']['revision']==3
        assert len([r for r in after['requests'] if r['method']=='POST'])==len([r for r in before['requests'] if r['method']=='POST'])
        prompt={'device_id':'このiPhoneの端末ID','tag_id':'この操作に紐付けたタグID','token':'このiPhone専用の資格情報'}[case['field']]
        assert any('初期設定が必要です。' in dialog and prompt in dialog for dialog in result['dialogs']),result
        guard_results.append({'field':case['field'],'kind':case['kind'],'status':'PASS','network_post_sent':False})
        print('PASS: missing configuration prevented POST:',case['field'],case['kind'],flush=True)
    preparation_results=[]
    for case in json.loads((root/'preparation-failures.json').read_text()):
        source=root/'unsigned'/case['file']; target=signed/source.name
        if not target.exists(): sign(source,target)
        before=read_state(origin)
        name=import_workflow(target)
        result=execute(name,root)
        after=read_state(origin)
        assert after['state']['revision']==before['state']['revision']==3
        assert len(after['scans'])==len(before['scans'])==3
        assert len([r for r in after['requests'] if r['path']=='/api/v1/nfc/scans'])==len([r for r in before['requests'] if r['path']=='/api/v1/nfc/scans'])
        assert any('準備APIで失敗しました:' in dialog and case['expected_message'] in dialog for dialog in result['dialogs']),result
        preparation_results.append({'case':case['case'],'status':'PASS','scan_sent':False,'original_error_shown':True})
        print('PASS: preparation failure preserved; no scan sent:',case['case'],flush=True)
    state=read_state(origin)
    scans=[item for item in state['requests'] if item['path']=='/api/v1/nfc/scans']
    assert len(scans)==3,state
    assert len({item['body']['scan_id'] for item in scans})==3
    report={'status':'PASS','runtime':'macOS Shortcuts CLI','backend':'real Worker handlers, isolated SQLite on Mac loopback','production_changed':False,'macos_version':platform.mac_ver()[0],'generator_sha256':hashlib.sha256((Path(__file__).resolve().parents[1]/'gen-shortcuts.py').read_bytes()).hexdigest(),'results':results,'configuration_guards':guard_results,'preparation_failures':preparation_results,'final_revision':state['state']['revision'],'final_phase':state['state']['routinePhase'],'accepted_scans':len(state['scans'])}
    (root/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('PASS: all six real Shortcuts workflows and four configuration guards and three preparation failures; final revision 3 / RESEARCH; production untouched.',flush=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        print('E2E FAILED:',str(error),file=sys.stderr,flush=True)
        raise
