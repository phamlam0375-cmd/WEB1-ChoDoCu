import axios from "axios";
import { getAccessToken } from "../lib/auth";
import { getDevUserId } from "../lib/api";

const instance = axios.create({
    // Dev dùng cùng proxy với D01 để Store/partnerApplication không gọi nhầm CD.
    // Giữ nguyên URL production hiện có của phân hệ này.
    baseURL: import.meta.env?.DEV ? "/api" : "http://localhost:3000/api",
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
