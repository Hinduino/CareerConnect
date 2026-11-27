// SCRUM-373: Integration tests for SCRUM-341 (Notifications and Reminders).
// They run the real Express app against an in-memory MongoDB, so each test checks the
// whole flow: route -> query -> notification saved -> notification shown on the dashboard.
// The basic "a notification is sent" cases are already in application.integration.test.js
// and server.integration.test.js; this file covers the remaining behaviour.
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.MONGO_URI = 'mongodb://localhost:27017/';

jest.mock('../src/middleware/auth', () => (req, res, next) => {
    if (!req.headers.test_user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: req.headers.test_user_id };
    next();
});

const app = require('../src/server');
const User = require('../src/models/User');
const JobPosting = require('../src/models/JobPosting');
const Resume = require('../src/models/Resume');
const Application = require('../src/models/Application');
const Notification = require('../src/models/Notification');
const {
    sendUpcomingApplicationReminders,
} = require('../src/services/applicationReminderService');

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

let mongoServer;
let userCounter = 0;

const JOB_FIELDS = {
    title: 'Frontend Developer',
    company: 'Acme Corp',
    location: 'Remote',
    category: 'Engineering',
    description: 'Build user interfaces.',
    requirements: 'React experience',
};

async function createUser(role = 'job_seeker', overrides = {}) {
    userCounter += 1;
    const user = await User.create({
        email: `notify-${role}-${userCounter}@example.com`,
        password: 'password123',
        name: `${role} ${userCounter}`,
        role,
        ...overrides,
    });
    return user._id.toString();
}

async function createJob(postedBy, overrides = {}) {
    const job = await JobPosting.create({ ...JOB_FIELDS, postedBy, ...overrides });
    return job._id.toString();
}

async function createApplicationWithStatus(applicant, job, status = 'Applied', overrides = {}) {
    const application = await Application.create({
        applicant,
        job,
        status,
        resume: { originalName: 'resume.pdf', contentType: 'application/pdf', size: 4 },
        ...overrides,
    });
    return application._id.toString();
}

// Submits a real application through the API, so the recruiter's
// "New Application Received" notification is created the same way as in the app.
async function applyThroughApi() {
    const recruiterId = await createUser('recruiter');
    const applicantId = await createUser();
    const jobId = await createJob(recruiterId);
    const resume = await Resume.create({
        user: applicantId,
        originalName: 'resume.pdf',
        contentType: 'application/pdf',
        size: 4,
        data: Buffer.from('test'),
    });
    const response = await request(app)
        .post('/api/applications')
        .set('test_user_id', applicantId)
        .send({ jobId, resumeId: resume._id.toString() });

    return {
        recruiterId,
        applicantId,
        jobId,
        resumeId: resume._id.toString(),
        response,
        applicationId: response.body.application?._id,
    };
}

function updateStatus(recruiterId, applicationId, body) {
    return request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('test_user_id', recruiterId)
        .send(body);
}

function getDashboard(userId) {
    return request(app).get('/api/notifications').set('test_user_id', userId);
}

function countNotifications(filter) {
    return Notification.countDocuments(filter);
}

// "YYYY-MM-DD" for a UTC day relative to today, which is what the date input sends.
function dateInputValue(daysFromToday) {
    return new Date(Date.now() + daysFromToday * DAY).toISOString().slice(0, 10);
}

