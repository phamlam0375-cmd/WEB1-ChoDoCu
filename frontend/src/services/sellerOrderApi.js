import api from "./apiClient";

export const getOrders = async () => {
    const res = await api.get("/seller/store/order");
    return res.data;
};

export const updateOrderStatus = async (orderId, status, reason) => {
    const res = await api.patch(
        `/seller/store/order/${orderId}/status`,
        {
            status,
            ...(reason ? { reason } : {}),
        }
    );

    return res.data;
};
