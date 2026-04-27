"use client";

import React, { useMemo } from "react";
import { sanitize, SanitizeOptions } from "../lib/sanitizer";

interface MuleResponseProps {
  text: string;
  agent?: string;
  options?: SanitizeOptions;
  className?: string;
}

/**
 * MuleResponse - 高性能 Next.js 组件
 * 负责渲染经过 Sanitizer 处理的 LLM 回复，并执行 RWA 合规审计展示。
 */
export const MuleResponse: React.FC<MuleResponseProps> = ({
  text,
  agent = "银月",
  options = {},
  className = "",
}) => {
  // 1. 执行 Sanitizer 逻辑 (Plan A)
  const sanitizedText = useMemo(() => {
    try {
      return sanitize(text, options);
    } catch (e) {
      // Plan B: 基础清理降级
      console.error("Sanitizer failed:", e);
      return text.trim() || "银月内阁暂时无可奉告。";
    }
  }, [text, options]);

  // 2. RWA 合规审计与格式化
  const renderContent = () => {
    const lines = sanitizedText.split("\n");
    const elements: React.ReactNode[] = [];

    let inCodeBlock = false;
    let codeLines: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // 处理代码块
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          // 结束代码块
          elements.push(
            <pre key={`code-${index}`} className="bg-zinc-900 text-zinc-100 p-4 rounded-lg my-2 overflow-x-auto text-sm font-mono">
              <code>{codeLines.join("\n")}</code>
            </pre>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // 处理 RWA 流程映射 (资产→证明→托管→映射→对账)
      if (trimmed.includes("→") && (trimmed.includes("资产") || trimmed.includes("映射"))) {
        const steps = trimmed.split("→").map(s => s.trim());
        elements.push(
          <div key={`rwa-flow-${index}`} className="my-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
            <h4 className="text-blue-800 font-bold mb-2 flex items-center">
              <span className="mr-2">🛡️</span> RWA 资产映射链 (合规审计已就绪)
            </h4>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center text-sm text-blue-700">
                  <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-600 flex items-center justify-center mr-2 text-xs font-bold">
                    {i + 1}
                  </span>
                  {step}
                  {i < steps.length - 1 && <span className="mx-2 text-blue-300">↓</span>}
                </div>
              ))}
            </div>
          </div>
        );
        return;
      }

      // 处理 KYC/AML 占位符
      if (/KYC|AML|合规/i.test(trimmed) && !trimmed.includes("✅")) {
        elements.push(
          <div key={`compliance-${index}`} className="my-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
            <span className="text-amber-500 mr-2">⚖️</span>
            <div className="text-xs text-amber-700">
              <p className="font-bold">合规预留位 (Compliance Placeholder)</p>
              <p>{trimmed}</p>
            </div>
          </div>
        );
        return;
      }

      // 处理普通行 (支持 🔹 和 ✅)
      if (trimmed.startsWith("✅")) {
        elements.push(
          <h3 key={index} className="text-lg font-bold text-zinc-800 mt-4 mb-2 flex items-center">
            <span className="mr-2">{trimmed.slice(0, 2)}</span>
            {trimmed.slice(2).trim()}
          </h3>
        );
      } else if (trimmed.startsWith("🔹")) {
        elements.push(
          <div key={index} className="flex items-start my-1 text-zinc-700">
            <span className="text-blue-500 mr-2 mt-1">🔹</span>
            <span className="flex-1">{trimmed.slice(2).trim()}</span>
          </div>
        );
      } else if (trimmed === "---") {
        elements.push(<hr key={index} className="my-4 border-zinc-200" />);
      } else if (trimmed) {
        elements.push(<p key={index} className="my-2 text-zinc-600 leading-relaxed">{line}</p>);
      } else {
        elements.push(<div key={index} className="h-2" />);
      }
    });

    return elements;
  };

  return (
    <div className={`mule-response-container max-w-2xl mx-auto p-6 bg-white shadow-sm border border-zinc-100 rounded-xl ${className}`}>
      <div className="flex items-center mb-4 border-b border-zinc-50 pb-3">
        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mr-3">
          <span className="text-xl">🌙</span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">{agent} · 银月内阁</h2>
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Secure Financial Gateway</p>
        </div>
      </div>
      
      <div className="mule-content space-y-1">
        {renderContent()}
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-50 flex justify-between items-center text-[10px] text-zinc-300">
        <span>银月钱庄 · RWA Compliance v1.0</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
};
