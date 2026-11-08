import { useLayoutEffect, useRef, useState } from "react";
import useChat from "../../hooks/useChat";

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const formatPrice = (price) => {
  if (price === undefined || price === null) return "";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
};

export default function ChatBox({
  conversationId,
  currentUserId,
  title,
  listing,
  onBack,
}) {
  const { messages, hasMore, loading, loadMore, send } = useChat(
    conversationId,
    currentUserId
  );
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevHeightRef = useRef(0);
  const isLoadingOldRef = useRef(false);

  // Cuộn xuống cuối khi có tin mới; giữ vị trí khi load tin cũ
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (isLoadingOldRef.current) {
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
      isLoadingOldRef.current = false;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = (e) => {
    if (e.target.scrollTop < 40 && hasMore && !loading) {
      prevHeightRef.current = e.target.scrollHeight;
      isLoadingOldRef.current = true;
      loadMore();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    send(content);
    setText("");
  };

  const handleOpenProductDetail = () => {
    if (!listing?.ListingId) return;
    window.dispatchEvent(
      new CustomEvent("view-listing-detail", {
        detail: { listingId: listing.ListingId, listing },
      })
    );
  };

  const listingImage = listing?.Media?.[0]?.MediaUrl;

  return (
    <div className="flex h-[540px] w-[360px] sm:w-[420px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-emerald-600 px-3 py-3 text-white">
        <div className="flex items-center gap-2 min-w-0 pr-8">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-full p-1 text-white/90 hover:bg-white/20 transition"
              title="Quay lại danh sách"
              aria-label="Quay lại"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">
              {title || `Cuộc trò chuyện #${conversationId}`}
            </div>
            {listing && (
              <div className="text-[11px] text-emerald-100 truncate">
                Đang trao đổi về sản phẩm
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner tóm tắt sản phẩm + Nút chuyển sang xem chi tiết sản phẩm */}
      {listing && (
        <div className="border-b bg-emerald-50/60 p-2.5 transition">
          <div className="flex items-center gap-2.5">
            {listingImage ? (
              <img
                src={listingImage}
                alt={listing.Title}
                className="h-11 w-11 shrink-0 rounded-lg object-cover border border-emerald-200 bg-white"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-lg">
                📦
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">
                {listing.Title}
              </p>
              <p className="text-xs font-bold text-emerald-700">
                {formatPrice(listing.Price)}
              </p>
            </div>

            {/* Nút bấm xem thông tin sản phẩm */}
            <button
              type="button"
              onClick={handleOpenProductDetail}
              className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-600 hover:text-white active:scale-95"
              title="Xem thông tin chi tiết sản phẩm"
            >
              <span>Xem món đồ</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Messages list */}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50 p-4">
        {loading && <p className="text-center text-xs text-gray-400">Đang tải...</p>}

        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 mt-10">Chưa có tin nhắn nào. Hãy gửi lời chào!</p>
        )}

        {messages.map((m) => {
          const mine = Number(m.SenderId) === Number(currentUserId);
          return (
            <div key={m.MessageId} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  mine ? "bg-emerald-600 text-white" : "bg-white text-gray-800 border border-gray-200"
                } ${m._status === "sending" ? "opacity-60" : ""}`}
              >
                {m.MessageType === "IMAGE" && m.AttachmentUrl && (
                  <img src={m.AttachmentUrl} alt="" className="mb-1 max-h-48 rounded-lg object-cover" />
                )}
                <p className="whitespace-pre-wrap break-words">{m.Content}</p>
                <div className={`mt-1 text-[10px] ${mine ? "text-emerald-100 text-right" : "text-gray-400"}`}>
                  {formatTime(m.SentAt)}
                  {m._status === "error" && " · Gửi lỗi"}
                  {mine && !m._status && (m.IsRead ? " · Đã xem" : " · Đã gửi")}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t bg-white p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
