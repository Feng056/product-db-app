"use client";

import { useState } from "react";
import UserManager from "@/components/UserManager";
import GroupManager from "@/components/GroupManager";
import InviteCodeManager from "@/components/InviteCodeManager";
import PublishReview from "@/components/PublishReview";
import RegistrationReview from "@/components/RegistrationReview";
import PasswordResetReview from "@/components/PasswordResetReview";
import ShutdownManager from "@/components/ShutdownManager";

import type { InviteCode, Profile, Group } from "@/lib/types";

type UserRow = Profile & {
  invite_codes: { source_label: string } | null;
  groups: { name: string } | null;
};

type Props = {
  userList: UserRow[];
  groupList: Group[];
  allTags: string[];
  adminId: string;
  memberCounts: Record<string, number>;
  subCountsByUser: Record<string, number>;
  codeList: InviteCode[];
  pendingPublish: { id: string; name: string; owner_name: string; product_count: number; publish_requested_at: string }[];
  pendingRegs: { id: string; username: string; display_name: string; registration_note: string; created_at: string }[];
  pendingResets: { id: string; username: string; display_name: string; note: string | null; created_at: string }[];
  isShutdown: boolean;
};

type UserTab = "users" | "groups" | "codes";
type ReviewTab = "publish" | "regs" | "reset";

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl py-2 text-xs font-medium ${
        active
          ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100"
          : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

/** 管理面板：可折叠，内部分组（用户管理 / 审核中心 / 服务停运置底） */
export default function AdminPanel(props: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [userTab, setUserTab] = useState<UserTab>("users");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("publish");

  const {
    userList,
    groupList,
    allTags,
    adminId,
    memberCounts,
    codeList,
    pendingPublish,
    pendingRegs,
    pendingResets,
    isShutdown,
  } = props;

  const reviewCount =
    pendingPublish.length + pendingRegs.length + pendingResets.length;

  return (
    <section className="mt-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-gray-500 dark:text-gray-400"
      >
        <span>
          管理
          {reviewCount > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {reviewCount}
            </span>
          )}
        </span>
        <span className="text-xs">{collapsed ? "展开 ▸" : "收起 ▾"}</span>
      </button>

      {!collapsed && (
        <div className="space-y-4">
          {/* 用户管理组 */}
          <div>
            <div className="mb-1 text-xs font-medium text-gray-400 dark:text-gray-500">
              用户管理
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
              <SubTab active={userTab === "users"} onClick={() => setUserTab("users")}>
                用户
              </SubTab>
              <SubTab active={userTab === "groups"} onClick={() => setUserTab("groups")}>
                分组
              </SubTab>
              <SubTab active={userTab === "codes"} onClick={() => setUserTab("codes")}>
                邀请码
              </SubTab>
            </div>
            <div className="mt-2">
              {userTab === "users" ? (
                <UserManager
                  users={userList}
                  groups={groupList}
                  allTags={allTags}
                  adminId={adminId}
                  subCountsByUser={props.subCountsByUser}
                />
              ) : userTab === "groups" ? (
                <GroupManager groups={groupList} memberCounts={memberCounts} />
              ) : (
                <InviteCodeManager codes={codeList} groups={groupList} />
              )}
            </div>
          </div>

          {/* 审核中心组 */}
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-gray-500">
              审核中心
              {reviewCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {reviewCount} 待处理
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
              <SubTab active={reviewTab === "publish"} onClick={() => setReviewTab("publish")}>
                发布审核{pendingPublish.length > 0 ? `(${pendingPublish.length})` : ""}
              </SubTab>
              <SubTab active={reviewTab === "regs"} onClick={() => setReviewTab("regs")}>
                注册审核{pendingRegs.length > 0 ? `(${pendingRegs.length})` : ""}
              </SubTab>
              <SubTab active={reviewTab === "reset"} onClick={() => setReviewTab("reset")}>
                密码重置{pendingResets.length > 0 ? `(${pendingResets.length})` : ""}
              </SubTab>
            </div>
            <div className="mt-2">
              {reviewTab === "publish" ? (
                <PublishReview requests={pendingPublish} />
              ) : reviewTab === "regs" ? (
                <RegistrationReview requests={pendingRegs} />
              ) : (
                <PasswordResetReview requests={pendingResets} />
              )}
            </div>
          </div>

          {/* 服务停运（最下） */}
          <div>
            <div className="mb-1 text-xs font-medium text-red-400">
              危险操作
            </div>
            <ShutdownManager isShutdown={isShutdown} />
          </div>
        </div>
      )}
    </section>
  );
}
