import api from "./axios";

const getStoreListing = async (StoreId) => {
    const res = await api.get(`/seller/listing/store/${StoreId}`);
    return res.data;
};

export { getStoreListing };