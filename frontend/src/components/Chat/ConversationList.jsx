const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

const formatPrice = (price) => {
  if (price === undefined || price === null) return "";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
};

export default function ConversationList({
  conversations = [],
  loading = false,
  onSelect = () => {},
}) {
  return (
    <div className="flex h-[540px] w-[360px] sm:w-[420px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-emerald-600 px-4 py-3.5 text-white pr-12">
        <div className="flex items-center gap-2">
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
          <span className="font-semibold text-base">Hội thoại sản phẩm</span>
        </div>
      </div>

      {/* Danh sách hội thoại */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-white">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-xs">Đang tải cuộc trò chuyện...</p>
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-300 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-600">Chưa có cuộc trò chuyện nào</p>
            <p className="text-xs mt-1 text-gray-400">
              Hãy bấm vào bất kỳ món đồ nào để nhắn tin với người bán!
            </p>
          </div>
        )}

        {!loading &&
          conversations.map((item) => {
            const partner = item.OtherUser || {};
            const displayName =
              partner.FullName || partner.Username || `Người dùng #${partner.UserId || ""}`;
            const avatar = partner.AvatarUrl;
            const listing = item.Listing;
            const listingImage = listing?.Media?.[0]?.MediaUrl;
            const lastMsg = item.LastMessage?.Content || "Đã mở cuộc trò chuyện";
            const time = formatTime(item.LastMessageAt || item.CreatedAt);

            return (
              <button
                key={item.ConversationId}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full flex items-start gap-3 p-3.5 text-left transition hover:bg-slate-50 ${
                  item.IsUnread ? "bg-emerald-50/40" : ""
                }`}
              >
                {/* Avatar Người nhắn hoặc Ảnh sản phẩm */}
                <div className="relative shrink-0">
                  {listingImage ? (
                    <img
                      src={listingImage}
                      alt={listing?.Title || "Sản phẩm"}
                      className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                    />
                  ) : avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-semibold text-sm border border-emerald-200">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {item.IsUnread && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>

                {/* Thông tin hội thoại & sản phẩm */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`truncate text-sm ${
                        item.IsUnread ? "font-bold text-gray-900" : "font-semibold text-gray-800"
                      }`}
                    >
                      {displayName}
                    </p>
                    <span className="shrink-0 text-[11px] text-gray-400">{time}</span>
                  </div>

                  {/* Tag thông tin sản phẩm đính kèm */}
                  {listing && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700 font-medium truncate">
                      <span className="truncate">📦 {listing.Title}</span>
                      <span className="shrink-0 font-bold">· {formatPrice(listing.Price)}</span>
                    </div>
                  )}

                  <p
                    className={`truncate text-xs mt-1 ${
                      item.IsUnread ? "font-semibold text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {lastMsg}
                  </p>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
