import api from "./apiClient";

const postPartnerApplication = (formData) => {
    return api.post("/partner-applications", formData)
}

const sendPartnerOtp = (email) => {
    return api.post("/partner-applications/send-otp", { email });
}

const verifyPartnerOtp = (email, otp) => {
    return api.post("/partner-applications/verify-otp", { email, otp });
};

export { postPartnerApplication, sendPartnerOtp ,verifyPartnerOtp}