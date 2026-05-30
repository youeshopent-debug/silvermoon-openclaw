"""三省六部 Worker 停止器 — Windows 兼容版"""
import os
import subprocess
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")

WORKERS = ["dispatch_worker", "orchestrator_worker"]

def kill_windows(pid):
    """Windows 上使用 taskkill /F 强制杀进程"""
    try:
        subprocess.check_call(
            ["taskkill", "/F", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except subprocess.CalledProcessError:
        return False

for name in WORKERS:
    pid_file = os.path.join(SCRIPTS_DIR, f"{name}.pid")
    if not os.path.exists(pid_file):
        print(f"⚠  {name} 未运行 (无 pid 文件)")
        continue

    with open(pid_file) as f:
        pid = int(f.read().strip())

    if sys.platform == "win32":
        ok = kill_windows(pid)
    else:
        import signal
        try:
            os.kill(pid, signal.SIGTERM)
            ok = True
        except ProcessLookupError:
            print(f"⚠  {name} (PID {pid}) 不存在，清理 pid 文件")
            ok = True  # 进程已消失，视为清理成功
        except PermissionError:
            print(f"❌ 无权停止 {name} (PID {pid})")
            ok = False

    if ok:
        os.remove(pid_file)
        print(f"✅ {name} (PID {pid}) 已停止")
    else:
        print(f"❌ 停止 {name} (PID {pid}) 失败")

print("所有 Worker 已停止")
