const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blog");
const isAuth = require("../middleware/is-auth");

// Public: anyone can read blogs
router.get("/", blogController.getBlogs);
router.get("/:id", blogController.getBlog);

// Auth required for mutations
router.post("/add", isAuth, blogController.addBlog);
router.delete("/:id", isAuth, blogController.deleteBlog);

module.exports = router;
