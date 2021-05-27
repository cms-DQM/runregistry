const NodeCache = require("node-cache");
const myCache = new NodeCache();
const {
  CLIENT_ID,
  CLIENT_SECRET,
  OMS_AUDIENCE,
} = require('../config/config')[process.env.ENV || 'development'];
const { get_tokens_api } = require('./api');

const headers = { 'content-type': 'application/x-www-form-urlencoded' };
const cache_access_token = (access_token, expires_in) => {
  myCache.set("access_token", access_token, expires_in);
}

const data = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  audience: OMS_AUDIENCE,
};

exports.getToken = async () => {
  const cached_access_token = myCache.get("access_token")

  if (!cached_access_token) {
    data.grant_type = 'client_credentials'
    
    try {
      const { data: { access_token }, } = await get_tokens_api(data, headers)
      const token_info = await exchangeTokens(access_token)
      cache_access_token(token_info.access_token, token_info.expires_in)
      return token_info.access_token
    }
    catch (err) {
      console.error('Error access token from auth service', err);
    }
  }
  else {
    return cached_access_token
  }
}

const exchangeTokens = async (token) => {
  const data = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: OMS_AUDIENCE,
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token: token,
  };

  try {
    const {
      data: { access_token, expires_in },
    } = await get_tokens_api(data, headers)
    return { access_token, expires_in };
  } catch (err) {
    console.error('Error exchanging token from auth service', err);
  }
};