// A fixed "now" at noon UTC, and a due date `days` calendar days later.
const REMINDER_NOW = new Date(Date.UTC(2026, 10, 20, 12));
function daysAfterReminderNow(days, hour = 15) {
    return new Date(Date.UTC(2026, 10, 20 + days, hour));
}

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.disconnect();
    await mongoose.connect(mongoServer.getUri());
    await Notification.syncIndexes();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
        await collection.deleteMany();
    }
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('SCRUM-371: status update notifications (end to end)', () => {
    it('includes the scheduled interview date in the Interview Invitation', async () => {
        const { recruiterId, applicantId, applicationId, response } = await applyThroughApi();
        expect(response.status).toBe(201);

        const update = await updateStatus(recruiterId, applicationId, {
            status: 'Interview',
            interviewDate: '2026-12-15T15:30:00.000Z',
        });
        const dashboard = await getDashboard(applicantId);

        expect(update.status).toBe(200);
        expect(update.body.application.interviewDate).toBe('2026-12-15T15:30:00.000Z');
        expect(dashboard.body.notifications).toHaveLength(1);
        expect(dashboard.body.notifications[0]).toMatchObject({
            type: 'INTERVIEW_INVITATION',
            title: 'Interview Invitation',
        });
        expect(dashboard.body.notifications[0].message).toContain('"Frontend Developer" at Acme Corp');
        expect(dashboard.body.notifications[0].message).toContain('scheduled for Dec 15, 2026');
    });

    it('sends a Rejected status notification to the applicant', async () => {
        const { recruiterId, applicantId, applicationId } = await applyThroughApi();

        const update = await updateStatus(recruiterId, applicationId, { status: 'Rejected' });
        const dashboard = await getDashboard(applicantId);

        expect(update.status).toBe(200);
        expect(dashboard.body.notifications[0]).toMatchObject({
            type: 'APPLICATION_STATUS',
            title: 'Application Status Updated: Rejected',
            message: 'Your application for "Frontend Developer" at Acme Corp is now "Rejected".',
        });
    });

    it('does not notify anyone when the status update is rejected', async () => {
        const { recruiterId, applicantId, applicationId, jobId } = await applyThroughApi();
        const otherRecruiterId = await createUser('recruiter');

        const invalidStatus = await updateStatus(recruiterId, applicationId, { status: 'Hired' });
        const notOwner = await updateStatus(otherRecruiterId, applicationId, { status: 'Offered' });
        const badDate = await updateStatus(recruiterId, applicationId, {
            status: 'Interview',
            interviewDate: 'not-a-date',
        });

        expect(invalidStatus.status).toBe(400);
        expect(notOwner.status).toBe(403);
        expect(badDate.status).toBe(400);
        expect(await countNotifications({ recipient: applicantId })).toBe(0);
        expect(await countNotifications({ relatedJob: jobId })).toBe(1); // only "New Application Received"
    });

    it('does not notify the recruiter when an offer decline is rejected', async () => {
        const { recruiterId, applicantId, applicationId } = await applyThroughApi();

        const decline = await request(app)
            .patch(`/api/applications/${applicationId}/decline-offer`)
            .set('test_user_id', applicantId);

        expect(decline.status).toBe(400);
        expect(decline.body.error).toBe('Cannot decline an offer unless one has been extended.');
        expect(await countNotifications({ recipient: recruiterId, title: 'Job Offer Declined' })).toBe(0);
    });

    it('does not notify the recruiter when a withdrawal targets someone else\'s application', async () => {
        const { recruiterId, applicationId } = await applyThroughApi();
        const otherSeekerId = await createUser();

        const withdraw = await request(app)
            .delete(`/api/applications/${applicationId}`)
            .set('test_user_id', otherSeekerId);

        expect(withdraw.status).toBe(404);
        expect(await Application.findById(applicationId)).not.toBeNull();
        expect(await countNotifications({ recipient: recruiterId, type: 'APPLICATION_WITHDRAWN' })).toBe(0);
    });
});

