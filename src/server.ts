import express, { Request, Response } from "express";
import dotenv from "dotenv";
import connectDB from "./config/db";
import router from "./routes";
const app = express();
dotenv.config();

const PORT = process.env.PORT ;

// Connect to Database
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/v1',router);

app.use((req: Request, res: Response) => {
    res.status(404).json({ message: "Route not found" });
}
);

app.listen(PORT, ()=> {
    console.log(`Server is running on port ${PORT}`);
})