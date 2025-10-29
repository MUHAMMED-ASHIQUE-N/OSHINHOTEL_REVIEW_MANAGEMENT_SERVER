// import { Request, Response, NextFunction } from 'express';
// import { Review } from '../models/Review';
// import { Composite } from '../models/Composite';
// import { Question } from '../models/Question';
// import mongoose from 'mongoose';

// // --- START: Type Definitions & Helper Functions ---

// // Define a specific type for the $match stage
// type MatchStage = {
//   $match: {
//     [key: string]: any;
//   }
// };

// // Helper to create date match stage
// const getDateMatchStage = (startDate?: string, endDate?: string): MatchStage => {
//   const match: any = {};
//   if (startDate || endDate) {
//     match.createdAt = {};
//     if (startDate) {
//       // Use UTC start of day
//       match.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
//     }
//     if (endDate) {
//       // Use UTC end of day
//       match.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
//     }
//   }
//   return { $match: match };
// };

// // Helper to create category match stage
// const getCategoryMatchStage = (category?: string): MatchStage => {
//   if (category && (category === 'room' || category === 'f&b')) {
//     return { $match: { category: category } };
//   }
//   return { $match: {} }; // Return an empty $match stage
// };

// // --- END: Helper Functions ---


// // --- START: Full Yearly Report Helpers ---

// // Helper to format monthly data
// const formatMonthlyData = (
//   monthlyResults: { name: string; month: number; value: number }[]
// ): { name: string; averages: (number | string)[] }[] => {
//   const groupedByName: { [key: string]: { [key: number]: number } } = {};
//   monthlyResults.forEach(item => {
//     if (!groupedByName[item.name]) {
//       groupedByName[item.name] = {};
//     }
//     groupedByName[item.name][item.month] = item.value;
//   });
//   return Object.entries(groupedByName).map(([name, monthValues]) => {
//     const averages: (number | string)[] = [];
//     for (let i = 1; i <= 12; i++) {
//       averages.push(monthValues[i]?.toFixed(2) ?? '-');
//     }
//     return { name, averages };
//   });
// };

// // Helper 1: Get Question Headers
// const _fetchQuestionHeaders = (category: string) => {
//   return Question.find(
//     { category: category, questionType: 'rating' },
//     'text'
//   ).sort('order').lean();
// };

// // Helper 2: Get Daily Data
// const _fetchDailyData = (dateMatch: MatchStage, categoryMatch: MatchStage, questionHeaders: {_id: mongoose.Types.ObjectId, text: string}[]) => {
//   const questionIdMap = questionHeaders.map(q => ({
//       k: q._id.toString(),
//       v: `$${q._id.toString()}`
//   }));

//   const pipeline: mongoose.PipelineStage[] = [
//     { $match: { ...dateMatch.$match, ...categoryMatch.$match } },
//     { $sort: { createdAt: 1 } },
//     {
//       $addFields: {
//         ratingsMap: {
//           $arrayToObject: {
//             $map: {
//               input: '$answers', as: 'ans', 
//               // ✅ FIX 1: Convert 'k' (key) from ObjectId to String
//               in: { k: { $toString: '$$ans.question' }, v: '$$ans.rating' }
//             }
//           }
//         }
//       }
//     },
//     {
//       $addFields: questionHeaders.reduce((acc, q) => {
//         acc[q._id.toString()] = { $ifNull: [`$ratingsMap.${q._id.toString()}`, null] };
//         return acc;
//       }, {} as any)
//     },
//     {
//       $project: {
//         _id: 0,
//         date: '$createdAt',
//         guestName: { $ifNull: ['$roomGuestInfo.name', null] },
//         roomNumber: { $ifNull: ['$roomGuestInfo.roomNumber', null] },
//         questionRatings: {
//           // ✅ FIX 2: Wrap the JS array 'questionIdMap' in $literal
//           $arrayToObject: { $literal: questionIdMap }
//         },
//         dailyCompositeAvg: "N/A", // Placeholder
//         dailyQuestionAvg: "N/A"  // Placeholder
//       }
//     }
//   ];
//   return Review.aggregate(pipeline);
// };

