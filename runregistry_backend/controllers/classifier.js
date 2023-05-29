const {
  findAllItems,
  findAllItemsFiltered,
  findAllItemsWithInclude,
  saveNewItem,
  editItem,
  deleteItem,
} = require('./version_tracking_helpers');

const {
  ClassClassifier,
  ClassClassifierEntries,
  ClassClassifierList,

  ComponentClassifier,
  ComponentClassifierEntries,
  ComponentClassifierList,

  DatasetClassifier,
  DatasetClassifierEntries,
  DatasetClassifierList,

  OfflineDatasetClassifier,
  OfflineDatasetClassifierEntries,
  OfflineDatasetClassifierList,

  JsonClassifier,
  JsonClassifierEntries,
  JsonClassifierList,

  Workspace,
  WorkspaceColumn,
} = require('../models');

// Allows us to set the Classifier dynamically
const ClassifierTypes = {
  class: {
    Classifier: ClassClassifier,
    Entries: ClassClassifierEntries,
    List: ClassClassifierList,
    id: 'CCL_id',
  },
  component: {
    Classifier: ComponentClassifier,
    Entries: ComponentClassifierEntries,
    List: ComponentClassifierList,
    id: 'CPCL_id',
  },
  dataset: {
    Classifier: DatasetClassifier,
    Entries: DatasetClassifierEntries,
    List: DatasetClassifierList,
    id: 'DCL_id',
  },
  offline_dataset: {
    Classifier: OfflineDatasetClassifier,
    Entries: OfflineDatasetClassifierEntries,
    List: OfflineDatasetClassifierList,
    id: 'ODCL_id',
  },
  json_classifier: {
    Classifier: JsonClassifier,
    Entries: JsonClassifierEntries,
    List: JsonClassifierList,
    id: 'JCL_id',
  },
};

exports.getClassifiers = async (req, res) => {
  const { category } = req.params;
  const { Classifier, List } = ClassifierTypes[category];

  // This will join the Classifiers with the Setting configuration of higher ID (the current one).
  let classifiers = await findAllItems(List, Classifier);
  // We convert the classifier into a string:
  classifiers = classifiers.map(({ dataValues }) => ({
    ...dataValues,
    classifier: JSON.stringify(dataValues.classifier),
  }));
  res.json(classifiers);
};

exports.getComponentClassifiers = async (req, res) => {
  const { online_or_offline } = req.params;
  if (online_or_offline !== 'online' && online_or_offline !== 'offline') {
    throw 'component classifiers must be either online or offline';
  }
  // This will join the Classifiers with the Setting configuration of higher ID (the current one).
  let classifiers = await findAllItemsFiltered(
    ComponentClassifierList,
    ComponentClassifier,
    {},
    [
      {
        model: WorkspaceColumn,
        include: [
          {
            model: Workspace,
          },
        ],
      },
    ]
  );
  classifiers = classifiers.filter(({ WorkspaceColumn }) => {
    const { Workspace } = WorkspaceColumn;
    return Workspace.online_or_offline === online_or_offline;
  });
  classifiers = classifiers.map((classifier) => {
    classifier.classifier = JSON.stringify(classifier.classifier);
    return classifier;
  });

  res.json(classifiers);
};

exports.getClassifiersFiltered = async (req, res) => {
  const { category, component } = req.params;
  const { Classifier, List } = ClassifierTypes[category];
  let classifiers = await findAllItemsFiltered(List, Classifier, {
    where: {
      component: +component,
    },
    include: [
      {
        model: WorkspaceColumn,
        include: [{ model: Workspace }],
      },
    ],
  });
  classifiers = classifiers.map((classifier) => {
    classifier.classifier = JSON.stringify(classifier.classifier);
    return classifier;
  });
  res.json(classifiers);
};

exports.new = async (req, res) => {
  console.log( "classifier.js # new(): start");
  const { category } = req.params;
  const new_classifier_data = { ...req.body, created_by: req.headers.email };
  const { Classifier, Entries, List, id } = ClassifierTypes[category];

  const new_classifier = await saveNewItem(
    List,
    Entries,
    Classifier,
    id,
    new_classifier_data,
    req.get('email')
  );
  new_classifier.classifier = JSON.stringify(new_classifier.classifier);
  res.json(new_classifier);

  console.log( "classifier.js # new():", new_classifier );
};

exports.edit = async (req, res) => {
  console.log( "classifier.js # edit(): start" );
  const { category, classifier_id } = req.params;
  const new_classifier_data = { ...req.body, updated_by: req.headers.email };
  const { Classifier, Entries, List, id } = ClassifierTypes[category];

  const edited_classifier = await editItem(
    List,
    Entries,
    Classifier,
    id,
    new_classifier_data,
    classifier_id,
    req.get('email')
  );
  edited_classifier.classifier = JSON.stringify(edited_classifier.classifier);
  res.json(edited_classifier);

  console.log( "classifier.js # edit():", edited_classifier );
};

exports.delete = async (req, res) => {
  console.log( "classifier.js # delete(): start" );
  const { category, classifier_id } = req.params;
  const { Classifier, Entries, List, id } = ClassifierTypes[category];
  const deleted_classifier = await deleteItem(
    List,
    Entries,
    Classifier,
    id,
    classifier_id,
    req.get('email')
  );
  res.json(deleted_classifier);

  console.log( "classifier.js # delete:", deleted_classifier );
};

exports.edit_json_classifier = async (req, res) => {
  const email = req.get('email');
  const egroups = req.get('egroups');
  const new_classifier_data = req.body;
  if (
    email !== new_classifier_data.created_by &&
    !egroups.includes('cms-dqm-runregistry-experts')
  ) {
    throw `To edit this classifier you must be the creator (${new_classifier_data.created_by}) or be part of cms-dqm-runregistry-experts e-group`;
  }
  exports.edit(req, res);
};

exports.delete_json_classifier = async (req, res) => {
  const email = req.get('email');
  const egroups = req.get('egroups');
  const new_classifier_data = req.body;
  if (
    email !== new_classifier_data.created_by &&
    !egroups.includes('cms-dqm-runregistry-experts')
  ) {
    throw `To delete this classifier you must be the creator (${new_classifier_data.created_by}) or be part of cms-dqm-runregistry-experts e-group`;
  }
  exports.delete(req, res);
};
