# -*- coding: utf-8 -*-
# Build the NeoX "bindict" .bin from a data-table .py, matching the project's
# export pipeline (export_data\export\bindictutils.py -> bindict.build), and
# deploy it to the location the editor actually loads (<bindict/...> == client\res\bindict).
#
# WHY: the eggy editor loads OGC data tables as bindict modules
#   '<bindict/common/ogc/.../auto_chess_projectile_data.bin>'
# built by bindict.build() (C ext bindict_64.pyd) from the .py source under
#   D:\EggyData\season\output\common\...
# The .py / .pyc under client\script\data\common are NOT read at runtime.
#
# MUST run with the SAME Python 2.7 arch as the editor / build tool
# (64-bit -> bindict_64.pyd).
#
# Usage:
#   py -2 build_bindict.py <source.py> [options]
# Options:
#   --export-dir DIR   export_data dir holding bindict(_64).pyd + export\taggeddict.py
#                      (default D:\EggyData\season\export\export_data)
#   --client-root DIR  client dir; deploys to <client-root>\res\bindict\...
#                      (default G:\resource\season\client)
#   --out FILE         explicit output .bin (repeatable). Overrides auto-deploy.
#   --verify REF       build only, compare bytes to REF, print result. No write.

import sys, os, imp, struct, argparse

DEFAULT_EXPORT_DIR = r'D:\EggyData\season\export\export_data'
DEFAULT_CLIENT_ROOT = r'G:\resource\season\client'


def load_bindict(export_dir):
    sys.path.insert(0, os.path.join(export_dir, 'export'))  # taggeddict.py
    sys.path.insert(0, export_dir)                          # bindict(_64).pyd
    mock = os.path.join(export_dir, 'mock_libs')            # stub pkgs for data .py imports (custom.pub.ccom ...)
    if os.path.isdir(mock):
        sys.path.insert(0, mock)
    if struct.calcsize('P') * 8 == 64:
        import bindict_64 as bindict
    else:
        import bindict as bindict
    import taggeddict
    return bindict, taggeddict.taggeddict


def build_bin(src_py, bindict, TD):
    def to_td(obj):
        if isinstance(obj, dict):
            return TD((k, to_td(v)) for k, v in obj.iteritems())
        elif isinstance(obj, (list, tuple)):
            return tuple(to_td(v) for v in obj)
        return obj
    mod = imp.load_source('_bindict_src', src_py)
    data = mod.data
    if data.__class__.__name__ not in ('dict', 'taggeddict'):
        raise Exception('data class is not dict/taggeddict: %s' % data.__class__.__name__)
    return bindict.build(to_td(data), 256)


def derive_targets(src_py, client_root):
    # Accepts EITHER:
    #  (a) D source under ...\output\common\ogc\...\X.py
    #        -> ...\output\bindict_res\common\ogc\...\X.bin  AND  <client_root>\res\bindict\common\ogc\...\X.bin
    #  (b) loose file under <root>\script\data\common\ogc\...\X.py  (the one seen in the editor)
    #        -> <root>\res\bindict\common\ogc\...\X.bin   (deploy straight to what the editor loads)
    norm = os.path.normpath(src_py)
    low = norm.lower()
    targets = []
    rel = None

    # (b) loose file: <root>\script\data\<common|client|editor>\...\X.py
    for seg in ('\\script\\data\\',):
        idx = low.find(seg)
        if idx >= 0:
            head = norm[:idx]  # <root> (e.g. G:\resource\season\client)
            tail = norm[idx + len(seg):]  # e.g. common\ogc\...\X.py
            rel = os.path.splitext(tail)[0] + '.bin'
            targets.append(os.path.join(head, 'res', 'bindict', rel))
            return targets

    # (a) D source under ...\output\...
    for seg in ('\\output\\common\\', '\\output\\client\\', '\\output\\editor\\'):
        idx = low.find(seg)
        if idx >= 0:
            head = norm[:idx]
            tail = norm[idx + len('\\output\\'):]  # e.g. common\ogc\...\X.py
            res_bin = os.path.join(head, 'output', 'bindict_res', tail)
            res_bin = os.path.splitext(res_bin)[0] + '.bin'
            targets.append(res_bin)
            rel = os.path.splitext(tail)[0] + '.bin'  # common\ogc\...\X.bin
            break
    if rel and client_root:
        targets.append(os.path.join(client_root, 'res', 'bindict', rel))
    return targets


def write_bin(dst, data):
    d = os.path.dirname(dst)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with open(dst, 'wb') as f:
        f.write(data)
    print('[WRITE] %d bytes -> %s' % (len(data), dst))


