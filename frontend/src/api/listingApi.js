import api from "./axios";

const getStoreListing = async (StoreId, page, limit) => {
    const res = await api.get(`/seller/listing/store/${StoreId}`, {
        params: {
            page, limit
        }
    });
    return res.data;
};

const updateListing = async (ListingId, data) => {
    const res = await api.patch(`/seller/listing/${ListingId}`, data);
    return res.data;
}

const hideListing = async (ListingId) => {
    const res = await api.patch(`/seller/listing/${ListingId}/hidden`);
    return res.data;
}
export { getStoreListing, updateListing, hideListing };