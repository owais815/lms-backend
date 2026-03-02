const { validationResult } = require("express-validator");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");
const RolesRights = require("../models/RolesRights");

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

exports.login = async (req, res, next) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const user = await Admin.findOne({
            where: { username },
            include: [{ model: Role }],
        });

        if (!user) {
            const error = new Error('No account found with that username.');
            error.statusCode = 401;
            throw error;
        }

        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
            const error = new Error('Incorrect password.');
            error.statusCode = 401;
            throw error;
        }

        // Fetch real permissions for this role
        const rightsRows = user.roleId
            ? await RolesRights.findAll({ where: { roleId: user.roleId }, attributes: ['rights'] })
            : [];
        const permissions = rightsRows.map(r => r.rights);

        const token = jwt.sign(
            {
                userId:   user.id.toString(),
                username: user.username,
                userType: 'ADMIN',
                roleId:   user.roleId || null,
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const role = user.Role
            ? {
                id:          String(user.Role.id),
                name:        user.Role.role,
                description: null,
                isSystem:    true,
                isActive:    true,
            }
            : null;

        res.status(200).json({
            token,
            user: {
                id:         String(user.id),
                email:      user.email || null,
                username:   user.username,
                role,
                permissions,
                isActive:   true,
                profileImg: user.profileImg || null,
            },
        });
    } catch (err) {
        if (!err?.statusCode) err.statusCode = 500;
        next(err);
    }
};