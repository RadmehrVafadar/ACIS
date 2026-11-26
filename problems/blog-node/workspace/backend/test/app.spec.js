import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import { connect } from "../config/database.js";
import { seed } from "../data/fixtures.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

describe("Post Creation", function () {
  let john;
  before(async () => { await connect({ test: true }); });
  beforeEach(async () => {
    await seed();
    john = await User.findOne({ email: "john@example.com" });
  });
  after(async () => { await mongoose.disconnect(); });

  it("returns the expected response structure and submitted values", async () => {
    const payload = {
      title: "Publishing an API", content: "An account of a release from a library maintainer.",
      category: "Technology", excerpt: "The release notes.", tags: ["api", "release", "design"], readTime: 5,
    };
    const res = await request(app).post("/api/posts").set("x-user-id", john.id).send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Post created successfully");
    const post = res.body.post;
    for (const [key, value] of Object.entries(payload)) assert.deepEqual(post[key], value);
    assert.equal(post.published, true);
    assert.deepEqual(post.author, { _id: john.id, name: john.name, email: john.email, bio: john.bio });
  });

  it("persists a post that can be retrieved under My Posts", async () => {
    const payload = {
      title: "Train notes", content: "A short journal entry from a sleeper train.",
      category: "Travel", excerpt: "Night on the rails.", tags: ["trains", "travel", "journal"], readTime: 3,
    };
    const res = await request(app).post("/api/posts").set("x-user-id", john.id).send(payload);
    assert.equal(res.status, 201);
    const id = res.body.post._id;
    const stored = await Post.findById(id).lean();
    assert.ok(stored);
    for (const [key, value] of Object.entries(payload)) assert.deepEqual(stored[key], value);
    assert.equal(stored.published, true);
    assert.equal(stored.author.toString(), john.id);
    const list = await request(app).get("/api/posts/my-posts").set("x-user-id", john.id);
    assert.equal(list.status, 200);
    assert.ok(list.body.posts.some((post) => post._id === id && post.title === payload.title));
  });
});
