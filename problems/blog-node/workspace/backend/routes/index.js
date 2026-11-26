import { Router } from "express";
import { login, me } from "../controllers/authController.js";
import { createPost, listPosts, myPosts, postDetail } from "../controllers/postController.js";

const routes = Router();
const handle = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
function identity(req, res, next) {
  if (!req.get("x-user-id")) return res.status(401).json({ message: "Please sign in." });
  next();
}

routes.post("/auth/login", handle(login));
routes.get("/auth/me", identity, handle(me));
routes.get("/posts", handle(listPosts));
routes.get("/posts/my-posts", identity, handle(myPosts));
routes.post("/posts", identity, handle(createPost));
routes.get("/posts/:id", handle(postDetail));
routes.put("/posts/:id", identity, handle(postDetail));
routes.delete("/posts/:id", identity, handle(postDetail));

export default routes;
