# 🌱 FoodSave — Food Waste Management Platform

> A web application for tracking food waste, monitoring environmental impact, and helping users build better food-management habits.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)

## 📌 Overview

FoodSave is designed to help users **record daily food waste, understand waste patterns, view environmental impact, and receive practical recommendations for reducing waste**.

The project also includes a Python backend built with **FastAPI, SQLAlchemy, PostgreSQL, Pydantic, and pytest**, providing hands-on experience with full-stack application development and backend API design. fileciteturn25file0L2-L6

## ✨ Key Features

- 📊 **Food Waste Tracking** — Record and monitor food waste over time
- 📈 **Analytics & Reports** — Visualize waste patterns and environmental impact
- 💡 **Waste Reduction Tips** — Provide practical recommendations for reducing food waste
- 🌱 **Environmental Impact** — Track sustainability-related metrics
- 📱 **Responsive Interface** — Designed for desktop, tablet, and mobile use
- 🔐 **Structured Application Backend** — FastAPI backend with database integration

## 🏗️ Architecture

```text
┌─────────────────────────────┐
│       Web Application       │
│     React + TypeScript      │
│       Vite + UI Layer       │
└──────────────┬──────────────┘
               │
               │ HTTP / API
               ▼
┌─────────────────────────────┐
│       FastAPI Backend       │
│     API + Business Logic    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│       SQLAlchemy ORM        │
│        PostgreSQL DB        │
└─────────────────────────────┘
```

## 🛠️ Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI, Lucide React |
| State / Data | TanStack React Query |
| Routing | TanStack Router |
| Forms & Validation | React Hook Form, Zod |
| Charts | Recharts |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL, SQLAlchemy |
| Validation | Pydantic |
| Testing | pytest |
| Code Quality | ESLint, Prettier |

The frontend dependencies and development scripts are defined in `package.json`, including React, TypeScript, Vite, TanStack tooling, Tailwind CSS, Recharts, ESLint, and Prettier. fileciteturn23file0L2-L6

## 🔄 Core Workflow

```text
User Records Food Waste
          ↓
     Application API
          ↓
    Data Validation
          ↓
      Database
          ↓
 Analytics & Reports
          ↓
Environmental Impact + Reduction Insights
```

## 📁 Project Structure

```text
Food-Waste-Management-Platform/
├── backend/
│   ├── app/              # FastAPI application
│   ├── requirements.txt  # Backend dependencies
│   └── foodsave.db       # Local database file
│
├── src/                  # Frontend source code
├── public/               # Static assets
├── package.json          # Frontend configuration
├── eslint.config.js      # ESLint configuration
├── .prettierrc           # Prettier configuration
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- Python 3.10+
- PostgreSQL

### 1. Clone the repository

```bash
git clone https://github.com/rohit78u/Food-Waste-Management-Platform.git
cd Food-Waste-Management-Platform
```

### 2. Frontend setup

```bash
npm install
npm run dev
```

### 3. Backend setup

```bash
cd backend
python -m venv venv
```

**Windows:**

```bash
venv\Scripts\activate
```

**macOS / Linux:**

```bash
source venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

## 🧪 Testing

The backend includes pytest as its testing framework. fileciteturn25file0L2-L6

Run backend tests with:

```bash
cd backend
pytest
```

## 🔍 Code Quality

Frontend development includes ESLint and Prettier configuration. fileciteturn23file0L2-L6

Run linting with:

```bash
npm run lint
```

Format the project with:

```bash
npm run format
```

## 🎯 What This Project Demonstrates

- Building a complete web application around a real-world sustainability problem
- Designing a **Python/FastAPI backend**
- Working with **SQLAlchemy and PostgreSQL**
- Building frontend interfaces with **React and TypeScript**
- Managing API data with **TanStack React Query**
- Creating data visualizations with **Recharts**
- Implementing frontend validation and form handling
- Applying linting and formatting workflows
- Writing backend tests with **pytest**

## 📌 Project Status

FoodSave is a portfolio project focused on demonstrating full-stack development, backend API development, data visualization, and sustainability-oriented application design.

## 🔮 Future Improvements

- Add authentication and user accounts
- Add richer historical analytics
- Add automated personalized recommendations
- Add production deployment
- Add comprehensive frontend and backend test coverage

## 📄 License

MIT
