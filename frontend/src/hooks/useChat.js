import { getMessages, sendMessage } from "../services/chatApi";
import { useCallback, useEffect, useRef, useState } from "react";
import socket from "../services/socket";

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

    // Tham gia vào room của conversation trên socket
    socket.emit("join_conversation", conversationId);

    // Lắng nghe tin nhắn mới từ socket realtime
    const handleNewMessage = (newMsg) => {
      if (Number(newMsg.ConversationId) === Number(conversationId)) {
        setMessages((prev) => {
          // Tránh duplicate tin nhắn (nếu đã thêm từ optimistic)
          const exists = prev.some(
            (m) =>
              m.MessageId === newMsg.MessageId ||
              (m._status === "sending" && m.Content === newMsg.Content && Number(m.SenderId) === Number(newMsg.SenderId))
          );
          if (exists) {
            return prev.map((m) =>
              m.Content === newMsg.Content && Number(m.SenderId) === Number(newMsg.SenderId) && m._status === "sending"
                ? newMsg
                : m
            );
          }
          return [...prev, newMsg];
        });
      }
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      isMounted = false;
      socket.emit("leave_conversation", conversationId);
      socket.off("new_message", handleNewMessage);
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

  return { messages, hasMore, loading, loadMore, send };
}
