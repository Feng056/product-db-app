"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** 服务停运时，向所有用户显示横幅提醒导出数据 */
export default function ShutdownBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "shutdown_requested")
        .single();
      if ((data as { value?: string } | null)?.value === "true") {
        setShow(true);
      }
    })();
  }, []);

  if (!show) return null;

  return (
    <div className="bg-orange-500 px-4 py-2 text-center text-sm font-medium text-white">
      ⚠️ 服务即将停运，请尽快
      <Link href="/export-data" className="mx-1 underline font-bold">
        导出你的自建库数据
      </Link>
      ，防止数据丢失
    </div>
  );
}
