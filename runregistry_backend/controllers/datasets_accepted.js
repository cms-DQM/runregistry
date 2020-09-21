const DatasetsAccepted = require('../models').DatasetsAccepted;
const DatasetsAcceptedEntries = require('../models').DatasetsAcceptedEntries;
const DatasetsAcceptedList = require('../models').DatasetsAcceptedList;
const {
  findAllItems,
  findAllItemsFiltered,
  saveNewItem,
  editItem,
} = require('./version_tracking_helpers');

// Still missing to be changed to versioned items
const getMaxIdPlusOne = require('../utils/model_tools').getMaxIdPlusOne;

const id = 'DAL_id';

exports.getAll = async (req, res) => {
  const datasets_accepted = await findAllItems(
    DatasetsAcceptedList,
    DatasetsAccepted
  );
  res.json(datasets_accepted);
};

exports.getAllByClass = async (req, res) => {
  const datasets_accepted_by_class = await findAllItemsFiltered(
    DatasetsAcceptedList,
    DatasetsAccepted,
    {
      where: { class: req.params.class },
    }
  );
  res.json(datasets_accepted_by_class);
};

exports.new = async (req, res) => {
  const new_datasets_accepted_data = req.body;
  const new_datasets_accepted = await saveNewItem(
    DatasetsAcceptedList,
    DatasetsAcceptedEntries,
    DatasetsAccepted,
    id,
    new_datasets_accepted_data,
    req.get('email')
  );
  res.json(new_datasets_accepted);
};

exports.edit = async (req, res) => {
  const new_datasets_accepted_data = req.body;
  const { id_dataset_accepted } = req.params;
  const edited_datasets_accepted = await editItem(
    DatasetsAcceptedList,
    DatasetsAcceptedEntries,
    DatasetsAccepted,
    id,
    new_datasets_accepted_data,
    id_dataset_accepted,
    req.get('email')
  );
  res.json(edited_datasets_accepted);
};
exports.delete = async (req, res) => {
  const { id_dataset_accepted } = req.params;
  const deleted_dataset_accepted = await deleteItem(
    DatasetsAcceptedList,
    DatasetsAcceptedEntries,
    DatasetsAccepted,
    id,
    id_dataset_accepted,
    req.get('email')
  );

  res.json(deleted_dataset_accepted);
};
