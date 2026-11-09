import { useCallback, useEffect, useState } from "react";

import ChatBox from "./ChatBox";
import ConversationList from "./ConversationList";
import { getConversations, startListingConversation } from "../../services/chatApi";
import socket from "../../services/socket";

export default function ChatWidget({ currentUserId }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);

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

  // Gọi API lấy danh sách hội thoại
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getConversations();
      setConversations(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      console.error("Lỗi lấy danh sách cuộc trò chuyện:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Gọi khi mount trang
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        const data = await getConversations();
        if (!isMounted) return;
        setConversations(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!isMounted) return;
        console.error("Lỗi lấy danh sách cuộc trò chuyện:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    // Lắng nghe socket khi có tin nhắn mới ở bất kỳ hội thoại nào để refresh inbox
    const handleConversationUpdated = () => {
      fetchConversations();
    };

    socket.on("conversation_updated", handleConversationUpdated);

    return () => {
      isMounted = false;
      socket.off("conversation_updated", handleConversationUpdated);
    };
  }, [fetchConversations]);

  // Lắng nghe sự kiện toàn cục khi người dùng click "Chat với người bán" từ trang sản phẩm
  useEffect(() => {
    const handleOpenListingChat = async (e) => {
      const { listingId, listing } = e.detail || {};
      if (!listingId) return;

      setOpen(true);
      try {
        setLoading(true);
        const conv = await startListingConversation(listingId);
        const updatedList = await fetchConversations();

        // Tìm hội thoại vừa tạo/lấy trong danh sách để có đủ thông tin Listing & OtherUser
        const found = updatedList.find(
          (c) => Number(c.ConversationId) === Number(conv.ConversationId)
        );

        setSelectedConv(
          found || {
            ...conv,
            Listing: listing || null,
          }
        );
      } catch (err) {
        console.error("Lỗi mở cuộc trò chuyện với người bán:", err);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener("open-listing-chat", handleOpenListingChat);
    return () => window.removeEventListener("open-listing-chat", handleOpenListingChat);
  }, [fetchConversations]);

  const unreadCount = conversations.filter((c) => c.IsUnread).length;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="relative">
          {/* Nút đóng widget */}
          <button
            onClick={() => {
              setOpen(false);
              setSelectedConv(null);
            }}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-white transition hover:bg-black/25"
            aria-label="Đóng"
          >
            ✕
          </button>

          {/* Nếu đang chọn 1 cuộc hội thoại -> Hiển thị ChatBox */}
          {selectedConv ? (
            <ChatBox
              conversationId={selectedConv.ConversationId}
              currentUserId={effectiveUserId}
              title={
                selectedConv.OtherUser?.FullName ||
                selectedConv.OtherUser?.Username ||
                `Hội thoại #${selectedConv.ConversationId}`
              }
              listing={selectedConv.Listing}
              onBack={() => {
                setSelectedConv(null);
                fetchConversations();
              }}
            />
          ) : (
            /* Nếu chưa chọn hội thoại -> Hiển thị ConversationList */
            <ConversationList
              conversations={conversations}
              loading={loading}
              onSelect={(conv) => setSelectedConv(conv)}
              onRefresh={fetchConversations}
            />
          )}
        </div>
      )}

      {/* Nút bấm nổi mở widget chat */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            fetchConversations();
          }}
          className="relative flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white shadow-xl transition-all duration-200 hover:bg-emerald-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
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

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
