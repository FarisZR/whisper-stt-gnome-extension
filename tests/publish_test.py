"""Exercise publication without GitHub credentials or mutations."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'a' * 40


class PublicationTest(unittest.TestCase):
    def run_publish(self, draft='true', current=COMMIT):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / 'dist').mkdir()
        (root / 'bin').mkdir()
        for name in ['whisper-stt-gnome-extension.tar.gz', 'whisper-stt@fariszr.com.shell-extension.zip']:
            (root / 'dist' / name).write_text('bundle')
        sums = subprocess.check_output(['sha256sum', 'whisper-stt-gnome-extension.tar.gz',
                                        'whisper-stt@fariszr.com.shell-extension.zip'], cwd=root / 'dist')
        (root / 'dist/SHA256SUMS').write_bytes(sums)
        fake = root / 'bin/gh'
        fake.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
with open('calls', 'a') as log:
    log.write(' '.join(args) + '\\n')
if args[0] == 'api':
    print(os.environ['CURRENT'])
elif '--json' in args:
    field = args[args.index('--json') + 1]
    if field == 'isDraft':
        print(os.environ['DRAFT'])
    else:
        print(json.dumps(['SHA256SUMS', 'whisper-stt-gnome-extension.tar.gz',
                          'whisper-stt@fariszr.com.shell-extension.zip']))
''')
        fake.chmod(0o755)
        env = {**os.environ, 'PATH': f'{root}/bin:{os.environ["PATH"]}',
               'BUILD_COMMIT': COMMIT, 'CURRENT': current, 'DRAFT': draft,
               'GITHUB_OUTPUT': str(root / 'output')}
        subprocess.run(['bash', str(ROOT / 'scripts/publish.sh')], cwd=root, env=env, check=True,
                       capture_output=True)
        calls = '\n'.join(path.read_text() for path in [root / 'calls', root / 'dist/calls'] if path.exists())
        return calls, (root / 'output').read_text() if (root / 'output').exists() else ''

    def test_recovers_incomplete_draft(self):
        calls, output = self.run_publish()
        self.assertIn('--clobber', calls)
        self.assertIn('published=true', output)

    def test_preserves_published_assets(self):
        calls, output = self.run_publish(draft='false')
        self.assertNotIn('release upload', calls)
        self.assertIn('published=true', output)

    def test_skips_outdated_main(self):
        calls, output = self.run_publish(current='b' * 40)
        self.assertNotIn('release ', calls)
        self.assertEqual(output, '')


if __name__ == '__main__':
    unittest.main()