describe('SCRUM-371: a failed notification never blocks the main action', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    function breakNotifications() {
        jest.spyOn(Notification, 'create').mockRejectedValue(new Error('Notification database is down'));
    }

    it('still submits the application', async () => {
        breakNotifications();

        const { applicantId, jobId, response } = await applyThroughApi();

        expect(response.status).toBe(201);
        expect(await Application.countDocuments({ applicant: applicantId, job: jobId })).toBe(1);
        expect(await Notification.countDocuments()).toBe(0);
        expect(console.error).toHaveBeenCalledWith('Non-blocking notification error:', expect.any(Error));
    });

    it('still updates the application status', async () => {
        const { recruiterId, applicationId } = await applyThroughApi();
        breakNotifications();

        const update = await updateStatus(recruiterId, applicationId, { status: 'Interview' });

        expect(update.status).toBe(200);
        expect((await Application.findById(applicationId)).status).toBe('Interview');
    });

    it('still declines the offer', async () => {
        const { recruiterId, applicantId, applicationId } = await applyThroughApi();
        await updateStatus(recruiterId, applicationId, { status: 'Offered' });
        breakNotifications();

        const decline = await request(app)
            .patch(`/api/applications/${applicationId}/decline-offer`)
            .set('test_user_id', applicantId);

        expect(decline.status).toBe(200);
        expect((await Application.findById(applicationId)).status).toBe('Offer Declined');
    });

    it('still withdraws the application', async () => {
        const { applicantId, applicationId } = await applyThroughApi();
        breakNotifications();

        const withdraw = await request(app)
            .delete(`/api/applications/${applicationId}`)
            .set('test_user_id', applicantId);

        expect(withdraw.status).toBe(200);
        expect(await Application.findById(applicationId)).toBeNull();
    });

    it('still creates a job posting with a due date', async () => {
        const recruiterId = await createUser('recruiter');
        await createUser(); // a job seeker who would get a deadline reminder
        breakNotifications();

        const response = await request(app)
            .post('/api/jobs')
            .set('test_user_id', recruiterId)
            .send({ ...JOB_FIELDS, dueDate: dateInputValue(3) });

        expect(response.status).toBe(201);
        expect(await JobPosting.countDocuments()).toBe(1);
    });
});

describe('SCRUM-371: duplicate notifications', () => {
    let offset;

    // Controls the clock used for the 1-minute dedupe window. The test starts
    // 1 second into a fresh minute, so a few quick requests stay in the same minute.
    function useControlledClock() {
        const realNow = Date.now.bind(Date);
        const start = realNow();
        offset = Math.ceil(start / MINUTE) * MINUTE + 1000 - start;
        jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    }

    function moveClockForward(ms) {
        offset += ms;
    }

    beforeEach(() => {
        useControlledClock();
    });

    it('sends only one notification for a rapid double-click on the same status', async () => {
        const { recruiterId, applicantId, applicationId } = await applyThroughApi();

        const first = await updateStatus(recruiterId, applicationId, { status: 'Under Review' });
        const second = await updateStatus(recruiterId, applicationId, { status: 'Under Review' });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(await countNotifications({ recipient: applicantId })).toBe(1);
    });

    it('sends only one notification when the same application is submitted twice at once', async () => {
        const { recruiterId, applicantId, jobId, resumeId } = await applyThroughApi();

        const again = await request(app)
            .post('/api/applications')
            .set('test_user_id', applicantId)
            .send({ jobId, resumeId });

        expect(again.status).toBe(409);
        expect(await countNotifications({ recipient: recruiterId })).toBe(1);
    });

    it('sends 3 notifications for Interview -> Offered -> Interview spread over several minutes', async () => {
        const { recruiterId, applicantId, applicationId } = await applyThroughApi();

        await updateStatus(recruiterId, applicationId, { status: 'Interview' });
        moveClockForward(2 * MINUTE);
        await updateStatus(recruiterId, applicationId, { status: 'Offered' });
        moveClockForward(2 * MINUTE);
        await updateStatus(recruiterId, applicationId, { status: 'Interview' });

        const dashboard = await getDashboard(applicantId);
        expect(dashboard.body.notifications.map((n) => n.title)).toEqual([
            'Interview Invitation',
            'Application Status Updated: Offered',
            'Interview Invitation',
        ]);
    });

    it('sends the same status again once the 1-minute window has passed', async () => {
        const { recruiterId, applicantId, applicationId } = await applyThroughApi();

        await updateStatus(recruiterId, applicationId, { status: 'Under Review' });
        moveClockForward(MINUTE);
        await updateStatus(recruiterId, applicationId, { status: 'Under Review' });

        expect(await countNotifications({ recipient: applicantId })).toBe(2);
    });

    it('keeps notifications for different applicants separate', async () => {
        const { recruiterId, jobId, applicationId } = await applyThroughApi();
        const secondApplicantId = await createUser();
        const secondApplicationId = await createApplicationWithStatus(secondApplicantId, jobId);

        await updateStatus(recruiterId, applicationId, { status: 'Under Review' });
        await updateStatus(recruiterId, secondApplicationId, { status: 'Under Review' });

        expect(await countNotifications({ title: 'Application Status Updated: Under Review' })).toBe(2);
    });
});

