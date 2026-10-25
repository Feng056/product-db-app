import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import AccountEditor from "@/components/AccountEditor";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import ThemeSelector from "@/components/ThemeSelector";
import AdminPanel from "@/components/AdminPanel";
import type { InviteCode, Profile, Group } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 设置页：账户信息 + 退出登录；管理员另有管理面板 */
export default async function SettingsPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  const isAdmin = !!profile?.is_admin;

  const supabase = await createClient();

  // 头像公开链接
  const avatarPath = (profile as { avatar_path?: string } | null)?.avatar_path || "";
  const avatarUrl = avatarPath
    ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
    : null;

  // 管理员数据
  type UserRow = Profile & {
    invite_codes: { source_label: string } | null;
    groups: { name: string } | null;
  };
  let userList: UserRow[] = [];
  let codeList: InviteCode[] = [];
  let groupList: Group[] = [];
  let allTags: string[] = [];
  let memberCounts: Record<string, number> = {};
  let subCountsByUser: Record<string, number> = {};
  let subscriberCountsByUser: Record<string, number> = {};
  let pendingPublish: { id: string; name: string; owner_name: string; product_count: number; publish_requested_at: string }[] = [];
  let pendingRegs: { id: string; username: string; display_name: string; registration_note: string; created_at: string }[] = [];
  let pendingResets: { id: string; username: string; display_name: string; note: string | null; created_at: string }[] = [];
  let isShutdown = false;
  if (isAdmin) {
    // 并行拉取管理数据
    const [usersRes, codesRes, groupsRes, tagsRes, subRowsRes, libsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, username, display_name, is_admin, is_active, tags, group_id, invite_code_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("invite_codes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.rpc("get_all_user_tags"),
      supabase.from("library_subscriptions").select("library_id, subscriber_id"),
      supabase.from("libraries").select("id, user_id"),
    ]);
    codeList = (codesRes.data || []) as InviteCode[];
    // 来源标注不在查询里联表（profiles.group_id 没有外键时联表会让整条查询报错），
    // 改为用已取到的邀请码列表在 JS 里拼；分组名由 UserManager 用分组列表兜底
    const labelByCodeId = new Map<string, string>();
    for (const c of codeList) {
      labelByCodeId.set(c.id, c.source_label);
    }
    userList = ((usersRes.data || []) as unknown as (Profile & { invite_code_id: string | null })[]).map((u) => ({
      ...u,
      invite_codes: u.invite_code_id ? { source_label: labelByCodeId.get(u.invite_code_id) || "" } : null,
      groups: null,
    }));
    groupList = (groupsRes.data || []) as Group[];
    allTags = (((tagsRes.data as string[]) || [])).sort();
    for (const u of userList) {
      if (u.group_id) memberCounts[u.group_id] = (memberCounts[u.group_id] || 0) + 1;
    }
    // 各用户订阅的库个数
    for (const s of subRowsRes.data || []) {
      const sid = (s as { subscriber_id: string }).subscriber_id;
      subCountsByUser[sid] = (subCountsByUser[sid] || 0) + 1;
    }
    // 各用户被订阅人数（按订阅者去重）
    const ownerByLib = new Map<string, string>();
    for (const l of (libsRes.data || []) as { id: string; user_id: string }[]) {
      ownerByLib.set(l.id, l.user_id);
    }
    const subscribersByOwner = new Map<string, Set<string>>();
    for (const s of subRowsRes.data || []) {
      const row = s as { library_id: string; subscriber_id: string };
      const owner = ownerByLib.get(row.library_id);
      if (!owner) continue;
      if (!subscribersByOwner.has(owner)) subscribersByOwner.set(owner, new Set<string>());
      subscribersByOwner.get(owner)!.add(row.subscriber_id);
    }
    subscribersByOwner.forEach((set, owner) => {
      subscriberCountsByUser[owner] = set.size;
    });
    const { getPendingPublishRequests } = await import("@/actions/libraries");
    const { getPendingRegistrations, getPendingPasswordResets, getShutdownStatus } = await import("@/actions/admin");
    const [pub, regs, resets, shutdown] = await Promise.all([
      getPendingPublishRequests(),
      getPendingRegistrations(),
      getPendingPasswordResets(),
      getShutdownStatus(),
    ]);
    pendingPublish = pub;
    pendingRegs = regs;
    pendingResets = resets;
    isShutdown = shutdown;
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
              username={profile?.username || null}
              avatarUrl={avatarUrl}
            />
            <PasswordChangeForm />
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

        {/* 管理（仅管理员）：可折叠，分组展示 */}
        {isAdmin && (
          <AdminPanel
            userList={userList}
            groupList={groupList}
            allTags={allTags}
            adminId={user.id}
            memberCounts={memberCounts}
            subCountsByUser={subCountsByUser}
            subscriberCountsByUser={subscriberCountsByUser}
            codeList={codeList}
            pendingPublish={pendingPublish}
            pendingRegs={pendingRegs}
            pendingResets={pendingResets}
            isShutdown={isShutdown}
          />
        )}
      </main>
      <BottomNav isAdmin={isAdmin} />
    </>
  );
}
