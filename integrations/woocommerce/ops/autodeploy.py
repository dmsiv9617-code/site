#!/usr/bin/env python3
"""Root-installed controller: build one Git branch, publish static files only."""
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import urllib.error

ROOT = Path('/srv/woodbase/autodeploy')
PUBLIC = Path('/srv/woodbase/dist-staging')


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def output(*args):
    return subprocess.check_output(args, text=True).strip()


def copy_release(source):
    # Keep previous hashed assets for tabs opened before the release.
    for entry in source.iterdir():
        if entry.name == 'index.html':
            continue
        target = PUBLIC / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target, dirs_exist_ok=True)
        else:
            shutil.copy2(entry, target)
    shutil.copyfile(source / 'index.html', PUBLIC / 'index.html.next')
    os.replace(PUBLIC / 'index.html.next', PUBLIC / 'index.html')


def check_http(url, expected):
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            code = response.status
            body = response.read()
    except urllib.error.HTTPError as error:
        code, body = error.code, error.read()
    if code != expected:
        raise RuntimeError(f'{url}: HTTP {code}, expected {expected}')
    return body


def main():
    config = json.loads(Path('/etc/woodbase-autodeploy.json').read_text())
    ROOT.mkdir(parents=True, exist_ok=True)
    lock = (ROOT / 'deploy.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        return
    try:
        deploy(config)
    finally:
        lock.close()


def deploy(config):
    repo = ROOT / 'repo.git'
    if not repo.exists():
        run('git', 'init', '--bare', str(repo))
    git = ('git', '-c', 'core.hooksPath=/dev/null', '--git-dir', str(repo))
    run(*git, 'fetch', '--no-tags', config['repository'],
        f"+refs/heads/{config['branch']}:refs/heads/source")
    sha = output(*git, 'rev-parse', 'refs/heads/source')
    state = ROOT / 'deployed.json'
    if state.exists() and json.loads(state.read_text())['sha'] == sha:
        print(f'Already deployed {sha}', flush=True)
        return
    backend = output(*git, 'rev-parse', f'{sha}:integrations/woocommerce')
    if backend != config['backend_tree']:
        raise RuntimeError('Backend/ops changed: manual review required; storefront unchanged')
    print(f'Building {sha}', flush=True)
    # Reject repository symlinks before extracting as root.
    entries = output(*git, 'ls-tree', '-r', sha).splitlines()
    if any(line.startswith(('120000 ', '160000 ')) for line in entries):
        raise RuntimeError('Symlinks/submodules require manual review')
    work = Path(tempfile.mkdtemp(prefix='build-', dir=ROOT))
    try:
        archive = work / 'source.tar'
        with archive.open('wb') as handle:
            run(*git, 'archive', sha, stdout=handle)
        source = work / 'source'
        source.mkdir()
        with tarfile.open(archive) as handle:
            handle.extractall(source, filter='data')
        work.chmod(0o755)
        for entry in [source, *source.rglob('*')]:
            os.chown(entry, 65534, 65534)
        # No Docker socket, host credentials, database or live volumes in builder.
        run('docker', 'run', '--rm', '--name', 'woodbase-frontend-build',
            '--user', '65534:65534', '--cap-drop=ALL',
            '--security-opt=no-new-privileges:true', '--memory=1g',
            '--cpus=1', '--pids-limit=256', '--read-only',
            '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m',
            '-e', 'HOME=/tmp', '-e', 'npm_config_cache=/tmp/npm',
            '-e', 'VITE_COMMERCE_MODE=woocommerce',
            '-e', 'VITE_WOOCOMMERCE_ORIGIN=',
            '-v', f'{source}:/build', '-w', '/build', config['node_image'],
            'sh', '-ec', 'npm ci --ignore-scripts --no-audit --no-fund; npm test; npm run build')
        dist = source / 'dist'
        if not (dist / 'index.html').is_file():
            raise RuntimeError('Build did not produce index.html')
        for entry in dist.rglob('*'):
            if entry.is_symlink() or (entry.is_file() and entry.suffix.lower() in {'.php', '.env', '.gpg', '.pem', '.key'}):
                raise RuntimeError('Non-static or secret file in build output')
        # Built-in Vite mode must still be the WooCommerce integration.
        bundle = '\n'.join(p.read_text() for p in (dist / 'assets').glob('*.js'))
        if '/wp-json/wc/store/v1/cart' not in bundle or '/add-item' not in bundle:
            raise RuntimeError('WooCommerce frontend contract missing')
        backups = ROOT / 'previous'
        backups.mkdir(exist_ok=True)
        backup = backups / sha
        if not backup.exists():
            shutil.copytree(PUBLIC, backup)
        try:
            copy_release(dist)
            check_http('https://woodbase-lazer.ru/', 200)
            products = json.loads(check_http('https://woodbase-lazer.ru/wp-json/woodbase/v1/product', 200))
            if len(products['products']) != 6:
                raise RuntimeError('Six WooCommerce products not available')
            check_http('https://woodbase-lazer.ru/wp-json/wc/store/v1/cart', 200)
            check_http('https://woodbase-lazer.ru/wp-admin/', 401)
        except Exception:
            copy_release(backup)
            print('Restored previous storefront', flush=True)
            raise
        next_state = state.with_suffix('.next')
        next_state.write_text(json.dumps({'sha': sha, 'branch': config['branch']}))
        os.replace(next_state, state)
        (PUBLIC / 'RELEASE.txt').write_text(f'GitHub {sha}\n')
        # Retain three storefront backups; never touch WooCommerce data.
        previous = sorted(backups.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in previous[3:]:
            shutil.rmtree(old)
        print(f'Deployed {sha}; database and backend unchanged', flush=True)
    finally:
        shutil.rmtree(work)


if __name__ == '__main__':
    main()
