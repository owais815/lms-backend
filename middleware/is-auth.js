const jwt = require('jsonwebtoken');

module.exports = (req,res,next)=>{
    const authHeader = req.get('Authorization');
    if(!authHeader){
        const error = new Error('Not authenticated.!');
        error.statusCode = 401;
        throw error;
    }

    const token = authHeader.split(' ')[1];
    let decodedToken;

    try{

        decodedToken = jwt.verify(token,'supersupersecretsecret');

    }catch(err){
        err.statusCode = 500;
        throw err;
    }
    if(!decodedToken){
        let error = new Error("Not authenticated...!!!");
        error.statusCode = 401;
        throw error;
    }

    req.userId = decodedToken.userId;
    next();
//end of file


}