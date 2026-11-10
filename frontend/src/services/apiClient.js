import axios from "axios";
import { api, getDevUserId } from "../lib/api.js";
import { getAccessToken } from "../lib/auth.js";

const instance = axios.create({
    // Cùng backend/proxy với client v1; bỏ cứng localhost ở bản build Docker.
    baseURL: String(api.defaults.baseURL).replace(/\/v1\/?$/, ""),
});

instance.interceptors.request.use((config) => {
    const token = getAccessToken({ sessionOnly: Boolean(config.sessionOnly) });
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else if (!config.sessionOnly) {
        const userId = getDevUserId();
        if (userId) config.headers["x-user-id"] = userId;
    }
    return config;
});

export default instance;