describe('SCRUM-372: deadline reminders for everyone affected', () => {
    async function setUpJobWithSeekers(daysUntilDue) {
        const recruiterId = await createUser('recruiter');
        const jobId = await createJob(recruiterId, { dueDate: daysAfterReminderNow(daysUntilDue) });
        const applicantId = await createUser();
        const rejectedId = await createUser();
        const savedId = await createUser('job_seeker', { savedJobs: [jobId] });
        const otherSeekerId = await createUser();
        await createApplicationWithStatus(applicantId, jobId, 'Under Review');
        await createApplicationWithStatus(rejectedId, jobId, 'Rejected');
        return { recruiterId, jobId, applicantId, rejectedId, savedId, otherSeekerId };
    }

    it('sends the right reminder to applicants, saved-job seekers and other seekers 3 days before', async () => {
        const users = await setUpJobWithSeekers(3);

        await sendUpcomingApplicationReminders(REMINDER_NOW);

        const titleFor = async (userId) => {
            const found = await Notification.find({ recipient: userId, type: 'REMINDER' });
            return found.map((n) => n.title);
        };
        expect(await titleFor(users.applicantId)).toEqual(['Application Deadline in 3 Days']);
        expect(await titleFor(users.savedId)).toEqual(['Saved Job Deadline in 3 Days']);
        expect(await titleFor(users.otherSeekerId)).toEqual(['Job Deadline in 3 Days']);
        expect(await titleFor(users.rejectedId)).toEqual([]);
        expect(await titleFor(users.recruiterId)).toEqual([]);

        const general = await Notification.findOne({ recipient: users.otherSeekerId });
        expect(general.message).toBe(
            '"Frontend Developer" at Acme Corp closes in 3 days. Apply before the deadline!'
        );
        expect(general.relatedJob.toString()).toBe(users.jobId);
    });

    it.each([2, 4, 5, 6, 8])('sends no reminders %i days before the deadline', async (days) => {
        await setUpJobWithSeekers(days);

        await sendUpcomingApplicationReminders(REMINDER_NOW);

        expect(await countNotifications({ type: 'REMINDER' })).toBe(0);
    });

    it('sends no reminders for an archived posting or a posting without a due date', async () => {
        const recruiterId = await createUser('recruiter');
        await createJob(recruiterId, { dueDate: daysAfterReminderNow(1), isArchived: true });
        await createJob(recruiterId, { dueDate: null });
        await createUser();

        await sendUpcomingApplicationReminders(REMINDER_NOW);

        expect(await countNotifications({ type: 'REMINDER' })).toBe(0);
    });

    it('does not send the same reminder twice when the scheduler runs again that day', async () => {
        await setUpJobWithSeekers(1);

        await sendUpcomingApplicationReminders(REMINDER_NOW);
        const firstRun = await countNotifications({ type: 'REMINDER' });
        await sendUpcomingApplicationReminders(new Date(REMINDER_NOW.getTime() + 6 * 60 * MINUTE));

        expect(firstRun).toBe(3);
        expect(await countNotifications({ type: 'REMINDER' })).toBe(3);
    });

    it('sends a new reminder on each of the 7, 3 and 1 day marks', async () => {
        const recruiterId = await createUser('recruiter');
        const seekerId = await createUser();
        await createJob(recruiterId, { dueDate: daysAfterReminderNow(7) });

        for (const daysLater of [0, 4, 6]) {
            await sendUpcomingApplicationReminders(new Date(REMINDER_NOW.getTime() + daysLater * DAY));
        }

        const reminders = await Notification.find({ recipient: seekerId }).sort({ createdAt: 1 });
        expect(reminders.map((n) => n.title)).toEqual([
            'Job Deadline in 7 Days',
            'Job Deadline in 3 Days',
            'Job Deadline in 1 Day',
        ]);
    });

    it('reminds the applicant about an interview 1 day before, but not 2 days before', async () => {
        const recruiterId = await createUser('recruiter');
        const jobId = await createJob(recruiterId);
        const tomorrowId = await createUser();
        const laterId = await createUser();
        await createApplicationWithStatus(tomorrowId, jobId, 'Interview', {
            interviewDate: daysAfterReminderNow(1),
        });
        await createApplicationWithStatus(laterId, jobId, 'Interview', {
            interviewDate: daysAfterReminderNow(2),
        });

        await sendUpcomingApplicationReminders(REMINDER_NOW);

        const reminder = await Notification.findOne({ recipient: tomorrowId });
        expect(reminder.title).toBe('Upcoming Interview in 1 Day');
        expect(reminder.message).toContain('"Frontend Developer" at Acme Corp');
        expect(await countNotifications({ recipient: laterId })).toBe(0);
    });
});

