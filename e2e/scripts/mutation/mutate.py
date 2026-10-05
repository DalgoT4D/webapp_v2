"""Mutation drill runner (production-build mode, e2e server on :3000).

Per mutation, one at a time:
  apply exact unique find/replace → `next build` (build failure = invalid mutation) →
  restart `next start -p 3000` → targeted specs (--max-failures=1) → if none failed, the whole
  area folder → caught / missed → ALWAYS revert. After the last mutation: clean rebuild + restart.
Results append to mutation-results.jsonl (resumable).

Usage: python3 mutate.py M31 M32 ...
"""
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.request

WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
S = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(S, 'mutation-results.jsonl')
MUTS = {m['id']: m for m in json.load(open(os.path.join(S, 'mutations.json')))}
PORT = 3000
BASE = f'http://localhost:{PORT}'

# Specs most related to each mutation (pass 1); the area folder is pass 2 (confirms a miss).
TARGETED = {
    'M01': ['e2e/charts/save-persistence.spec.ts', 'e2e/charts/edit.spec.ts'],
    'M02': ['e2e/charts/builder-shared.spec.ts'],
    'M03': ['e2e/charts/builder-bar.spec.ts'],
    'M04': ['e2e/charts/perm-chains.spec.ts'],
    'M05': ['e2e/charts/save-persistence.spec.ts', 'e2e/charts/edit.spec.ts'],
    'M06': ['e2e/charts/type-switch-matrix-edit.spec.ts'],
    'M07': ['e2e/charts/type-switch.spec.ts', 'e2e/charts/metrics-matrix-a.spec.ts'],
    'M08': ['e2e/charts/builder-shared.spec.ts'],
    'M09': ['e2e/charts/builder-number.spec.ts'],
    'M10': ['e2e/charts/builder-map.spec.ts'],
    'M11': ['e2e/charts/builder-pivot.spec.ts'],
    'M12': ['e2e/charts/edit.spec.ts'],
    'M13': ['e2e/charts/list.spec.ts'],
    'M14': ['e2e/dashboards/builder.spec.ts'],
    'M15': ['e2e/dashboards/tabs.spec.ts'],
    'M16': ['e2e/dashboards/builder-text.spec.ts'],
    'M17': ['e2e/dashboards/widget-placement.spec.ts'],
    'M18': ['e2e/dashboards/sequential-actions.spec.ts'],
    'M19': ['e2e/dashboards/gaps-builder.spec.ts'],
    'M20': ['e2e/dashboards/sequential-actions.spec.ts'],
    'M21': ['e2e/dashboards/filters.spec.ts'],
    'M22': ['e2e/dashboards/gaps-view.spec.ts'],
    'M23': ['e2e/dashboards/list.spec.ts'],
    'M24': ['e2e/reports/gaps-create-viewer.spec.ts'],
    'M25': ['e2e/reports/comments.spec.ts'],
    'M26': ['e2e/reports/comments.spec.ts'],
    'M27': ['e2e/reports/create.spec.ts'],
    'M28': ['e2e/reports/viewer.spec.ts'],
    'M29': ['e2e/reports/list.spec.ts'],
    'M30': ['e2e/cross/navigation.spec.ts'],
    'M31': ['e2e/charts/metrics-matrix-a.spec.ts'],
    'M32': ['e2e/charts/builder-shared.spec.ts'],
    'M33': ['e2e/dashboards/builder.spec.ts'],
    'M34': ['e2e/dashboards/builder-text.spec.ts'],
}
# Optional title filter for the targeted pass (to check WHICH test catches a mutation)
TARGETED_GREP = {'M08': 'sort', 'M11': 'grand total'}
AREA = {'charts': ['e2e/charts', 'e2e/cross'], 'dashboards': ['e2e/dashboards', 'e2e/cross'],
        'reports': ['e2e/reports', 'e2e/cross']}
TEST_TIMEOUT_S = 2 * 60 * 60
# Extra settle time after `next start` before tests log in (setup once failed right after a restart)
SERVER_GRACE_S = 5
RUN_LOG = open(os.path.join(S, 'mutation-runs.log'), 'a')


def log(msg):
    print(msg, flush=True)


def server_pids():
    out = subprocess.run(['lsof', '-tiTCP:%d' % PORT, '-sTCP:LISTEN'], capture_output=True, text=True).stdout
    return [int(p) for p in out.split()]


