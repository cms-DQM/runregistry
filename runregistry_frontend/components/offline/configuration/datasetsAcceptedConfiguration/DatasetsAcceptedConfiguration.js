import React, { Component } from 'react';
import { connect } from 'react-redux';
import ReactTable from 'react-table';
import { Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Swal from 'sweetalert2';
import {
  fetchDatasetsAccepted,
  addRegexp,
  editRegexp,
  removeRegexp
} from '../../../../ducks/offline/datasets_accepted';
import RegexpEditor from './regexpEditor/RegexpEditor';

const default_page_size = 10;

class DatasetsAcceptedConfiguration extends Component {
  state = { add: false, edit: false };

  componentDidMount() {
    this.props.fetchDatasetsAccepted();
  }
  addRegexp = async values => {
    await this.props.addRegexp(values);
    this.setState({ add: false });
    await Swal('Criteria successfully added', '', 'success');
  };

  removeRegexp = async id_dataset_accepted => {
    console.log(id_dataset_accepted);
    const { value } = await Swal({
      type: 'warning',
      title: `Are you sure you want to delete this criteria?`,
      text: '',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      reverseButtons: true,
      footer: '<a >What does this mean?</a>'
    });
    if (value) {
      await this.props.removeRegexp(id_dataset_accepted);
      await Swal('Criteria deleted', '', 'success');
    }
  };

  editRegexp = async values => {
    await this.props.editRegexp(values);
    this.setState({ edit: false });
    await Swal('Criteria successfully edited', '', 'success');
  };

  render() {
    const { datasets_accepted } = this.props;
    const { add, edit } = this.state;
    const columns = [
      {
        Header: 'Class',
        accessor: 'class',
        width: 280
      },
      {
        Header: 'Name',
        accessor: 'name',
        width: 280
      },
      {
        Header: 'Regular Expression',
        accessor: 'regexp',
        width: 1100
      },
      {
        Header: 'Run Number from ',
        accessor: 'run_from',
        width: 100
      },
      {
        Header: 'Run Number to',
        accessor: 'run_to',
        width: 100
      },
      {
        Header: 'Enabled',
        accessor: 'enabled',
        width: 100,
        Cell: row => (
          <div style={{ textAlign: 'center' }}>
            {row.value ? (
              <CheckCircleOutlined
                style={{
                  fontSize: 15,
                  margin: '0 auto',
                  color: 'green'
                }}
              />
            ) : (
              <CloseCircleOutlined
                style={{
                  fontSize: 15,
                  margin: '0 auto',
                  color: 'red'
                }}
              />
            )}
          </div>
        )
      },
      { Header: 'Updated at', accessor: 'createdAt', width: 100 },
      {
        Header: 'Edit',
        width: 100,
        Cell: row => (
          <div style={{ textAlign: 'center' }}>
            <a
              onClick={() => {
                this.setState({
                  edit: row.original,
                  add: false
                });
              }}
            >
              Edit
            </a>
          </div>
        )
      },
      {
        Header: 'Delete',
        width: 100,
        Cell: row => (
          <div style={{ textAlign: 'center' }}>
            <a onClick={() => this.removeRegexp(row.original.id)}>Delete</a>
          </div>
        )
      }
    ];
    console.log(datasets_accepted);
    return (
      <div>
        <p>
          Current Datasets Accepted (Regular Expressions) - Ordered by enabled
          first:
        </p>
        <ReactTable
          columns={columns}
          data={datasets_accepted.sort((a, b) =>
            // Sort by enabled and then by the one which was updated most recently
            b.enabled === a.enabled
              ? new Date(b.updatedAt) - new Date(a.updatedAt)
              : b.enabled - a.enabled
          )}
          defaultPageSize={default_page_size}
          showPagination={datasets_accepted.length > default_page_size}
          optionClassName="react-table"
        />
        <br />
        <div className="classsifier_button">
          <Button
            type="primary"
            onClick={() => this.setState({ add: true, edit: false })}
          >
            Add new Regular Expression
          </Button>
        </div>
        {add && (
          <RegexpEditor
            cancel={() => this.setState({ add: false })}
            submit={this.addRegexp}
          />
        )}
        {edit && (
          <RegexpEditor
            cancel={() => this.setState({ edit: false })}
            editing={edit}
            submit={this.editRegexp}
          />
        )}
      </div>
    );
  }
}

const mapStateToProps = state => {
  return {
    datasets_accepted: state.offline.datasets_accepted
  };
};

export default connect(mapStateToProps, {
  fetchDatasetsAccepted,
  addRegexp,
  editRegexp,
  removeRegexp
})(DatasetsAcceptedConfiguration);
