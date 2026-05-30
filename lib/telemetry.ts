/**
 * OpenTelemetry 观测性接入
 *
 * 为银月钱庄网关提供分布式链路追踪能力。
 * 初始化失败不阻塞主进程启动 — 完全可选。
 *
 * 环境变量:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — OTLP HTTP exporter 地址 (默认 http://localhost:4318/v1/traces)
 *   OTEL_SERVICE_NAME            — 服务名 (默认 silvermoon-gateway)
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

const serviceName = process.env.OTEL_SERVICE_NAME || "silvermoon-gateway";
const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
  }),
  spanProcessors: [
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: otlpEndpoint,
      })
    ),
  ],
});

let initialized = false;

/**
 * 初始化 OpenTelemetry SDK
 * 幂等调用，多次调用只生效一次
 */
export function initTelemetry(): void {
  if (initialized) {
    return;
  }
  try {
    sdk.start();
    initialized = true;
    console.log(`[telemetry] OpenTelemetry 已初始化 — 服务名="${serviceName}", endpoint="${otlpEndpoint}"`);
  } catch (err) {
    console.warn("[telemetry] OpenTelemetry 初始化失败（可选模块，不阻塞启动）:", err);
  }
}

/**
 * 关闭 OpenTelemetry SDK
 * 确保所有 span 在进程退出前刷出
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!initialized) {
    return;
  }
  try {
    await sdk.shutdown();
    console.log("[telemetry] OpenTelemetry 已关闭");
  } catch (err) {
    console.warn("[telemetry] OpenTelemetry 关闭异常:", err);
  }
}
