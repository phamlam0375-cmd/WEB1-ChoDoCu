
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./AIChatWidget.scss";

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  const messagesEndRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, loading, open]);

  const sendMessage = async () => {
    const content = input.trim();

    // Không cho gửi tin nhắn rỗng
    if (!content) {
      setError("Vui lòng nhập tin nhắn");
      return;
    }

    if (sendingRef.current) return;

    sendingRef.current = true;
    setError("");
    setInput("");
    setLoading(true);

    const userMessage = {
      role: "user",
      content,
    };

    // Lưu lịch sử trước tin nhắn hiện tại
    const history = messages
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          history,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "Không thể lấy phản hồi từ trợ lý"
        );
      }

      const aiMessage = {
        role: "assistant",
        content:
          result.reply ||
          "Xin lỗi, mình chưa tìm được câu trả lời phù hợp.",
        products: Array.isArray(result.products)
          ? result.products
          : [],
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.message ||
            "Không thể kết nối đến trợ lý. Vui lòng thử lại.",
          products: [],
        },
      ]);
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Nút mở trợ lý */}
      {!open && (
        <button
          type="button"
          className="ai-floating-button"
          onClick={() => setOpen(true)}
          aria-label="Mở trợ lý AI"
        >
          💬
        </button>
      )}

      {/* Popup trợ lý AI */}
      {open && (
        <section className="ai-chat-widget">
          {/* Header */}
          <header className="ai-chat-header">
            <div>
              <strong>Trợ lý AI</strong>
              <small>
                Giúp bạn chọn sản phẩm hợp túi tiền
              </small>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng trợ lý AI"
            >
              ×
            </button>
          </header>

          {/* Nội dung hội thoại */}
          <div className="ai-chat-messages">
            {messages.length === 0 && (
              <div className="ai-message assistant">
                Xin chào! 👋
                {"\n\n"}
                Mình có thể giúp bạn tìm sản phẩm phù hợp
                với nhu cầu và ngân sách.
                {"\n\n"}
                Bạn đang muốn tìm sản phẩm gì?
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`ai-message ${msg.role}`}
              >
                <div>{msg.content}</div>

                {/* Danh sách sản phẩm thật */}
                {msg.products?.length > 0 && (
                  <div className="ai-product-links">
                    {msg.products.map((product) => (
                      <Link
                        key={product.id}
                        to={`/products/${product.id}`}
                        onClick={() => setOpen(false)}
                      >
                        Xem chi tiết: {product.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Thông báo lỗi */}
          {error && (
            <p className="ai-chat-error" role="alert">
              {error}
            </p>
          )}

          {/* Ô nhập tin nhắn */}
          <div className="ai-chat-input">
            <input
              type="text"
              value={input}
              maxLength={1000}
              onChange={(event) => {
                setInput(event.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              aria-label="Nội dung tin nhắn"
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={loading}
              aria-label="Gửi tin nhắn"
            >
              ➤
            </button>
          </div>
        </section>
      )}
    </>
  );
}
