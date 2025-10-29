// controllers/compositeController.ts
import { Request, Response, NextFunction } from 'express';
import { Composite } from '../models/Composite'; // Adjust path

const createComposite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newComposite = await Composite.create(req.body);
        res.status(201).json({ status: 'success', data: { composite: newComposite } });
    } catch(error) { next(error); }
};

const getAllComposites = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // ✅ MODIFIED: Populate and sort by category, then order
        const composites = await Composite.find()
            .populate('questions')
            .sort({ category: 1, order: 1 }); // Sorts by category, then by order
        res.status(200).json({ status: 'success', data: { composites } });
    } catch(error) { next(error); }
};
const updateComposite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const composite = await Composite.findByIdAndUpdate(req.params.compositeId, req.body, { new: true, runValidators: true });
        if (!composite) return res.status(404).json({ message: 'No composite found with that ID' });
        res.status(200).json({ status: 'success', data: { composite } });
    } catch(error) { next(error); }
};

const deleteComposite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const composite = await Composite.findByIdAndDelete(req.params.compositeId);
        if (!composite) return res.status(404).json({ message: 'No composite found with that ID' });
        res.status(204).json({ status: 'success', data: null });
    } catch(error) { next(error); }
};

export { createComposite, getAllComposites, updateComposite, deleteComposite };