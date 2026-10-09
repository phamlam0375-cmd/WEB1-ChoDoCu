import api from "./axios";

const getSellerListing = async (sellerId) => {
    const res =await api.get(`/seller/listing/${sellerId}`);
    return res.data;
};

export { getSellerListing };