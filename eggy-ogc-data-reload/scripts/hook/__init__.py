# -*- coding: utf-8 -*-
# reload_tool package init.
# Original __init__ was empty. We add an F5 hook so that reload_script also
# refreshes bindict data tables (OGC etc.). Fully guarded: any failure here
# leaves the original F5 code-reload behavior untouched.

try:
    from reload_tool import toolset as _toolset
    from reload_tool import bindict_hot as _bindict_hot

    if not getattr(_toolset, '_bindict_hook_installed', False):
        _orig_reload_script = _toolset.reload_script

        def _reload_script_with_bindict(only_modified=True):
            result = _orig_reload_script(only_modified)
            try:
                _bindict_hot.reload_bindict_data(only_modified)
            except Exception as _e:
                try:
                    print '[bindict-hot] hook error: %s' % _e
                except Exception:
                    pass
            return result

        _toolset.reload_script = _reload_script_with_bindict
        _toolset._bindict_hook_installed = True
        try:
            print '[bindict-hot] F5 hook installed on reload_tool.toolset.reload_script'
        except Exception:
            pass
except Exception as _e:
    try:
        print '[bindict-hot] install failed: %s' % _e
    except Exception:
        pass
