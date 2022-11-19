module.exports = (sequelize, DataTypes) => {
  const ClassClassifier = sequelize.define(
    'ClassClassifier',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      class: { type: DataTypes.STRING, allowNull: false },
      classifier: { type: DataTypes.JSONB, allowNull: false },
      priority: { type: DataTypes.INTEGER, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false },
      created_by: { type: DataTypes.TEXT, allowNull: true },
      updated_by: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      // the RR DB was created and filled only with createdAt field. But for the operation we need updatedAt instead, actually. 
      // So, we alias updatedAt as createdAt for sequelize that will update it properly.
      createdAt: false,
      updatedAt: 'createdAt',
      name: {
        singular: 'ClassClassifier',
        plural: 'ClassClassifier',
      },
    }
  );
  ClassClassifier.associate = function (models) {
    ClassClassifier.belongsToMany(models.ClassClassifierList, {
      through: models.ClassClassifierEntries,
      foreignKey: 'id',
      otherKey: 'CCL_id',
    });
  };
  return ClassClassifier;
};
