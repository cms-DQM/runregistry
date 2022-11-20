import React, { Component } from 'react';
import axios from 'axios';
import { Timeline, Button } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { error_handler } from '../../utils/error_handlers';
import { api_url } from '../../config/config';
import Event from './event/Event';

import { Space, Table, Tag } from 'antd';
const { Column, ColumnGroup } = Table;

const columns = [
  {
    title: 'Time',
    dataIndex: 'createdAt',
    key: 'createdAt',
  },
  {
    title: 'Author',
    dataIndex: 'by',
    key: 'by',
  },
  {
    title: 'Comment',
    dataIndex: 'comment',
    key: 'comment',
  },
];

const INITIAL_PAGE_SIZE = 100;
class LogViewer extends Component {
  state = {
    versions: [],
    page: 0,
    pages: 0,
    count: 0
  };

  componentDidMount = () => this.fetchVersions(0);

  fetchVersions = error_handler(async page => {
    const { data } = await axios.post(`${api_url}/versions/get_versions`, {
      page,
      page_size: INITIAL_PAGE_SIZE
    });

    const { versions, pages, count } = data;
    this.setState({
      versions: [...this.state.versions, ...versions],
      pages,
      count,
      page
    });
  });

  /// TODO fix this when figure out when we have RunEvent !== null etc
  generateComment = event => {
    let {
      version,
      comment,
      by,
      createdAt,
      RunEvent,
      DatasetEvent,
      LumisectionEvent,
      OMSLumisectionEvent
    } = event;
    if (RunEvent !== null && typeof RunEvent !== 'undefined' ) {
      comment += " RunEvent";
    }
    if (DatasetEvent !== null && typeof RunEvent !== 'undefined') {
      comment += " DatasetEvent";
    }
    if (LumisectionEvent !== null && typeof RunEvent !== 'undefined') {
      comment += " LumisectionEvent";
    }
    if (OMSLumisectionEvent !== null && typeof RunEvent !== 'undefined') {
      comment += " OMSLumisectionEvent";
    }
    return {createdAt, by, comment};
  };

  render() {
    return (
      <div>
        <center>
          <h1>Log of versions in Run Registry</h1>
        </center>
        <br />
        <div>

        <Table columns={columns} dataSource={ this.state.versions.map(event => this.generateComment(event)) } />;


        </div>
        <center>
          <Button onClick={() => this.fetchVersions(this.state.page + 1)}>
            Load more...
          </Button>
        </center>
      </div>
    );
  }
}

export default LogViewer;
