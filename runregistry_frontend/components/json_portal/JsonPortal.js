import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Menu } from 'antd';
import io from 'socket.io-client';
import axios from 'axios';
import { MailOutlined, AppstoreOutlined } from '@ant-design/icons';
import { selectJson } from '../../ducks/json/ui';
import { api_url } from '../../config/config';
import {
  getJsons,
  updateProgress,
  fetchMoreJsons,
} from '../../ducks/json/jsons';
import { error_handler } from '../../utils/error_handlers';

import DebuggingJson from './debuggingJson/DebuggingJson';
import VisualizeLuminosity from './visualizeLuminosity/VisualizeLuminosity';
import SubystemDivision from './visualizeLuminosity/subSystemDivision/SubsystemDivision';
const { SubMenu } = Menu;

import JsonList from './jsonList/JsonList';

class JsonPortal extends Component {
  state = {
    selected_tab: 'by_email',
    debugging_json: false,
    visualize_luminosity: false,
    loading: true,
  };

  async componentDidMount() {
    await this.fetchJsons();
    const socket_path = `/${api_url.includes('/api') ? 'api/' : ''}socket.io`;
    this.socket = io(`${api_url.split('/api')[0]}`, {
      path: socket_path,
    });
    this.socket.on('progress', (evt) => {
      this.updateProgress(evt);
    });
    this.socket.on('completed', async (evt) => {
      await this.fetchJsons();
      console.log('completed', evt);
      // replace completed json
    });
    this.socket.on('new_json_added_to_queue', async (evt) => {
      console.log('new job');
      await this.fetchJsons();
    });
    this.setState({ loading: false });
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.close();
    }
  }

  fetchJsons = async (key) => {
    this.setState({ loading: true });
    await this.props.getJsons(key || this.state.selected_tab);
    this.setState({ loading: false });
  };

  fetchMoreJsons = async () => {
    const json_list = this.props.jsons.jsons;
    const last_reference = json_list[json_list.length - 1].id;
    const { selected_tab } = this.state;
    await this.props.fetchMoreJsons(selected_tab, last_reference);
  };

  changeTab = async ({ key }) => {
    this.setState({ selected_tab: key, loading: true });
    await this.fetchJsons(key);
  };

  updateProgress = (event) => {
    this.props.updateProgress(event);
  };

  selectJson = (selected_id) => {
    const json = this.props.jsons.jsons.find(({ id }) => id === selected_id);
    this.props.selectJson(json);
    this.setState({ debugging_json: false });
  };

  toggleDebugging = (show) => this.setState({ debugging_json: show });

  toggleVisualizeLuminosity = (show) =>
    this.setState({ visualize_luminosity: show });

  render() {
    const { selected_json } = this.props;
    const {
      loading,
      selected_tab,
      debugging_json,
      visualize_luminosity,
    } = this.state;
    const { jsons } = this.props;
    let json_list = jsons.jsons;
    return (
      <div className="container">
        <Menu
          onClick={this.changeTab}
          selectedKeys={[selected_tab]}
          mode="horizontal"
        >
          <Menu.Item key="by_email">
            <MailOutlined />
            My JSONs
          </Menu.Item>
          <Menu.Item key="all">
            <AppstoreOutlined />
            All JSONs
          </Menu.Item>
          <Menu.Item key="official">
            <AppstoreOutlined />
            Official JSONs
          </Menu.Item>
        </Menu>
        <br />
        <br />
        {loading ? (
          'loading...'
        ) : (
          <JsonList
            jsons={json_list}
            category={selected_tab}
            selected_json={selected_json}
            fetchMoreJsons={this.fetchMoreJsons}
            selectJson={this.selectJson}
            toggleDebugging={this.toggleDebugging}
            toggleVisualizeLuminosity={this.toggleVisualizeLuminosity}
            fetchJson={this.fetchJsons}
          />
        )}
        {debugging_json && (
          <DebuggingJson selected_json={selected_json} jsons={json_list} />
        )}
        {visualize_luminosity && (
          <div>
            <SubystemDivision selected_json={selected_json} />
            {/* <VisualizeLuminosity selected_json={selected_json} /> */}
          </div>
        )}
        <style jsx>{`
          .container {
            padding: 10px;
            margin-top: 10px;
            margin-left: 30px;
            margin-right: 30px;
            background-color: white;
            border: 1px solid white;
            border-radius: 10px;
          }
        `}</style>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    selected_json: state.json.ui.selected_json,
    jsons: state.json.jsons,
  };
};
export default connect(mapStateToProps, {
  selectJson,
  getJsons,
  updateProgress,
  fetchMoreJsons,
})(JsonPortal);
