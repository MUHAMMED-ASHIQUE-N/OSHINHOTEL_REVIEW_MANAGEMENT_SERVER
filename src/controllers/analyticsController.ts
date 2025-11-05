import { Request, Response, NextFunction } from 'express';
import { Review } from '../models/Review';
import { Composite } from '../models/Composite';
import { Question } from '../models/Question';
import mongoose from 'mongoose';
import { IUser } from '../models/User'; // <-- ADDED

// <-- ADDED: Define a custom Request type to access req.user
interface RequestWithUser extends Request {
  user?: IUser;
}

type MatchStage = {
  $match: {
    [key: string]: any;
  }
};

// Helper to create date match stage (No changes)
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

// Helper: Create category match stage (No changes)
const getCategoryMatchStage = (category?: string): MatchStage => {
  if (category && (category === 'room' || category === 'f&b' || category === 'cfc')) {
    return { $match: { category: category } };
  }
  return { $match: {} };
};

// <-- ADDED: New helper to create hotel/location match stage
const getHotelMatchStage = (req: RequestWithUser): MatchStage => {
    const user = req.user;

    // If user exists and has a hotelId, create a match stage
    // A 'viewer' might be a super-user, so we explicitly check if the role is NOT viewer
    // Adjust this logic if viewers should also be tied to a hotel
    if (user && user.hotelId && user.role !== 'viewer') {
        return { $match: { hotelId: new mongoose.Types.ObjectId(user.hotelId as any) } };
    }

    // If user is Super Admin (no hotelId) or a global viewer, return an empty match
    // to show data from all hotels.
    return { $match: {} };
};


// @desc    Get key stats (submissions, avg rating)
// @route   GET /api/analytics/stats
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query;
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string);
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const stats = await Review.aggregate([
        hotelMatchStage, // <-- ADDED: Filter by hotel first
        dateMatchStage,
        categoryMatchStage,
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

// @desc    Get average rating for each question
// @route   GET /api/analytics/question-averages
export const getQuestionAverages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, compositeId, category } = req.query;
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string);
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
        hotelMatchStage, // <-- ADDED
        dateMatchStage,
        categoryMatchStage,
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
          compositeId: '$_id', 
          value: { $round: ['$averageRating', 2] },
        }
      },
      { $sort: { name: 1 } }
    );

    const averages = await Review.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: averages });
  } catch (error) { next(error); }
};

// @desc    Get average rating for each composite group
// @route   GET /api/analytics/composite-averages
export const getCompositeAverages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query;
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string);
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
      { $match: { category: category as string } },
      { $unwind: '$questions' },
      {
        $lookup: {
          from: 'reviews',
          let: { questionId: '$questions' },
          pipeline: [
            hotelMatchStage, // <-- ADDED: Filter reviews inside the lookup
              dateMatchStage,
              categoryMatchStage, 
              { $unwind: '$answers' },
              { $match: { $expr: { $eq: ['$answers.question', '$$questionId'] } } },
              { $project: { rating: '$answers.rating', _id: 0 } }
          ],
          as: 'matchingReviews'
        }
      },
      { $unwind: '$matchingReviews' },
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
          value: { $round: ['$averageRating', 2] }
        }
      }
    ];

    if (!category) {
      pipeline.shift();
    }

    const result = await Composite.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) { next(error); }
};


