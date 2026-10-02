import axios from "axios";

const instance=axios.create({
    baseURL:"http://localhost/api",
});

instance.interceptors.response.use(
    function (response) {
        return response && response.data ? response.data : response;
    },
    function (error) {
        return error && error.response && error.response.data
            ? error.response.data
            : Promise.reject(error);
    }
);
export default instance;