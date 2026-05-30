#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ACCOUNT="alanlsl8208@gmail.com"

ACTIVE_ACCOUNT="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' | head -n 1 || true)"
if [ "${ACTIVE_ACCOUNT}" != "${EXPECTED_ACCOUNT}" ]; then
  echo "错误：当前 gcloud 账号不是主账号"
  echo "期望：${EXPECTED_ACCOUNT}"
  echo "当前：${ACTIVE_ACCOUNT:-空}"
  exit 1
fi

if [ -z "${PROJECT_ID:-}" ]; then
  echo "错误：必须显式设置 PROJECT_ID"
  echo "用法：PROJECT_ID=你的项目号 bash scripts/gcp_secrets_cloudshell.sh"
  exit 1
fi

gcloud config set account "${EXPECTED_ACCOUNT}" >/dev/null
gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable secretmanager.googleapis.com >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

ensure_secret() {
  local name="$1"
  if ! gcloud secrets describe "${name}" >/dev/null 2>&1; then
    gcloud secrets create "${name}" --replication-policy=automatic >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "${name}" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
}

put_secret() {
  local name="$1"
  local prompt="$2"
  local v
  printf "%s" "${prompt}"
  IFS= read -r -s v
  echo
  if [ -z "${v}" ]; then
    echo "跳过：${name}"
    return 0
  fi
  printf "%s" "${v}" | gcloud secrets versions add "${name}" --data-file=- >/dev/null
  echo "已写入：${name}"
}

ensure_secret "silvermoon-discord-token"
ensure_secret "silvermoon-stripe-webhook-secret"
ensure_secret "silvermoon-groq-api-key"
ensure_secret "silvermoon-gemini-api-key"
ensure_secret "silvermoon-cashclaw-relay-secret"

put_secret "silvermoon-discord-token" "请输入 DISCORD_TOKEN（不回显，留空跳过）："
put_secret "silvermoon-stripe-webhook-secret" "请输入 STRIPE_WEBHOOK_SECRET（不回显，留空跳过）："
put_secret "silvermoon-groq-api-key" "请输入 GROQ_API_KEY（不回显，留空跳过）："
put_secret "silvermoon-gemini-api-key" "请输入 GEMINI_API_KEY（不回显，留空跳过）："
put_secret "silvermoon-cashclaw-relay-secret" "请输入 CASHCLAW_RELAY_SECRET（不回显，留空跳过）："

echo "完成"
echo "PROJECT_ID=${PROJECT_ID}"
echo "SERVICE_ACCOUNT=${SA}"
