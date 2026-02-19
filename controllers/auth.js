const { validationResult } = require("express-validator");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");

exports.signup= (req,res,next)=>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Validation failed.');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }
    const username = req.body.username;
    const name = req.body.name;
    const password = req.body.password;
    const role = req.body.role;
    console.log("username:",username);
    bcrypt.hash(password,12)
    .then(hashPwd=>{
        const user = new Admin({
            username:username,
            name:name,
            password:hashPwd,
            RoleId:role
        });
        return user.save();
    })
    .then(result=>{
        res.status(200).json({message:'User saved successfully.!',userId:result.id});
    })
    
    .catch(err=>{
        if(!err?.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

exports.addRole= async (req,res,next)=>{
    const role = req.body.role;

    try {
        // Extract role data from the request body
        const { role } = req.body;

        // Create a new role instance
        const newRole = await Role.create({
            role: role
        });

        // If role is created successfully, send a success response
        return res.status(201).json({
            success: true,
            message: 'Role created successfully',
            role: newRole
        });
    } catch (error) {
        // If an error occurs, send an error response
        return res.status(500).json({
            success: false,
            message: 'Failed to create role',
            error: error.message
        });
    }
}

exports.addRights= async (req,res,next)=>{
    

    try {
        // Extract role data from the request body
        const { name } = req.body;

        // Create a new role instance
        const newRight = await Rights.create({
            name: name
        });

        // If role is created successfully, send a success response
        return res.status(201).json({
            success: true,
            message: 'Right created successfully',
            role: newRight
        });
    } catch (error) {
        // If an error occurs, send an error response
        return res.status(500).json({
            success: false,
            message: 'Failed to create right',
            error: error.message
        });
    }
}

//admin rights
exports.addAdminRights= async (req,res,next)=>{
    

    try {
        // Extract role data from the request body
        const { adminId,rightId } = req.body;

        // Create a new role instance
        const newRight = await AdminRights.create({
            AdminId: adminId,
            RightId:rightId
        });

        // If role is created successfully, send a success response
        return res.status(201).json({
            success: true,
            message: 'Admin Rights created successfully',
            role: newRight
        });
    } catch (error) {
        // If an error occurs, send an error response
        return res.status(500).json({
            success: false,
            message: 'Failed to create admin right',
            error: error.message
        });
    }
}

exports.login = (req, res, next) => {
    const username = req.body.username;
    const password = req.body.password;
    let loggedIn;

    Admin.findOne({ where: { username: username }, include: [{ model: Role, as: 'Role' }] })
        .then(user => {
            if (!user) {
                const error = new Error('No account found with that username.');
                error.statusCode = 401;
                throw error;
            }
            loggedIn = user;
            return bcrypt.compare(password, user.password);
        })
        .then(isEqual => {
            if (!isEqual) {
                const error = new Error('Incorrect password.');
                error.statusCode = 401;
                throw error;
            }

            const token = jwt.sign(
                { userId: loggedIn.id.toString(), username: loggedIn.username },
                'supersupersecretsecret',
                { expiresIn: '1h' }
            );

            const role = loggedIn.Role
                ? {
                    id: String(loggedIn.Role.id),
                    name: loggedIn.Role.role,
                    description: null,
                    isSystem: true,
                    isActive: true,
                }
                : null;

            res.status(200).json({
                token,
                user: {
                    id: String(loggedIn.id),
                    email: loggedIn.email || null,
                    username: loggedIn.username,
                    role,
                    permissions: [],
                    isActive: true,
                },
            });
        })
        .catch(err => {
            if (!err?.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};