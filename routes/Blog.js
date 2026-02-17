const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blog");
const Blog = require("../models/Blog");

router.post("/add", blogController.addBlog);

router.get("/", blogController.getBlogs);

router.get("/:id", blogController.getBlog);

router.delete("/:id", blogController.deleteBlog);

module.exports = router;
