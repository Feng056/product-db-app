"use client";

import { useState } from "react";
import QRCode from "react-qr-code";

/** 邀请码二维码：扫码直达注册页并自动填入邀请码 */
export default function InviteCodeQR({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?code=${encodeURIComponent(code)}`
      : `/register?code=${encodeURIComponent(code)}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs text-blue-600"
      >
        二维码
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-3xl bg-white p-6 text-center dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white p-3 rounded-2xl inline-block">
              <QRCode value={url} size={200} />
            </div>
            <p className="mt-3 text-sm font-semibold">{code}</p>
            <p className="mt-1 text-xs text-gray-400">
              扫码注册，邀请码自动填入
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}
