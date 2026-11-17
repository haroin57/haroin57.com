#!/usr/bin/env python3
import json
from pathlib import Path
import sys


def validate(projects, deployments, name):
    project = next((item for item in projects if item.get('Project Name') == name), None)
    if not project or 'haroin57.com' not in [part.strip() for part in project.get('Project Domains', '').split(',')]:
        raise ValueError('haroin57.comに接続済みのPagesプロジェクトを確認できません。')
    if not deployments or deployments[0].get('Branch') != 'main' or deployments[0].get('Environment') != 'Production':
        raise ValueError('既存の本番配備ブランチがmainであることを確認できません。')


if __name__ == '__main__':
    validate(json.loads(Path(sys.argv[1]).read_text()), json.loads(Path(sys.argv[2]).read_text()), sys.argv[3])
