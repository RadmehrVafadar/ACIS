import mongoose from "mongoose";
import { connect } from "../config/database.js";
import { seed } from "../data/fixtures.js";

await connect();
try {
  await seed();
  console.log("Created 4 authors and 10 posts.");
} finally {
  await mongoose.disconnect();
}
