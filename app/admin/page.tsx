import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import {
  toggleInviteCode,
  deleteInviteCode,
} from "@/actions/admin";
import BottomNav from "@/components/BottomNav";
import CreateInviteCodeForm from "@/components/CreateInviteCodeForm";
import { formatDateTime } from "@/lib/utils";
import type { InviteCode, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function ToggleButton({ code }: { code: InviteCode }) {
  return (
    <form
      action={async () => {
        "use server";
        await toggleInviteCode(code.id, code.is_active);
      }}
    >
      <button
        type="submit"
        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
          code.is_active
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {code.is_active ? "启用中" : "已停用"}
      </button>
    </form>
  );
}

function DeleteCodeButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await deleteInviteCode(id);
      }}
    >
      <button type="submit" className="text-xs text-red-500">
        删除
      </button>
    </form>
  );
}

/** 管理后台：仅 is_admin 用户可见 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile?.is_admin) {
    return (
      <main className="page-container">
        <div className="rounded-2xl bg-white p-10 text-center">
          <div className="text-4xl">🔒</div>
          <p className="mt-3 font-medium">无权访问</p>
          <p className="mt-1 text-sm text-gray-500">该页面仅管理员可见</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
          >
            返回产品库
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const tab = searchParams.tab === "codes" ? "codes" : "users";

  // 用户列表（含来源标注、昵称）
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_admin, created_at, invite_codes(source_label)")
    .order("created_at", { ascending: false });
  type UserRow = Profile & {
    invite_codes: { source_label: string } | null;
  };
  const userList = (users || []) as unknown as UserRow[];

  // 邀请码列表
  const { data: codes } = await supabase
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false });
  const codeList = (codes || []) as InviteCode[];

  return (
    <>
      <main className="page-container">
        <h1 className="text-xl font-bold">管理后台</h1>

        {/* Tab 切换 */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <Link
            href="/admin?tab=users"
            className={`rounded-xl py-2 text-center text-sm font-medium ${
              tab === "users" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
          >
            用户（{userList.length}）
          </Link>
          <Link
            href="/admin?tab=codes"
            className={`rounded-xl py-2 text-center text-sm font-medium ${
              tab === "codes" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
          >
            邀请码（{codeList.length}）
          </Link>
        </div>

        {tab === "users" ? (
          <div className="mt-4 space-y-2">
            {userList.length === 0 && (
              <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400">
                暂无用户
              </p>
            )}
            {userList.map((u) => (
              <div key={u.id} className="rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-semibold">
                    {u.display_name || u.email}
                  </span>
                  {u.is_admin && (
                    <span className="ml-2 shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      管理员
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-gray-400">{u.email}</div>
                <div className="mt-1 text-xs text-gray-500">
                  来源：{u.invite_codes?.source_label || "—"}
                </div>
                <div className="text-xs text-gray-400">
                  注册时间：{formatDateTime(u.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 创建邀请码 */}
            <CreateInviteCodeForm />

            {/* 邀请码列表 */}
            <div className="mt-4 space-y-2">
              {codeList.length === 0 && (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400">
                  暂无邀请码
                </p>
              )}
              {codeList.map((c) => (
                <div key={c.id} className="rounded-2xl bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="truncate text-sm font-bold text-blue-700">
                      {c.code}
                    </code>
                    <div className="flex shrink-0 items-center gap-2">
                      <ToggleButton code={c} />
                      <DeleteCodeButton id={c.id} />
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    来源：{c.source_label} · 已用 {c.used_count}/{c.max_uses} 次
                  </div>
                  <div className="text-xs text-gray-400">
                    创建于 {formatDateTime(c.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <BottomNav isAdmin />
    </>
  );
}
