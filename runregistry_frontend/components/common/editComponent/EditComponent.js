import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Formik, Field } from 'formik';
import { Input, Button, InputNumber } from 'antd';
import Swal from 'sweetalert2';
import { reFetchDataset } from '../../../ducks/offline/datasets';
import { reFetchRun } from '../../../ducks/online/runs';
import BarPlot from './BarPlot';
import History from './History';
import DisplayComments from './DisplayComments';
const { TextArea } = Input;

class EditComponent extends Component {
  constructor(props) {
    super(props);
    let { lumisection_ranges } = this.props;
    lumisection_ranges = lumisection_ranges || [];
    const ls_ranges_lengths = { title: 'LS' };
    lumisection_ranges.forEach((range) => {
      const { start, end } = range;
      ls_ranges_lengths[`${start} - ${end}`] = end - start + 1;
    });

    this.state = {
      modifying: false,
      show_history: false,
      loading_submit: false,
      ls_ranges_lengths: [ls_ranges_lengths],
      lumisection_ranges,
    };
  }
  render() {
    const {
      run_number,
      dataset_name,
      component,
      state,
      component_name,
      hide_cause,
      boolean_statuses,
      show_oms_history,
    } = this.props;
    const {
      modifying,
      show_history,
      lumisection_ranges,
      ls_ranges_lengths,
      loading_submit,
    } = this.state;
    const number_of_lumisections = lumisection_ranges[
      lumisection_ranges.length - 1
    ]
      ? lumisection_ranges[lumisection_ranges.length - 1].end
      : 0;
    const initialValues = {
      start: number_of_lumisections === 0 ? 0 : 1,
      end: number_of_lumisections,
    };
    const lumisections_with_comments = lumisection_ranges.filter(
      ({ comment }) => typeof comment !== 'undefined' && comment.length > 0
    );
    return (
      <tr>
        <td>{component_name ? component_name : component}</td>
        <td className="comment">
          {show_history ? (
            <div>
              <History
                run_number={run_number}
                dataset_name={dataset_name}
                component={component}
                number_of_lumisections={number_of_lumisections}
                show_oms_history={show_oms_history}
              />
              <br />
              {dataset_name === 'online' && (
                <center>
                  Changes done manually to the Lumisections have priority over
                  automatic (auto@auto) changes, therefore they (the manual
                  ones) will always be applied after all the automatic changes
                  have been applied (even if the automatic changes happen after
                  the manual ones).
                </center>
              )}
            </div>
          ) : (
            <div>
              <BarPlot
                ls_ranges_lengths={ls_ranges_lengths}
                lumisection_ranges={lumisection_ranges}
              />
              {lumisections_with_comments.length > 0 && (
                <div>
                  <h4>Comments:</h4>
                  <DisplayComments
                    lumisections_with_comments={lumisections_with_comments}
                    label_width={42}
                  />
                </div>
              )}
            </div>
          )}
          {modifying && (
            <Formik
              initialValues={initialValues}
              enableReinitialize={true}
              onSubmit={async (form_values) => {
                try {
                  this.setState({ loading_submit: true });
                  const { run_number, dataset_name } = this.props;
                  let component_triplet_name = component;
                  await this.props.addLumisectionRange(
                    form_values,
                    run_number,
                    dataset_name,
                    component_triplet_name
                  );
                  await this.props.refreshLumisections();
                  if (dataset_name === 'online') {
                    await this.props.reFetchRun(run_number);
                  } else {
                    await this.props.reFetchDataset(run_number, dataset_name);
                  }
                  this.setState({ loading_submit: false });
                  await Swal(`Component edited successfully`, '', 'success');
                } catch (err) {
                  this.setState({ loading_submit: false });
                  throw err;
                }
              }}
              render={({
                values,
                setFieldValue,
                errors,
                touched,
                handleChange,
                handleBlur,
                handleSubmit,
                isSubmitting,
              }) => {
                const { status, start, end } = values;
                const status_values = [
                  <option value="GOOD">GOOD</option>,
                  <option value="BAD">BAD</option>,
                  <option value="STANDBY">STANDBY</option>,
                  <option value="EXCLUDED">EXCLUDED</option>,
                  <option value="NOTSET">NOTSET</option>,
                ];
                const boolean_values = [
                  <option value="true">true</option>,
                  <option value="false">false</option>,
                ];
                return (
                  <form>
                    <hr />
                    <br />
                    <h3>Edit Lumisections</h3>
                    <br />
                    <center>
                      <i>Change status to: </i>
                      <Field component="select" name="status">
                        <option value="">-----</option>
                        {boolean_statuses ? boolean_values : status_values}
                      </Field>
                      <br />
                      {!hide_cause && (
                        <div>
                          <br />
                          <i>Cause: </i>
                          <Field
                            key={component}
                            component="select"
                            name="cause"
                            disabled
                          />
                          <br />
                        </div>
                      )}
                      <br />
                      <i>From Lumisection: </i>
                      <InputNumber
                        name="end"
                        value={start}
                        min={1}
                        max={number_of_lumisections}
                        defaultValue={1}
                        onChange={(value) => setFieldValue('start', value)}
                      />{' '}
                      &nbsp; <i>To Lumisection: </i>
                      <InputNumber
                        name="start"
                        value={end}
                        min={1}
                        max={number_of_lumisections}
                        defaultValue={number_of_lumisections}
                        onChange={(value) => setFieldValue('end', value)}
                      />
                      <br />
                      <br />
                      <i>Comment: </i>
                      <div className="text_area">
                        <TextArea
                          name="comment"
                          onChange={(value) =>
                            setFieldValue('comment', value.target.value)
                          }
                        />
                      </div>
                      <br />
                      <div className="submit">
                        <Button
                          type="primary"
                          onClick={handleSubmit}
                          loading={loading_submit}
                        >
                          Modify
                        </Button>
                      </div>
                    </center>
                  </form>
                );
              }}
            />
          )}
        </td>
        <td className="modify_toggle">
          {modifying ? (
            <div>
              <Button
                onClick={() =>
                  this.setState({
                    modifying: false,
                  })
                }
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              onClick={() =>
                this.setState({
                  modifying: true,
                })
              }
              disabled={state !== 'OPEN'}
            >
              {state === 'OPEN'
                ? 'Modify'
                : 'State should be OPEN to modify components'}
            </Button>
          )}
        </td>
        <td className="history_toggle">
          {show_history ? (
            <div>
              <Button onClick={() => this.setState({ show_history: false })}>
                Hide history
              </Button>
            </div>
          ) : (
            <Button onClick={() => this.setState({ show_history: true })}>
              Show History
            </Button>
          )}
        </td>
        <style jsx>{`
          h3 {
            text-decoration: underline;
          }
          form {
            margin-top: 10px;
          }
          tr > td {
            padding: 8px 5px;
          }
          tr:not(:last-child) {
            border-bottom: 1px solid grey;
          }

          tr > td :not(:last-child) {
            border-right: 0.5px solid grey;
          }

          th {
            text-align: center;
          }

          th > td:not(:last-child) {
            border-right: 0.5px solid grey;
            padding-right: 5px;
          }
          .comment {
            width: 800px;
          }
          .lumisection_slider {
            width: 200px;
          }
          .modify_toggle {
            width: 180px;
          }

          .buttons {
            display: flex;
            justify-content: flex-end;
          }
          .submit {
            text-align: center;
          }

          .text_area {
            width: 80%;
          }
        `}</style>
      </tr>
    );
  }
}

export default connect(null, {
  reFetchDataset,
  reFetchRun,
})(EditComponent);
