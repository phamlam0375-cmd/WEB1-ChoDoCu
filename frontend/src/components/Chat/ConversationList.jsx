const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

export default function ConversationList({
  conversations = [],
  loading = false,
  onSelect = () => {},
  onRefresh = () => {},
}) {
  return (
    <div className="flex h-[520px] w-[360px] sm:w-[400px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-emerald-600 px-4 py-3.5 text-white">
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
          <span className="font-semibold text-base">Hội thoại</span>
        </div>

        <button
          onClick={onRefresh}
          className="rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
          title="Làm mới"
          aria-label="Làm mới"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
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
              Hãy liên hệ với người bán từ bài đăng để bắt đầu nhắn tin!
            </p>
          </div>
        )}

        {!loading &&
          conversations.map((item) => {
            const partner = item.OtherUser || {};
            const displayName =
              partner.FullName || partner.Username || `Hội thoại #${item.ConversationId}`;
            const avatar = partner.AvatarUrl;
            const lastMsg = item.LastMessage?.Content || "Đã tạo cuộc trò chuyện";
            const time = formatTime(item.LastMessageAt || item.CreatedAt);

            return (
              <button
                key={item.ConversationId}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-3 p-3.5 text-left transition hover:bg-slate-50 ${
                  item.IsUnread ? "bg-emerald-50/40" : ""
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="h-11 w-11 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm border border-emerald-200">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {item.IsUnread && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>

                {/* Thông tin */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`truncate text-sm ${
                        item.IsUnread ? "font-bold text-gray-900" : "font-medium text-gray-800"
                      }`}
                    >
                      {displayName}
                    </p>
                    <span className="shrink-0 text-[11px] text-gray-400">{time}</span>
                  </div>

                  <p
                    className={`truncate text-xs mt-0.5 ${
                      item.IsUnread ? "font-semibold text-emerald-800" : "text-gray-500"
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
