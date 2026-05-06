#!/bin/bash
source ~/.nvm/nvm.sh
curl -s -X POST http://127.0.0.1:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer e916efc00d85cb6689fc6f6568f212c71336f9427d5d508e" \
  -d '{"model":"openrouter/auto","messages":[{"role":"user","content":"say hello in 3 words"}]}'
