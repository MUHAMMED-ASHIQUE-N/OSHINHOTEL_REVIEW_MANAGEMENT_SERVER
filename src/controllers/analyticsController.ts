// src/controllers/analyticsController.ts
import { Request, Response, NextFunction } from 'express';
import { Review } from '../models/Review';
import { Composite } from '../models/Composite';
import { Question } from '../models/Question'; // <-- Import Question model
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
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      match.createdAt.$lte = endOfDay;
    }
  }
  return { $match: match };
};

// ✅ NEW HELPER: Create category match stage
const getCategoryMatchStage = (category?: string) => {
  if (category && (category === 'room' || category === 'f&b')) {
    // Match the 'category' field on the Review model
    return { $match: { category: category } };
  }
  // If no category is provided, return an empty stage that does nothing
  return { $match: {} };
};


// @desc    Get key stats (submissions, avg rating)
// @route   GET /api/analytics/stats
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query; // Get category
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string); // Create stage

    const stats = await Review.aggregate([
      dateMatchStage,
      categoryMatchStage, // ✅ Add stage to pipeline
      { $unwind: '$answers' },
      {
        $group: {
          _id: null,
          totalSubmissions: { $addToSet: '$_id' },
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
// @route   GET /api/analytics/question-averages
export const getQuestionAverages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, compositeId, category } = req.query; // Get category
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string); // Create stage
    
    const pipeline: mongoose.PipelineStage[] = [
      dateMatchStage,
      categoryMatchStage, // ✅ Add stage to pipeline
      { $unwind: '$answers' },
    ];

    if (compositeId) {
      const composite = await Composite.findById(compositeId as string);
      if (composite) {
        pipeline.push({
          $match: { 'answers.question': { $in: composite.questions } }
        });
      }
    }

    pipeline.push(
      {
        $group: {
          _id: '$answers.question',
          averageRating: { $avg: '$answers.rating' },
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
          name: '$questionDetails.text',
          compositeId: '$_id', // <-- ADD THIS LINE to include the ID
          value: { $round: ['$averageRating', 2] },
        }
      },
      { $sort: { name: 1 } }
    );

    const averages = await Review.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: averages });
  } catch (error) { next(error); }
};

// @desc    Get average rating for each composite group
// @route   GET /api/analytics/composite-averages
export const getCompositeAverages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query; // Get category
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string); // Create stage

    const pipeline: mongoose.PipelineStage[] = [
      // ✅ 1. Filter composites by the requested category FIRST
      { $match: { category: category as string } },
      // 2. Unwind the questions array
      { $unwind: '$questions' },
      // 3. Lookup reviews that match the question, date range, AND category
      {
        $lookup: {
          from: 'reviews',
          let: { questionId: '$questions' },
          pipeline: [
            dateMatchStage,
            categoryMatchStage, // ✅ 2. Add category match to sub-pipeline
            { $unwind: '$answers' },
            { $match: { $expr: { $eq: ['$answers.question', '$$questionId'] } } },
            { $project: { rating: '$answers.rating', _id: 0 } }
          ],
          as: 'matchingReviews'
        }
      },
      { $unwind: '$matchingReviews' },
      // 4. Group by composite to calculate the average
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          averageRating: { $avg: '$matchingReviews.rating' }
        }
      },
      {
        $project: {
          _id: 0,
          name: 1,
          value: { $round: ['$averageRating', 2] } // ✅ Renamed to name/value
        }
      }
    ];

    // If no category is provided, don't filter composites
    if (!category) {
      pipeline.shift(); // Remove the first $match stage
    }

    const result = await Composite.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) { next(error); }
};


// @desc    Get staff performance leaderboard
// @route   GET /api/analytics/staff-performance
export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query; // Get category
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string); // Create stage

    const performance = await Review.aggregate([
      dateMatchStage,
      categoryMatchStage, // ✅ Add stage to pipeline
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$staff',
          totalReviews: { $addToSet: '$_id' },
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
      { $sort: { [req.query.sortBy === 'rating' ? 'averageRating' : 'totalReviews']: -1 } }
    ]);

    res.status(200).json({ status: 'success', data: performance });
  } catch (error) { next(error); }
};

