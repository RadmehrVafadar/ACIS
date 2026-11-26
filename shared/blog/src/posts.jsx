import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Filter,
  Pencil,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react";

import { api, categories, dateLabel } from "./api";
import { useResource } from "./hooks";

function Meta({ post }) {
  return (
    <div className="meta">
      <span className={"category " + post.category.toLowerCase()}>{post.category}</span>
      <span>
        <Clock3 size={13} />
        {post.readTime} min read
      </span>
    </div>
  );
}

function Tags({ items }) {
  return (
    <div className="tags">
      {items.map((t, i) => (
        <span key={i}>{t}</span>
      ))}
    </div>
  );
}

function OwnerActions({ post, toast, deleted }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await api("/posts/" + post._id, { method: "DELETE" });
      toast("Post deleted successfully");
      deleted();
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  }
  return confirm ? (
    <div className="confirm">
      <span>Delete post?</span>
      <button className="danger" onClick={remove} disabled={busy}>
        Delete
      </button>
      <button onClick={() => setConfirm(false)} disabled={busy}>
        Cancel
      </button>
    </div>
  ) : (
    <div className="owner-actions">
      <Link className="icon-button" aria-label={"Edit " + post.title} to={"/edit/" + post._id}>
        <Pencil size={17} />
      </Link>
      <button
        className="icon-button"
        aria-label={"Delete " + post.title}
        onClick={() => setConfirm(true)}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

function PostCard({ post }) {
  return (
    <article className="surface story">
      <Meta post={post} />
      <h2>
        <Link to={"/post/" + post._id}>{post.title}</Link>
      </h2>
      <p className="excerpt">{post.excerpt}</p>
      <footer>
        <span className="avatar">{post.author.name[0]}</span>
        <div className="byline">
          <strong>{post.author.name}</strong>
          <small>
            <CalendarDays size={12} />
            {dateLabel(post.createdAt)}
          </small>
        </div>
        <Tags items={post.tags.slice(0, 2)} />
      </footer>
    </article>
  );
}

export function Feed() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const { value, error } = useResource("/posts");
  const search = query.trim().toLowerCase();
  const posts = (value?.posts || []).filter(
    (p) =>
      (category === "All" || p.category === category) &&
      [p.title, p.excerpt, p.author.name].some((s) => s.toLowerCase().includes(search)),
  );
  return (
    <main className="page">
      <div className="page-heading">
        <h1>Discover Stories</h1>
        <p>Explore articles from our community of writers</p>
      </div>
      <div className="search">
        <Search size={20} />
        <input
          aria-label="Search posts"
          placeholder="Search posts..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="filters" aria-label="Filter by category">
        <Filter size={18} />
        {["All", ...categories].map((c) => (
          <button
            key={c}
            aria-pressed={c === category}
            className={c === category ? "primary" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {error || !value ? (
        <p role="status">{error || "Loading posts..."}</p>
      ) : posts.length ? (
        <div className="grid">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Search size={28} />
          <h2>No posts found</h2>
          <p>Try another search or category.</p>
        </div>
      )}
    </main>
  );
}

export function MyPosts({ toast }) {
  const [revision, setRevision] = useState(0);
  const { value, error } = useResource("/posts/my-posts", revision);
  return (
    <main className="page">
      <div className="page-heading heading-row">
        <div>
          <h1>My Posts</h1>
          <p>Manage your published articles</p>
        </div>
        <Link to="/create" className="button primary">
          <SquarePen size={18} />
          Write New Post
        </Link>
      </div>
      {error || !value ? (
        <p role="status">{error || "Loading posts..."}</p>
      ) : value.posts.length === 0 ? (
        <div className="empty">
          <h2>No posts yet</h2>
          <Link to="/create">Write your first post</Link>
        </div>
      ) : (
        <div className="my-list">
          {value.posts.map((post) => (
            <article key={post._id} className="surface own-post">
              <div className="article-tools">
                <Meta post={post} />
                <OwnerActions post={post} toast={toast} deleted={() => setRevision((n) => n + 1)} />
              </div>
              <h2>
                <Link to={"/post/" + post._id}>{post.title}</Link>
              </h2>
              <p className="excerpt">{post.excerpt}</p>
              <small>
                <CalendarDays size={14} />
                Published on {dateLabel(post.createdAt)}
                {new Date(post.updatedAt) - new Date(post.createdAt) > 1000 &&
                  " · Updated " + dateLabel(post.updatedAt)}
              </small>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function ArticleBody({ content }) {
  return (
    <div className="article-body">
      {content.split(/\n\s*\n/).map((text, i) => {
        if (text.startsWith("### ")) return <h3 key={i}>{text.slice(4)}</h3>;
        if (text.startsWith("## ")) return <h2 key={i}>{text.slice(3)}</h2>;
        if (text.startsWith("# ")) return <h2 key={i}>{text.slice(2)}</h2>;
        if (text.startsWith("```"))
          return (
            <pre key={i}>
              <code>{text.split("\n").slice(1, -1).join("\n")}</code>
            </pre>
          );
        return <p key={i}>{text}</p>;
      })}
    </div>
  );
}

export function Article({ user, toast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { value, error } = useResource("/posts/" + id);
  if (!value || error)
    return (
      <main className="page narrow" role="status">
        {error || "Loading article..."}
      </main>
    );
  const p = value.post;
  return (
    <main className="page narrow article">
      <button className="back" onClick={() => navigate(-1)}>
        <ArrowLeft size={17} />
        Back
      </button>
      <div className="article-tools">
        <Meta post={p} />
        {p.author._id === user._id && (
          <OwnerActions post={p} toast={toast} deleted={() => navigate("/my-posts")} />
        )}
      </div>
      <h1>{p.title}</h1>
      <p className="lede">{p.excerpt}</p>
      <div className="author-detail">
        <span className="avatar">{p.author.name[0]}</span>
        <div>
          <strong>{p.author.name}</strong>
          <p>{p.author.bio}</p>
          <small>{dateLabel(p.createdAt)}</small>
        </div>
      </div>
      <ArticleBody content={p.content} />
      <Tags items={p.tags} />
    </main>
  );
}
