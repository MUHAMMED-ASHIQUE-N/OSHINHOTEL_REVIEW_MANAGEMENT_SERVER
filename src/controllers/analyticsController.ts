// src/controllers/analyticsController.ts
import { Request, Response, NextFunction } from 'express';
import { Review } from '../models/Review';
import { Composite } from '../models/Composite';
import { Question } from '../models/Question'; // <-- Import Question model
import mongoose from 'mongoose';

type MatchStage = {
  $match: {
    [key: string]: any;
  }
};

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
const getCategoryMatchStage = (category?: string): MatchStage => {
  if (category && (category === 'room' || category === 'f&b' || category === 'cfc')) {
    return { $match: { category: category } };
  }
  return { $match: {} };
};


// @desc    Get key stats (submissions, avg rating)
// @route   GET /api/analytics/stats
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query; // Get category
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string); // ✅ This now supports 'cfc'
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
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', new mongoose.Types.ObjectId(compositeId as string)] },
                    { $in: ['$$questionId', '$questions'] }
                  ]
                }
              }
            },
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



// @desc    Get reviews containing Yes/No answers OR descriptions
// @route   GET /api/analytics/yes-no-responses
export const getYesNoResponses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query;
    // ✅ ADDED 'cfc' to validation
    if (!category || (category !== 'room' && category !== 'f&b' && category !== 'cfc')) {
      return res.status(400).json({ message: 'Valid category (room, f&b, or cfc) is required.' });
    }

    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = { $match: { category: category as string } };

    const pipeline: mongoose.PipelineStage[] = [
      dateMatchStage,
      categoryMatchStage,
      // ✅ 1. Find reviews that have a description OR a "yes_no" answer
      {
        $match: {
          $or: [
            { 'description': { $exists: true, $ne: "" } },
            { 'answers.answerBoolean': { $exists: true } }
          ]
        }
      },
      // 2. Unwind answers, preserving reviews that might have 0 answers (but have a description)
      // Note: With the match above, this will still unwind rating-only answers.
      { $unwind: { path: '$answers', preserveNullAndEmptyArrays: true } },
      // 3. Lookup question details (will be [] if $answers is null)
      {
        $lookup: {
          from: 'questions',
          localField: 'answers.question',
          foreignField: '_id',
          as: 'questionDetails'
        }
      },
      // 4. Unwind question details (will preserve docs where questionDetails is [])
      { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
      // 5. Group back by the original review ID
      {
        $group: {
          _id: '$_id', // Group by Review ID
          createdAt: { $first: '$createdAt' },
          description: { $first: '$description' },
          guestInfo: { $first: '$roomGuestInfo' }, // ✅ Use roomGuestInfo
          category: { $first: '$category' },
          yesNoAnswers: {
            $push: {
              $cond: [
                { $eq: ['$questionDetails.questionType', 'yes_no'] },
                {
                  questionText: '$questionDetails.text',
                  answer: '$answers.answerBoolean', // true/false
                  answerText: '$answers.answerText' // ✅ ADD THIS LINE
                },
                "$$REMOVE"
              ]
            }
          }
        }
      },
      // 6. Project the final structure
      {
        $project: {
          _id: 1,
          createdAt: 1,
          description: 1,
          roomGuestInfo: 1, // ✅ Use roomGuestInfo
          yesNoAnswers: 1
        }
      },
      // 8. Sort reviews by date
      { $sort: { createdAt: -1 } }
    ];

    const responses = await Review.aggregate(pipeline);

    res.status(200).json({ status: 'success', results: responses.length, data: responses });

  } catch (error) {
    next(error);
  }
};


