---
name: eggy-ogc-data-reload
description: 修改蛋仔派对编辑器（OGC/自走棋）数据表并让编辑器生效。这类 OGC bindict 数据表运行时【只读】client\res\bindict\...\xxx.bin，散文件 .py/.pyc 运行时不读。改动生效流程：改 py → 用 bindict.build 生成 .bin 部署到 client\res\bindict → 编辑器按 F5（已装 reload_tool 钩子，F5 会重读 .bin 并清 OGC 数据表模块缓存）→ 试玩。首次需装一次钩子（放两个文件进 reload_tool 后整进程重启一次）。当用户提到"数据表改了不生效"、"编辑器读不到修改"、"投射物/单位/技能数据不更新"、"py转bin/bindict"、"OGC/自走棋数据编译"、"F5刷数据表"时使用。
---

# Eggy OGC 数据表修改与生效

改 OGC/自走棋数据表（投射物、单位、技能等），让编辑器生效。**已实现 F5 热更**（无需重开地图）。

## 核心机制（务必理解，已多次实测确认）

同一张数据表 `data.common.ogc.ogc3_auto_chess.auto_chess_projectile_data` 有三份物理文件：

| 文件 | 路径 | 运行时是否被读 |
|------|------|---------|
| bindict `.bin` | `client\res\bindict\common\ogc\...\xxx.bin` | **是。运行时唯一真源**（引擎 `<bindict/...>` 模块） |
| 散文件 `.py` | `client\script\data\common\ogc\...\xxx.py` | **否**（给人看的源，运行时不读） |
| 散文件 `.pyc` | 同上目录 | **否**（NeoX py27 `04` magic 构建产物，运行时不读） |
| D 源 `.py` | `D:\EggyData\season\output\common\ogc\...\xxx.py` | 构建 `.bin` 的输入源 |

### 实测证据

- 运行时取值**恒等于 `.bin`**（pyc 在不在、py 是否更新都无关）。
- 删掉 `.bin` → **直接崩**（无源码回退）。
- `stop_game→run_game` 不会重读 `.bin`；只有**重开地图**或 **F5（装了下面的钩子后）**才会。

> 编辑器运行时是 NeoX 定制 py2.7（`.pyc` magic `04f30d0a`，非标准 `03`）。标准 Python 编的 `.pyc` 它不认。

---

## 推荐流程：构建 .bin + F5（已装钩子）

1. 改 py（D 源 `D:\EggyData\season\output\common\ogc\...\xxx.py` **或**散文件 `client\script\data\common\ogc\...\xxx.py`）
2. 构建并部署 `.bin`（GUI `scripts\bindict_gui.hta` / 拖拽 `scripts\build_bindict.bat` / 命令行）：

   ```bat
   py -2 "scripts\build_bindict.py" "D:\EggyData\season\output\common\ogc\ogc3_auto_chess\auto_chess_projectile_data.py"
   ```

   自动写入 `output\bindict_res\...` 与 `client\res\bindict\...`。
3. **先试玩一次**（让 OGC 加载该数据表模块）→ 停 → **编辑态按 F5**（钩子原地刷新已加载的 `.bin` 模块 `.data`）→ **再试玩**验证。

> 关键：F5 只能刷新**已在 `sys.modules` 里**的数据表（本次开图后试玩加载过的）。没试玩过的表 F5 碰不到——首次请直接**重开地图**。
> 兜底：任何情况下**重开地图**（退回项目列表→重开）都会从 `.bin` 重新加载，最稳。

---

## F5 热更钩子（安装一次）

F5 = `reload_tool.toolset.reload_script`，原本只热重载**代码**（函数/类）+ UI 数据 + ai_trees，**够不到 bindict 数据表**（它们是 `<bindict/...>` 模块，`isfile=False`，被 `get_local_modules` 过滤掉；且 OGC 数据走 OgcMgr 独立管线）。钩子补上这块。

