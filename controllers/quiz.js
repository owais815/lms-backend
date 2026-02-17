const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const { Quiz, QuizAttempt, CourseDetails, Courses } = require("../models/association");
const Question = require("../models/Quiz/Question");

exports.createQuiz = async (req, res, next) => {
  try {
    const { title, instructions, duration, passingScore, teacherId,courseDetailsId,studentId } = req.body;
    const quiz = await Quiz.create({ title, instructions, duration, passingScore, teacherId,courseDetailsId,studentId });
    res.status(201).json(quiz);
  } catch (error) {
    //res.status(400).json({ error: error.message });
    next(error);
  }
};

exports.assignCourseAndStudentToQuiz = async (req, res, next) => {
  try {
    const { quizId, courseDetailsId, studentId } = req.body;
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    const updatedQuiz = await quiz.update({ courseDetailsId, studentId });

    //  = await Quiz.findByPk(quizId, {
    //   include: [
    //     { model: CourseDetails, as: 'course' },
    //     { model: Student, as: 'student' }
    //   ]
    // });

    res.status(200).json(updatedQuiz);
  } catch (error) {
    next(error);
  }
};

exports.AddQuestionToQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { type, question, options, correctAnswer } = req.body;
    const newQuestion = await Question.create({ quizId, type, question, options, correctAnswer });
    res.status(201).json(newQuestion);
  } catch (error) {
    res.status(400).json({ error: error.message });
    next(error);
  }
};

exports.getQuizWithQuestion = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findByPk(quizId, { include: Question });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
    next(error);
  }
};

exports.startQuizAttempt = async (req, res, next) => {
  try {
    const { quizId, studentId } = req.body;

    // Check if a quiz attempt already exists
    const existingAttempt = await QuizAttempt.findOne({
      where: {
        quizId,
        studentId
      }
    });

    if (existingAttempt) {
      // If an attempt already exists, return a 400 status with a message
      return res.status(400).json({ error: 'Quiz already attempted by this student',data:existingAttempt });
    }

    // If no existing attempt, create a new one
    const quizAttempt = await QuizAttempt.create({
      quizId,
      studentId,
      startTime: new Date()
    });

    res.status(201).json(quizAttempt);
  } catch (error) {
    res.status(400).json({ error: error.message });
    next(error);
  }
};

