const axios = require('axios');
const qs = require('qs');
const {
  AUTH_SERVICE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  OMS_AUDIENCE,
} = require('../config/config')[process.env.ENV || 'development'];

const headers = { 'content-type': 'application/x-www-form-urlencoded' };
exports.getToken = async () => {
  const data = qs.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: OMS_AUDIENCE,
    grant_type: 'client_credentials',
  });

  try {
    const {
      data: { access_token },
    } = await axios.post(AUTH_SERVICE_URL, data, {
      headers,
    });
    return await exchangeTokens(access_token);
  } catch (err) {
    console.log('Error fetching token from auth service', err);
  }
};

const exchangeTokens = async (token) => {
  const data = qs.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: OMS_AUDIENCE,
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token: token,
  });

  try {
    const {
      data: { access_token },
    } = await axios.post(AUTH_SERVICE_URL, data, {
      headers,
    });
    return access_token;
  } catch (err) {
    console.log('Error exchanging token from auth service', err);
  }
};
