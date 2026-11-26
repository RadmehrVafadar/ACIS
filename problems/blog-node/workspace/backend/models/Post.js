import mongoose from "mongoose";

const categories = ["Technology", "Lifestyle", "Travel", "Food", "Business", "Health", "Education", "Entertainment"];
const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  category: { type: String, required: true, enum: categories },
  excerpt: { type: String, default: "", trim: true },
  tags: [{ type: String, trim: true }],
  readTime: { type: Number, default: 5 },
  published: { type: Boolean, default: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default mongoose.model("Post", postSchema);