describe('SCRUM-372: job posting due dates through the API', () => {
    function postJob(recruiterId, body) {
        return request(app).post('/api/jobs').set('test_user_id', recruiterId).send(body);
    }

    function putJob(recruiterId, jobId, body) {
        return request(app).put(`/api/jobs/${jobId}`).set('test_user_id', recruiterId).send(body);
    }

    it('saves the due date from the form and returns it when the job is opened', async () => {
        const recruiterId = await createUser('recruiter');

        const created = await postJob(recruiterId, { ...JOB_FIELDS, dueDate: '2027-01-15' });
        const fetched = await request(app).get(`/api/jobs/${created.body._id}`);

        expect(created.status).toBe(201);
        expect(fetched.body.dueDate).toBe('2027-01-15T00:00:00.000Z');
    });

    it('saves no due date when the field is left empty', async () => {
        const recruiterId = await createUser('recruiter');

        const created = await postJob(recruiterId, { ...JOB_FIELDS, dueDate: '' });

        expect(created.status).toBe(201);
        expect(created.body.dueDate).toBeNull();
    });

    it('rejects a due date that is not a real date', async () => {
        const recruiterId = await createUser('recruiter');

        const created = await postJob(recruiterId, { ...JOB_FIELDS, dueDate: 'next friday' });

        expect(created.status).toBe(400);
        expect(created.body.error).toBe('dueDate must be a valid date');
        expect(await JobPosting.countDocuments()).toBe(0);
    });

    it('changes, keeps and clears the due date when the posting is edited', async () => {
        const recruiterId = await createUser('recruiter');
        const jobId = await createJob(recruiterId, { dueDate: new Date('2027-01-15') });

        const changed = await putJob(recruiterId, jobId, { ...JOB_FIELDS, dueDate: '2027-02-01' });
        const kept = await putJob(recruiterId, jobId, { ...JOB_FIELDS, title: 'Senior Frontend Developer' });
        const invalid = await putJob(recruiterId, jobId, { ...JOB_FIELDS, dueDate: 'soon' });
        const keptAfterInvalid = await JobPosting.findById(jobId);
        const cleared = await putJob(recruiterId, jobId, { ...JOB_FIELDS, dueDate: '' });

        expect(changed.body.dueDate).toBe('2027-02-01T00:00:00.000Z');
        expect(kept.body.dueDate).toBe('2027-02-01T00:00:00.000Z');
        expect(invalid.status).toBe(400);
        expect(keptAfterInvalid.dueDate.toISOString()).toBe('2027-02-01T00:00:00.000Z');
        expect(cleared.body.dueDate).toBeNull();
    });

    it('does not let another recruiter change the due date', async () => {
        const ownerId = await createUser('recruiter');
        const otherRecruiterId = await createUser('recruiter');
        const jobId = await createJob(ownerId, { dueDate: new Date('2027-01-15') });

        const response = await putJob(otherRecruiterId, jobId, { ...JOB_FIELDS, dueDate: '2027-03-01' });

        expect(response.status).toBe(403);
        expect((await JobPosting.findById(jobId)).dueDate.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });

    it('reminds job seekers right away when a posting is created 3 days before its deadline', async () => {
        const recruiterId = await createUser('recruiter');
        const seekerId = await createUser();

        const created = await postJob(recruiterId, { ...JOB_FIELDS, dueDate: dateInputValue(3) });
        const dashboard = await getDashboard(seekerId);

        expect(created.status).toBe(201);
        expect(dashboard.body.notifications).toHaveLength(1);
        expect(dashboard.body.notifications[0]).toMatchObject({
            type: 'REMINDER',
            title: 'Job Deadline in 3 Days',
            relatedJob: created.body._id,
        });
        expect(await countNotifications({ recipient: recruiterId })).toBe(0);
    });

    it('reminds the applicant when an edit moves the deadline to tomorrow', async () => {
        const recruiterId = await createUser('recruiter');
        const applicantId = await createUser();
        const jobId = await createJob(recruiterId, { dueDate: new Date(Date.now() + 20 * DAY) });
        await createApplicationWithStatus(applicantId, jobId, 'Applied');

        const updated = await putJob(recruiterId, jobId, { ...JOB_FIELDS, dueDate: dateInputValue(1) });
        const dashboard = await getDashboard(applicantId);

        expect(updated.status).toBe(200);
        expect(dashboard.body.notifications.map((n) => n.title)).toEqual(['Application Deadline in 1 Day']);
    });

    it('sends no reminders when an archived posting is edited', async () => {
        const recruiterId = await createUser('recruiter');
        await createUser();
        const jobId = await createJob(recruiterId, { isArchived: true });

        const updated = await putJob(recruiterId, jobId, { ...JOB_FIELDS, dueDate: dateInputValue(1) });

        expect(updated.status).toBe(200);
        expect(await countNotifications({ type: 'REMINDER' })).toBe(0);
    });
});

describe('SCRUM-394: notification dashboard', () => {
    async function createNotificationFor(recipient, overrides = {}) {
        const notification = await Notification.create({
            recipient,
            type: 'SYSTEM',
            title: 'Test notification',
            message: 'Something happened.',
            ...overrides,
        });
        return notification._id.toString();
    }

    it('requires login to see or update notifications', async () => {
        const id = new mongoose.Types.ObjectId().toString();

        const list = await request(app).get('/api/notifications');
        const readOne = await request(app).patch(`/api/notifications/${id}/read`);
        const readAll = await request(app).patch('/api/notifications/read-all');

        expect([list.status, readOne.status, readAll.status]).toEqual([401, 401, 401]);
    });

    it('marks all of my notifications as read without touching anyone else\'s', async () => {
        const meId = await createUser();
        const otherId = await createUser();
        await createNotificationFor(meId, { title: 'First' });
        await createNotificationFor(meId, { title: 'Second' });
        await createNotificationFor(otherId);

        const response = await request(app).patch('/api/notifications/read-all').set('test_user_id', meId);
        const mine = await getDashboard(meId);
        const theirs = await getDashboard(otherId);

        expect(response.status).toBe(200);
        expect(mine.body.unreadCount).toBe(0);
        expect(mine.body.notifications.every((n) => n.isRead)).toBe(true);
        expect(theirs.body.unreadCount).toBe(1);
    });

    it('does not let a user mark someone else\'s notification as read', async () => {
        const ownerId = await createUser();
        const otherId = await createUser();
        const notificationId = await createNotificationFor(ownerId);

        const response = await request(app)
            .patch(`/api/notifications/${notificationId}/read`)
            .set('test_user_id', otherId);

        expect(response.status).toBe(404);
        expect((await Notification.findById(notificationId)).isRead).toBe(false);
    });

    it('rejects an invalid notification id', async () => {
        const userId = await createUser();

        const response = await request(app)
            .patch('/api/notifications/not-an-id/read')
            .set('test_user_id', userId);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid notification ID');
    });

    it('shows the newest 50 notifications but counts every unread one', async () => {
        const userId = await createUser();
        const start = Date.now();
        await Notification.insertMany(
            Array.from({ length: 55 }, (_, i) => ({
                recipient: userId,
                title: `Notification ${i}`,
                message: 'Something happened.',
                createdAt: new Date(start + i * 1000),
                updatedAt: new Date(start + i * 1000),
            }))
        );

        const dashboard = await getDashboard(userId);

        expect(dashboard.body.notifications).toHaveLength(50);
        expect(dashboard.body.notifications[0].title).toBe('Notification 54');
        expect(dashboard.body.notifications[49].title).toBe('Notification 5');
        expect(dashboard.body.unreadCount).toBe(55);
    });
});
