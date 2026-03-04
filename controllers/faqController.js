const FAQ = require('../models/FAQ');

// GET /api/faq — returns all published FAQs (students/teachers)
exports.getPublishedFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.findAll({
      where: { isPublished: true },
      order: [['createdAt', 'ASC']],
    });
    res.status(200).json(faqs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQs', error });
  }
};

// GET /api/faq/all — returns all FAQs including unpublished (admin)
exports.getAllFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.findAll({ order: [['createdAt', 'ASC']] });
    res.status(200).json(faqs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQs', error });
  }
};

// POST /api/faq — create FAQ (admin)
exports.createFAQ = async (req, res) => {
  try {
    const { question, answer, category, isPublished } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer are required.' });
    }
    const faq = await FAQ.create({
      question,
      answer,
      category: category || 'General',
      isPublished: isPublished !== undefined ? isPublished : true,
    });
    res.status(201).json(faq);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create FAQ', error });
  }
};

// PUT /api/faq/:id — update FAQ (admin)
exports.updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByPk(id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });

    const { question, answer, category, isPublished } = req.body;
    if (question !== undefined) faq.question = question;
    if (answer !== undefined) faq.answer = answer;
    if (category !== undefined) faq.category = category;
    if (isPublished !== undefined) faq.isPublished = isPublished;

    await faq.save();
    res.status(200).json(faq);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update FAQ', error });
  }
};

// DELETE /api/faq/:id — delete FAQ (admin)
exports.deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByPk(id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    await faq.destroy();
    res.status(200).json({ message: 'FAQ deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete FAQ', error });
  }
};
