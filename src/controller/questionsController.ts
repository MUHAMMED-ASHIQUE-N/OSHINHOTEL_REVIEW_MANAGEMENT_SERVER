import { Request, Response } from "express";
import {Question} from "../models/questionModel";

// Add question controller
export const addQuestion = async (req: Request, res: Response) => {
    try {
        const { questionText, order } = req.body;
        if (!questionText || order === undefined) {
            return res
                .status(400)
                .json({ message: "questionText and order are required fields." });
        }

        // Optionally prevent duplicate order values
        const existing = await Question.findOne({ order });
        if (existing) {
            return res
                .status(409)
                .json({ message: "Question with this order already exists." });
        }

        const newQuestion = new Question({ questionText, order });
        await newQuestion.save();

        res.status(201).json({ message: "New question added", newQuestion });
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error adding question:", error);
            res
                .status(500)
                .json({ message: error.message || "Internal Server Error" });
        }

    }
};


export const getQuestions = async (req: Request, res: Response) => {

    try {
        const questions = await Question.find().sort({ order: 1 });
        res.status(200).json({ questions });


    } catch (error) {
        if (error instanceof Error) {
            console.log("Error fetching questions:", error);
            res.status(500).json({ message: error.message || "Internal Server Error" });


        }
    }
}


export const getQuestionById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) {
            return res.status(404).json({ message: "Question not found" });
        }
        res.status(200).json({ question });


    } catch (error) {
        if (error instanceof Error) {
            console.log("Error fetching question by ID:", error);
            res.status(500).json({ message: error.message || "Internal Server Error" });

        }
    }
}


export const updateQuestion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { questionText, order } = req.body;
        const updatateQuestion = await Question.findByIdAndUpdate(
            id,
            { questionText, order },
            { new: true, runValidators: true }

        );
        if (!updatateQuestion) {
            return res.status(404).json({ message: "Question not found" });
        }
        res.status(200).json({ message: "Question updated", updatateQuestion });

    } catch (error) {
        if (error instanceof Error) {
            console.log("Error updating question:", error);
            res.status(500).json({ message: error.message || "Internal Server Error" });

        }
    }

}


export const updateQuestionStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updateStatus = await Question.findByIdAndUpdate(
            id,
            { isActive },
            { new: true, runValidators: true }
        );
        if (!updateStatus) {
            return res.status(404).json({ message: "Question not found" });
        }
        res.status(200).json({ message: "Question status updated", updateStatus });


    } catch (error) {
        if (error instanceof Error) {
            console.log("Error updating question status:", error);
            res.status(500).json({ message: error.message || "Internal Server Error" });

        }
    }
}


export const deleteQuestion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const deletedQuestion = await Question.findByIdAndDelete(id);
        if (!deletedQuestion) {
            return res.status(404).json({ message: "Question not found" });
        }
        res.status(200).json({ message: "Question deleted", deletedQuestion });
    } catch (error) {
        if (error instanceof Error) {
            console.log("Error deleting question:", error);
            res.status(500).json({ message: error.message || "Internal Server Error" });
        }
    }
}