"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SpecItem } from "@/lib/types";

export type RecognizedProduct = {
  name: string;
  model: string;
  category: string;
  specs: SpecItem[];
  notes: string;
};

const PROMPT = `识别这张产品照片。只返回 JSON，不要任何其他文字，格式如下：
{"name": "产品名称（必填，简明中文）", "model": "型号（如包装/机身上可见，否则空字符串）", "category": "分类（如：电子产品/家居/服装/食品/工具等）", "specs": [{"key": "参数名", "value": "参数值"}], "notes": "一句话描述产品外观用途"}
specs 最多 6 条，只写照片上能看到或能合理推断的参数，不确定的不要编造。`;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 调用 Gemini 识别单张产品照片（base64，不含 data: 前缀） */
export async function recognizeImage(
  imageBase64: string,
  mimeType: string
): Promise<{ product?: RecognizedProduct; error?: string }> {
  const { user } = await requireUser();
  void user;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "识别服务未配置，请联系管理员" };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error:", res.status, t.slice(0, 300));
      return { error: `识别失败（${res.status}），请重试` };
    }
    const json = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return { error: "识别无结果，请换张更清晰的照片" };
    const p = JSON.parse(text);
    const specs: SpecItem[] = Array.isArray(p.specs)
      ? p.specs
          .filter((s: unknown) => s && typeof s === "object")
          .map((s: { key?: unknown; value?: unknown }) => ({
            key: String(s.key || ""),
            value: String(s.value || ""),
          }))
          .filter((s: SpecItem) => s.key || s.value)
          .slice(0, 6)
      : [];
    return {
      product: {
        name: String(p.name || "未命名产品"),
        model: String(p.model || ""),
        category: String(p.category || "未分类"),
        specs,
        notes: String(p.notes || ""),
      },
    };
  } catch (e) {
    console.error("recognizeImage error:", e);
    return { error: "识别出错，请重试" };
  }
}

export type SaveRecognizedResult = { saved: number; error?: string };

/** 批量保存识别结果到指定产品库 */
export async function saveRecognizedProducts(
  products: RecognizedProduct[],
  libraryId: string
): Promise<SaveRecognizedResult> {
  const { supabase, user } = await requireUser();

  // 校验产品库归属
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { saved: 0, error: "产品库不存在或无权限" };

  const clean = products
    .map((p) => ({
      name: String(p.name || "").trim(),
      model: String(p.model || "").trim(),
      category: String(p.category || "").trim() || "未分类",
      specs: Array.isArray(p.specs) ? p.specs : [],
      notes: String(p.notes || ""),
    }))
    .filter((p) => p.name);
  if (clean.length === 0) return { saved: 0, error: "没有可保存的产品" };

  const { error } = await supabase.from("products").insert(
    clean.map((p) => ({
      user_id: user.id,
      library_id: libraryId,
      name: p.name,
      model: p.model,
      category: p.category,
      price: null,
      specs: p.specs,
      notes: p.notes,
      images: [],
      docs: [],
    }))
  );
  if (error) return { saved: 0, error: `保存失败：${error.message}` };

  revalidatePath("/products");
  return { saved: clean.length };
}
