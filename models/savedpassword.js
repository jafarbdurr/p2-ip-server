'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SavedPassword extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SavedPassword.belongsTo(models.User,{
        foreignKey : "userId"
      })
    }
  }
  SavedPassword.init({
    name: DataTypes.STRING,
    password: DataTypes.STRING,
    reminder: DataTypes.BOOLEAN,
    userId: DataTypes.INTEGER,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'SavedPassword',
  });
  return SavedPassword;
};