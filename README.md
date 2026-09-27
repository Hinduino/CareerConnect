# CareerConnect

## Objective

CareerConnect is an online platform designed to help job seekers and recruiters manage their job-search activities. Job seekers can explore job opportunities, create profiles, upload and manage resumes, submit applications, and track their application progress. Recruiters can create and manage job postings and connect with potential candidates.

CareerConnect aims to centralize the job-search process and make it easier for job seekers and recruiters to manage their activities in one place.

## Problem

Job seekers may have to manage job opportunities, resumes, applications, and application updates across different platforms.

Students may also feel overwhelmed by the amount of information available and have difficulty identifying the right opportunities for their next career step, whether after graduation or during an internship search.

CareerConnect aims to reduce this complexity by centralizing these activities and helping users find opportunities that better match their career goals.

## Proposed Solution

CareerConnect aims to reduce this complexity by centralizing job-search activities in one platform and helping users find opportunities that better match their career goals.

## Proposed Features

- User registration, authentication, and profile management
- Resume upload and management
- Job posting management for recruiters
- Job search and filtering
- Job application submission
- Application status tracking (Applied, Interview, Offered, Rejected)
- Application history dashboard
- Notifications and reminders for application deadlines
- Saved jobs and favourites
- AI-assisted resume feedback or job-matching suggestions

Additional team generated and GenAI features will be documented separately according to the project requirements.

## Team Members

- Hind Houfaidi 
- Kavya Patel 
- Samuel charchar 
- Nazila Hoche Abdi 
- Thanh Samdara Thach 
- Johnny Quach

## Technologies

### Frontend
- React
- CSS
- Vite

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Authentication
- JSON Web Token (JWT)
- bcryptjs

### Development & Collaboration
- Git & GitHub
- Atlassian Jira
- Visual Studio Code
- Microsoft Teams

## Project Setup

Clone the GitHub repository and open two separate terminal windows.

**Backend Setup:**  
In the first terminal, navigate to the server directory and run `npm install` to install the required backend dependencies. Start the API using `node server.js`. The backend runs on port 3000.

**Frontend Setup:**  
In the second terminal, navigate to the client directory and run `npm install` to install the required frontend dependencies. Start the application using `npm run dev`. The frontend runs on port 5173.

**Database Setup:**  
The project uses MongoDB with Mongoose. Create a `.env` file and add the MongoDB connection string as `MONGO_URI`. Ensure that your IP address is authorized in MongoDB Atlas before starting the backend.

**Authentication Setup:**  
Add a secure `JWT_SECRET` to the `.env` file. The application uses bcryptjs for password hashing and JSON Web Tokens (JWT) for user authentication. The `.env` file must not be committed to GitHub.

**Development and Collaboration:**  
Development is managed using Git and GitHub with separate branches, pull requests, and peer reviews before changes are merged into `main`. Jira is used for task and sprint management, while Microsoft Teams is used for team communication and pull request coordination.