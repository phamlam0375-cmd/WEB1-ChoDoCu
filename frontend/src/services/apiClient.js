import axios from "axios";
import { api } from "../lib/api.js";
import { getAccessToken } from "../lib/auth.js";
import { getAccessToken } from "../lib/auth";
import { getDevUserId } from "../lib/api";

const instance = axios.create({
    // Cùng backend/proxy với client v1; bỏ cứng localhost ở bản build Docker.
    baseURL: String(api.defaults.baseURL).replace(/\/v1\/?$/, ""),
});

instance.interceptors.request.use(config => {
    const token = getAccessToken({ sessionOnly: true });
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        const userId = getDevUserId();
        if (userId) config.headers["x-user-id"] = userId;
    }
    return config;
});

export default instance;