export const getQuestionOverTime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, period, month, questionId, category } = req.query;

    // --- Validation ---
    if (!year || !period || !questionId || !category) {
      return res.status(400).json({ message: 'Year, period, questionId, and category are required.' });
    }
    if (period !== 'Monthly' && period !== 'Weekly') {
      return res.status(400).json({ message: 'Period must be Monthly or Weekly for this endpoint.' });
    }
    if (period === 'Weekly' && (month === undefined || month === null || isNaN(parseInt(month as string)))) {
      return res.status(400).json({ message: 'Month (0-11) is required for weekly period.' });
    }
    let questionObjectId: mongoose.Types.ObjectId;
    try {
      questionObjectId = new mongoose.Types.ObjectId(questionId as string);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid questionId format.' });
    }
    // --- End Validation ---


    const yearNum = parseInt(year as string);
    // Use UTC dates to avoid timezone issues in aggregation
    const yearStartDate = new Date(Date.UTC(yearNum, 0, 1)); // Jan 1st
    const yearEndDate = new Date(Date.UTC(yearNum + 1, 0, 1)); // Jan 1st of next year (exclusive end)

    const categoryMatchStage = getCategoryMatchStage(category as string);

    const pipeline: mongoose.PipelineStage[] = [
      // Match reviews within the year, category, and containing the specific question in answers
      {
        $match: {
          createdAt: { $gte: yearStartDate, $lt: yearEndDate }, // Use $lt for exclusive end date
          category: category as string,
          'answers.question': questionObjectId
        }
      },
      // Unwind answers
      { $unwind: '$answers' },
      // Filter the unwound answers to keep only the one for the specific question
      { $match: { 'answers.question': questionObjectId } },
      // Group by the selected period (Month or Week number) using UTC dates
      {
        $group: {
          _id: {
            // %m: month(01-12), %U: week(00-53, Sunday start), %V: ISO week(01-53, Monday start)
            $dateToString: { format: period === 'Monthly' ? '%m' : '%U', date: '$createdAt', timezone: "UTC" }
          },
          // Calculate the average rating for that question in that period
          averageRating: { $avg: '$answers.rating' } // Assumes question is rating type
        }
      },
      // Format the output
      {
        $project: {
          _id: 0,
          name: '$_id', // Keep the period identifier string (e.g., "01", "42")
          value: { $round: ['$averageRating', 2] }
        }
      },
      // Sort by period identifier
      { $sort: { name: 1 } }
    ];

    // Add filtering by month if period is Weekly
    if (period === 'Weekly') {
      const monthNum = parseInt(month as string); // 0-11 from frontend
      // Add stages to the beginning of the pipeline
      pipeline.unshift(
        { $addFields: { monthOfYearUTC: { $month: { date: '$createdAt', timezone: "UTC" } } } }, // Extract month (1-12) using UTC
        { $match: { monthOfYearUTC: monthNum + 1 } } // Filter by the specific month (1-12)
      );
    }

    const result = await Review.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: result });

  } catch (error) { next(error); }
};
// --- ✅ END: NEW Controller Function ---


// --- ✅ START: NEW Controller Function for Single Question Average ---
// @desc    Get average score for a single question over a date range (Yearly/Custom)
// @route   GET /api/analytics/question-average
export const getQuestionAverage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, questionId, category } = req.query;

    // --- Validation ---
    if (!startDate || !endDate || !questionId || !category) {
      return res.status(400).json({ message: 'startDate, endDate, questionId, and category are required.' });
    }
    let questionObjectId: mongoose.Types.ObjectId;
    try {
      questionObjectId = new mongoose.Types.ObjectId(questionId as string);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid questionId format.' });
    }
    // --- End Validation ---

    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string);

    const pipeline: mongoose.PipelineStage[] = [
      dateMatchStage,
      categoryMatchStage,
      // Match reviews containing the specific question ID in their answers array
      { $match: { 'answers.question': questionObjectId } },
      // Unwind the answers array to process each answer document
      { $unwind: '$answers' },
      // Match only the specific answer document for the target question ID
      { $match: { 'answers.question': questionObjectId } },
      // Group all matching answers together (there's only one question, so _id is constant)
      {
        $group: {
          _id: null, // Group all matched answers into one result
          averageRating: { $avg: '$answers.rating' }, // Calculate average rating
          // Get the question ID (will be the same for all grouped docs)
          questionId: { $first: '$answers.question' }
        }
      },
      {
        $lookup: { // Join with questions collection to get the name (text)
          from: 'questions',
          localField: 'questionId', // Use the questionId saved in $group
          foreignField: '_id',
          as: 'questionDetails'
        }
      },
      // If no reviews matched, $lookup might produce empty questionDetails, handle this
      { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0, // Exclude the grouping ID
          // Use $ifNull to handle cases where no reviews were found
          questionId: { $ifNull: ['$questionId', questionObjectId] }, // Return original ID if lookup failed
          name: { $ifNull: ['$questionDetails.text', 'N/A'] }, // Return 'N/A' if lookup failed
          value: { $ifNull: [{ $round: ['$averageRating', 2] }, null] } // Return null average if no reviews
        }
      }
    ];

    const result = await Review.aggregate(pipeline);

    // Send the single result object, or an object with null value if no data
    res.status(200).json({ status: 'success', data: result[0] || { questionId: questionId, name: 'N/A', value: null } });

  } catch (error) { next(error); }
};



