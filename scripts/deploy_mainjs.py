import argparse
import hashlib
import os
import subprocess
import sys
import time


def _sha256_file(p: str) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _run(cmd: list[str]) -> None:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    sys.stdout.write(p.stdout)
    if p.returncode != 0:
        raise SystemExit(p.returncode)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="34.87.153.189")
    ap.add_argument("--user", default="alanlsl8208")
    ap.add_argument("--port", type=int, default=22)
    ap.add_argument("--identity", default="")
    ap.add_argument("--remote-dir", default="/home/alanlsl8208/silvermoon")
    ap.add_argument("--service", default="silvermoon-control")
    ap.add_argument("--local-main", default="")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    local_main = args.local_main.strip() or os.path.join(root, "main.js")
    if not os.path.exists(local_main):
        sys.stderr.write("找不到本机 main.js：%s\n" % local_main)
        return 2

    digest = _sha256_file(local_main)
    ts = time.strftime("%Y%m%d_%H%M%S")

    remote = f"{args.user}@{args.host}"
    remote_new = f"{args.remote_dir.rstrip('/')}/main.js.new"

    scp = ["scp", "-P", str(args.port)]
    ssh = ["ssh", "-p", str(args.port)]
    if args.identity.strip():
        scp += ["-i", args.identity.strip()]
        ssh += ["-i", args.identity.strip()]

    scp_cmd = scp + [local_main, f"{remote}:{remote_new}"]
    remote_cmd = (
        "set -euo pipefail; "
        f"cd {args.remote_dir}; "
        "test -f main.js.new; "
        f"cp -f main.js main.js.bak.{ts}; "
        "mv -f main.js.new main.js; "
        f"sudo systemctl restart {args.service}; "
        f"sudo systemctl --no-pager --full status {args.service} || true; "
        f"sudo journalctl -u {args.service} -n 50 --no-pager || true"
    )
    ssh_cmd = ssh + [remote, remote_cmd]

    sys.stdout.write("本机文件：%s\n" % local_main)
    sys.stdout.write("SHA256：%s\n" % digest)
    sys.stdout.write("目标主机：%s\n" % remote)
    sys.stdout.write("远端路径：%s\n" % remote_new)
    sys.stdout.write("服务名：%s\n" % args.service)
    sys.stdout.write("\n")

    if args.dry_run:
        sys.stdout.write("DRY-RUN\n")
        sys.stdout.write("SCP：%s\n" % " ".join(scp_cmd))
        sys.stdout.write("SSH：%s\n" % " ".join(ssh_cmd))
        return 0

    _run(scp_cmd)
    _run(ssh_cmd)
    sys.stdout.write("\n部署完成\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

