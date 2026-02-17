const Blog = require("../models/Blog");

// Add a new blog post

exports.addBlog = async (req, res) => {
  const { title, content, author, tags } = req.body;
  
const {file} = req;
 let imageUrl; 
if(file){
    imageUrl = req.file.path.replace("\\", "/");
}else{
    imageUrl = null;
}
  try {
 
    const newBlog = await Blog.create({
      title,
      content,
      author,
      tags,
      imageUrl
    });
    
    res.status(201).json({
      message: "Blog post created successfully!",
      blog: newBlog,
    });
  } catch (error) {
    console.error("Error adding blog post:", error);
    res.status(500).json({
      message: "Failed to create blog post",
      error: error.message,
    });
  }
};

exports.getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.findAll({
      order: [['publishedDate', 'DESC']], // Sort by publishedDate in descending order
    });
    res.status(200).json(blogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// Get a single blog post by ID
exports.getBlog = async (req, res) => {
  const { id } = req.params;

  try {
    const blog = await Blog.findByPk(id);

    if (!blog) {
      return res.status(404).json({ message: "Blog post not found" });
    }

    res.status(200).json(blog);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    res.status(500).json({
      message: "Failed to fetch blog post",
      error: error.message,
    });
  }
};

exports.deleteBlog = async (req, res) => {
  const { id } = req.params;
  try {
    const blog = await Blog.findByPk(id);
    if (!blog) {
      return res.status(404).json({ message: "Blog post not found" });
    }
    await blog.destroy();
    res.status(200).json({ message: "Blog post deleted successfully" });
  } catch (error) {
    console.error("Error deleting blog post:", error);
    res.status(500).json({  message: "Failed to delete blog post",
      error: error.message,
    });
  }
};
