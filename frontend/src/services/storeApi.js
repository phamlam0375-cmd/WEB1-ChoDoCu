import api from "./apiClient";

const getStoreByOwnerId = (ownerId) => {
    return api.get(`/stores/${ownerId}`);
};

const updateStore = (ownerId, data) => {
    return api.patch(`/stores/${ownerId}`, data, { sessionOnly: true });
};

const uploadQrImage = (ownerId, file) => {
    return api.post(`/stores/${encodeURIComponent(ownerId)}/qr`, file, {
        headers: {
            "Content-Type": file.type,
        },
    });
};

export {
    getStoreByOwnerId,
    updateStore,
    uploadQrImage,
};
