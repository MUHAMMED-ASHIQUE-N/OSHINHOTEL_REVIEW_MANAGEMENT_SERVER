import { Request, Response } from "express";
import { Composite } from "../models/compositeModel";
import { Question } from "../models/questionModel";

export const addComposite = async (req: Request, res: Response) => {
    try {
        const { CompositeName, questionIds } = req.body;
        if (!CompositeName || !questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({ message: "Name and atleast 2 questionIds are required" });
        }


        // Validate questionIds
        const validateQuestions = await Question.find({ _id: { $in: questionIds } });
        if (validateQuestions.length !== questionIds.length) {
            return res.status(400).json({ message: "Name and at least 2 questionIds are required." });
        }

        const newComposite = new Composite({ CompositeName, questionIds });
        await newComposite.save();
        res.status(201).json({ message: "New composite added", newComposite });
    } catch (error) {
        if (error instanceof Error) {
            console.log("Error adding composite:", error);
            res.status(500).json({ message: error.message || "Internal Server Error" });

        }
    }
}