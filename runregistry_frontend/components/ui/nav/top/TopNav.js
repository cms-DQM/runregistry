import React, { Component } from 'react';
import { connect } from 'react-redux';
import Link from 'next/link';
import { Layout, Menu, Breadcrumb } from 'antd';
import config, { root_url_prefix } from '../../../../config/config';
const { Header, Content, Footer, Sider } = Layout;

class TopNav extends Component {
  render() {
    const {
      router: { query: { type, section, workspace }, },
      user, env,
    } = this.props;
    // Log to see who has used the webpage on the server:
    console.log(`user: ${user.displayname}, ${user.id}, Type: ${type}`);
    const menu_style = { lineHeight: '64px', minWidth: '800px' };
    const header_style = {};
    if (env === 'staging') {
      menu_style.backgroundColor = 'purple';
      header_style.backgroundColor = 'purple';
    }
    return (
      <Header className="header" style={header_style}>
        <Menu
          theme="dark"
          mode="horizontal"
          defaultSelectedKeys={[type]}
          style={menu_style}
        >
          <Menu.Item key="logo">
            <Link
              as={`${root_url_prefix}/online`}
              href={`${root_url_prefix}/online/global?type=online&workspace=global`}
            >
              <div>
                <img className="logo" src={`/static/images/cms_logo.png`} />
                <h4
                  style={{
                    display: 'inline-block',
                    color: 'white',
                    marginLeft: '10px',
                    marginBottom: 0,
                  }}
                >
                  Run Registry
                </h4>
              </div>
            </Link>
          </Menu.Item>
          <Menu.Item key="online">
            <Link
              as={`${root_url_prefix}/online`}
              href={`${root_url_prefix}/online/global?type=online&workspace=global`}
            >
              <a>ONLINE</a>
            </Link>
          </Menu.Item>
          <Menu.Item key="offline">
            <Link
              as={`${root_url_prefix}/offline/datasets/global`}
              href={`${root_url_prefix}/offline?type=offline&section=datasets&workspace=global`}
            >
              <a>OFFLINE</a>
            </Link>
          </Menu.Item>
          <Menu.Item key="ml">
            <Link
              as={`${root_url_prefix}/ml/datasets/global`}
              href={`${root_url_prefix}/ml?type=ml&section=datasets&workspace=global`}
            >
              <a>ML</a>
            </Link>
          </Menu.Item>
          {/* <Menu.Item key="json">
            <Link
              as={`${root_url_prefix}/json`}
              href={`${root_url_prefix}/json`}
            >
              <a>JSON CREATION</a>
            </Link>
          </Menu.Item> */}
          <Menu.Item key="json_portal">
            <Link
              as={`${root_url_prefix}/json_portal`}
              href={`${root_url_prefix}/json_portal`}
            >
              <a>JSON PORTAL</a>
            </Link>
          </Menu.Item>
          <Menu.Item key="log">
            <Link as={`${root_url_prefix}/log`} href={`${root_url_prefix}/log`}>
              <a>LOG</a>
            </Link>
          </Menu.Item>
          {env === 'staging' && (
            <Menu.Item
              disabled
              key="warning"
              style={{ opacity: 1, color: 'red !important' }}
            >
              <span
                onClick={() => { }}
                style={{
                  color: 'red !important',
                  fontSize: '0.9em',
                }}
              >
                STAGING ENV (FOR TESTING)
              </span>
            </Menu.Item>
          )}
        </Menu>
        <div>
          <h3 className="user_name white">
            {user.displayname ||
              'No User Specified in the Headers, or User is Developing'}
          </h3>

          <a className="white" href="https://cmsrunregistry.web.cern.ch/logout">
            Log out
          </a>
        </div>
        <style jsx global>{`
          .logo {
            width: 50px;
          }

          .header {
            display: flex;
            justify-content: space-between;
          }
          .white {
            color: white;
          }
          .user_name {
            display: inline-block;
            margin-right: 20px;
          }
        `}</style>
      </Header>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    user: state.info,
    env: state.info.environment,
  };
};

export default connect(mapStateToProps)(TopNav);
