const Sequelize = require('sequelize');

const sequelize = require('../utils/database');

const Role = sequelize.define('Role',{
   id:{
    type:Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
   },
   role:{
    type:Sequelize.STRING,
    required:true
},

});

module.exports = Role;