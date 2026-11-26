# Issue: Post Creation

People can sign in and browse the blog, but a valid new post does not publish correctly.
Repair the backend publishing workflow in this repository.

## Reproduce

1. Choose **Run** and open the **Blog** preview on port 8000.
2. Sign in with `john@example.com` and `password123`.
3. Open **Write**, enter a title and content, choose a category, and select **Publish Post**.
4. Compare the result with **My Posts**, then run the two integration tests.

A successful submission shows the new article at the top of My Posts, including after a refresh.
The repository README specifies the API and protected files.
