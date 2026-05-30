#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ACCOUNT="alanlsl8208@gmail.com"
REGION="asia-southeast1"
ZONE="asia-southeast1-b"
INSTANCE_NAME="${INSTANCE_NAME:-silvermoon-control}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-medium}"
DISK_SIZE_GB="${DISK_SIZE_GB:-30}"
ADDRESS_NAME="${ADDRESS_NAME:-silvermoon-ip}"

ACTIVE_ACCOUNT="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' | head -n 1 || true)"
if [ "${ACTIVE_ACCOUNT}" != "${EXPECTED_ACCOUNT}" ]; then
  echo "错误：当前 gcloud 账号不是主账号"
  echo "期望：${EXPECTED_ACCOUNT}"
  echo "当前：${ACTIVE_ACCOUNT:-空}"
  exit 1
fi

if [ -z "${PROJECT_ID:-}" ]; then
  echo "错误：必须显式设置 PROJECT_ID（避免误建僵尸项目）"
  echo "用法：PROJECT_ID=你的项目号 bash scripts/gcp_bootstrap_cloudshell.sh"
  exit 1
fi

gcloud config set account "${EXPECTED_ACCOUNT}" >/dev/null
gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable compute.googleapis.com >/dev/null

if ! gcloud compute addresses describe "${ADDRESS_NAME}" --region="${REGION}" >/dev/null 2>&1; then
  gcloud compute addresses create "${ADDRESS_NAME}" --region="${REGION}" >/dev/null
fi

STATIC_IP="$(gcloud compute addresses describe "${ADDRESS_NAME}" --region="${REGION}" --format='value(address)')"
if [ -z "${STATIC_IP}" ]; then
  echo "错误：无法获取静态 IP"
  exit 1
fi

if ! gcloud compute firewall-rules describe silvermoon-allow-http-https >/dev/null 2>&1; then
  gcloud compute firewall-rules create silvermoon-allow-http-https \
    --network=default \
    --allow=tcp:80,tcp:443 \
    --target-tags=silvermoon-web \
    --direction=INGRESS >/dev/null
fi

if ! gcloud compute firewall-rules describe silvermoon-allow-iap-ssh >/dev/null 2>&1; then
  gcloud compute firewall-rules create silvermoon-allow-iap-ssh \
    --network=default \
    --allow=tcp:22 \
    --source-ranges=35.235.240.0/20 \
    --target-tags=silvermoon-web \
    --direction=INGRESS >/dev/null
fi

if ! gcloud compute instances describe "${INSTANCE_NAME}" --zone="${ZONE}" >/dev/null 2>&1; then
  gcloud compute instances create "${INSTANCE_NAME}" \
    --zone="${ZONE}" \
    --machine-type="${MACHINE_TYPE}" \
    --image-family="ubuntu-2204-lts" \
    --image-project="ubuntu-os-cloud" \
    --boot-disk-size="${DISK_SIZE_GB}GB" \
    --address="${STATIC_IP}" \
    --tags="silvermoon-web" >/dev/null
fi

echo "完成"
echo "PROJECT_ID=${PROJECT_ID}"
echo "REGION=${REGION}"
echo "ZONE=${ZONE}"
echo "INSTANCE=${INSTANCE_NAME}"
echo "STATIC_IP=${STATIC_IP}"