// // Helper 3: Get Monthly Question Averages
// const _fetchMonthlyQuestions = (dateMatch: MatchStage, categoryMatch: MatchStage) => {
//   const pipeline: mongoose.PipelineStage[] = [
//     { $match: { ...dateMatch.$match, ...categoryMatch.$match } },
//     { $unwind: '$answers' },
//     { $match: { 'answers.rating': { $exists: true, $ne: null } } },
//     {
//       $group: {
//         _id: {
//           month: { $month: { date: '$createdAt', timezone: "UTC" } },
//           questionId: '$answers.question'
//         },
//         averageRating: { $avg: '$answers.rating' }
//       }
//     },
//     { $lookup: { from: 'questions', localField: '_id.questionId', foreignField: '_id', as: 'questionDetails' } },
//     { $unwind: '$questionDetails' },
//     {
//       $project: {
//         _id: 0,
//         name: '$questionDetails.text',
//         month: '$_id.month',
//         value: { $round: ['$averageRating', 2] }
//       }
//     }
//   ];
//   return Review.aggregate(pipeline);
// };

// // Helper 4: Get Monthly Composite Averages
// const _fetchMonthlyComposites = (dateMatch: MatchStage, categoryMatch: MatchStage) => {
//    const pipeline: mongoose.PipelineStage[] = [
//     { $match: { ...dateMatch.$match, ...categoryMatch.$match } },
//     { $unwind: '$answers' },
//     { $match: { 'answers.rating': { $exists: true, $ne: null } } },
//     {
//       $lookup: {
//         from: 'composites',
//         let: { questionId: '$answers.question' },
//         pipeline: [
//           { $match: {
//               ...categoryMatch.$match,
//               $expr: { $in: ['$$questionId', '$questions'] }
//           }}
//         ],
//         as: 'compositeDetails'
//       }
//     },
//     { $unwind: '$compositeDetails' },
//     {
//       $group: {
//         _id: {
//           month: { $month: { date: '$createdAt', timezone: "UTC" } },
//           compositeId: '$compositeDetails._id'
//         },
//         name: { $first: '$compositeDetails.name' },
//         averageRating: { $avg: '$answers.rating' }
//       }
//     },
//     {
//       $project: {
//         _id: 0,
//         name: '$name',
//         month: '$_id.month',
//         value: { $round: ['$averageRating', 2] }
//       }
//     }
//   ];
//   return Review.aggregate(pipeline);
// };

// // Helper 5: Get Yearly Question Averages
// const _fetchYearlyQuestions = (dateMatch: MatchStage, categoryMatch: MatchStage) => {
//   const pipeline: mongoose.PipelineStage[] = [
//       dateMatch,
//       categoryMatch,
//       { $unwind: '$answers' },
//       { $match: { 'answers.rating': { $exists: true, $ne: null } } },
//       { $group: { _id: '$answers.question', averageRating: { $avg: '$answers.rating' } } },
//       { $lookup: { from: 'questions', localField: '_id', foreignField: '_id', as: 'qD' } },
//       { $unwind: '$qD' },
//       { $project: { _id: 0, name: '$qD.text', value: { $round: ['$averageRating', 2] } } },
//       { $sort: { name: 1 } }
//   ];
//   return Review.aggregate(pipeline);
// };

// // Helper 6: Get Yearly Composite Averages
// const _fetchYearlyComposites = (dateMatch: MatchStage, categoryMatch: MatchStage) => {
//   const pipeline: mongoose.PipelineStage[] = [
//       categoryMatch,
//       { $unwind: '$questions' },
//       {
//         $lookup: {
//           from: 'reviews',
//           let: { questionId: '$questions' },
//           pipeline: [
//             dateMatch,
//             categoryMatch,
//             { $unwind: '$answers' },
//             { $match: { $expr: { $eq: ['$answers.question', '$$questionId'] } } },
//             { $project: { rating: '$answers.rating', _id: 0 } }
//           ],
//           as: 'matchingReviews'
//         }
//       },
//       { $unwind: '$matchingReviews' },
//       {
//         $group: {
//           _id: '$_id',
//           name: { $first: '$name' },
//           averageRating: { $avg: '$matchingReviews.rating' }
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           compositeId: '$_id',
//           name: 1,
//           value: { $round: ['$averageRating', 2] }
//         }
//       }
//   ];
//   return Composite.aggregate(pipeline);
// };
// // --- ✅ END: Full Yearly Report Helpers ---


