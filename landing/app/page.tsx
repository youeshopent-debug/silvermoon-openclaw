import { CaseStudies } from "../components/CaseStudies";
import { Contact } from "../components/Contact";
import { Footer } from "../components/Footer";
import { Hero } from "../components/Hero";
import { Services } from "../components/Services";
import { MuleResponse } from "../components/MuleResponse";

const SAMPLE_MULE_REPLY = `✅ RWA 资产上线方案
🔹 资产类型：收益权代币化 (Yield-bearing Token)
🔹 映射路径：资产 → 证明 → 托管 → 映射 → 对账
🔹 合规要求：必须完成 KYC/AML 验证。

我听到你的反馈了。我会努力改进。
请稍等，我正在查找相关资料。

\`\`\`js
// 示例代码
const rwa = {
  id: "asset_001",
  status: "compliant"
};
\`\`\`

银月内阁已完成初步审计。`;

export default function Page() {
  return (
    <div className="min-h-dvh bg-zinc-50">
      <Hero />
      <main>
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8 text-zinc-800">Mule 实时响应演示</h2>
            <MuleResponse text={SAMPLE_MULE_REPLY} />
          </div>
        </section>
        <Services />
        <CaseStudies />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
