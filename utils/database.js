const Sequelize = require('sequelize');

const PWD="Germany.1D@y";
// const PWD="alisher.1";

const sequelize = new Sequelize("LMSystem", "root", PWD,{
    dialect:'mysql',
    host:'localhost',
    logging:false
});

module.exports = sequelize;