**安装**：把 `scripts\hook\` 两个文件放进编辑器 `client\script\reload_tool\`：

| 文件 | 作用 |
|------|------|
| `bindict_hot.py` | 遍历 `sys.modules` 里所有 bindict 模块 → 从 `__file__`（`<bindict/...>`）反推 `res\bindict\...\xxx.bin` → 重读 → **原地** `module.data = bindict.bindict(raw)`（**保留模块对象身份**，不删 `sys.modules`） |
| `__init__.py` | 包装 `toolset.reload_script`，原逻辑后追加 `bindict_hot.reload_bindict_data()`，全 `try/except` |

**装完必须整进程重启一次**（`reload_tool` 是重载器自身的包，**F5 不会重载它**，所以对这两个文件的任何修改都只能靠重启生效；数据表改动则只需 F5）。

**验证**（客户端日志 `client\log_inst*.txt`）：

```
[bindict-hot] F5 hook installed on reload_tool.toolset.reload_script
[bindict-hot] refreshed data.common.ogc...auto_chess_projectile_data <- ...\xxx.bin
[bindict-hot] purged OGC module data.common.ogc...auto_chess_projectile_data
[bindict-hot] F5: bindict modules seen=1324 refreshed=1324 ogc_purged=153
```

**踩过的坑**：
- 遍历 `sys.modules` 时 `getattr(mod,'__file__')` 会触发某些**惰性模块代理**去 `import sndhdr`（NeoX 裁剪了该 stdlib）而抛异常，中断整个循环。→ 用 `mod.__dict__.get('__file__')` 绕过，且**每个模块单独 try/except**。
- **只能原地更新 `module.data`，不能 `del sys.modules[name]`**：OGC 的 `custom.pub.ogc...data_config` 在 import 时把数据表**模块对象**存成自己的属性（`data_config.auto_chess_projectile_data`），消费方读 `.data[id]`。原地 `module.data = fresh` 保留对象身份 → 该属性指向的对象 `.data` 被就地刷新 → 消费方立即见新值。若 `del sys.modules`，模块缺席、身份丢失，`data_config` 仍抱旧对象 → 值卡住不变（曾因此踩坑）。
- **前提**：F5 时该数据表模块必须已在 `sys.modules`（即本次开图后**至少试玩过一次**、加载过它）。所以流程是：先试玩一次加载 → 停 → 改 `.bin` → F5（原地刷新活模块）→ 再试玩。

**回退**：删这两个文件（`svn revert reload_tool`），重启即恢复。

### 构建要点

- **必须 64 位 Python 2.7**（`bindict.pyd` 是 py2 C 扩展，用 `bindict_64`）。
- `.bin` 是 NeoX 自定义二进制（头 `4c 03 00 00`），不是 pyc/marshal。
- 自检：`py -2 scripts\build_bindict.py "源.py" --verify "现有.bin"`（同大小同头即方法正确）。

---

## 文件

```
scripts/
  build_bindict.py     构建 .bin + 自动部署（py2）
  build_bindict.bat    命令行 / 拖拽
  bindict_gui.hta      GUI
  hook/
    bindict_hot.py     F5 数据表热更钩子（放进 client\script\reload_tool\）
    __init__.py        包装 reload_script（放进 client\script\reload_tool\）
```

## build_bindict.py 参数

| 参数 | 说明 |
|------|------|
| `source` | 源 `.py` 或目录。支持两种路径：① D 源 `...\output\common\|client\|editor\...`；② 散文件 `<root>\script\data\common\|client\|editor\...`（编辑器里看到的那个）。两者都能自动派生 `.bin` 输出到 `<root>\res\bindict\...` |
| `--force` | 强制全量重编。**默认增量**：目录/文件里，`.bin` 已存在且比 `.py` 新的会 `SKIP-UPTODATE` 跳过，只编改过的 |
| `--export-dir DIR` | `bindict(_64).pyd` + `export\taggeddict.py` 目录，默认 `D:\EggyData\season\export\export_data` |
| `--client-root DIR` | client 根，散文件模式用不到（从散文件路径自身推 root）；D 源模式部署到 `<root>\res\bindict\...`，默认 `G:\resource\season\client` |
| `--out FILE` | 显式输出 `.bin`（可重复），覆盖自动派生 |
| `--verify REF` | 只构建并与 REF 逐字节比对，不写入 |

> **增量**：按「`.bin` 的 mtime ≥ `.py` 的 mtime」判定是否最新。选整个目录编译时，只会重编你改动过的表，其余跳过，很快。想强制全部重编加 `--force`。

## 输出汇总（SUMMARY）

每次运行末尾打印分类汇总，一眼看清本次改动：

| 分类 | 含义 |
|------|------|
| `[BUILT & DEPLOYED]` | **本次实际构建部署的表 —— 这些改动会生效**，回编辑器重开地图即见效 |
| `[UP-TO-DATE, skipped]` | `.bin` 比 `.py` 新，增量跳过 |
| `[CODE-DEP, cannot build here]` | 表数据 `import` 了游戏代码常量（如 `custom.pub.ccom`），standalone 环境序列化不了，**需走官方导出**；已知有 `auto_chess_ai_rule_data` 等极少数 AI 表。**这类不计入失败**（exit 0 不变） |
| `[FAILED]` | 真正的数据/语法错，需你检查（exit 1） |

> 只有 `[FAILED]` 会让退出码非 0；`[CODE-DEP]` 是预期内的、无害。

## editor-cli 说明

`editor-cli.exe` 若被杀软拦（Error 225 file contains a virus，误报），加进程排除即可（管理员 PowerShell）：

```powershell
Add-MpPreference -ExclusionProcess 'editor-cli.exe'
```

该 CLI 只能跑 **Lua**（`exec`/`eval`），全量 `EditorAPI` 里**没有** reload/hotfix/python 接口，**无法用它触发 F5**。F5 需在编辑器里手动按（数据热更走上面的钩子）。
