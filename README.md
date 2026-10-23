# 产品资料库（多用户版）

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase 构建的多用户产品资料库，移动端优先。

## 功能

- **用户系统**：邮箱注册（必填邀请码）/ 登录 / 登出；middleware 保护需登录页面
- **邀请码机制**：注册时校验邀请码（存在、启用、未超次），成功后 `used_count` +1 并记录来源
- **管理后台**（`/admin`，仅 `profiles.is_admin` 用户可见）：
  - 用户列表：邮箱、来源标注、注册时间
  - 邀请码管理：创建（带来源标注）、启用/停用、查看使用次数、删除
- **产品库**（按 `user_id` 隔离）：CRUD，字段含名称、型号、分类、规格参数（动态 key-value）、价格、备注、图片、文档附件
- **一键导入**：上传 Excel / CSV / JSON，预览后导入，名称+型号重复自动跳过
- **导出**：JSON / CSV（前端直接生成下载）

## 快速开始

```bash
npm install
cp .env.local.example .env.local   # 填入 Supabase 凭证
npm run dev
```

## Supabase 配置步骤

1. 在 [Supabase](https://supabase.com) 新建项目，拿到 `Project URL` 和 `anon public key`，
   填入 `.env.local`。
2. 在 Dashboard 的 **SQL Editor** 中按顺序执行
   `supabase/migrations/` 下的 5 个 SQL 文件（文件名已按时间排序）：
   - `20261023120000_profiles.sql` — profiles 表 + 新用户触发器 + `is_admin()` 函数
   - `20261023120001_invite_codes.sql` — invite_codes 表 + 校验/核销 RPC 函数
   - `20261023120002_products.sql` — products 表
   - `20261023120003_storage.sql` — `product-images`（公开）/ `product-docs`（私有）buckets + Storage 策略
   - `20261023120004_rls.sql` — RLS 策略
3. **关闭邮箱验证**（否则注册后需先点邮件才能登录）：
   Dashboard → Authentication → Providers → Email → 关闭 "Confirm email"。
   如需保留邮箱验证，注册成功后用户点邮件完成验证再登录即可（邀请码在注册时已核销）。
4. **创建第一枚邀请码**（在 SQL Editor 执行）：
   ```sql
   insert into public.invite_codes (code, source_label, max_uses)
   values ('WELCOME-001', '初始邀请码', 100);
   ```
5. 用该邀请码在应用里注册第一个账号，然后将其设为管理员：
   ```sql
   update public.profiles set is_admin = true where email = '你的邮箱';
   ```
6. 之后即可用管理员账号在 `/admin` 里创建带来源标注的邀请码。

## 目录结构

```
app/                    页面（App Router）
  login/ register/      登录 / 注册（含邀请码）
  products/             产品列表（搜索+分类筛选+导出）、新增、详情/编辑
  import/               一键导入（解析+预览+导入）
  admin/                管理后台（用户列表 / 邀请码管理）
actions/                Server Actions：auth / products / import / admin
components/             UI 组件（表单、卡片、底部导航、导入客户端等）
lib/supabase/           浏览器端 / 服务端 / middleware 的 Supabase 客户端
lib/types.ts lib/utils.ts
middleware.ts           登录态刷新 + 未登录跳转
supabase/migrations/    数据库表结构 + RLS + Storage 的 SQL
```

## 注意事项

- `.env.local` 不要提交到 git（已在 `.gitignore` 中）。
- 图片 bucket 为公开读取，文档 bucket 为私有（下载走临时签名链接）。
- 导入暂不支持图片/文档列，仅导入文本字段。
