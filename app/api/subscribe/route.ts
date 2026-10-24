import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { copyProductsToLibrary } from "@/lib/copy-products";

export const dynamic = "force-dynamic";

/**
 * 流式订阅已发布的库：复制过程中按 NDJSON 逐行回传进度，前端据此显示进度条。
 * 事件：
 * - { type: "progress", copied, total } 复制进度
 * - { type: "done", libraryId } 完成（新订阅副本 id）
 * - { type: "skipped", libraryId } 已订阅过（现有副本 id）
 * - { type: "error", message } 失败
 * 逻辑与 subscribeToPublished 一致（校验发布状态、不能订自己的、已订过直接返回）。
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  let body: { sourceLibraryId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "参数错误" }, { status: 400 });
  }
  const sourceLibraryId = body.sourceLibraryId || "";
  const customName = (body.name || "").trim();
  if (!sourceLibraryId) {
    return Response.json({ error: "缺少参数" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* 流已关闭时忽略 */
        }
      };
      try {
        const { data: srcLib } = await supabase
          .from("libraries")
          .select("id, name, user_id, publish_status, time_display, publish_categories")
          .eq("id", sourceLibraryId)
          .single();
        if (!srcLib || srcLib.publish_status !== "published") {
          send({ type: "error", message: "该库未发布或不存在" });
          controller.close();
          return;
        }
        if (srcLib.user_id === user.id) {
          send({ type: "error", message: "不能订阅自己的库" });
          controller.close();
          return;
        }

        // 已订阅过则直接返回现有副本
        const { data: existing } = await supabase
          .from("library_subscriptions")
          .select("copy_library_id")
          .eq("library_id", sourceLibraryId)
          .eq("subscriber_id", user.id)
          .limit(1);
        if (existing && existing.length > 0) {
          send({ type: "skipped", libraryId: existing[0].copy_library_id });
          controller.close();
          return;
        }

        const { data: newLib, error: libError } = await supabase
          .from("libraries")
          .insert({
            user_id: user.id,
            name: (customName || srcLib.name).slice(0, 30),
            time_display: srcLib.time_display || "both",
          })
          .select("id")
          .single();
        if (libError || !newLib) {
          send({ type: "error", message: "订阅失败" });
          controller.close();
          return;
        }

        await copyProductsToLibrary(
          supabase,
          sourceLibraryId,
          newLib.id,
          user.id,
          (srcLib as { publish_categories?: string[] | null }).publish_categories,
          (copied, total) => send({ type: "progress", copied, total })
        );
        await supabase.from("library_subscriptions").insert({
          library_id: sourceLibraryId,
          copy_library_id: newLib.id,
          subscriber_id: user.id,
        });

        revalidatePath("/products");
        send({ type: "done", libraryId: newLib.id });
      } catch {
        send({ type: "error", message: "订阅失败，请重试" });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
