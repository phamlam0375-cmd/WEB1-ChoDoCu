import api from "./apiClient";

export const getConversations = async () => {
    const { data } = await api.get("/conversations");
    return data?.data || [];
};

export const startListingConversation = async (listingId) => {
    const { data } = await api.post("/conversations/listing", { listingId });
    return data?.data;
};

export const getMessages = async (conversationId, cursor) => {
    const { data } = await api.get(
        `/conversations/${conversationId}/messages`,
        { params: { before: cursor, limit: 20 } }
    );
    return data; // { message, hasMore, nextCursor }
};

export const sendMessage = async (conversationId, payload) => {
    const { data } = await api.post(
        `/conversations/${conversationId}/messages`,
        payload
    );
    return data;
};
