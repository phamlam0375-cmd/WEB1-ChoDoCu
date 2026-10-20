import axios from "axios";

const instance = axios.create({
    // Dev dùng cùng proxy với D01 để Store/partnerApplication không gọi nhầm CD.
    // Giữ nguyên URL production hiện có của phân hệ này.
    baseURL: import.meta.env?.DEV ? "/api" : "http://localhost:3000/api",
});

export default instance;
