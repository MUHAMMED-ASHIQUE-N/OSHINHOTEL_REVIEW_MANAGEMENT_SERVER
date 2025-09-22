import mongoose, {Schema, Document} from "mongoose";

export interface IComposite extends Document {
CompositeName: string;
questionIds: mongoose.Types.ObjectId[];
isActicve: boolean;
createdAt: Date;
updatedAt: Date;

}

const compositeSchema = new mongoose.Schema(
    {
        CompositeName: { type: String, required: true, trim: true },
        questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true }],
        isActive: { type: Boolean, default: true },

    }, { timestamps: true }
    // Automatically manages createdAt and updatedAt fields
);

export const Composite = mongoose.model<IComposite>("Composite", compositeSchema);