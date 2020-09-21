const Settings = require('../models').Settings;
const { getMaxIdPlusOne } = require('../utils/model_tools');

const include_conditions = (List, max_settings_id) => [
  {
    model: List,
    required: true,
    include: [
      {
        model: Settings,
        required: true,
        where: {
          id: max_settings_id,
        },
      },
    ],
  },
];
// This will join the Item with the Setting configuration of higher ID (the current one).
exports.findAllItems = async (List, Item) => {
  const max_settings_id = await Settings.max('id');
  return await Item.findAll({
    include: include_conditions(List, max_settings_id),
  });
};

// This will join the Item with the Setting configuration of higher ID (the current one).
exports.findAllItemsFiltered = async (List, Item, conditions, include) => {
  const max_settings_id = await Settings.max('id');
  if (!include) {
    include = [];
  }
  return await Item.findAll({
    ...conditions,
    include: include.concat(include_conditions(List, max_settings_id)),
  });
};

exports.findAllItemsWithInclude = async (List, Item, include) => {
  if (!include) {
    include = [];
  }
  const max_settings_id = await Settings.max('id');
  return await Item.findAll({
    include: include.concat(include_conditions(List, max_settings_id)),
  });
};

exports.findOneItem = async (List, Item, conditions) => {
  const max_settings_id = await Settings.max('id');
  return await Item.findOne({
    ...conditions,
    include: include_conditions(List, max_settings_id),
  });
};

// generateNewItem, generateNewList, getCurrentEntries, generateNewEntries and generateNewSettings are all helpers of the CUD (CREATE UPDATE or DELETE) operations down below

const generateNewItem = async (Item, data) => {
  const new_item = await Item.build({
    ...data,
    id: await getMaxIdPlusOne(Item),
  }).save();
  return new_item;
};

const generateNewList = async (List) => {
  const new_item_list = await List.build({
    id: await getMaxIdPlusOne(List),
  }).save();
  return new_item_list;
};

const getCurrentEntries = async (Entries, id) => {
  const current_id_version = await Entries.max(id);
  const current_item_entries = await Entries.findAll({
    where: {
      [id]: current_id_version || 0,
    },
  });
  return current_item_entries;
};

const generateNewEntries = (current_item_entries, new_item_list, id) => {
  const new_item_entries = current_item_entries.map((entry) => {
    return { [id]: new_item_list.id, id: entry.id };
  });
  return new_item_entries;
};

const generateNewSettings = async (id, new_classifier_list, by) => {
  const current_settings_id = await Settings.max('id');
  const current_settings = await Settings.findByPk(current_settings_id);
  const new_settings = await Settings.build({
    ...current_settings.dataValues,
    id: await getMaxIdPlusOne(Settings),
    [id]: new_classifier_list.id,
    metadata: { by },
  }).save();
  return new_settings;
};

// CUD (CREATE UPDATE OR DELETE) opeartions for version controlled entities:

// This is the standard way of adding a new item to a version controlled Entity
exports.saveNewItem = async (
  ItemList,
  ItemEntries,
  Item,
  id,
  new_item_data,
  author
) => {
  const new_item = await generateNewItem(Item, new_item_data);

  const new_item_list = await generateNewList(ItemList);
  const current_item_entries = await getCurrentEntries(ItemEntries, id);
  const new_item_entries = generateNewEntries(
    current_item_entries,
    new_item_list,
    id
  );

  // We add the new entry:
  new_item_entries.push({
    [id]: new_item_list.id,
    id: new_item.id,
  });
  await ItemEntries.bulkCreate(new_item_entries);

  await generateNewSettings(id, new_item_list, author);
  return new_item;
};

exports.editItem = async (
  ItemList,
  ItemEntries,
  Item,
  id,
  new_item_data,
  old_item_id,
  author
) => {
  const new_item = await generateNewItem(Item, new_item_data);

  const new_item_list = await generateNewList(ItemList);
  const current_item_entries = await getCurrentEntries(ItemEntries, id);
  let new_item_entries = generateNewEntries(
    current_item_entries,
    new_item_list,
    id
  );

  // If the item was edited, we don't want it duplicated,
  new_item_entries = new_item_entries.filter(
    (item_entry) => +old_item_id !== item_entry.id
  );
  // We add the new entry:
  new_item_entries.push({
    [id]: new_item_list.id,
    id: new_item.id,
  });
  await ItemEntries.bulkCreate(new_item_entries);

  await generateNewSettings(id, new_item_list, author);
  return new_item;
};

exports.deleteItem = async (
  ItemList,
  ItemEntries,
  Item,
  id,
  old_item_id,
  author
) => {
  const deleted_item = await Item.findByPk(old_item_id);
  if (deleted_item === null) {
    throw 'Item trying to delete does not exists';
  }
  const new_item_list = await generateNewList(ItemList);
  const current_item_entries = await getCurrentEntries(ItemEntries, id);
  let new_item_entries = generateNewEntries(
    current_item_entries,
    new_item_list,
    id
  );
  // If the item is deleted, we don't want it to be added to the next set of entries
  new_item_entries = new_item_entries.filter(
    (item_entry) => +old_item_id !== item_entry.id
  );
  await ItemEntries.bulkCreate(new_item_entries);
  await generateNewSettings(id, new_item_list, author);
  return deleted_item;
};
