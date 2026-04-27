# 银月钱庄 · 官网落地页

> 基于 Next.js 14 (App Router) 的单页官网，部署于 Vercel Free 计划。

---

## 项目定位

银月钱庄的对外展示门户，用于：
- 品牌展示与项目介绍
- Upwork/Fiverr 客户转化
- 服务能力展示

## 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **部署**: Vercel (Free Plan)

## 本地开发

```bash
cd landing
npm install
npm run dev
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_FORMSPREE_ENDPOINT` | 否 | Formspree 表单端点（设置后启用联系表单） |
| `NEXT_PUBLIC_FIVERR_PROFILE_URL` | 否 | Fiverr 个人主页链接 |

## 部署 (Vercel)

在 Vercel 项目设置中：
1. **Root Directory**: `landing`
2. **Framework**: Next.js
3. 添加上述环境变量（可选）

## 关联项目

- [silvermoon-openclaw](https://github.com/Alanlsl/silvermoon-openclaw) — 银月钱庄核心系统
