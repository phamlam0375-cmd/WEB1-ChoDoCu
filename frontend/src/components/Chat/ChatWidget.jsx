import { useState } from "react";
import ChatBox from "./ChatBox";

export default function ChatWidget({ conversationId = 1, currentUserId, title }) {
  const [open, setOpen] = useState(false);

  // Lấy currentUserId từ user đã lưu nếu chưa truyền prop
  const effectiveUserId =
    currentUserId ||
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem("user") || "null");
        return u?.UserId || 1;
      } catch {
        return 1;
      }
    })();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
            aria-label="Đóng"
          >
            ✕
          </button>
          <ChatBox
            conversationId={conversationId}
            currentUserId={effectiveUserId}
            title={title}
          />
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white shadow-xl transition-all duration-200 hover:bg-emerald-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h8M8 14h5m-9 6l3-3h11a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z"
            />
          </svg>
          <span className="font-medium text-sm">Nhắn tin</span>
        </button>
      )}
    </div>
  );
}
