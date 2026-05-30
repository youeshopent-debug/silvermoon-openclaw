"""三省六部 Worker 启动器 — 可靠的后台进程启动方案"""
import subprocess
import sys
import os
import time

PYTHON = sys.executable
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOG_DIR = os.path.join(BASE_DIR, "logs")
WORKER_DIR = os.path.join(BASE_DIR, "edict")
os.makedirs(LOG_DIR, exist_ok=True)

WORKERS = [
    {
        "name": "dispatch_worker",
        "module": "edict.backend.app.workers.dispatch_worker",
        "func": "run_dispatcher",
    },
    {
        "name": "orchestrator_worker",
        "module": "edict.backend.app.workers.orchestrator_worker",
        "func": "run_orchestrator",
    },
]

SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
PIDS = {}

for w in WORKERS:
    pid_file = os.path.join(SCRIPTS_DIR, f"{w['name']}.pid")
    out_log = os.path.join(LOG_DIR, f"{w['name']}_out.log")
    err_log = os.path.join(LOG_DIR, f"{w['name']}_err.log")

    # 如果已有 pid 文件且进程活着，跳过
    if os.path.exists(pid_file):
        with open(pid_file) as f:
            old_pid = int(f.read().strip())
        try:
            os.kill(old_pid, 0)
            print(f"⚠  {w['name']} 已在运行 (PID {old_pid})，跳过")
            PIDS[w['name']] = old_pid
            continue
        except OSError:
            pass

    # 清旧日志
    for lf in (out_log, err_log):
        if os.path.exists(lf):
            os.remove(lf)

    # 使用 CREATE_NEW_PROCESS_GROUP + DETACHED_PROCESS 创建独立进程
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = 0  # SW_HIDE

    proc = subprocess.Popen(
        [
            PYTHON, "-c",
            f"import sys; sys.path.insert(0, r'{WORKER_DIR}'); "
            f"from {w['module']} import {w['func']}; "
            f"import asyncio; asyncio.run({w['func']}())"
        ],
        stdout=open(out_log, "w"),
        stderr=open(err_log, "w"),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        startupinfo=startupinfo,
    )

    with open(pid_file, "w") as f:
        f.write(str(proc.pid))

    print(f"✅ {w['name']} 已启动 (PID {proc.pid})")
    PIDS[w['name']] = proc.pid

# 等一会检查进程是否存活
time.sleep(3)
for w in WORKERS:
    pid = PIDS.get(w['name'])
    if pid is None:
        continue
    try:
        os.kill(pid, 0)
        pid_file = os.path.join(SCRIPTS_DIR, f"{w['name']}.pid")
        print(f"✅ {w['name']} 运行正常 (PID {pid})")
    except OSError:
        pid_file = os.path.join(SCRIPTS_DIR, f"{w['name']}.pid")
        err_log = os.path.join(LOG_DIR, f"{w['name']}_err.log")
        print(f"❌ {w['name']} 已崩溃！检查日志: {err_log}")
        if os.path.exists(err_log):
            with open(err_log) as f:
                print(f"   错误日志: {f.read().strip()[-200:]}")
        if os.path.exists(pid_file):
            os.remove(pid_file)
