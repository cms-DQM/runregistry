const { Workspace, WorkspaceColumn } = require('../models');

exports.getAll = async (req, res) => {
    const { online_or_offline } = req.params;
    let workspaces = await Workspace.findAll({
        order: [['workspace', 'ASC']],
        include: [
            {
                model: WorkspaceColumn,
                as: 'columns'
            }
        ],
        where: {
            online_or_offline
        }
    });
    // Front end will need the id of each column, and it will also need the name of the column
    workspaces = workspaces.map(workspace => {
        workspace.dataValues.columns_with_id = [
            ...workspace.dataValues.columns
        ];
        workspace.dataValues.columns = workspace.dataValues.columns.map(
            ({ name }) => name
        );
        return workspace.dataValues;
    });
    res.json(workspaces);
};

exports.addColumnToWorkspace = async (req, res) => {
    const workspace = await Workspace.findOne({
        where: {
            workspace: req.body.workspace
        }
    });
    workspace.columns.push(req.body.column);
    const updated_workspace = await workspace.update(workspace);
    res.json(updated_workspace);
};

exports.deleteColumnFromWorkspace = async (req, res) => {
    const workspace = await Workspace.findOne({
        where: {
            workspace: req.body.workspace
        }
    });

    workspace.columns = workspace.columns.filter(column => {
        return column !== req.body.column;
    });
    const updated_workspace = await workspace.update(workspace);
    res.json(updated_workspace);
};
