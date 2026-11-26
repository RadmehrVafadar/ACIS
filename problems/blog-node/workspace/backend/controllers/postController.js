import Post from "../models/Post.js";

const profile = "name email bio";
const newest = { createdAt: -1, _id: -1 };

export async function listPosts(_req, res) {
  const posts = await Post.find({ published: true }).populate("author", profile).sort(newest);
  res.json({ posts });
}

export async function myPosts(req, res) {
  const posts = await Post.find({ author: req.get("x-user-id") }).populate("author", profile).sort(newest);
  res.json({ posts });
}

export async function createPost(req, res) {
  const { title, content, category, excerpt, tags, readTime } = req.body;
  const post = new Post({
    title, content, category, author: req.get("x-user-id"),
    excerpt: excerpt || content.slice(0, 150),
    tags: tags ?? [], readTime: readTime ?? Math.ceil(content.trim().split(/\s+/).length / 200),
  });
  await post.save();
  await post.populate("author", profile);
  res.status(201).json({ message: "Post created successfully", post });
}

export async function postDetail(req, res) {
  const post = await Post.findById(req.params.id).populate("author", profile);
  if (!post) return res.status(404).json({ message: "Post not found" });
  if (req.method === "GET") return res.json({ post });
  if (!post.author._id.equals(req.get("x-user-id"))) return res.status(403).json({ message: "Only the author can change this post" });
  if (req.method === "DELETE") {
    await post.deleteOne();
    return res.json({ message: "Post deleted successfully" });
  }
  for (const key of ["title", "content", "category", "excerpt", "tags", "readTime", "published"]) {
    if (Object.hasOwn(req.body, key)) post[key] = req.body[key];
  }
  if (req.body.content && req.body.readTime == null) post.readTime = Math.ceil(req.body.content.trim().split(/\s+/).length / 200);
  await post.save();
  return res.json({ message: "Post updated successfully", post });
}
