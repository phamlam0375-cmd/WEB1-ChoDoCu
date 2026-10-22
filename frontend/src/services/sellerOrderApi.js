import api from "./apiClient";

const getOrders = async () => {
    const res = await api.get("/seller/store/order");
    return res.data;
}

export default getOrders;