exports.submitQuizAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { answers, endTime } = req.body;
    const quizAttempt = await QuizAttempt.findByPk(attemptId, { include: { model: Quiz, include: Question } });
    if (!quizAttempt) {
      return res.status(404).json({ error: 'Quiz attempt not found' });
    }
    
    let score = 0;
    console.log("Answers received:", answers);

    quizAttempt.Quiz.Questions.forEach((question, index) => {
      const studentAnswer = answers[index];
      console.log(`Question ${index + 1} - Type: ${question.type}, Student Answer: ${studentAnswer}`);

      if (question.type === 'short_answer') {
        const keywords = question.correctAnswer
          .split(',')
          .map(k => k.trim().toLowerCase().replace(/^'|'$/g, ''));
        const lowerStudentAnswer = studentAnswer.toLowerCase();
        
        // Implement minimum answer length requirement
        if (lowerStudentAnswer.length < 3) {
          console.log(`Question ${index + 1}: Answer too short`);
          return; // Skip this question if answer is too short
        }

        // Use more flexible matching approach with partial matching
        const matchedKeywords = keywords.filter(keyword => 
          lowerStudentAnswer.includes(keyword) || 
          keyword.split(' ').some(word => 
            lowerStudentAnswer.includes(word) || 
            (word.length > 3 && lowerStudentAnswer.includes(word.slice(0, Math.ceil(word.length * 0.7))))
          )
        );

        console.log(`Question ${index + 1} - Keywords:`, keywords);
        console.log(`Question ${index + 1} - Matched Keywords:`, matchedKeywords);

        // Adjust scoring to give partial credit
        const matchPercentage = matchedKeywords.length / keywords.length;
        if (matchPercentage > 0) {
          score += matchPercentage;
        }
        console.log(`Question ${index + 1} - Score: ${matchPercentage}`);
      }
      else if (question.type === 'multiple_choice' ) {
        if (question.correctAnswer.toLowerCase() === studentAnswer.toLowerCase()) {
          score++;
          console.log(`Question ${index + 1} - Correct Answer`);
        } else {
          console.log(`Question ${index + 1} - Incorrect Answer`);
        }
      }
      else if (question.type === 'true_false' ) {
        console.log(`Question::`, question.correctAnswer,studentAnswer);
        if (question.correctAnswer === studentAnswer) {
          score++;
          console.log(`Question ${index + 1} - Correct Answer`);
        } else {
          console.log(`Question ${index + 1} - Incorrect Answer`);
        }
      }
    });
    
    const finalScore = (score / quizAttempt.Quiz.Questions.length) * 100;
    console.log("Final Score:", finalScore);
    
    await quizAttempt.update({
      score: finalScore,
      endTime
    });
    
    res.json(quizAttempt);
  } catch (error) {
    console.error("Error in submitQuizAttempt:", error);
    res.status(400).json({ error: error.message });
  }
};
exports.getStudentById = (req, res, next) => {
  const studentId = req.params.studentId;

  Student.findByPk(studentId)
    .then((student) => {
      if (!student) {
        const error = new Error("Student not found!");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ student: student });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getStudentByUsername = (req, res, next) => {
  const { username } = req.body;

  Student.findOne({ where: { username: username } })
    .then((student) => {
      if (!student) {
        const error = new Error("Student not found!");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ student: student });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getQuizWithTeachers = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const quiz = await Quiz.findAll({where:{teacherId:teacherId}} , { include: Teacher });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
    next(error);
  }
};

exports.deleteQuiz = async (req, res, next) => {
  const { quizId } = req.params;
  try {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Delete associated questions
    await Question.destroy({ where: { quizId: quizId } });

    // Delete associated quiz attempts
    await QuizAttempt.destroy({ where: { quizId: quizId } });

    // Delete the quiz itself
    await quiz.destroy();

    res.status(200).json({ message: 'Quiz and associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
    next(error);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  const { questionId } = req.params;
  try {
    const question = await Question.findByPk(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get the associated quiz
    const quiz = await Quiz.findByPk(question.quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Associated quiz not found' });
    }

    // Delete the question
    await question.destroy();
    res.status(200).json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
    next(error);
  }
};

exports.getCourseName = async (req, res, next) => {
  const { courseDetailsId } = req.params;
  try {
    const course = await Course.findByPk(courseDetailsId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(200).json({ course: course });
  } catch (error) {
    res.status(500).json({ error: error.message });
    next(error);
  }
};

exports.getStudentQuizzes = async (req, res, next) => {
  try {
    const { studentId } = req.params; // Assuming studentId is passed as a route parameter

    const quizzes = await Quiz.findAll({
      where: { studentId: studentId },
      include: [
        {
          model: CourseDetails,
          include:[{model:Courses, attributes:['id','courseName']}],
          attributes: ['id','teacherId'],
          as:'CourseDetails' 
        },
        {
          model: Teacher,
          attributes: ['id', 'firstName','lastName','imageUrl'] // Include teacher details if needed
        }
      ],
      attributes: ['id', 'title', 'instructions', 'duration', 'passingScore', 'createdAt']
    });

    if (quizzes.length === 0) {
      return res.status(404).json({ message: "No quizzes found for this student" });
    }

    res.status(200).json(quizzes);
  } catch (error) {
    next(error);
  }
};

//check if a student has attempted a quiz
exports.checkIfStudentHasAttemptedQuiz = async (req, res, next) => {
  try {
    const { studentId, quizId } = req.params;
    const attempt = await QuizAttempt.findOne({ where: { studentId, quizId }, attributes: ['id', 'startTime', 'endTime', 'score'] });
    if (attempt) {
      res.status(200).json({ hasAttempted: true, attempt: {
        id: attempt.id,
        startTime: attempt.startTime,
        endTime: attempt.endTime,
        score: attempt.score,
      } });
    } else {
      res.status(200).json({ hasAttempted: false,attempt:null });
    }
  } catch (error) {
    next(error);
  }
}