// // --- START: Controller Functions ---

// // @desc    Get key stats
// export const getStats = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { startDate, endDate, category } = req.query;
//     const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
//     const categoryMatchStage = getCategoryMatchStage(category as string);

//     const stats = await Review.aggregate([
//       dateMatchStage,
//       categoryMatchStage,
//       { $unwind: '$answers' },
//       {
//         $group: {
//           _id: null,
//           totalSubmissions: { $addToSet: '$_id' },
//           averageRating: { $avg: '$answers.rating' }
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           totalSubmissions: { $size: '$totalSubmissions' },
//           averageRating: { $round: ['$averageRating', 2] }
//         }
//       }
//     ]);

//     res.status(200).json({ status: 'success', data: stats[0] || { totalSubmissions: 0, averageRating: 0 } });
//   } catch (error) { next(error); }
// };

// // @desc    Get question averages for composite breakdown
// export const getQuestionAverages = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { startDate, endDate, compositeId, category } = req.query;
//     const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
//     const categoryMatchStage = getCategoryMatchStage(category as string);
    
//     const pipeline: mongoose.PipelineStage[] = [
//       dateMatchStage,
//       categoryMatchStage,
//       { $unwind: '$answers' },
//     ];

//     if (compositeId) {
//       const composite = await Composite.findById(compositeId as string);
//       if (composite) {
//         pipeline.push({
//           $match: { 'answers.question': { $in: composite.questions } }
//         });
//       }
//     }

//     pipeline.push(
//       { $group: { _id: '$answers.question', averageRating: { $avg: '$answers.rating' } } },
//       { $lookup: { from: 'questions', localField: '_id', foreignField: '_id', as: 'questionDetails' } },
//       { $unwind: '$questionDetails' },
//       {
//         $project: {
//           _id: 0,
//           name: '$questionDetails.text',
//           questionId: '$_id',
//           value: { $round: ['$averageRating', 2] },
//         }
//       },
//       { $sort: { name: 1 } }
//     );
//     const averages = await Review.aggregate(pipeline);
//     res.status(200).json({ status: 'success', data: averages });
//   } catch (error) { next(error); }
// };

// // @desc    Get composite averages (Yearly/Custom)
// export const getCompositeAverages = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { startDate, endDate, category } = req.query;
//     const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
//     const categoryMatchStage = getCategoryMatchStage(category as string);

//     const pipeline: mongoose.PipelineStage[] = [
//       categoryMatchStage,
//       { $unwind: '$questions' },
//       {
//         $lookup: {
//           from: 'reviews',
//           let: { questionId: '$questions' },
//           pipeline: [
//             dateMatchStage,
//             categoryMatchStage,
//             { $unwind: '$answers' },
//             { $match: { $expr: { $eq: ['$answers.question', '$$questionId'] } } },
//             { $project: { rating: '$answers.rating', _id: 0 } }
//           ],
//           as: 'matchingReviews'
//         }
//       },
//       { $unwind: '$matchingReviews' },
//       { $group: { _id: '$_id', name: { $first: '$name' }, averageRating: { $avg: '$matchingReviews.rating' } } },
//       {
//         $project: {
//           _id: 0,
//           compositeId: '$_id',
//           name: 1,
//           value: { $round: ['$averageRating', 2] }
//         }
//       }
//     ];
//     if (!category) { pipeline.shift(); }
//     const result = await Composite.aggregate(pipeline);
//     res.status(200).json({ status: 'success', data: result });
//   } catch (error) { next(error); }
// };

