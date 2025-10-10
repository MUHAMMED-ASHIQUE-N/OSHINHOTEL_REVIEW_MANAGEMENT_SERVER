// controllers/analyticsController.ts
import { Request, Response, NextFunction } from 'express';
import { Review } from '../models/Review';
import { Composite } from '../models/Composite';
import mongoose from 'mongoose';

// Helper to create date match stage
const getDateMatchStage = (startDate?: string, endDate?: string) => {
    const match: any = {};
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) {
            match.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            // This is the fix: create a date and set it to the END of the day.
            const endOfDay = new Date(endDate);
            endOfDay.setUTCHours(23, 59, 59, 999);
            match.createdAt.$lte = endOfDay;
        }
    }
    return { $match: match };
};

// @desc    Get key stats (submissions, avg rating)
// @route   GET /api/admin/analytics/stats
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateMatchStage = getDateMatchStage(req.query.startDate as string, req.query.endDate as string);

        const stats = await Review.aggregate([
            dateMatchStage,
            { $unwind: '$answers' },
            {
                $group: {
                    _id: null,
                    totalSubmissions: { $addToSet: '$_id' }, // Use addToSet to count unique reviews
                    averageRating: { $avg: '$answers.rating' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSubmissions: { $size: '$totalSubmissions' },
                    averageRating: { $round: ['$averageRating', 2] }
                }
            }
        ]);

        res.status(200).json({ status: 'success', data: stats[0] || { totalSubmissions: 0, averageRating: 0 } });
    } catch (error) { next(error); }
};

// @desc    Get average rating for each question
// @route   GET /api/admin/analytics/question-averages
export const getQuestionAverages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { startDate, endDate, compositeId } = req.query; // ✅ Accept a compositeId

        const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
        
        const pipeline: mongoose.PipelineStage[] = [
            dateMatchStage,
            { $unwind: '$answers' },
        ];

        // ✅ If a compositeId is provided, filter for questions within that composite
        if (compositeId) {
            const composite = await Composite.findById(compositeId as string);
            if (composite) {
                pipeline.push({
                    $match: { 'answers.question': { $in: composite.questions } }
                });
            }
        }

        // The rest of the pipeline calculates the averages
        pipeline.push(
            {
                $group: {
                    _id: '$answers.question',
                    averageRating: { $avg: '$answers.rating' },
                    reviewCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'questions',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'questionDetails'
                }
            },
            { $unwind: '$questionDetails' },
            {
                $project: {
                    _id: 0,
                    name: '$questionDetails.text', // ✅ Output 'name' to match our chart data
                    value: { $round: ['$averageRating', 2] }, // ✅ Output 'value'
                }
            },
            { $sort: { name: 1 } }
        );

        const averages = await Review.aggregate(pipeline);
        res.status(200).json({ status: 'success', data: averages });

    } catch (error) { next(error); }
};


// @desc    Get average rating for each composite group
// @route   GET /api/admin/analytics/composite-averages
export const getCompositeAverages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateMatchStage = getDateMatchStage(req.query.startDate as string, req.query.endDate as string);

        // This is a complex aggregation that calculates averages for each question and then maps them to composites.
        const result = await Composite.aggregate([
            // 1. Unwind the questions array in each composite
            { $unwind: '$questions' },

            // 2. Lookup reviews that match the question and date range
            {
                $lookup: {
                    from: 'reviews',
                    let: { questionId: '$questions' },
                    pipeline: [
                        dateMatchStage,
                        { $unwind: '$answers' },
                        { $match: { $expr: { $eq: ['$answers.question', '$$questionId'] } } },
                        { $project: { rating: '$answers.rating', _id: 0 } }
                    ],
                    as: 'matchingReviews'
                }
            },
            { $unwind: '$matchingReviews' },
            
            // 3. Group by composite to calculate the average
            {
                $group: {
                    _id: '$_id',
                    name: { $first: '$name' },
                    averageRating: { $avg: '$matchingReviews.rating' }
                }
            },
            {
                $project: {
                    compositeId: '$_id',
                    _id: 0,
                    name: 1,
                    averageRating: { $round: ['$averageRating', 2] }
                }
            }
        ]);
        
        res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
};


// @desc    Get staff performance leaderboard
// @route   GET /api/admin/analytics/staff-performance
export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateMatchStage = getDateMatchStage(req.query.startDate as string, req.query.endDate as string);

        const performance = await Review.aggregate([
            dateMatchStage,
            { $unwind: '$answers' },
            {
                $group: {
                    _id: '$staff',
                    totalReviews: { $addToSet: '$_id' }, // Count unique reviews
                    averageRating: { $avg: '$answers.rating' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'staffDetails'
                }
            },
            { $unwind: '$staffDetails' },
            {
                $project: {
                    _id: 0,
                    staffId: '$_id',
                    staffName: '$staffDetails.fullName',
                    totalReviews: { $size: '$totalReviews' },
                    averageRating: { $round: ['$averageRating', 2] }
                }
            },
            // Dynamically sort based on query param
            { $sort: { [req.query.sortBy === 'rating' ? 'averageRating' : 'totalReviews']: -1 } }
        ]);

        res.status(200).json({ status: 'success', data: performance });
    } catch (error) { next(error); }
};


export const getCompositeOverTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { year, period, month, compositeId } = req.query;

        if (!year || !period || !compositeId) {
            return res.status(400).json({ message: 'Year, period, and compositeId are required.' });
        }

        const yearNum = parseInt(year as string);
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);

        // --- Aggregation Pipeline ---
        const pipeline: mongoose.PipelineStage[] = [
            // 1. Find reviews within the selected year
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            // 2. Deconstruct the answers array
            { $unwind: '$answers' },
            // 3. Find the composite and check if the question is part of it
            {
                $lookup: {
                    from: 'composites',
                    let: { questionId: '$answers.question' },
                    pipeline: [
                        { $match: { 
                            $expr: { 
                                $and: [
                                    { $eq: ['$_id', new mongoose.Types.ObjectId(compositeId as string)] },
                                    { $in: ['$$questionId', '$questions'] }
                                ]
                            } 
                        }},
                    ],
                    as: 'compositeMatch'
                }
            },
            // 4. Filter out answers that don't belong to the composite
            { $match: { 'compositeMatch': { $ne: [] } } },
            // 5. Group by the selected period (Month or Week)
            {
                $group: {
                    _id: {
                        // For 'Monthly', group by month number. For 'Weekly', group by week number.
                        $dateToString: { format: period === 'Monthly' ? '%m' : '%U', date: '$createdAt' }
                    },
                    averageRating: { $avg: '$answers.rating' }
                }
            },
            // 6. Format the output
            {
                $project: {
                    _id: 0,
                    name: '$_id', // 'name' will be the month number ('01', '02') or week number
                    value: { $round: ['$averageRating', 2] }
                }
            },
            // 7. Sort by the period
            { $sort: { name: 1 } }
        ];

        // If filtering by week, we need to also filter by the specific month
        if (period === 'Weekly') {
            if (!month) return res.status(400).json({ message: 'Month is required for weekly period.' });
            const monthNum = parseInt(month as string); // 0-11
            
            // Add a stage to filter for the correct month *after* finding the reviews
            pipeline.unshift({
                $addFields: { month: { $month: '$createdAt' } }
            }, {
                // MongoDB months are 1-12, JS months are 0-11. Add 1.
                $match: { month: monthNum + 1 } 
            });
        }
        
        const result = await Review.aggregate(pipeline);
        res.status(200).json({ status: 'success', data: result });

    } catch (error) { next(error); }
};