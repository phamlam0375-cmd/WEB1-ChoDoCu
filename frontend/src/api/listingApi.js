import api from "./axios";

const getStoreListing = async (StoreId) => {
    const res = await api.get(`/seller/listing/store/${StoreId}`);
    return res.data;
};

const updateListing = async (ListingId, data) => {
    const res = await api.patch(`/seller/listing/${ListingId}`, data);
    return res.data;
}
export { getStoreListing, updateListing };