// // @desc    Get staff performance
// export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { startDate, endDate, category } = req.query;
//     const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
//     const categoryMatchStage = getCategoryMatchStage(category as string);
//     const performance = await Review.aggregate([
//       dateMatchStage,
//       categoryMatchStage,
//       { $unwind: '$answers' },
//       {
//         $group: {
//           _id: '$staff',
//           totalReviews: { $addToSet: '$_id' },
//           averageRating: { $avg: '$answers.rating' }
//         }
//       },
//       {
//         $lookup: {
//           from: 'users',
//           localField: '_id',
//           foreignField: '_id',
//           as: 'staffDetails'
//         }
//       },
//       { $unwind: '$staffDetails' },
//       {
//         $project: {
//           _id: 0,
//           staffId: '$_id',
//           staffName: '$staffDetails.fullName',
//           totalReviews: { $size: '$totalReviews' },
//           averageRating: { $round: ['$averageRating', 2] }
//         }
//       },
//       { $sort: { [req.query.sortBy === 'rating' ? 'averageRating' : 'totalReviews']: -1 } }
//     ]);
//     res.status(200).json({ status: 'success', data: performance });
//   } catch (error) { next(error); }
// };

// // @desc    Get composite score over time (Monthly/Weekly)
// export const getCompositeOverTime = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { year, period, month, compositeId, category } = req.query;
//     if (!year || !period || !compositeId || !category) {
//       return res.status(400).json({ message: 'Year, period, compositeId, and category are required.' });
//     }

//     const yearNum = parseInt(year as string);
//     const startDate = new Date(Date.UTC(yearNum, 0, 1));
//     const endDate = new Date(Date.UTC(yearNum + 1, 0, 1));
    
//     const categoryMatchStage = getCategoryMatchStage(category as string);

//     const pipeline: mongoose.PipelineStage[] = [
//       { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
//       categoryMatchStage,
//       { $unwind: '$answers' },
//       {
//         $lookup: {
//           from: 'composites',
//           let: { questionId: '$answers.question' },
//           pipeline: [
//             { $match: { 
//                 $expr: { 
//                   $and: [
//                     { $eq: ['$_id', new mongoose.Types.ObjectId(compositeId as string)] },
//                     { $in: ['$$questionId', '$questions'] }
//                   ]
//                 } 
//             }},
//           ],
//           as: 'compositeMatch'
//         }
//       },
//       { $match: { 'compositeMatch': { $ne: [] } } },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: period === 'Monthly' ? '%m' : '%U', date: '$createdAt', timezone: "UTC" }
//           },
//           averageRating: { $avg: '$answers.rating' }
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           name: '$_id',
//           value: { $round: ['$averageRating', 2] }
//         }
//       },
//       { $sort: { name: 1 } }
//     ];

//     if (period === 'Weekly') {
//       if (month === undefined || month === null || isNaN(parseInt(month as string))) {
//         return res.status(400).json({ message: 'Month (0-11) is required for weekly period.' });
//       }
//       const monthNum = parseInt(month as string);
//       pipeline.unshift(
//         { $addFields: { monthOfYearUTC: { $month: {date: '$createdAt', timezone: "UTC"} } } },
//         { $match: { monthOfYearUTC: monthNum + 1 } }
//       );
//     }
    
//     const result = await Review.aggregate(pipeline);
//     res.status(200).json({ status: 'success', data: result });
//   } catch (error) { next(error); }
// };

// // @desc    Get available years
// export const getAvailableYears = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const years = await Review.distinct('createdAt', {}).then(dates =>
//       Array.from(new Set(
//         dates
//           .map(date => new Date(date).getFullYear())
//           .filter(year => !isNaN(year))
//       )).sort((a, b) => b - a)
//     );
//     res.status(200).json({ status: 'success', data: { years } });
//   } catch (error) {
//     next(error);
//   }
// };

