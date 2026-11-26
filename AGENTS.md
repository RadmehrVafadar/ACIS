# ACIS Interview Practice

Local AI-assisted repository debugging interviews with Django REST Framework as the default learner stack.
A Node.js session controller hosts a React shell and provisions code-server, PostgreSQL or MongoDB, and real test runners through Docker Compose.

## Commands

```powershell
npm ci                                                # install locked platform dependencies
npm run doctor                                        # check the local Docker engine and Compose
npm run mock                                          # open the exercise library
npm run build                                         # build the React assessment UI
npm run lint                                          # lint JavaScript and TypeScript
uvx ruff check problems templates                     # lint Python and Django exercise sources
npm run lint:docs                                     # lint Markdown
npm run typecheck                                     # check UI and browser test types
npm test                                              # exercise the controller, packs, coach and report parsing
node --test --test-name-pattern="deadline" test/attempts.test.mjs  # run one regression
npm run test:e2e                                      # exercise the actual browser IDE and shell
npm run problem:validate -- blog-django                # validate all Django publishing variants on Docker
```

## Repo map

```text
bin/                User-facing launcher and authoring CLI
server/             Local controller, attempt storage, coaching and Docker operations
web/                React assessment shell
runtime/            Docker workbench, Compose configuration and editor extension
problems/           Bundled interview packs
templates/          Small standalone language templates
shared/blog/        Learner-facing frontend shared by the publishing packs
test/, e2e/         Controller and browser regression coverage
```

## Conventions

- Keep instructor files and correct baseline history out of the materialized candidate workspace.
- Exercise defects are patches against correct code so the project can verify both the failure and the repair.
- Preserve the two visible publishing checks and keep additional verification outside their score.
- Store local attempts, secrets, and QA output outside version control.
- Leave repository work staged and uncommitted.

## Docs

- Before changing the learner experience, read the [product brief](PRODUCT.md) and [studio design](DESIGN.md).
- Before changing lifecycle or student-facing controls, read [practice sessions](docs/practice-sessions.md).
- Before changing model context or authentication, read [AI coach](docs/ai-coach.md).
- Before adding or changing an exercise, read [problem authoring](docs/problem-authoring.md).
