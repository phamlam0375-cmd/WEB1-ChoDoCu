import api from "./apiClient";

const getStoreListing = async (StoreId, page, limit) => {
    const res = await api.get(`/seller/listing/store/${StoreId}`, {
        params: {
            page, limit
        }
    });
    return res.data;
};
const createListing = async (data, images = []) => {
    const formData = new FormData();

    // Thêm các trường text
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            formData.append(key, value);
        }
    });

    // Thêm ảnh
    images.forEach((img) => {
        formData.append("images", img.file);
    });

    const res = await api.post(`/seller/listing`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
}
const updateListing = async (ListingId, data) => {
    const res = await api.patch(`/seller/listing/${ListingId}`, data);
    return res.data;
}

const hideListing = async (ListingId) => {
    const res = await api.patch(`/seller/listing/${ListingId}/hidden`);
    return res.data;
}

const getAllListing = async (page = 1, limit = 100) => {
    const res = await api.get(`/seller/listing`, { params: { page, limit } });
    return res.data;
}
export { getStoreListing, updateListing, hideListing, createListing, getAllListing };