def restart_server():
    for pid in server_pids():
        os.kill(pid, signal.SIGTERM)
    for _ in range(30):
        if not server_pids():
            break
        time.sleep(1)
    subprocess.Popen(['npx', 'next', 'start', '-p', str(PORT)], cwd=WT,
                     stdout=open(os.path.join(S, 'mutation-server.log'), 'a'), stderr=subprocess.STDOUT,
                     start_new_session=True)
    ready = False
    for _ in range(60):
        try:
            with urllib.request.urlopen(f'{BASE}/login', timeout=5) as r:
                if r.status == 200:
                    ready = True
                    break
        except Exception:
            time.sleep(1)
    for path in ('/login', '/impact', '/charts', '/dashboards', '/reports'):
        try:
            urllib.request.urlopen(f'{BASE}{path}', timeout=30).read()
        except Exception:
            pass
    time.sleep(SERVER_GRACE_S)
    return ready


def build():
    p = subprocess.run(['npm', 'run', 'build'], cwd=WT, capture_output=True, text=True)
    return p.returncode == 0, (p.stdout + p.stderr)[-1500:]


def run_specs(specs, grep=None):
    # isolated = the org-wide list specs (dashboards/list*, run alone in normal runs)
    cmd = ['npx', 'playwright', 'test', '--project=chromium', '--project=isolated', '--max-failures=1',
           '--reporter=line', *specs]
    if grep:
        cmd += ['-g', grep]
    try:
        p = subprocess.run(cmd, cwd=WT, capture_output=True, text=True, timeout=TEST_TIMEOUT_S,
                           env=dict(os.environ, E2E_BASE_URL=BASE))
        out, code = re.sub(r'\x1b\[[0-9;?]*[A-Za-z]', '', p.stdout + p.stderr), p.returncode
    except subprocess.TimeoutExpired:
        return -1, None, 'TIMEOUT'
    RUN_LOG.write(f"\n===== {' '.join(specs)}\n{out[-20000:]}\n")
    RUN_LOG.flush()
    first = next((m.group(1) for l in out.splitlines() if (m := re.search(r'\d+\) (\[[a-z]+\] › [^\n]+)', l))), None)
    err = next((l.strip() for l in out.splitlines() if l.strip().startswith(('Error:', 'TimeoutError'))), None)
    return code, first, err


def run_one(m):
    path = os.path.join(WT, m['file'])
    src = open(path).read()
    if src.count(m['find']) != 1:
        return {'id': m['id'], 'status': 'invalid', 'reason': f"find occurs {src.count(m['find'])}x"}
    open(path, 'w').write(src.replace(m['find'], m['replace']))
    try:
        t0 = time.time()
        ok, tail = build()
        if not ok:
            return {'id': m['id'], 'status': 'invalid', 'reason': 'build failed', 'build_tail': tail}
        restart_server()
        res = {'id': m['id'], 'area': m['area'], 'description': m['description']}
        code, first, err = run_specs(TARGETED.get(m['id'], AREA[m['area']]), TARGETED_GREP.get(m['id']))
        if code != 0 and err and re.search(r'→ 5\d\d |522|Token expired', err):
            res.update(status='infra', pass_='targeted', caught_by=first, error=err)
        elif code != 0:
            res.update(status='caught', pass_='targeted', caught_by=first, error=err)
        elif os.environ.get('TARGETED_ONLY') == '1':
            res.update(status='missed', pass_='targeted-only', caught_by=None, error=None)
        else:
            code, first, err = run_specs(AREA[m['area']])
            res.update(status='caught' if code != 0 else 'missed', pass_='area', caught_by=first, error=err)
        res['minutes'] = round((time.time() - t0) / 60, 1)
        return res
    finally:
        open(path, 'w').write(src)  # ALWAYS revert


def main():
    ids = sys.argv[1:]
    done = {json.loads(l)['id'] for l in open(RESULTS)} if os.path.exists(RESULTS) else set()
    try:
        for mid in ids:
            if mid in done:
                continue
            m = MUTS[mid]
            log(f"→ {mid} [{m['area']}] {m['description']}")
            res = run_one(m)
            with open(RESULTS, 'a') as f:
                f.write(json.dumps(res) + '\n')
            log(f"   {res['status'].upper()} ({res.get('minutes')} min) {res.get('caught_by') or res.get('reason') or ''}")
    finally:
        log('restoring clean build…')
        ok, _ = build()
        restart_server()
        log(f'clean build {"ok" if ok else "FAILED"}; server restarted on :{PORT}')


if __name__ == '__main__':
    main()
