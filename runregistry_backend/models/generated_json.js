module.exports = (sequelize, DataTypes) => {
  const GeneratedJson = sequelize.define(
    'GeneratedJson',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      dataset_name_filter: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      tags: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      official: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      runregistry_version: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      json_logic: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      generated_json: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      generated_json_with_dataset_names: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      generated_anti_json: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      generated_anti_json_with_dataset_names: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      min_run_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      max_run_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      total_delivered_luminosity: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      total_recorded_luminosity: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      recorded_luminosity_in_json: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      delivered_luminosity_in_json: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      total_recorded_luminosity_lost: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      total_delivered_luminosity_lost: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      total_recorded_luminosity_from_run_range: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      total_delivered_luminosity_from_run_range: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      rules_flagged_false_quantity_luminosity: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      rules_flagged_false_combination_luminosity: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      runs_lumisections_responsible_for_rule: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      name: {
        singular: 'GeneratedJson',
        plural: 'GeneratedJson',
      },
    }
  );

  return GeneratedJson;
};
