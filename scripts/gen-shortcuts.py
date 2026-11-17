#!/usr/bin/env python3
"""Build unsigned Shortcuts templates. Signing/importing requires an Apple device."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import stat
import urllib.parse
import uuid

REPO = Path(__file__).resolve().parents[1]
NAMESPACE = uuid.UUID('cfb6fc88-2638-48b0-9a5b-f644fb86aa48')


def reference(action, name):
    return {'OutputUUID': action['WFWorkflowActionParameters']['UUID'], 'OutputName': name, 'Type': 'ActionOutput'}


def text(value, variable=None, prefix=''):
    if variable is None:
        return {'Value': {'string': str(value), 'attachmentsByRange': {}}, 'WFSerializationType': 'WFTextTokenString'}
    return {'Value': {'string': prefix + '\ufffc', 'attachmentsByRange': {'{%d, 1}' % len(prefix): variable}}, 'WFSerializationType': 'WFTextTokenString'}


def dictionary(values):
    return {'Value': {'WFDictionaryFieldValueItems': [
        {'WFKey': text(key), 'WFItemType': 0, 'WFValue': value if isinstance(value, dict) else text(value)}
        for key, value in values.items()
    ]}, 'WFSerializationType': 'WFDictionaryFieldValue'}


def build(config, token):
    origin = config['origin'].rstrip('/')
    parsed = urllib.parse.urlsplit(origin)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('origin must be an HTTPS origin without credentials or a path')
    outputs = {}
    names = {'wake': 'BECS 起床', 'departure': 'BECS 外出', 'lab-arrival': 'BECS 研究室到着'}
    for key in [*names, 'habit-public-log', 'control', 'focus']:
        actions = []
        questions = []

        def action(identifier, **parameters):
            parameters['UUID'] = str(uuid.uuid5(NAMESPACE, key + ':' + str(len(actions))))
            item = {'WFWorkflowActionIdentifier': 'is.workflow.actions.' + identifier, 'WFWorkflowActionParameters': parameters}
            actions.append(item)
            return item

        if key in names:
            action('comment', WFCommentActionText='本人用iPhoneの端末ID・端末資格情報・公開tag_idを設定してください。ネットワーク失敗は未確認です。全体を自動再実行しません。')
            configured = {}
            fields = [
                ('device_id', config['device_id'], 'CONFIGURE_IPHONE_DEVICE_ID', 'このiPhoneの端末IDを入力してください。/control/tagsで発行します。'),
                ('tag_id', config['tags'][key], 'CONFIGURE_NFC_' + {'wake':'WAKE','departure':'DEPARTURE','lab-arrival':'LAB_ARRIVAL'}[key] + '_TAG_ID', 'この操作に紐付けたタグIDを入力してください。'),
                ('token', token, 'CONFIGURE_DEVICE_SCOPED_TOKEN', 'このiPhone専用の資格情報を入力してください。管理者シークレットは使用しません。'),
            ]
            for field, value, placeholder, prompt in fields:
                index = len(actions)
                configured[field] = action('gettext', WFTextActionText=value)
                questions.append({'ActionIndex': index, 'Category': 'Parameter', 'ParameterKey': 'WFTextActionText', 'Text': prompt, 'DefaultValue': '' if value == placeholder else value})
            for field, value, placeholder, prompt in fields:
                for invalid in ['', placeholder]:
                    group = str(uuid.uuid5(NAMESPACE, key + ':guard:' + field + ':' + invalid))
                    check = {'Type': 'Variable', 'Variable': {'Value': reference(configured[field], field), 'WFSerializationType': 'WFTextTokenAttachment'}}
                    action('conditional', GroupingIdentifier=group, WFControlFlowMode=0, WFCondition=4, WFConditionalActionString=invalid, WFInput=check)
                    message = '初期設定が必要です。' + prompt + ' ショートカットの最初の3つのテキスト欄、または詳細の設定タブで変更してください。'
                    action('showresult', Text=text(message))
                    action('output', WFOutput=text('CONFIGURATION_REQUIRED: ' + field))
                    action('conditional', GroupingIdentifier=group, WFControlFlowMode=2)
            device = text('', reference(configured['device_id'], 'device_id'))
            tag = text('', reference(configured['tag_id'], 'tag_id'))
            authorization = text('', reference(configured['token'], 'token'), 'Bearer ')
            headers = dictionary({'Content-Type': 'application/json', 'Authorization': authorization})
            prepared = action('downloadurl', WFURL=origin + '/api/v1/nfc/prepare', WFHTTPMethod='POST', WFHTTPBodyType='JSON', WFHTTPHeaders=headers, WFJSONValues=dictionary({'tag_id': tag, 'device_id': device}))
            scan_id = action('getvalueforkey', WFDictionaryKey='scan_id', WFInput={'Value': reference(prepared, '準備応答'), 'WFSerializationType': 'WFTextTokenAttachment'})
            occurred = action('getvalueforkey', WFDictionaryKey='occurred_at', WFInput={'Value': reference(prepared, '準備応答'), 'WFSerializationType': 'WFTextTokenAttachment'})
            submitted = action('downloadurl', WFURL=origin + '/api/v1/nfc/scans', WFHTTPMethod='POST', WFHTTPBodyType='JSON', WFHTTPHeaders=headers,
                   WFJSONValues=dictionary({'scan_id': text('', reference(scan_id, 'scan_id')), 'tag_id': tag, 'device_id': device, 'source': 'IOS_SHORTCUTS', 'occurred_at': text('', reference(occurred, 'occurred_at'))}))
            action('showresult', Text=text('', reference(submitted, '受付結果')))  # Show the actual outcome, never a synthetic success.
            name = names[key]
        elif key == 'habit-public-log':
            fetched = action('downloadurl', WFURL=origin + '/api/habit/stats', WFHTTPMethod='GET')
            streak = action('getvalueforkey', WFDictionaryKey='streak_days', WFInput={'Value': reference(fetched, '公開ログ'), 'WFSerializationType': 'WFTextTokenAttachment'})
            action('showresult', Text=text('', reference(streak, '連続達成日数'), '連続達成日数: '))
            action('openurl', WFInput=origin + '/habit', **{'Show-WFInput': True})
            name = 'Habit 公開ログを取得'
        else:
            action('openurl', WFInput=origin + '/' + key, **{'Show-WFInput': True})
            name = 'BECS ' + ('管理画面' if key == 'control' else '集中画面')
        outputs[key] = {'WFWorkflowName': name, 'WFWorkflowMinimumClientVersion': 900,
                        'WFWorkflowIcon': {'WFWorkflowIconStartColor': 4286611584, 'WFWorkflowIconGlyphNumber': 59511},
                        'WFWorkflowInputContentItemClasses': [], 'WFWorkflowTypes': ['NCWidget'], 'WFWorkflowImportQuestions': questions, 'WFWorkflowActions': actions}
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=REPO / 'shortcuts/becs.example.json')
    parser.add_argument('--output', type=Path, default=REPO / 'public/shortcuts')
    parser.add_argument('--device-token-file', type=Path)
    parser.add_argument('--cherri-output', type=Path, default=REPO / 'shortcuts/sources')
    args = parser.parse_args()
    token = 'CONFIGURE_DEVICE_SCOPED_TOKEN'
    output = args.output.expanduser().resolve()
    cherri_output = args.cherri_output.expanduser().resolve()
    if args.device_token_file:
        if output.is_relative_to(REPO) or cherri_output.is_relative_to(REPO):
            raise ValueError('Personalized shortcuts must be written outside the repository/public assets')
        token_file = args.device_token_file.expanduser()
        if stat.S_IMODE(token_file.stat().st_mode) & 0o077:
            raise ValueError('Token file must have permission 0600')
        token = token_file.read_text().strip()
        if not token or '\n' in token:
            raise ValueError('Token file must contain one non-empty credential')
    config = json.loads(args.config.read_text())
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    cherri_output.mkdir(parents=True, exist_ok=True, mode=0o700)
    for key, shortcut in build(config, token).items():
        path = output / (key + '.unsigned.shortcut')
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'wb') as handle:
            plistlib.dump(shortcut, handle, fmt=plistlib.FMT_XML, sort_keys=False)
        source = '#define name ' + shortcut['WFWorkflowName'] + '\n\n'
        source += '// Generated raw action parameters. Compile and validate on the owner Mac.\n'
        for action in shortcut['WFWorkflowActions']:
            source += 'rawAction(' + json.dumps(action['WFWorkflowActionIdentifier']) + ', ' + json.dumps(action['WFWorkflowActionParameters'], ensure_ascii=False, indent=2) + ')\n\n'
        source_path = cherri_output / (key + '.cherri')
        with os.fdopen(os.open(source_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as handle:
            handle.write(source.rstrip() + '\n')
    print('Created six unsigned workflows. macOS signing and iPhone import/automation binding remain required.')


if __name__ == '__main__':
    main()
