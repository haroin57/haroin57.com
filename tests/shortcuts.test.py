import copy
import importlib.util
import hashlib
import json
from pathlib import Path
import plistlib
import unittest

ROOT=Path(__file__).resolve().parents[1]

def load(name, path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

builder=load('shortcuts_builder',ROOT/'scripts/gen-shortcuts.py')
target=load('deploy_target',ROOT/'scripts/check-deploy-target.py')


class ShortcutTests(unittest.TestCase):
    def setUp(self):
        self.config=json.loads((ROOT/'shortcuts/becs.example.json').read_text())
        self.workflows=builder.build(self.config,'CONFIGURE_DEVICE_SCOPED_TOKEN')

    def test_six_credential_free_deterministic_workflows_match_generated_files(self):
        self.assertEqual(len(self.workflows),6)
        self.assertEqual(self.workflows,builder.build(self.config,'CONFIGURE_DEVICE_SCOPED_TOKEN'))
        for name,workflow in self.workflows.items():
            published=plistlib.loads((ROOT/f'public/shortcuts/{name}.unsigned.shortcut').read_bytes())
            self.assertEqual(workflow,published)
            content=json.dumps(workflow)
            self.assertNotIn('BECS_ADMIN_SECRET',content)
            self.assertNotIn('HABIT_TOKEN',content)
            self.assertTrue((ROOT/f'shortcuts/sources/{name}.cherri').exists())

    def test_six_signed_artifacts_match_manifest_and_unsigned_sources(self):
        root=ROOT/'public/shortcuts'
        artifacts=json.loads((root/'signed/artifact-manifest.json').read_text())
        self.assertEqual(len(artifacts),6)
        self.assertEqual({item['file'] for item in artifacts},{name+'.shortcut' for name in self.workflows})
        for item in artifacts:
            data=(root/'signed'/item['file']).read_bytes()
            self.assertEqual(data[:4],b'AEA1')
            self.assertEqual(len(data),item['bytes'])
            self.assertEqual(hashlib.sha256(data).hexdigest(),item['sha256'])
            source=(root/item['file'].replace('.shortcut','.unsigned.shortcut')).read_bytes()
            self.assertEqual(hashlib.sha256(source).hexdigest(),item['source_sha256'])
            self.assertEqual(item['signing_mode'],'anyone')

    def test_nfc_workflows_prepare_before_submit_and_wire_runtime_identifiers(self):
        for name in ['wake','departure','lab-arrival']:
            actions=self.workflows[name]['WFWorkflowActions']
            requests=[a['WFWorkflowActionParameters'] for a in actions if a['WFWorkflowActionIdentifier'].endswith('.downloadurl')]
            self.assertEqual([r['WFURL'].split('/api/v1')[-1] for r in requests],['/nfc/prepare','/nfc/scans'])
            self.assertTrue(all(r['WFHTTPMethod']=='POST' for r in requests))
            values={entry['WFKey']['Value']['string']:entry['WFValue'] for entry in requests[1]['WFJSONValues']['Value']['WFDictionaryFieldValueItems']}
            self.assertEqual(values['source']['Value']['string'],'IOS_SHORTCUTS')
            for field in ['scan_id','occurred_at']:
                reference=values[field]['Value']['attachmentsByRange']['{0, 1}']['OutputUUID']
                upstream=next(a for a in actions if a['WFWorkflowActionParameters']['UUID']==reference)
                self.assertEqual(upstream['WFWorkflowActionParameters']['WFDictionaryKey'],field)
            # A failed network operation is not followed by any synthetic success notification.
            self.assertFalse(any(a['WFWorkflowActionIdentifier'].endswith('.notification') for a in actions))

    def test_public_log_uses_get_and_no_auth(self):
        actions=self.workflows['habit-public-log']['WFWorkflowActions']
        request=actions[0]['WFWorkflowActionParameters']
        self.assertEqual(request['WFHTTPMethod'],'GET')
        self.assertTrue(request['WFURL'].endswith('/api/habit/stats'))
        self.assertNotIn('WFHTTPHeaders',request)
        self.assertTrue(actions[-1]['WFWorkflowActionParameters']['WFInput'].endswith('/habit'))

    def test_nfc_setup_questions_bind_shared_values_before_any_network_action(self):
        for name in ['wake','departure','lab-arrival']:
            workflow=self.workflows[name]
            actions=workflow['WFWorkflowActions']
            questions=workflow['WFWorkflowImportQuestions']
            self.assertEqual(len(questions),3)
            self.assertEqual({q['ParameterKey'] for q in questions},{'WFTextActionText'})
            self.assertTrue(all(q['DefaultValue']=='' for q in questions))
            request_index=next(i for i,a in enumerate(actions) if a['WFWorkflowActionIdentifier'].endswith('.downloadurl'))
            self.assertTrue(all(q['ActionIndex']<request_index for q in questions))
            guards=[a for a in actions[:request_index] if a['WFWorkflowActionIdentifier'].endswith('.output')]
            self.assertTrue(all(a['WFWorkflowActionParameters']['WFOutput']['Value']['string'].startswith('CONFIGURATION_REQUIRED') for a in guards))
            self.assertTrue(guards)
            token_action=actions[questions[2]['ActionIndex']]['WFWorkflowActionParameters']
            self.assertEqual(token_action['WFTextActionText'],'CONFIGURE_DEVICE_SCOPED_TOKEN')
            for action in actions:
                if action['WFWorkflowActionIdentifier'].endswith('.downloadurl'):
                    entries=action['WFWorkflowActionParameters']['WFHTTPHeaders']['Value']['WFDictionaryFieldValueItems']
                    auth=next(item['WFValue'] for item in entries if item['WFKey']['Value']['string']=='Authorization')
                    self.assertEqual(auth['Value']['string'],'Bearer \ufffc')
                    self.assertEqual(auth['Value']['attachmentsByRange']['{7, 1}']['OutputUUID'],token_action['UUID'])

    def test_open_url_uses_explicit_runtime_input_instead_of_inheriting_previous_result(self):
        for name,path in [('habit-public-log','/habit'),('control','/control'),('focus','/focus')]:
            action=self.workflows[name]['WFWorkflowActions'][-1]
            self.assertEqual(action['WFWorkflowActionIdentifier'],'is.workflow.actions.openurl')
            self.assertEqual(action['WFWorkflowActionParameters']['WFInput'],self.config['origin']+path)
            self.assertTrue(action['WFWorkflowActionParameters']['Show-WFInput'])
            self.assertNotIn('WFURL',action['WFWorkflowActionParameters'])

    def test_origin_rejects_credentials_and_unexpected_path(self):
        for origin in ['http://example.com','https://token@example.com','https://example.com/private']:
            config=copy.deepcopy(self.config); config['origin']=origin
            with self.assertRaises(ValueError): builder.build(config,'placeholder')

    def test_confirm_deployment_requires_custom_domain_production_and_main(self):
        projects=[{'Project Name':'existing','Project Domains':'haroin57.com, existing.pages.dev'}]
        deploys=[{'Environment':'Production','Branch':'main'}]
        target.validate(projects,deploys,'existing')
        for project,deploy,name in [(projects,deploys,'another'),([{'Project Name':'existing','Project Domains':'evilharoin57.com'}],deploys,'existing'),(projects,[{'Environment':'Production','Branch':'dev'}],'existing'),(projects,[],'existing')]:
            with self.assertRaises(ValueError): target.validate(project,deploy,name)


if __name__=='__main__': unittest.main()
