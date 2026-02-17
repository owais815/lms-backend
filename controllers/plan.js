

const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const PlanChangeRequest = require('../models/PlanChangeRequest');
const Student = require('../models/Student');


//For Admin 
// Add a new plan
exports.addPlan = async (req, res) => {
    const { name, description, price, features } = req.body;
    try {
        const plan = await Plan.create({ name, description, price, features });
        res.status(201).json({ success: true, plan });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all plans
exports.getPlans = async (req, res) => {
    try {
        const plans = await Plan.findAll();
        res.status(200).json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update a plan
exports.updatePlan = async (req, res) => {
    const { id } = req.params;
    const { name, description, price, features } = req.body;

    try {
        const plan = await Plan.findByPk(id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        plan.name = name || plan.name;
        plan.description = description || plan.description;
        plan.price = price || plan.price;
        plan.features = features || plan.features;

        await plan.save();
        res.status(200).json({ success: true, plan });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a plan
exports.deletePlan = async (req, res) => {
    const { id } = req.params;
    try {
        const plan = await Plan.findByPk(id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        await plan.destroy();
        res.status(200).json({ success: true, message: 'Plan deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

//change plan request from student
exports.createPlanChangeRequest = async (req, res) => {
    const { studentId, newPlanId } = req.body;

    try {
        const student = await Student.findByPk(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const currentPlan = student.planId;
        if (currentPlan === newPlanId) {
            return res.json({ planStatus:'already', error: 'You already have this plan!' });
        }
        const isRequest = await PlanChangeRequest.findOne({
            where: {
                studentId,
                status: 'pending',
            },
        });
        if(isRequest){
            return res.json({ planStatus:'pending', error: 'You already have a pending plan change request.' });
        }
        await PlanChangeRequest.create({
            studentId,
            currentPlanId: currentPlan,
            requestedPlanId:newPlanId,
            status: 'pending',
        });

        // Notify admin (optional logic)
        res.json({ success: true,planStatus:'success', message: 'Plan change request submitted successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while submitting the request.' });
    }
};


// Controller to handle initial plan purchase
exports.purchasePlan = async (req, res) => {
    const { studentId, planId, amount } = req.body;

    try {
        // Step 1: Associate plan with student
        const updatedStudent = await Student.update(
            { planId },
            { where: { id: studentId } }
        );

        if (!updatedStudent[0]) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Step 2: Record payment
        const payment = await Payment.create({
            studentId,
            amount,
            purpose: 'Plan Purchase',
        });

        res.status(201).json({
            success: true,
            message: 'Plan purchased and payment recorded successfully.',
            payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};



//Add plan to student

exports.assignPlan = async (req, res) => {
    const { studentId, planId } = req.body;

    try {
        const student = await Student.findByPk(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        student.planId = planId;
        await student.save();

        res.status(200).json({ success: true, message: 'Plan assigned successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

//Get Student's current Plan

exports.getStudentPlan = async (req, res) => {
    const { studentId } = req.params;

    try {
        const student = await Student.findByPk(studentId, { include: 'Plan' });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.status(200).json({ success: true, plan: student.Plan });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

