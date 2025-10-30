   //controller/FullYearReportController.ts
   import { Request, Response } from 'express';
    import mongoose from 'mongoose';
    import { Review } from '../models/Review';
    import { Question } from '../models/Question';
    import { Composite } from '../models/Composite';

    // ✅ REMOVED: isLeapYear and getDatesInYear functions are no longer needed
    // for this approach.

    /**
     * @route GET /api/dashboard/years
     * @desc Get all years for which reviews exist for a specific category
     */
    export const getAvailableYearss = async (req: Request, res: Response) => {
    try {
        const { category } = req.query;

        if (!category || (category !== 'room' && category !== 'f&b')) {
        return res.status(400).json({ message: 'Invalid or missing category. Must be "room" or "f&b".' });
        }

        const yearsResult = await Review.aggregate([
        {
            $match: {
            category: category as string,
            },
        },
        {
            $project: {
            year: { $year: '$createdAt' },
            },
        },
        {
            $group: {
            _id: '$year',
            },
        },
        {
            $sort: {
            _id: -1, // Sort descending, most recent year first
            },
        },
        {
            $project: {
            _id: 0,
            year: '$_id',
            },
        },
        ]);

        const years = yearsResult.map((y) => y.year);
        res.status(200).json(years);
    } catch (error) {
        console.error('Error fetching available years:', error);
        res.status(500).json({ message: 'Server error while fetching available years.' });
    }
    };

    /**
     * @route GET /api/dashboard/data
     * @desc Get comprehensive dashboard data for a given category and year
     */
    export const getDashboardData = async (req: Request, res: Response) => {
    try {
        const { category, year } = req.query;

        // --- Validation ---
        if (!category || (category !== 'room' && category !== 'f&b')) {
        return res.status(400).json({ message: 'Invalid or missing category. Must be "room" or "f&b".' });
        }

        const yearNum = parseInt(year as string, 10);
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 3000) {
        return res.status(400).json({ message: 'Invalid or missing year.' });
        }

        const startDate = new Date(yearNum, 0, 1); // Jan 1
        const endDate = new Date(yearNum + 1, 0, 1); // Jan 1 of next year

        // --- Step 1: Fetch all questions and composites for the category ---
        // We only average 'rating' type questions
        const questions = await Question.find({
        category,
        questionType: 'rating',
        }).lean();
        const composites = await Composite.find({ category }).lean();

        // --- Step 2: Run the main aggregation ---
        const aggregationResult = await Review.aggregate([
        {
            // Filter by category and date range
            $match: {
            category: category as string,
            createdAt: {
                $gte: startDate,
                $lt: endDate,
            },
            },
        },
        {
            // Deconstruct the answers array
            $unwind: '$answers',
        },
        {
            // Join with questions to filter by questionType
            $lookup: {
            from: 'questions',
            localField: 'answers.question',
            foreignField: '_id',
            as: 'questionDoc',
            },
        },
        {
            $unwind: '$questionDoc',
        },
        {
            // Only include answers that are for 'rating' questions
            $match: {
            'questionDoc.questionType': 'rating',
            'answers.rating': { $exists: true, $ne: null },
            },
        },
        {
            // Project the fields we need for grouping
            $project: {
            _id: 0,
            date: '$createdAt',
            questionId: '$answers.question',
            rating: '$answers.rating',
            },
        },
        {
            // Use $facet to run multiple aggregations in parallel
            $facet: {
            // Part 1: Daily overall average
            dailyBreakdown: [
                {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    dailyAverage: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                },
                },
                {
                $project: {
                    _id: 0,
                    date: '$_id',
                    overallAverage: '$dailyAverage',
                    totalReviews: '$totalReviews',
                },
                },
                { $sort: { date: 1 } },
            ],

            // Part 2: Monthly average per question
            monthlyQuestionAverages: [
                {
                $group: {
                    _id: {
                    month: { $month: '$date' }, // 1-12
                    questionId: '$questionId',
                    },
                    monthlyAverage: { $avg: '$rating' },
                },
                },
                { $sort: { '_id.month': 1 } },
                {
                // Group again to collect months for each question
                $group: {
                    _id: '$_id.questionId',
                    monthlyAvgs: {
                    $push: {
                        month: '$_id.month',
                        avg: '$monthlyAverage',
                    },
                    },
                },
                },
            ],

            // Part 3: Yearly average per question
            yearlyQuestionAverages: [
                {
                $group: {
                    _id: '$questionId',
                    yearlyAverage: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                },
                },
            ],
            },
        },
        ]);

        const result = aggregationResult[0];

        // --- Step 3: Post-processing in JavaScript ---

        // ✅ UPDATED: 3.1: Format Daily Breakdown (Data for available dates only)
        // We no longer fill in the empty days. We just return the data
        // exactly as the database aggregated it.
        const dailyBreakdown = result.dailyBreakdown;


        // 3.2: Format Monthly Question Averages
        const monthlyQuestionAvgMap = new Map<string, Map<number, number>>(
        result.monthlyQuestionAverages.map((q: any) => [
            q._id.toString(),
            new Map(q.monthlyAvgs.map((m: any) => [m.month, m.avg])),
        ])
        );

        const monthlyQuestionAverages = questions.map((q) => {
        // qAvgs is now correctly typed as Map<number, number> | undefined
        const qAvgs = monthlyQuestionAvgMap.get(q._id.toString());
        const averages = [];
        for (let i = 1; i <= 12; i++) {
            // Optional chaining works as intended
            averages.push(qAvgs?.get(i) || 0);
        }
        return {
            questionId: q._id,
            questionText: q.text,
            averages, // [JanAvg, FebAvg, ..., DecAvg]
        };
        });

        // 3.3: Format Yearly Question Averages
        const yearlyQuestionAvgMap = new Map<string, { yearlyAverage: number; totalReviews: number }>(
        result.yearlyQuestionAverages.map((q: any) => [
            q._id.toString(),
            {
            yearlyAverage: q.yearlyAverage,
            totalReviews: q.totalReviews,
            },
        ])
        );

        const yearlyQuestionAverages = questions.map((q) => {
        // qData is now correctly typed as { yearlyAverage: number, totalReviews: number } | undefined
        const qData = yearlyQuestionAvgMap.get(q._id.toString());
        return {
            questionId: q._id,
            questionText: q.text,
            yearlyAverage: qData?.yearlyAverage || 0, // Optional chaining works as intended
            totalReviews: qData?.totalReviews || 0,   // Optional chaining works as intended
        };
        });

        // 3.4: Calculate Composite Averages (based on question averages)
        const monthlyQuestionAveragesByQId = new Map(
        monthlyQuestionAverages.map((q) => [q.questionId.toString(), q.averages])
        );
        const yearlyQuestionAveragesByQId = new Map(
        yearlyQuestionAverages.map((q) => [q.questionId.toString(), q.yearlyAverage])
        );

        const monthlyCompositeAverages = composites.map((c) => {
        const averages: number[] = [];
        for (let i = 0; i < 12; i++) { // For each month (index 0-11)
            let monthSum = 0;
            let questionCount = 0;
            for (const qId of c.questions) {
            const qMonthAvgs = monthlyQuestionAveragesByQId.get(qId.toString());
            if (qMonthAvgs && qMonthAvgs[i] > 0) {
                monthSum += qMonthAvgs[i];
                questionCount++;
            }
            }
            averages.push(questionCount > 0 ? monthSum / questionCount : 0);
        }
        return {
            compositeId: c._id,
            compositeName: c.name,
            averages,
        };
        });
        
        const yearlyCompositeAverages = composites.map((c) => {
        let yearSum = 0;
        let questionCount = 0;
        for (const qId of c.questions) {
            const qYearAvg = yearlyQuestionAveragesByQId.get(qId.toString());
            if (qYearAvg && qYearAvg > 0) {
            yearSum += qYearAvg;
            questionCount++;
            }
        }
        return {
            compositeId: c._id,
            compositeName: c.name,
            yearlyAverage: questionCount > 0 ? yearSum / questionCount : 0,
        };
        });


        // --- Step 4: Return formatted data ---
        res.status(200).json({
        dailyBreakdown, // This is now the sparse array
        monthlyQuestionAverages,
        yearlyQuestionAverages,
        monthlyCompositeAverages,
        yearlyCompositeAverages,
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Server error while fetching dashboard data.' });
    }
    };

