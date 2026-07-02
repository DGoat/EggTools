@echo off
setlocal EnableExtensions

rem Build a data-table .py into the NeoX bindict .bin the eggy editor loads,
rem and deploy it to output\bindict_res + client\res\bindict.
rem Editor loads OGC tables as '<bindict/...>' modules built by bindict.build
rem (py2 C ext). The .py/.pyc under client\script\data are NOT read at runtime.
rem
rem Usage:
rem   drag a source .py (under ...\output\common\...) onto this bat
rem   or: build_bindict.bat "D:\EggyData\season\output\common\ogc\ogc3_auto_chess\xxx.py"

set "SCRIPT_DIR=%~dp0"
set "SRC=%~1"
if "%SRC%"=="" set "SRC=D:\EggyData\season\output\common\ogc\ogc3_auto_chess\auto_chess_projectile_data.py"

rem detect Python 2.7 (bindict.pyd is a py2 C extension)
set "PY2="
where py >nul 2>nul && (
    py -2 -c "import sys;sys.exit(0 if sys.version_info[0]==2 else 1)" >nul 2>nul && set "PY2=py -2"
)
if not defined PY2 if exist "C:\Python27\python.exe" set "PY2=C:\Python27\python.exe"
if not defined PY2 (
    echo [ERROR] Python 2.7 not found. bindict.pyd is a py2 C extension.
    pause & exit /b 1
)

echo [INFO] Python 2.7: %PY2%
echo [INFO] Source: %SRC%
%PY2% "%SCRIPT_DIR%build_bindict.py" "%SRC%"
set "RET=%errorlevel%"
if not "%RET%"=="0" ( echo [ERROR] build failed. & pause & exit /b %RET% )

echo [SUCCESS] bindict built and deployed. Restart editor to reload.
pause
exit /b 0
