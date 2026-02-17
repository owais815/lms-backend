const express = require('express');
const {body} = require('express-validator');
const Admin = require('../models/Admin');
const authController = require('../controllers/auth');

const router = express.Router();

router.put('/signup',[
    // body('email').isEmail().withMessage("Please enter a valid email.").custom((value,{req})=>{
    //     return Admin.findOne({where:{email:value}}).then(userObj=>{
    //         if(userObj){
    //             return Promise.reject("E-mail already exist.!");
    //         }
    //     })
    // }).normalizeEmail(),
    // email validation ends here
    body('username').trim().isLength({min:5}),
    body('password').trim().isLength({min:5}),
    body('name').trim().not().isEmpty()
],authController.signup);


router.post('/login',authController.login);
router.post('/addRole',authController.addRole);
router.post('/addRights',authController.addRights);
router.post('/addAdminRights',authController.addAdminRights);
module.exports = router;
