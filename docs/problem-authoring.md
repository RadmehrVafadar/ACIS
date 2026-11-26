# Author a practice problem

A problem pack contains the correct project, the learner's prompt, visible tests, and one or more private patches that introduce the interview defect.

## Create a Django problem

From the repository root, run:

```powershell
npm run problem:new -- ticket-search --template django
```

This creates `problems/ticket-search/` from the runnable ticket-pagination example.
It already contains migrations, PostgreSQL setup, a seeded queue, two API tests, and a reversible defect.
Use `--template python` or `--template node` for a smaller standalone reading-queue service.
The default template is Django.

```text
problems/ticket-search/
  problem.json
  prompt.md
  workspace/
  instructor/variants/
    01.patch
    01.md
```

1. Edit `prompt.md` and the workspace README with the symptom, reproduction steps, and expected result.
2. In `workspace/`, implement the **correct** behavior and add visible tests that demonstrate the full requirement.
3. Edit the versioned manifest with the title, description, runtime, commands, database, protected paths, ports, and intended failure count.
4. Introduce a deliberate defect in a disposable copy of the correct project and save its unified diff as `instructor/variants/01.patch`.
5. Write the post-attempt explanation in the matching `01.md`.
   Keep descriptions, fixtures, and public file names free of repair instructions.

## Make a variant patch

The patch paths must be relative to the candidate workspace, such as `a/backend/tickets/views.py` and `b/backend/tickets/views.py`.
The patch goes from correct code to faulty code.
To produce it from an isolated scratch directory in PowerShell:

```powershell
$pack = (Resolve-Path 'problems/ticket-search').Path
$scratch = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
Copy-Item -LiteralPath (Join-Path $pack 'workspace') -Destination $scratch -Recurse
git -C $scratch init --quiet
git -C $scratch add .
# Edit the scratch copy to introduce the defect, then export just that change.
git -C $scratch diff --output="$pack/instructor/variants/01.patch"
```

The temporary Git index captures the correct version without a commit.
Use an existing candidate file or run `git add -N` in the scratch copy for a new file that belongs in the patch.
Each extra variant gets a unique ID, a patch, a debrief, and a declared expected number of failing test cases.

## Runtime contract

| Manifest field | Meaning |
| --- | --- |
| `id`, `title`, `description`, `durationMinutes` | Folder ID, learner-facing catalog entry, and timer allocation. |
| `runtime`, `database` | Choose `django`, `python`, or `node` and `postgres`, `mongo`, or `none`. |
| `install`, `seed`, `run`, `test` | An executable and arguments for each operation, run inside Linux from `/workspace`. |
| `ports` | Internal port, label, and HTTP readiness path for each preview. Services must listen on `0.0.0.0`. |
| `protected` | Paths relative to the delivered workspace whose deletion or modification invalidates the grade. |
| `variants` | Variant IDs and expected failing test counts, in seed rotation order. |
| `sharedBlog` | Copies the shared React blog into `frontend/` for the two publishing exercises. |

Use migrations and a repeatable seed command.
PostgreSQL settings come from `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`.
Mongo packs receive `MONGODB_URI` and `MONGODB_TEST_URI`.
Use a dedicated test database.
The test command must run real assertions, exit with their outcome, and write JUnit XML to `ACIS_REPORT`.
Point the test command at the protected assessment cases so learners can add their own tests without changing the score.
The supplied Python and Node test scripts demonstrate the report contract.

## Validate and practice

```powershell
npm run problem:validate -- ticket-search
npm run mock -- --problem ticket-search --seed 0
```

Validation provisions the pack, checks the passing project, applies each defect, runs its tests, starts the app, reverses the patch, and confirms the repair.
Successful validation writes a content digest to the pack's `validation.json` and makes it available in the library.
Include that file when sharing a validated pack from Git.
Editing a pack or its shared frontend requires revalidation before starting new attempts.
Existing attempts retain their original starter and assessment instructions.
