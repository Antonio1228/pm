# Project Management System

A small Node.js/Express project-management dashboard for tracking projects, progress updates, status summaries, and simple report views.

## Portfolio highlights

- Demonstrates a clean full-stack learning project with an Express API and static frontend screens.
- Keeps backend routes, JSON-backed data storage, and frontend views separated enough to explain the architecture in an interview.
- Useful as a compact CRUD/API example without the overhead of a larger framework.
- Includes local development scripts and dependency hygiene through `.gitignore`.

## Features

- Project creation and status tracking.
- Progress report submission.
- Dashboard-style summary views.
- Static frontend pages for project and report workflows.
- Express backend API.
- JSON-file persistence for simple local development.

## Tech stack

- Node.js
- Express
- JavaScript
- Static HTML/CSS/JS frontend
- JSON data files for local persistence

## Local development

```bash
git clone https://github.com/Antonio1228/pm.git
cd pm
npm install
npm start
```

For development with auto-restart:

```bash
npm run dev
```

Run a lightweight syntax check:

```bash
npm test
```

## Project structure

```text
backend/server.js       # Express app and API entry point
backend/routes/         # Backend route handlers
backend/data/           # Local JSON persistence
frontend/               # Static frontend views
package.json            # Root scripts and dependencies
```

## Notes

This is intentionally a small portfolio project. For production use, the next steps would be authentication, database-backed persistence, request validation, integration tests, and deployment configuration.
