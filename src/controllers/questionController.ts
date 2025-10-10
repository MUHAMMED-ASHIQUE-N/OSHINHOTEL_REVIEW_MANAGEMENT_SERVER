// controllers/questionController.ts
import { Request, Response, NextFunction } from 'express';
import { Question } from '../models/Question'; // Adjust path

// Basic CRUD operations
const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newQuestion = await Question.create(req.body);
        res.status(201).json({ status: 'success', data: { question: newQuestion } });
    } catch(error) { next(error); }
};

const getAllQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questions = await Question.find();
        res.status(200).json({ status: 'success', data: { questions } });
    } catch(error) { next(error); }
};

const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const question = await Question.findByIdAndUpdate(req.params.questionId, req.body, { new: true, runValidators: true });
        if (!question) return res.status(404).json({ message: 'No question found with that ID' });
        res.status(200).json({ status: 'success', data: { question } });
    } catch(error) { next(error); }
};

const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.questionId);
        if (!question) return res.status(404).json({ message: 'No question found with that ID' });
        res.status(204).json({ status: 'success', data: null });
    } catch(error) { next(error); }
};

export { createQuestion, getAllQuestions, updateQuestion, deleteQuestion };