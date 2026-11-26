import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";

import { api, categories } from "./api";

const blank = { title: "", category: "Technology", tags: "", excerpt: "", content: "" };

export function PostForm({ id, toast }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api("/posts/" + id, { signal: controller.signal })
      .then(({ post }) => {
        setForm({
          title: post.title,
          category: post.category,
          tags: post.tags.join(", "),
          excerpt: post.excerpt,
          content: post.content,
        });
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(error.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id]);
  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }
  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()) : [],
      excerpt: form.excerpt || form.content.slice(0, 150),
    };
    try {
      await api(id ? "/posts/" + id : "/posts", { method: id ? "PUT" : "POST", body: payload });
      toast(id ? "Post updated successfully" : "Post created successfully");
      navigate("/my-posts");
    } catch (error) {
      console.error(error.message);
      toast(id ? "Failed to update post" : "Failed to create post", true);
    } finally {
      setSubmitting(false);
    }
  }
  if (loading || loadError)
    return (
      <main className="page narrow" role="status">
        {loadError || "Loading post..."}
      </main>
    );
  return (
    <main className="page narrow">
      <div className="page-heading">
        <h1>{id ? "Edit Post" : "Create New Post"}</h1>
        <p>{id ? "Update your published article" : "Share your thoughts with the world"}</p>
      </div>
      <form onSubmit={submit}>
        <div className="surface fields">
          <label>
            <span id="title-label">
              Title <b aria-hidden="true">*</b>
            </span>
            <input
              name="title"
              aria-labelledby="title-label"
              value={form.title}
              onChange={change}
              required
              placeholder="Enter an engaging title..."
            />
          </label>
          <div className="field-pair">
            <label>
              <span id="category-label">
                Category <b aria-hidden="true">*</b>
              </span>
              <select
                name="category"
                aria-labelledby="category-label"
                value={form.category}
                onChange={change}
                required
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Tags
              <input
                name="tags"
                value={form.tags}
                onChange={change}
                placeholder="React, JavaScript, Web Dev (comma-separated)"
              />
            </label>
          </div>
          <label>
            <span id="excerpt-label">Excerpt</span>
            <textarea
              name="excerpt"
              aria-labelledby="excerpt-label"
              aria-describedby="excerpt-count"
              rows="3"
              value={form.excerpt}
              onChange={change}
              placeholder="Brief description of your post (optional)"
            />
            <small id="excerpt-count">{form.excerpt.length}/150 characters</small>
          </label>
          <label>
            <span id="content-label">
              Content <b aria-hidden="true">*</b>
            </span>
            <textarea
              name="content"
              aria-labelledby="content-label"
              aria-describedby="content-help"
              className="content-field"
              rows="18"
              value={form.content}
              onChange={change}
              required
              placeholder="Write your post content here... (Markdown supported)"
            />
            <small id="content-help">Supports Markdown formatting</small>
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" disabled={submitting}>
            <Save size={18} />
            {submitting ? "Saving..." : id ? "Save Changes" : "Publish Post"}
          </button>
          <button type="button" onClick={() => navigate(-1)}>
            <X size={18} />
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
