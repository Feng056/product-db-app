"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkAndPrepareAutoExport } from "@/actions/auth";

/** 用户打开程序时，检查是否有待自动导出的标记 */
export default function AutoExportCheck() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const res = await checkAndPrepareAutoExport();
      if (res.token) {
        router.push(`/export-data?token=${res.token}`);
      }
    })();
  }, [router]);

  return null;
}
