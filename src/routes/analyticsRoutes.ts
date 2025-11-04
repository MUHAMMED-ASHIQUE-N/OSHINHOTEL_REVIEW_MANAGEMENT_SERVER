// routes/analyticsRoutes.ts
import express from 'express';
import{getCompositeAverages,getQuestionAverages,getStaffPerformance,getStats,getCompositeOverTime, getAvailableYears, getYesNoResponses,getQuestionAverage,getQuestionOverTime,getLowRatedReviewsByQuestion} from '../controllers/analyticsController';
import {getAvailableYearss,getDashboardData} from '../controllers/FullYearReportController'
const router = express.Router();

router.get('/stats', getStats);
router.get('/question-averages', getQuestionAverages);
router.get('/composite-averages', getCompositeAverages);
router.get('/staff-performance', getStaffPerformance);
router.get('/composite-over-time', getCompositeOverTime); // <-- ADD THIS
router.get('/available-years', getAvailableYears); // Add the new route
router.get('/yes-no-responses',getYesNoResponses ); // <-- Add the new route
router.get('/question-over-time', getQuestionOverTime); // Used for Monthly/Weekly question timeline
router.get('/question-average', getQuestionAverage);   // Used for Yearly/Custom question avg
router.get('/full-yearly-report', getDashboardData);
router.get('/years', getAvailableYearss);
router.get('/low-rated-reviews/:questionId',getLowRatedReviewsByQuestion);

export default router;