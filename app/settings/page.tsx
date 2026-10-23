import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import { toggleInviteCode, deleteInviteCode } from "@/actions/admin";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import AccountEditor from "@/components/AccountEditor";
import CreateInviteCodeForm from "@/components/CreateInviteCodeForm";
import ThemeSelector from "@/components/ThemeSelector";
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
            ? "bg-green-100 text-green-700 dark:text-green-300"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
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

/** 设置页：账户信息 + 退出登录；管理员另有用户管理与邀请码管理 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  const isAdmin = !!profile?.is_admin;

  const supabase = await createClient();
  const tab = searchParams.tab === "codes" ? "codes" : "users";

  // 头像公开链接
  const avatarPath = (profile as { avatar_path?: string } | null)?.avatar_path || "";
  const avatarUrl = avatarPath
    ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
    : null;

  // 管理员数据
  type UserRow = Profile & { invite_codes: { source_label: string } | null };
  let userList: UserRow[] = [];
  let codeList: InviteCode[] = [];
  if (isAdmin) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, created_at, invite_codes(source_label)")
      .order("created_at", { ascending: false });
    userList = (users || []) as unknown as UserRow[];
    const { data: codes } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });
    codeList = (codes || []) as InviteCode[];
  }

  return (
    <>
      <main className="page-container">
        <h1 className="text-xl font-bold">设置</h1>

        {/* 账户 */}
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400 ">账户</h2>
          <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
            <AccountEditor
              displayName={profile?.display_name || null}
              email={profile?.email || null}
              avatarUrl={avatarUrl}
            />
            <div className="mt-3">
              <LogoutButton />
            </div>
          </div>
        </section>

        {/* 显示设置 */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400 ">显示设置</h2>
          <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              产品库右上角展示
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "off", label: "关闭" },
                { value: "avatar", label: "仅头像" },
                { value: "name", label: "仅名称" },
              ].map((opt) => {
                const active =
                  ((profile as { header_display?: string } | null)?.header_display || "name") ===
                  opt.value;
                return (
                  <form
                    key={opt.value}
                    action={async (formData: FormData) => {
                      "use server";
                      const { updateHeaderDisplay } = await import("@/actions/profile");
                      await updateHeaderDisplay(formData);
                    }}
                  >
                    <input type="hidden" name="header_display" value={opt.value} />
                    <button
                      type="submit"
                      className={`w-full rounded-xl border-2 py-2.5 text-sm font-medium ${
                        active
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                          : "border-transparent bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-white dark:bg-gray-900 p-4">
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">页面颜色</div>
            <ThemeSelector />
          </div>
        </section>

        {/* 管理（仅管理员） */}
        {isAdmin && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400 ">管理</h2>

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
              <Link
                href="/settings?tab=users"
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  tab === "users" ? "bg-white dark:bg-gray-900 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                用户（{userList.length}）
              </Link>
              <Link
                href="/settings?tab=codes"
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  tab === "codes" ? "bg-white dark:bg-gray-900 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                邀请码（{codeList.length}）
              </Link>
            </div>

            {tab === "users" ? (
              <div className="mt-3 space-y-2">
                {userList.length === 0 && (
                  <p className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    暂无用户
                  </p>
                )}
                {userList.map((u) => (
                  <div key={u.id} className="rounded-2xl bg-white dark:bg-gray-900 p-4">
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
                    <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{u.email}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 ">
                      来源：{u.invite_codes?.source_label || "—"}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      注册时间：{formatDateTime(u.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <CreateInviteCodeForm />
                </div>
                <div className="mt-3 space-y-2">
                  {codeList.length === 0 && (
                    <p className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      暂无邀请码
                    </p>
                  )}
                  {codeList.map((c) => (
                    <div key={c.id} className="rounded-2xl bg-white dark:bg-gray-900 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <code className="truncate text-sm font-bold text-blue-700 dark:text-blue-300">
                          {c.code}
                        </code>
                        <div className="flex shrink-0 items-center gap-2">
                          <ToggleButton code={c} />
                          <DeleteCodeButton id={c.id} />
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 ">
                        来源：{c.source_label} · 已用 {c.used_count}/{c.max_uses} 次
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        创建于 {formatDateTime(c.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <BottomNav isAdmin={isAdmin} />
    </>
  );
}
