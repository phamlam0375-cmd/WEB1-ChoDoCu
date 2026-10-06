import api from "./axios";

const getStoreByOwnerId = (ownerId) => {
    return api.get(`/stores/${ownerId}`);
};

const updateStore = (ownerId, data) => {
    return api.patch(`/stores/${ownerId}`, data);
};

const uploadQrImage = (file) => {
    return api.post("/v1/uploads", file, {
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
