import User from "../models/User.js";

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
  if (!user || user.password !== password) return res.status(401).json({ message: "Invalid email or password" });
  const { _id, name, bio } = user;
  return res.json({ message: "Login successful", user: { _id, name, email: user.email, bio } });
}

export async function me(req, res) {
  const user = await User.findById(req.get("x-user-id"));
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user });
}
