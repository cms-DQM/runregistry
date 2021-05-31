const axios = require('axios');
const qs = require('qs');

const {
    AUTH_SERVICE_URL,
} = require('../config/config')[process.env.ENV || 'development'];

exports.get_tokens_api =  (data, headers) =>  axios.post(AUTH_SERVICE_URL, qs.stringify(data), {
    headers,
});