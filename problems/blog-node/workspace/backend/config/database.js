import mongoose from "mongoose";

export function connect({ test = false } = {}) {
  const live = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/blog";
  const isolated = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/blog_test";
  if (test && new URL(live).pathname === new URL(isolated).pathname) {
    throw new Error("Use a distinct database name for test data.");
  }
  return mongoose.connect(test ? isolated : live, { serverSelectionTimeoutMS: 5000 });
}
