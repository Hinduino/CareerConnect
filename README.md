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

Clone the GitHub repository, install Node.js 20.19.0 or newer, and open two terminal windows in the repository.

**AI Chatbot Setup:**
The chatbot sends requests to the [Kilo AI Gateway](https://kilo.ai/docs/gateway) without an API key, using Kilo's anonymous `kilo-auto/free` model. Kilo dynamically selects an available free model for each chat, so no model configuration is needed. The server adds up to 20 public job listings to chat context; for signed-in users, it also includes a limited profile summary and their own 25 most recent applications. Users can also attach PDF, DOC, and DOCX files up to 5MB. The server extracts up to 12,000 characters of text in memory and sends that text to Kilo with each chat request while the document remains attached; uploaded files are not stored by the chat endpoint. Document requests use a smaller database context, the six latest conversation messages, and a 90-second Kilo timeout to limit prompt size and allow longer model responses. These details are sent to Kilo to generate replies. Do not enter sensitive information in chat. Anonymous requests are subject to Kilo's rate limits.

**Backend Setup:**  
In the first terminal, run `cd server` and `npm install`, then start the API with `npm start`. The backend runs on port 3000. The start script launches `src/server.js`.

**Frontend Setup:**  
In the second terminal, run `cd client` and `npm install`, then start the application with `npm run dev`. The frontend runs on port 5173. The client does not define an `npm start` script.

**Database Setup:**  
The project uses MongoDB with Mongoose. Create a `.env` file in the repository root and add the MongoDB connection string as `MONGO_URI`. Ensure that your IP address is authorized in MongoDB Atlas before starting the backend. The backend loads this root file whether you start it from the repository root or the `server` directory.

**Authentication Setup:**  
Add a secure `JWT_SECRET` to the `.env` file. The application uses bcryptjs for password hashing and JSON Web Tokens (JWT) for user authentication. The `.env` file must not be committed to GitHub.

**Development and Collaboration:**  
Development is managed using Git and GitHub with separate branches, pull requests, and peer reviews before changes are merged into `main`. Jira is used for task and sprint management, while Microsoft Teams is used for team communication and pull request coordination.