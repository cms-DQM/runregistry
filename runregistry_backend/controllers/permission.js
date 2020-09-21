const Permission = require('../models').Permission;
const PermissionEntries = require('../models').PermissionEntries;
const PermissionList = require('../models').PermissionList;
const {
    findAllItems,
    findOneItem,
    saveNewItem,
    editItem,
    deleteItem
} = require('./version_tracking_helpers');

const id = 'PL_id';

// getAll and getAllPermissions are separated due to the use in ./auth/authenticate.
exports.getAll = async (req, res) => {
    const permissions = await getAllPermissions();
    res.json(permissions);
};

exports.getAllPermissions = async () => {
    const permissions = await findAllItems(PermissionList, Permission);
    return permissions;
};

exports.addEgroup = async (req, res) => {
    const new_permission_data = req.body;

    const new_permission = await saveNewItem(
        PermissionList,
        PermissionEntries,
        Permission,
        id,
        new_permission_data,
        req.get('email')
    );

    res.json(new_permission);
};

exports.deleteEgroup = async (req, res) => {
    const { egroup_id } = req.params;
    const deleted_egroup = await deleteItem(
        PermissionList,
        PermissionEntries,
        Permission,
        id,
        egroup_id,
        req.get('email')
    );

    res.json(deleted_egroup);
};

exports.addPermissionToEgroup = async (req, res) => {
    const permission = await findOneItem(PermissionList, Permission, {
        where: { egroup: req.body.egroup }
    });
    permission.dataValues.routes.push(req.body.action);

    const edited_permission = await editItem(
        PermissionList,
        PermissionEntries,
        Permission,
        id,
        permission.dataValues,
        permission.dataValues.id,
        req.get('email')
    );

    res.json(edited_permission);
};
exports.deletePermissionToEgroup = async (req, res) => {
    const permission = await findOneItem(PermissionList, Permission, {
        where: { egroup: req.body.egroup }
    });

    permission.dataValues.routes = permission.routes.filter(route => {
        return route !== req.body.route;
    });

    const updated_permission = await editItem(
        PermissionList,
        PermissionEntries,
        Permission,
        id,
        permission.dataValues,
        permission.dataValues.id,
        req.get('email')
    );

    res.json(updated_permission);
};
