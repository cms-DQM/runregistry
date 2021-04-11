const axios = require('axios');
var qs = require('qs');
const { AUTH_SERVICE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  AUDIENCE } = require('../config/config')[
  process.env.ENV || 'development'
  ];

exports.getToken = () => {
  const data = qs.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: AUDIENCE,
    grant_type: "client_credentials"
  })

  var options = {
    method: 'POST',
    url: AUTH_SERVICE_URL,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data
  }
  return axios
    .request(options)
    .then(async response => {
      const token = await exchangeTokens(response.data.access_token);
      return token;
    })
    .catch(error => {
      console.error(error);
      throw error
    });
};

const exchangeTokens = async (token) => {
  const data = qs.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: AUDIENCE,
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token: token
  })

  var options = {
    method: 'POST',
    url: AUTH_SERVICE_URL,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data,
  }

  return await axios
    .request(options)
    .then(response => {
      return response.data.access_token;
    })
    .catch(error => {
      console.error(error);
      throw error
    });
};
