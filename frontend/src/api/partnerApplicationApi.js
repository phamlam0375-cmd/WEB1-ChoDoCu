import api from "./axios";
const postPartnerApplication = (UserId, PartnerType, IdentityImageUrl, IdentityNumberMasked) => {
    return api.post("/partner-applications", { UserId, PartnerType, IdentityImageUrl, IdentityNumberMasked })
}
export { postPartnerApplication }