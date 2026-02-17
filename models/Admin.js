const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Role = require('./Roles'); // Check the import path
 // Check the import path

 const Rights = sequelize.define('Right',{
    id:{
        type:Sequelize.INTEGER,
        required:true,
        autoIncrement: true,
        primaryKey: true
    },
    name:{
        type:Sequelize.STRING,
        required:true
    }
});



module.exports = Rights;

const Admin = sequelize.define('Admin', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    }
});

// Association with Role model
Admin.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(Admin, { foreignKey: 'roleId' });

// Association with Rights model (many-to-many)
Admin.belongsToMany(Rights, { through: 'AdminRights' });
Rights.belongsToMany(Admin, { through: 'AdminRights' });
module.exports = Admin;