// // @desc    Get Yes/No responses
// export const getYesNoResponses = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { startDate, endDate, category } = req.query;
//     if (!category || (category !== 'room' && category !== 'f&b')) {
//        return res.status(400).json({ message: 'Valid category (room or f&b) is required.' });
//     }

//     const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
//     const categoryMatchStage = getCategoryMatchStage(category as string);
//     const pipeline: mongoose.PipelineStage[] = [
//       dateMatchStage,
//       categoryMatchStage,
//       { $unwind: '$answers' },
//       { $lookup: { from: 'questions', localField: 'answers.question', foreignField: '_id', as: 'questionDetails' } },
//       { $unwind: '$questionDetails' },
//       { $match: { 'questionDetails.questionType': 'yes_no' } },
//       {
//         $group: {
//           _id: '$_id',
//           createdAt: { $first: '$createdAt' },
//           description: { $first: '$description' },
//           roomGuestInfo: { $first: '$roomGuestInfo' },
//           category: { $first: '$category'},
//           yesNoAnswers: {
//             $push: {
//               questionText: '$questionDetails.text',
//               answer: '$answers.answerBoolean'
//             }
//           }
//         }
//       },
//       {
//         $project: {
//           _id: 1,
//           createdAt: 1,
//           description: 1,
//           roomGuestInfo: 1,
//           yesNoAnswers: 1
//         }
//       },
//       { $sort: { createdAt: -1 } }
//     ];
//     const responses = await Review.aggregate(pipeline);
//     res.status(200).json({ status: 'success', results: responses.length, data: responses });
//   } catch (error) {
//     next(error);
//   }
// };

// // @desc    Get single question score over time (Monthly/Weekly)
// export const getQuestionOverTime = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { year, period, month, questionId, category } = req.query;
//     if (!year || !period || !questionId || !category) {
//       return res.status(400).json({ message: 'Year, period, questionId, and category are required.' });
//     }
//     if (period !== 'Monthly' && period !== 'Weekly') {
//        return res.status(400).json({ message: 'Period must be Monthly or Weekly for this endpoint.' });
//     }
//     if (period === 'Weekly' && (month === undefined || month === null || isNaN(parseInt(month as string)))) {
//        return res.status(400).json({ message: 'Month (0-11) is required for weekly period.' });
//     }
//     let questionObjectId: mongoose.Types.ObjectId;
//     try {
//        questionObjectId = new mongoose.Types.ObjectId(questionId as string);
//     } catch (e) {
//         return res.status(400).json({ message: 'Invalid questionId format.' });
//     }

//     const yearNum = parseInt(year as string);
//     const yearStartDate = new Date(Date.UTC(yearNum, 0, 1));
//     const yearEndDate = new Date(Date.UTC(yearNum + 1, 0, 1));
//     const categoryMatchStage = getCategoryMatchStage(category as string);

//     const pipeline: mongoose.PipelineStage[] = [
//       { $match: {
//           createdAt: { $gte: yearStartDate, $lt: yearEndDate },
//           category: category as string,
//           'answers.question': questionObjectId
//       }},
//       // categoryMatchStage is redundant here
//       { $unwind: '$answers' },
//       { $match: { 'answers.question': questionObjectId } },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: period === 'Monthly' ? '%m' : '%U', date: '$createdAt', timezone: "UTC" }
//           },
//           averageRating: { $avg: '$answers.rating' }
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           name: '$_id',
//           value: { $round: ['$averageRating', 2] }
//         }
//       },
//       { $sort: { name: 1 } }
//     ];

//     if (period === 'Weekly') {
//       const monthNum = parseInt(month as string); // 0-11 from frontend
//       pipeline.unshift(
//         { $addFields: { monthOfYearUTC: { $month: {date: '$createdAt', timezone: "UTC"} } } },
//         { $match: { monthOfYearUTC: monthNum + 1 } }
//       );
//     }
//     const result = await Review.aggregate(pipeline);
//     res.status(200).json({ status: 'success', data: result });
//   } catch (error) { next(error); }
// };

