# Blog Platform (MERN): Post Creation

This is a blogging platform where people discover, read, and share posts.
Publishing a valid article should persist it and immediately show it under My Posts.

## Expected API behavior

`POST /api/posts` accepts JSON and identifies the author through the `x-user-id` header.
Title, content, and category are required.
Supported categories are Technology, Lifestyle, Travel, Food, Business, Health, Education, and Entertainment.
Preserve supplied tags and reading time, default tags to an empty array, and estimate omitted reading time at 200 words per minute rounded up.
Use the first 150 characters of the content when the excerpt is missing or empty.

Return HTTP 201 with `message` set to `Post created successfully` and a `post` object.
The saved post includes `_id`, title, content, category, excerpt, tags, `readTime`, timestamps, `published: true`, and a populated author with `_id`, name, email, and bio.
The saved ID must be retrievable from the database and `GET /api/posts/my-posts` for that author.

## Reproduce

1. Select **Run** to open **Blog** on port 8000.
2. Sign in with `john@example.com` and `password123`.
3. Select **Write**, fill in the required fields, and publish.
4. Open **My Posts** and refresh to check persistence.

## Commands

```bash
bash setup.sh
bash seed.sh
bash run.sh
bash test.sh
npm --prefix backend test -- --grep 'response'
```

The live and test databases are separate.
Reseeding restores the ten sample posts and four sample accounts in the live database.
From the repository root, `npm start`, `npm test`, and `npm run seed` also run the corresponding commands above.

## Protected files

The following files are part of the exercise contract.
Editing or deleting one invalidates a submission.

- `README.md`
- `setup.sh`
- `seed.sh`
- `test.sh`
- `backend/config/database.js`
- `backend/data/seed.json`
- `backend/test/app.spec.js`
- `backend/reporter.json`
