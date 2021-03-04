import Document, { Html, Head, Main, NextScript } from 'next/document';
import { root_url_prefix } from '../config/config';

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    // const assetPrefix = this.props.__NEXT_DATA__.assetPrefix || '';

    return (
      <Html>
        <Head>
          <link
            rel="stylesheet"
            type="text/css"
            href={`${root_url_prefix}/static/nprogress.css`}
          />
          <link
            rel="stylesheet"
            type="text/css"
            href={`${root_url_prefix}/static/ant-modified.min.css`}
          />
          <link
            rel="stylesheet"
            type="text/css"
            href={`${root_url_prefix}/static/react-table.css`}
          />
          <meta charSet="utf-8" />
        </Head>
        <body className="custom_class">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