// @desc    Get staff performance leaderboard
// @route   GET /api/analytics/staff-performance
export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, category } = req.query;
    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = getCategoryMatchStage(category as string);
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const performance = await Review.aggregate([
        hotelMatchStage, // <-- ADDED
        dateMatchStage,
        categoryMatchStage,
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

// @desc    Get composite score over time (for line/bar charts)
// @route   GET /api/analytics/composite-over-time
export const getCompositeOverTime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, period, month, compositeId, category } = req.query;

    if (!year || !period || !compositeId) {
      return res.status(400).json({ message: 'Year, period, and compositeId are required.' });
    }

    const yearNum = parseInt(year as string);
    const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);

    const categoryMatchStage = getCategoryMatchStage(category as string);
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
        hotelMatchStage, // <-- ADDED
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        categoryMatchStage, 
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
    // <-- MODIFIED: Get hotel match stage
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser);

    // Find all distinct years from the 'createdAt' field in reviews
    const years = await Review.distinct('createdAt', hotelMatchStage.$match).then(dates => // <-- MODIFIED: Apply filter
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
    if (!category || (category !== 'room' && category !== 'f&b' && category !== 'cfc')) {
      return res.status(400).json({ message: 'Valid category (room, f&b, or cfc) is required.' });
    }

    const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
    const categoryMatchStage = { $match: { category: category as string } };
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
        hotelMatchStage, // <-- ADDED
        dateMatchStage,
        categoryMatchStage,
        // 1. Find reviews that have a description OR a "yes_no" answer
        {
          $match: {
            $or: [
              { 'description': { $exists: true, $ne: "" } },
              { 'answers.answerBoolean': { $exists: true } }
            ]
          }
        },
        // 2. Unwind answers...
        { $unwind: { path: '$answers', preserveNullAndEmptyArrays: true } },
        // 3. Lookup question details...
        {
          $lookup: {
            from: 'questions',
            localField: 'answers.question',
            foreignField: '_id',
            as: 'questionDetails'
          }
        },
        // 4. Unwind question details...
        { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
        // 5. Group back by the original review ID
        {
          $group: {
            _id: '$_id', // Group by Review ID
            createdAt: { $first: '$createdAt' },
            description: { $first: '$description' },
    // <-- MODIFIED: Check the correct guestInfo field
            guestInfo: { $first: '$guestInfo' }, 
            category: { $first: '$category' },
            yesNoAnswers: {
              $push: {
                $cond: [
                  { $eq: ['$questionDetails.questionType', 'yes_no'] },
                  {
                    questionText: '$questionDetails.text',
                    answer: '$answers.answerBoolean',
                    answerText: '$answers.answerText'
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
            guestInfo: 1, // <-- MODIFIED
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
    // ... more validation ...
    let questionObjectId: mongoose.Types.ObjectId;
    try {
      questionObjectId = new mongoose.Types.ObjectId(questionId as string);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid questionId format.' });
    }
    // --- End Validation ---


    const yearNum = parseInt(year as string);
    const yearStartDate = new Date(Date.UTC(yearNum, 0, 1));
    const yearEndDate = new Date(Date.UTC(yearNum + 1, 0, 1));

    // const categoryMatchStage = getCategoryMatchStage(category as string); // Not needed, $match below has it
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
        hotelMatchStage, // <-- ADDED
        // Match reviews within the year, category, and containing the specific question in answers
        {
          $match: {
            createdAt: { $gte: yearStartDate, $lt: yearEndDate },
            category: category as string,
            'answers.question': questionObjectId
          }
        },
        // Unwind answers
        { $unwind: '$answers' },
        // Filter the unwound answers to keep only the one for the specific question
        { $match: { 'answers.question': questionObjectId } },
        // Group by the selected period
        {
          $group: {
            _id: {
              $dateToString: { format: period === 'Monthly' ? '%m' : '%U', date: '$createdAt', timezone: "UTC" }
            },
            averageRating: { $avg: '$answers.rating' }
          }
        },
        // Format the output
        {
          $project: {
            _id: 0,
            name: '$_id',
            value: { $round: ['$averageRating', 2] }
          }
        },
        { $sort: { name: 1 } }
    ];

    // Add filtering by month if period is Weekly
    if (period === 'Weekly') {
      const monthNum = parseInt(month as string); // 0-11 from frontend
      pipeline.unshift(
        { $addFields: { monthOfYearUTC: { $month: { date: '$createdAt', timezone: "UTC" } } } }, 
        { $match: { monthOfYearUTC: monthNum + 1 } } 
      );
    }

    const result = await Review.aggregate(pipeline);
    res.status(200).json({ status: 'success', data: result });

  } catch (error) { next(error); }
};
// --- ✅ END: NEW Controller Function ---


// --- ✅ START: NEW Controller Function for Single Question Average ---
// @desc    Get average score for a single question over a date range (Yearly/Custom)
// @route   GET /api/analytics/question-average
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
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
        hotelMatchStage, // <-- ADDED
        dateMatchStage,
        categoryMatchStage,
        { $match: { 'answers.question': questionObjectId } },
        { $unwind: '$answers' },
        { $match: { 'answers.question': questionObjectId } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$answers.rating' },
            questionId: { $first: '$answers.question' }
          }
        },
        {
          $lookup: { 
            from: 'questions',
            localField: 'questionId',
            foreignField: '_id',
            as: 'questionDetails'
          }
        },
        { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0, 
            questionId: { $ifNull: ['$questionId', questionObjectId] }, 
            name: { $ifNull: ['$questionDetails.text', 'N/A'] }, 
            value: { $ifNull: [{ $round: ['$averageRating', 2] }, null] } 
          }
        }
   ];

    const result = await Review.aggregate(pipeline);

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
    const hotelMatchStage = getHotelMatchStage(req as RequestWithUser); // <-- ADDED

    const pipeline: mongoose.PipelineStage[] = [
        hotelMatchStage, // <-- ADDED
        dateMatchStage,
        // 2. Find reviews with a low-rated answer for this question
        {
          $match: {
            answers: {
              $elemMatch: {
                question: questionObjectId,
                rating: { $lte: 5, $gt: 0 } 
              }
            }
          }
        },
        // 3. Unwind answers
        { $unwind: '$answers' },
        // 4. Keep only the specific low-rated answer
        {
          $match: {
            'answers.question': questionObjectId,
            'answers.rating': { $lte: 5, $gt: 0 }
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
        
        // 6. Project the fields...
        {
          $project: {
            _id: 1,
            date: '$createdAt',
            category: 1,
            questionId: '$answers.question',
            questionText: '$questionDetails.text',
            point: '$answers.rating',
            
            // <-- MODIFIED: Check the correct guestInfo field
            guestName: { $ifNull: ['$guestInfo.name', null] },
            phone: { $ifNull: ['$guestInfo.phone', null] },
            roomNumber: { $ifNull: ['$guestInfo.roomNumber', null] },
            email: { $ifNull: ['$guestInfo.email', null] }
          }
     },
        // 7. Sort: lowest rating first, newest first for same rating
        { $sort: { point: 1, date: -1 } }
    ];

    const rawResults = await Review.aggregate(pipeline);

    res.status(200).json({ status: 'success', count: rawResults.length, data: rawResults });
  } catch (error) {
    next(error);
  }
};