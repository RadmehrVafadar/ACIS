import { readFile } from "node:fs/promises";
import Post from "../models/Post.js";
import User from "../models/User.js";

export async function seed() {
  const fixtures = JSON.parse(await readFile(new URL("./seed.json", import.meta.url), "utf8"));
  await Post.deleteMany({});
  await User.deleteMany({});
  const users = await User.insertMany(fixtures.authors.map((author) => ({ ...author, password: "password123" })));
  const owners = new Map(users.map((user) => [user.email, user._id]));
  const articles = fixtures.posts.map(({ email, read_time, ...post }) => ({
    ...post, author: owners.get(email), readTime: read_time,
  }));
  await Post.insertMany(articles);
}
