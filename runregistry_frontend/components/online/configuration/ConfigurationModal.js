import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Modal, Button } from 'antd';
import { hideConfigurationModal } from '../../../ducks/online/ui';
import { hideJsonEditor } from '../../../ducks/classifier_editor';
import ClassClassifierConfiguration from './classClassifierConfiguration/ClassClassifierConfiguration';
import DatasetClassifierConfiguration from './datasetClassifierConfiguration/DatasetClassifierConfiguration';
import ComponentClassifierConfiguration from '../../common/componentClassifierConfiguration/ComponentClassifierConfiguration';

// For component classifier:
import {
    fetchComponentClassifiers,
    deleteComponentClassifier,
    editComponentClassifier,
    newComponentClassifier
} from '../../../ducks/online/classifiers/component';
class ConfigurationModal extends Component {
    render() {
        const {
            configuration_modal_visible,
            hideConfigurationModal,
            hideJsonEditor,
            children,
            configuration_modal_type
        } = this.props;
        const {
            fetchComponentClassifiers,
            deleteComponentClassifier,
            editComponentClassifier,
            newComponentClassifier
        } = this.props;
        const title_options = {
            class_classifiers:
                'Set automatic classifiers for class of run selection',
            dataset_classifiers:
                'Set automatic classifiers for datasets considered significant',
            component_classifiers:
                "Set automatic classifiers for each component's status"
        };

        return (
            <div>
                <Modal
                    title={title_options[configuration_modal_type]}
                    open={configuration_modal_visible}
                    onOk={hideConfigurationModal}
                    onCancel={
                        hideConfigurationModal // confirmLoading={confirmLoading}
                    }
                    footer={[
                        <Button key="submit" onClick={hideConfigurationModal}>
                            Close
                        </Button>
                    ]}
                    width="90vw"
                    maskClosable={false}
                    destroyOnClose={true}
                    afterClose={hideJsonEditor}
                >
                    {configuration_modal_type === 'class_classifiers' && (
                        <ClassClassifierConfiguration />
                    )}
                    {configuration_modal_type === 'dataset_classifiers' && (
                        <DatasetClassifierConfiguration />
                    )}
                    {configuration_modal_type === 'component_classifiers' && (
                        <ComponentClassifierConfiguration
                            online_or_offline="online"
                            fetchComponentClassifiers={
                                fetchComponentClassifiers
                            }
                            deleteComponentClassifier={
                                deleteComponentClassifier
                            }
                            editComponentClassifier={editComponentClassifier}
                            newComponentClassifier={newComponentClassifier}
                        />
                    )}
                </Modal>
            </div>
        );
    }
}

const mapStateToProps = state => {
    return {
        configuration_modal_visible:
            state.online.ui.configuration_modal_visible,
        configuration_modal_type: state.online.ui.configuration_modal_type
    };
};
export default connect(
    mapStateToProps,
    {
        hideConfigurationModal,
        hideJsonEditor,
        fetchComponentClassifiers,
        deleteComponentClassifier,
        editComponentClassifier,
        newComponentClassifier
    }
)(ConfigurationModal);
