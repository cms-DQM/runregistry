/* eslint-disable */
const withCss = require('@zeit/next-css');
const withSass = require('@zeit/next-sass');
const { root_url_prefix } = require('./config/config');

if (typeof require !== 'undefined') {
  require.extensions['.css'] = (file) => { };
}
module.exports = withCss(
  withSass({
    assetPrefix: '',
    // basePath: process.env.ENV === 'kubernetes' && '/runregistry',
    publicRuntimeConfig: {
      // Will be available on both server and client
      staticFolder: '/static',
      NODE_ENV: process.env.NODE_ENV,
      ENV: process.env.ENV,
    },
  })
);
