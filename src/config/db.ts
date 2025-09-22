import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.dataBaserURL as string);
        console.log("Database Connected Succsessfulyy");


    } catch (error) {
        if (error instanceof Error) {
      console.error(" MongoDB connection failed:", error.message);
    } else {
      console.error(" Unknown error:", error);
    }
    process.exit(1); // stop app if DB fails
    }

}

export default connectDB;
