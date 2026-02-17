// const {validationResult} = require('express-validator');
// const Roles = require('../models/Roles');
// const fs = require('fs');
// const path = require('path');

// exports.getPosts= (req,res,next) =>{
//     Roles.findAll()
//     .then(posts=>{
//         res.status(200).json({message:'success.',posts:posts});
//     })
//     .catch(err=>{
//         if(!err.statusCode){
//             err.statusCode = 500;
//             next(err);
//         }
//     })

// }

// exports.createPosts = (req,res,next)=>{

//     const errors = validationResult(req);
//     if(!errors.isEmpty()){
//         const error = new Error('Validation Failed, Entered data is incorrect.');
//         error.statusCode = 422;
//         throw error;
//     }

//     if(!req.file){
//         const error = new Error('No image provided...!!!');
//         error.statusCode = 422;
//         throw error;
//     }
//     const imageUrl = req.file.path;
//     const title = req.body.title;
//     const content = req.body.content;

//     Post.create({title,content,imageUrl:imageUrl,creator:req.userId})
//     .then((result)=>{
//         console.log(result);
//         res.status(201).json({
//             message:"Post created successfully...!!!",
//             posts:result
//         });
//     }).catch(err=>{
//         if(!err?.statusCode){
//             err.statusCode = 500;
//         }
//         next(err);
//     });
// }

// exports.getPost = (req,res,next)=>{
//     const id = req.params.postId;
//     Post.findByPk(id)
//     .then(post=>{
//         if(!post){
//             const error = new Error('Post with this id not found.');
//             throw error;
//         }
//         res.status(200).json({message:'fetched.!',post:post});
//     })
//     .catch(err=>{
//         if(!err.statusCode){
//             err.statusCode = 500;
//         }
//         next(err);
//     });
// }

// exports.updatePost = (req,res,next)=>{
//     const erros = validationResult(req);
//     if(!erros.isEmpty()){
//         const error = new Error('Validation failed.');
//         error.statusCode = 422;
//         throw error;
//     }

//     const id = req.params.postId;
//     const title = req.body.title;
//     const content = req.body.title;
//     let imageUrl = req.body.image;

    
//     if(req.file){
//         imageUrl = req.file.path;
//     }
//     if(!imageUrl){
//         const error = new Error("image not set");
//         error.statusCode = 422;
//         throw error;
//     }

//     Post.findByPk(id)
//     .then(post=>{
//         if(!post){
//             const error = new Error("No post found.");
//             error.statusCode = 422;
//             throw error;
//         }

//         if(post.creator !== req.userId){
//             const error = new Error("You are not authorized to do that.");
//             error.statusCode=403;
//             throw error;
//         }
//         if(imageUrl !== post.imageUrl){
//             clearImage(post.imageUrl);
//         }
//         post.title = title;
//         post.content = content;
//         post.imageUrl = imageUrl;
//         return post.save();
//     }).then(result=>{
//         res.status(200).json({message:'Post updated!',post:result});
//     })
//     .catch(err=>{
//         if(!err?.statusCode){
//             err.statusCode=500;
//         }
//         next(err);
//     })

// }

// exports.deletePost = (req,res,next)=>{
//     const postId = req.params.postId;
//     Post.findByPk(postId)
//     .then(post=>{
//         if(!post){
//             let error = new Error("Post not found.");
//             error.statusCode = 422;
//             throw error;
//         }
//         if(post.creator !== req.userId){
//             const error = new Error("You are not authorized to do that.");
//             error.statusCode=403;
//             throw error;
//         }
//         clearImage(post.imageUrl);
//         return post.destroy();
//     }).then(result=>{
//         res.status(200).json({message:'deleted.'});
//     })
//     .catch(err=>{
//         if(!err?.statusCode){
//             err.statusCode = 500;
//         }
//         next(err);
//     })
// }

// const clearImage = filePath =>{
//     const filePaths = path.join(__dirname,'..',filePath);
//     fs.unlink(filePaths,err=>{
//         console.log(err);
//     })
// }