export const getLowRatedReviewsByQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questionId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate questionId
    let questionObjectId: mongoose.Types.ObjectId;
    try {
      questionObjectId = new mongoose.Types.ObjectId(questionId as string);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid questionId format.' });
    }

    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);

    const pipeline: mongoose.PipelineStage[] = [
      // 1. Apply date filter (may be {} if no dates provided)
      dateMatchStage,
      // 2. Ensure the review has an answers element with this question AND rating <= 5 (same array element)
      {
        $match: {
          answers: {
            $elemMatch: {
              question: questionObjectId,
              rating: { $lte: 5 }
            }
          }
        }
      },
      // 3. Unwind answers to work with the matching element
      { $unwind: '$answers' },
      // 4. Keep only the answer element for the specific question with rating <= 5
      {
        $match: {
          'answers.question': questionObjectId,
          'answers.rating': { $lte: 5 }
        }
      },
      // 5. Lookup question details (text)
      {
        $lookup: {
          from: 'questions',
          localField: 'answers.question',
          foreignField: '_id',
          as: 'questionDetails'
        }
      },
      { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
      // 6. Project & coalesce guest fields from possible field names
      {
        $project: {
          _id: 1,
          date: '$createdAt',
          category: 1,
          questionId: '$answers.question',
          questionText: '$questionDetails.text',
          point: '$answers.rating',
          // coalesce guest name: supports roomGuestInfo.name OR roomGuestInfo.name OR guest_name
          guestName: {
            $ifNull: [
              '$roomGuestInfo.name',
              { $ifNull: ['$roomGuestInfo.name', '$guest_name'] }
            ]
          },
          phone: {
            $ifNull: [
              '$roomGuestInfo.phone',
              '$roomGuestInfo.phone'
            ]
          },
          roomNumber: {
            $ifNull: [
              '$roomGuestInfo.roomNumber',
              '$roomGuestInfo.roomNumber',
              '$roomNumber'
            ]
          },
          email: {
            $ifNull: [
              '$roomGuestInfo.email',
              '$roomGuestInfo.email',
              '$email'
            ]
          }
        }
      },
      // 7. Sort: lowest rating first, newest first for same rating
      { $sort: { point: 1, date: -1 } }
    ];

    const rawResults = await Review.aggregate(pipeline);

    // (Optional) debug: dump a sample so you can inspect the exact fields stored in DB
    // console.log('sample raw result:', rawResults[0]);

    // 8. Map to category-specific shape for response
    // const mapped = rawResults.map((r: any) => {
    //   if (r.category === 'room') {
    //     return {
    //       reviewId: r._id,
    //       date: r.date,
    //       questionId: r.questionId,
    //       questionText: r.questionText || null,
    //       guestName: r.guestName || null,
    //       phone: r.phone || null,
    //       roomNumber: r.roomNumber || null,
    //       point: r.point
    //     };
    //   } else { // f&b or cfc
    //     return {
    //       reviewId: r._id,
    //       date: r.date,
    //       questionId: r.questionId,
    //       questionText: r.questionText || null,
    //       email: r.email || null,
    //       point: r.point
    //     };
    //   }
    // });

    res.status(200).json({ status: 'success', count: rawResults.length, data: rawResults });
  } catch (error) {
    next(error);
  }
};

