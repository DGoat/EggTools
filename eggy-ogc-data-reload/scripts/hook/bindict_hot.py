# -*- coding: utf-8 -*-
# F5 hook: refresh bindict data tables (OGC etc.) by re-reading their .bin
# and rebuilding module.data. Additive; wrapped in try/except so it can never
# break the normal F5 code reload.
#
# Runtime bindict modules have __file__ like '<bindict/common/ogc/.../x.bin>'.
# We parse that, map to client\res\bindict\...\x.bin, re-read bytes, and do
#   module.data = bindict.bindict(new_bytes)
# So NEW reads of module.data[...] pick up the rebuilt values without reopening
# the map. (Effectiveness depends on consumers reading module.data lazily.)

import os
import sys

# where the editor loads .bin from
_RES_ROOTS = [
    r'G:\resource\season\client\res\bindict',
]

_last_mtime = {}  # module __name__ -> .bin mtime already applied


def _looks_bindict(f):
    if not f:
        return False
    low = f.lower()
    return ('bindict' in low) and ('.bin' in low)


def _bin_path_from_file(f):
    s = f.strip()
    if s.startswith('<'):
        s = s[1:]
    if s.endswith('>'):
        s = s[:-1]
    s = s.replace('/', os.sep).replace('\\', os.sep)
    low = s.lower()
    key = 'bindict' + os.sep
    i = low.find(key)
    if i < 0:
        return None
    rel = s[i + len(key):]  # e.g. common\ogc\...\x.bin
    if not rel.lower().endswith('.bin'):
        rel = os.path.splitext(rel)[0] + '.bin'
    for root in _RES_ROOTS:
        p = os.path.join(root, rel)
        if os.path.isfile(p):
            return p
    return None


def reload_bindict_data(only_modified=True):
    """Re-read changed .bin files and replace module.data. Returns count refreshed."""
    try:
        import bindict
    except Exception as e:
        print '[bindict-hot] no bindict module: %s' % e
        return 0

    n = 0
    seen = 0
    ogc_purged = 0
    # snapshot names first; accessing some lazy module proxies (e.g. via getattr)
    # can trigger imports of stripped stdlib (sndhdr) and raise -- guard each one.
    for name in list(sys.modules.keys()):
        try:
            mod = sys.modules.get(name)
            if mod is None:
                continue
            # use __dict__ to avoid triggering lazy-import __getattr__ proxies
            d = getattr(mod, '__dict__', None)
            f = d.get('__file__') if isinstance(d, dict) else None
            if not _looks_bindict(f):
                continue
            seen += 1
            binp = _bin_path_from_file(f)
            if not binp:
                continue

            # OGC tables are consumed by custom.*.ogc code that OgcMgr re-imports
            # on F5. That re-import reuses the CACHED data module (old bytes), so
            # just replacing .data isn't enough -- purge it from sys.modules so
            # the next import re-reads the .bin fresh.
            is_ogc = ('.ogc.' in name) or (os.sep + 'ogc' + os.sep in f.lower())

            try:
                mt = os.path.getmtime(binp)
            except OSError:
                continue

            fh = open(binp, 'rb')
            raw = fh.read()
            fh.close()
            new_data = bindict.bindict(raw)
            mod.data = new_data          # help any lazy in-place reader
            _last_mtime[name] = mt
            n += 1
            print '[bindict-hot] refreshed %s <- %s' % (name, binp)
            if is_ogc:
                del sys.modules[name]    # force clean re-import by OGC code
                _last_mtime.pop(name, None)
                ogc_purged += 1
                print '[bindict-hot] purged OGC module %s (will re-import fresh)' % name
        except Exception as e:
            print '[bindict-hot] FAIL %s : %s' % (name, e)
    print '[bindict-hot] F5: bindict modules seen=%d refreshed=%d ogc_purged=%d' % (
        seen, n, ogc_purged)
    return n