// // @desc    Get average score for a single question (Yearly/Custom)
// export const getQuestionAverage = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const { startDate, endDate, questionId, category } = req.query;
//         if (!startDate || !endDate || !questionId || !category) {
//             return res.status(400).json({ message: 'startDate, endDate, questionId, and category are required.' });
//         }
//         let questionObjectId: mongoose.Types.ObjectId;
//         try {
//            questionObjectId = new mongoose.Types.ObjectId(questionId as string);
//         } catch (e) {
//             return res.status(400).json({ message: 'Invalid questionId format.' });
//         }
        
//         const dateMatchStage = getDateMatchStage(startDate as string, endDate as string);
//         const categoryMatchStage = getCategoryMatchStage(category as string);

//         const pipeline: mongoose.PipelineStage[] = [
//             dateMatchStage,
//             categoryMatchStage,
//             { $match: { 'answers.question': questionObjectId } },
//             { $unwind: '$answers' },
//             { $match: { 'answers.question': questionObjectId } },
//             {
//               $group: {
//                   _id: null,
//                   averageRating: { $avg: '$answers.rating' },
//                   questionId: { $first: '$answers.question' }
//               }
//             },
//             {
//               $lookup: {
//                   from: 'questions',
//                   localField: 'questionId',
//                   foreignField: '_id',
//                   as: 'questionDetails'
//               }
//             },
//             { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
//             {
//               $project: {
//                   _id: 0,
//                   questionId: { $ifNull: ['$questionId', questionObjectId] },
//                   name: { $ifNull: ['$questionDetails.text', 'N/A'] },
//                   value: { $ifNull: [ { $round: ['$averageRating', 2] }, null ] }
//               }
//             }
//         ];
//         const result = await Review.aggregate(pipeline);
//         res.status(200).json({ status: 'success', data: result[0] || { questionId: questionId, name: 'N/A', value: null } });
//     } catch (error) { next(error); }
// };

// // @desc    Get full aggregated report for a given year and category
// // @route   GET /api/analytics/full-yearly-report
// export const getFullYearlyReport = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const { year, category } = req.query;

//         if (!year || !category || (category !== 'room' && category !== 'f&b')) {
//             return res.status(400).json({ message: 'Year and category (room/f&b) are required.' });
//         }

//         const yearNum = parseInt(year as string);
//         const yearStartDate = `${yearNum}-01-01`;
//         const yearEndDate = `${yearNum}-12-31`;

//         const dateMatch = getDateMatchStage(yearStartDate, yearEndDate);
//         const categoryMatch = getCategoryMatchStage(category as string);
        
//         // 1. Get question headers
//         const questionHeaders = await _fetchQuestionHeaders(category as string);
        
//         // 2. Run remaining fetches
//         const [
//             dailyData,
//             monthlyCompositesRaw,
//             monthlyQuestionsRaw,
//             yearlyComposites,
//             yearlyQuestions
//         ] = await Promise.all([
//             _fetchDailyData(dateMatch, categoryMatch, questionHeaders),
//             _fetchMonthlyComposites(dateMatch, categoryMatch),
//             _fetchMonthlyQuestions(dateMatch, categoryMatch),
//             _fetchYearlyComposites(dateMatch, categoryMatch),
//             _fetchYearlyQuestions(dateMatch, categoryMatch)
//         ]);

//         // 3. Format data
//         const formattedQuestionHeaders = questionHeaders.map(q => ({ id: q._id.toString(), text: q.text }));
        
//         const monthlyData = {
//             questions: formatMonthlyData(monthlyQuestionsRaw as any),
//             composites: formatMonthlyData(monthlyCompositesRaw as any)
//         };
        
//         const yearlyData = {
//             questions: yearlyQuestions,
//             composites: yearlyComposites
//         };

//         // 4. Send Response
//         res.status(200).json({
//             status: 'success',
//             data: {
//                 questionHeaders: formattedQuestionHeaders,
//                 dailyData: dailyData as any,
//                 monthlyData: monthlyData,
//                 yearlyData: yearlyData
//             }
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// // --- END: Controller Functions ---