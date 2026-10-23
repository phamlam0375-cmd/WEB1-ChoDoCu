import axios from "axios";
import { api } from "../lib/api.js";
import { getAccessToken } from "../lib/auth.js";

const instance = axios.create({
    // Cùng backend/proxy với client v1; bỏ cứng localhost ở bản build Docker.
    baseURL: String(api.defaults.baseURL).replace(/\/v1\/?$/, ""),
});

instance.interceptors.request.use(config => {
    const token = getAccessToken({ sessionOnly: true });
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default instance;