// @desc    Get composite score over time (for line/bar charts)
// @route   GET /api/analytics/composite-over-time
export const getCompositeOverTime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, period, month, compositeId, category } = req.query; // Get category

    if (!year || !period || !compositeId) {
      return res.status(400).json({ message: 'Year, period, and compositeId are required.' });
    }

    const yearNum = parseInt(year as string);
    const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);
    
    const categoryMatchStage = getCategoryMatchStage(category as string); // Create stage

    const pipeline: mongoose.PipelineStage[] = [
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      categoryMatchStage, // ✅ Add stage to pipeline
      { $unwind: '$answers' },
      // Find the composite
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
      // Filter out answers not in the composite
      { $match: { 'compositeMatch': { $ne: [] } } },
      // Group by the selected period
      {
        $group: {
          _id: {
            $dateToString: { format: period === 'Monthly' ? '%m' : '%U', date: '$createdAt' }
          },
          averageRating: { $avg: '$answers.rating' }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: { $round: ['$averageRating', 2] }
        }
      },
      { $sort: { name: 1 } }
    ];

    if (period === 'Weekly') {
      if (!month) return res.status(400).json({ message: 'Month is required for weekly period.' });
      const monthNum = parseInt(month as string); // 0-11
      
      pipeline.unshift(
        { $addFields: { month: { $month: '$createdAt' } } },
        { $match: { month: monthNum + 1 } } // MongoDB months are 1-12
      );
    }
    
    const result = await Review.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: result });

  } catch (error) { next(error); }
};

export const getAvailableYears = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Find all distinct years from the 'createdAt' field in reviews
    const years = await Review.distinct('createdAt', {}).then(dates =>
      // Map dates to years, filter out invalid dates, create a Set for uniqueness, sort descending
      Array.from(new Set(
        dates
          .map(date => new Date(date).getFullYear())
          .filter(year => !isNaN(year)) // Filter out any NaN results
      )).sort((a, b) => b - a) // Sort years descending
    );

    res.status(200).json({ status: 'success', data: { years } });
  } catch (error) {
    next(error);
  }
};



// @desc    Get reviews containing Yes/No answers, grouped by review
// @route   GET /api/analytics/yes-no-responses
export const getYesNoResponses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query;

    if (!category || (category !== 'room' && category !== 'f&b')) {
      return res.status(400).json({ message: 'Valid category (room or f&b) is required.' });
    }

    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = { $match: { category: category as string } };

    const pipeline: mongoose.PipelineStage[] = [
      dateMatchStage,
      categoryMatchStage,
      // 1. Unwind answers
      { $unwind: '$answers' },
      // 2. Lookup question details
      {
        $lookup: {
          from: 'questions',
          localField: 'answers.question',
          foreignField: '_id',
          as: 'questionDetails'
        }
      },
      // 3. Unwind question details
      { $unwind: '$questionDetails' },
      // 4. Match only Yes/No questions
      {
        $match: {
          'questionDetails.questionType': 'yes_no'
        }
      },
      // 5. Group back by the original review ID
      {
        $group: {
          _id: '$_id', // Group by Review ID
          createdAt: { $first: '$createdAt' },
          description: { $first: '$description' },
          roomGuestInfo: { $first: '$roomGuestInfo' },
          category: { $first: '$category'}, // Keep category if needed
          // Collect all Yes/No questions and answers for this review
          yesNoAnswers: {
            $push: {
              questionText: '$questionDetails.text',
              answer: '$answers.answerBoolean' // true/false
            }
          }
        }
      },
      // 6. Project the final structure
      {
        $project: {
          _id: 1, // Keep the review ID
          createdAt: 1,
          description: 1,
          roomGuestInfo: 1,
          yesNoAnswers: 1 // The array of question/answer pairs
        }
      },
      // 7. Sort reviews by date
      { $sort: { createdAt: -1 } }
    ];

    const responses = await Review.aggregate(pipeline);

    res.status(200).json({ status: 'success', results: responses.length, data: responses });

  } catch (error) {
    next(error);
  }
};