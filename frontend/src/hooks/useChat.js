import { getMessages, sendMessage } from "../services/chatApi";
import { useCallback, useEffect, useRef, useState } from "react";

export default function useChat(conversationId, currentUserId) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // Load trang đầu
  useEffect(() => {
    if (!conversationId) return;

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        const res = await getMessages(conversationId);
        if (!isMounted) return;
        setMessages(res.message || []);
        setHasMore(Boolean(res.hasMore));
        setCursor(res.nextCursor);
      } catch (err) {
        if (!isMounted) return;
        console.error("Lỗi tải tin nhắn:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Load tin cũ hơn
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current || !conversationId) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await getMessages(conversationId, cursor);
      setMessages((prev) => [...(res.message || []), ...prev]);
      setHasMore(Boolean(res.hasMore));
      setCursor(res.nextCursor);
    } catch (err) {
      console.error("Lỗi tải thêm tin nhắn:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [conversationId, cursor, hasMore]);

  // Gửi tin (optimistic)
  const send = useCallback(
    async (content) => {
      if (!conversationId) return;
      const tempId = `temp-${Date.now()}`;
      const temp = {
        MessageId: tempId,
        ConversationId: conversationId,
        SenderId: currentUserId,
        SenderType: "USER",
        Content: content,
        MessageType: "TEXT",
        AttachmentUrl: null,
        IsRead: false,
        SentAt: new Date().toISOString(),
        _status: "sending",
      };
      setMessages((prev) => [...prev, temp]);
      try {
        const saved = await sendMessage(conversationId, {
          content,
          messageType: "TEXT",
        });
        setMessages((prev) =>
          prev.map((m) => (m.MessageId === tempId ? saved : m))
        );
      } catch (err) {
        console.error("Lỗi gửi tin nhắn:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.MessageId === tempId ? { ...m, _status: "error" } : m
          )
        );
      }
    },
    [conversationId, currentUserId]
  );

  // Nhận tin mới từ socket (tránh trùng)
  const receive = useCallback((msg) => {
    setMessages((prev) =>
      prev.some((m) => m.MessageId === msg.MessageId) ? prev : [...prev, msg]
    );
  }, []);

  return { messages, hasMore, loading, loadMore, send, receive };
}
