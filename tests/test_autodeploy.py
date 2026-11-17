"""Failure-path tests of the controller; no Docker/network/database access."""
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).parents[1] / 'integrations/woocommerce/ops/autodeploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        deploy.ROOT, deploy.PUBLIC = root / 'controller', root / 'public'
        deploy.PUBLIC.mkdir()
        (deploy.PUBLIC / 'index.html').write_text('old')
        self.config = json.dumps(dict(repository='https://example.test/repo', branch='deploy/test', backend_tree='backend', node_image='node@sha256:fixture'))
        self.original_read = Path.read_text
        config = self.config
        original_read = self.original_read
        def read(path, *args, **kwargs):
            if str(path) == '/etc/woodbase-autodeploy.json':
                return config
            return original_read(path, *args, **kwargs)
        self.read_patch = patch.object(Path, 'read_text', read)
        self.read_patch.start()
        self.addCleanup(self.read_patch.stop)
        self.docker_calls = 0

    def output(self, *args):
        if 'ls-tree' in args:
            return '100644 blob file\tindex.html'
        return 'backend' if args[-1].endswith(':integrations/woocommerce') else 'commit'

    def simulate_run(self, *args, **kwargs):
        if 'archive' in args:
            with tarfile.open(fileobj=kwargs['stdout'], mode='w') as archive:
                content = b'{}'
                info = tarfile.TarInfo('package.json')
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        if args[0] == 'docker':
            self.docker_calls += 1
            source = next(value[:-7] for value in args if value.endswith(':/build'))
            dist = Path(source) / 'dist'
            (dist / 'assets').mkdir(parents=True)
            (dist / 'index.html').write_text('new')
            (dist / 'assets/app.js').write_text('/wp-json/wc/store/v1/cart /add-item')

    def http(self, url, expected):
        return b'{"products":[1,2,3,4,5,6]}' if '/product' in url else b'ok'

    def test_backend_change_does_not_build_or_publish(self):
        with patch.object(deploy, 'run', self.simulate_run), patch.object(deploy, 'output', lambda *args: 'different'):
            with self.assertRaisesRegex(RuntimeError, 'Backend/ops changed'):
                deploy.main()
        self.assertEqual((deploy.PUBLIC / 'index.html').read_text(), 'old')
        self.assertEqual(self.docker_calls, 0)

    def test_failed_build_keeps_live_index_and_no_success_state(self):
        def fail(*args, **kwargs):
            if args[0] == 'docker':
                raise RuntimeError('failed tests')
            return self.simulate_run(*args, **kwargs)
        with patch.object(deploy, 'run', fail), patch.object(deploy, 'output', self.output):
            with self.assertRaisesRegex(RuntimeError, 'failed tests'):
                deploy.main()
        self.assertEqual((deploy.PUBLIC / 'index.html').read_text(), 'old')
        self.assertFalse((deploy.ROOT / 'deployed.json').exists())

    def test_http_failure_restores_previous_index(self):
        with patch.object(deploy, 'run', self.simulate_run), patch.object(deploy, 'output', self.output), patch.object(deploy, 'check_http', side_effect=RuntimeError('HTTP failure')):
            with self.assertRaisesRegex(RuntimeError, 'HTTP failure'):
                deploy.main()
        self.assertEqual((deploy.PUBLIC / 'index.html').read_text(), 'old')
        self.assertFalse((deploy.ROOT / 'deployed.json').exists())

    def test_demo_only_bundle_cannot_replace_storefront(self):
        def demo(*args, **kwargs):
            result = self.simulate_run(*args, **kwargs)
            if args[0] == 'docker':
                source = next(value[:-7] for value in args if value.endswith(':/build'))
                (Path(source) / 'dist/assets/app.js').write_text('demo cart only')
            return result
        with patch.object(deploy, 'run', demo), patch.object(deploy, 'output', self.output):
            with self.assertRaisesRegex(RuntimeError, 'WooCommerce frontend contract missing'):
                deploy.main()
        self.assertEqual((deploy.PUBLIC / 'index.html').read_text(), 'old')

    def test_success_and_repeat_only_build_once(self):
        with patch.object(deploy, 'run', self.simulate_run), patch.object(deploy, 'output', self.output), patch.object(deploy, 'check_http', self.http):
            deploy.main()
            deploy.main()
        self.assertEqual((deploy.PUBLIC / 'index.html').read_text(), 'new')
        self.assertEqual(self.docker_calls, 1)
        self.assertEqual(json.loads((deploy.ROOT / 'deployed.json').read_text())['sha'], 'commit')


if __name__ == '__main__':
    unittest.main()

