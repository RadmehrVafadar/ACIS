import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { CheckCircle2, CircleAlert, FileText, House, LogIn, LogOut, SquarePen } from "lucide-react";

import { api, storedUser } from "./api";
import { Article, Feed, MyPosts } from "./posts";
import { PostForm } from "./post-form";
import "./style.css";

function Navigation({ user, logout }) {
  return (
    <header className="topbar">
      <div className="nav-inner">
        <Link className="brand" to="/">
          <span className="brand-mark">B</span>
          <strong>BlogPlatform</strong>
        </Link>
        <nav aria-label="Blog navigation">
          <NavLink className="feed-link" end to="/">
            <House size={17} />
            All Posts
          </NavLink>
          <NavLink to="/my-posts">
            <FileText size={17} />
            My Posts
          </NavLink>
        </nav>
        <div className="account">
          <Link className="button primary write" to="/create" aria-label="Write">
            <SquarePen size={18} />
            <span>Write</span>
          </Link>
          <div className="profile">
            <Link to="/my-posts" className="avatar" aria-label="My Posts">
              {user.name[0]}
            </Link>
            <span>{user.name}</span>
          </div>
          <button className="icon-button" onClick={logout} aria-label="Logout">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Login({ onLogin, toast }) {
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { user } = await api("/auth/login", { method: "POST", body: Object.fromEntries(form) });
      onLogin(user);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-block">
        <div className="brand-mark brand-big">B</div>
        <h1>Welcome Back</h1>
        <p>Sign in to continue to BlogPlatform</p>
        <form className="surface login-form" onSubmit={submit}>
          <label>
            Email Address
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            <LogIn size={18} />
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Editor({ toast }) {
  const { id } = useParams();
  return <PostForm key={id || "new"} id={id} toast={toast} />;
}

function App() {
  const [user, setUser] = useState(storedUser);
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    if (window.parent !== window)
      window.parent.postMessage({ type: "acis-preview-location", url: window.location.href }, "*");
  }, [location]);
  useEffect(() => {
    function historyRequest(event) {
      if (
        event.source === window.parent &&
        event.data?.type === "acis-preview-history" &&
        [-1, 1].includes(event.data.direction)
      ) {
        window.history.go(event.data.direction);
      }
    }
    window.addEventListener("message", historyRequest);
    return () => {
      window.removeEventListener("message", historyRequest);
      clearTimeout(timer.current);
    };
  }, []);
  function toast(text, error = false) {
    setNotice({ text, error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 4500);
  }
  function login(nextUser) {
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
    navigate("/", { replace: true });
  }
  function logout() {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  }
  return (
    <>
      {user && <Navigation user={user} logout={logout} />}
      {notice && (
        <div
          className={"toast " + (notice.error ? "error" : "success")}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />} {notice.text}
        </div>
      )}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login onLogin={login} toast={toast} />}
        />
        {user && (
          <>
            <Route path="/" element={<Feed />} />
            <Route path="/my-posts" element={<MyPosts toast={toast} />} />
            <Route path="/post/:id" element={<Article user={user} toast={toast} />} />
            <Route path="/create" element={<Editor toast={toast} />} />
            <Route path="/edit/:id" element={<Editor toast={toast} />} />
          </>
        )}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
