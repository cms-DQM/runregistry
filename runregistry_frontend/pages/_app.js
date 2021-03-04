import React from 'react';
import { Provider } from 'react-redux';
import App from 'next/app';
import withRedux from 'next-redux-wrapper';
import configureStore from '../store/configure-store';
import Head from 'next/head';

export default withRedux(configureStore, { debug: false })(
  class MyApp extends App {
    static async getInitialProps({ Component, ctx }) {
      return {
        pageProps: {
          // Call page-level getInitialProps
          ...(Component.getInitialProps
            ? await Component.getInitialProps(ctx)
            : {}),
        },
      };
    }

    render() {
      const { Component, pageProps, store } = this.props;
      return (
        <>
          <Head>
            <meta
              name="viewport"
              content="width=device-width, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"
            />
          </Head>
          <Provider store={store}>
            <Component {...pageProps} />
          </Provider>
        </>
      );
    }
  }
);
