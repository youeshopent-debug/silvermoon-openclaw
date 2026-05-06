#!/bin/bash
cd /home/alan/openclaw-zero-token
source ~/.nvm/nvm.sh
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
PORT=3001

start() {
 if lsof -i :$PORT 2>/dev/null | grep -q LISTEN; then
   echo "Zero Token already running"
   return 0
 fi
 echo "Starting Zero Token..."
 nohup node openclaw.mjs gateway --port $PORT > /dev/null 2>&1 &
 echo "PID=$!"
 sleep 3
 if lsof -i :$PORT 2>/dev/null | grep -q LISTEN; then
   echo "Started OK"
 else
   echo "Start failed"
 fi
}

stop() {
 echo "Stopping..."
 lsof -ti :$PORT | xargs kill -9 2>/dev/null
 echo "Stopped"
}

status() {
 if lsof -i :$PORT 2>/dev/null | grep -q LISTEN; then
   echo "Zero Token running (port $PORT)"
 else
   echo "Zero Token not running"
 fi
}

case "${1:-status}" in
 start) start ;;
 stop) stop ;;
 restart) stop; sleep 2; start ;;
 status) status ;;
 *) echo "Usage: $0 [start|stop|restart|status]" ;;
esac