def iter_py_files(source):
    if os.path.isfile(source):
        yield source
        return
    for root, dirs, files in os.walk(source):
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')
        for name in files:
            if name.endswith('.py') and name != '__init__.py':
                yield os.path.join(root, name)


def _targets_up_to_date(src, targets):
    # incremental: skip only if every target exists AND is newer than the source .py
    if not targets:
        return False
    try:
        src_m = os.path.getmtime(src)
    except OSError:
        return False
    for dst in targets:
        if not os.path.isfile(dst) or os.path.getmtime(dst) < src_m:
            return False
    return True


def process_one(src, bindict, TD, client_root, out, force=False):
    targets = out if out else derive_targets(src, client_root)
    if not targets:
        return 0, 'notarget', targets
    if not force and _targets_up_to_date(src, targets):
        return 0, 'uptodate', targets
    bin_str = build_bin(src, bindict, TD)
    print('[BUILD] %s  (%d bytes)' % (src, len(bin_str)))
    for dst in targets:
        write_bin(dst, bin_str)
    return len(targets), 'built', targets


# build errors that mean "this table depends on game code / real env" (not a user data error)
_CODEDEP_SIGNS = ('No module named', 'build node tree', 'cannot import name')


def _classify_error(msg):
    for s in _CODEDEP_SIGNS:
        if s in msg:
            return 'codedep'
    return 'fail'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', help='source .py file OR a folder (recurse .py)')
    ap.add_argument('--export-dir', default=DEFAULT_EXPORT_DIR)
    ap.add_argument('--client-root', default=DEFAULT_CLIENT_ROOT)
    ap.add_argument('--out', action='append', default=[])
    ap.add_argument('--verify', default=None)
    ap.add_argument('--force', action='store_true',
                    help='rebuild all (default: incremental, skip .bin newer than .py)')
    args = ap.parse_args()

    if sys.version_info[0] != 2:
        sys.stderr.write('[ERROR] MUST run with Python 2.7 (bindict.pyd is a py2 C ext).\n')
        return 2

    bindict, TD = load_bindict(args.export_dir)

    if args.verify:
        bin_str = build_bin(args.source, bindict, TD)
        print('[BUILD] %d bytes  head=%s' % (
            len(bin_str), ' '.join('%02x' % ord(c) for c in bin_str[:16])))
        with open(args.verify, 'rb') as f:
            ref = f.read()
        print('[VERIFY] ref=%d bytes  identical=%s' % (len(ref), ref == bin_str))
        return 0

    files = list(iter_py_files(args.source))
    if not files:
        sys.stderr.write('[ERROR] no .py found under: %s\n' % args.source)
        return 3
    if len(files) > 1 and args.out:
        sys.stderr.write('[ERROR] --out cannot be used with a folder (multiple sources).\n')
        return 3

    built = []       # (src, [dst...])
    uptodate = []    # src
    codedep = []     # (src, msg)
    failed = []      # (src, msg)
    notarget = []    # src
    for src in files:
        try:
            deployed, status, targets = process_one(
                src, bindict, TD, args.client_root, args.out, args.force)
            if status == 'built':
                built.append((src, targets))
            elif status == 'uptodate':
                uptodate.append(src)
            else:
                notarget.append(src)
        except Exception as exc:
            msg = str(exc)
            (codedep if _classify_error(msg) == 'codedep' else failed).append((src, msg))

    def base(p):
        return os.path.basename(p)

    print('')
    print('==================== SUMMARY ====================')
    print('[BUILT & DEPLOYED] %d  <-- these changes take effect' % len(built))
    for src, targets in built:
        print('   * %s' % base(src))
        for dst in targets:
            print('       -> %s' % dst)
    print('[UP-TO-DATE, skipped] %d  (.bin newer than .py)' % len(uptodate))
    if codedep:
        print('[CODE-DEP, cannot build here] %d  (need official export)' % len(codedep))
        for src, _ in codedep:
            print('   * %s' % base(src))
    if notarget:
        print('[NO-TARGET, skipped] %d  (path not under output/script\\data)' % len(notarget))
        for src in notarget:
            print('   * %s' % base(src))
    if failed:
        print('[FAILED, check your data/syntax] %d' % len(failed))
        for src, msg in failed:
            print('   * %s : %s' % (base(src), msg))
    print('-------------------------------------------------')
    print('total %d : built %d / up-to-date %d / code-dep %d / no-target %d / FAILED %d' % (
        len(files), len(built), len(uptodate), len(codedep), len(notarget), len(failed)))
    if built:
        print('>>> Reopen the map in editor to apply.')
    print('=================================================')
    # only genuine data/syntax failures make exit non-zero; code-dep is expected/benign
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
