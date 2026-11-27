const Application = require("../models/Application");
const JobPosting = require("../models/JobPosting");
const User = require("../models/User");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");
const { createNotificationSafe } = require("../queries/notificationQueries");

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = new Set([1, 3, 7]);

async function sendDeadlineRemindersForJob(job, now = new Date()) {
  if (!job || job.isArchived || !job.dueDate) {
    return;
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueDate = new Date(job.dueDate);
  const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const daysUntilDue = Math.round((dueDay - today) / DAY_IN_MILLISECONDS);

  if (!REMINDER_DAYS.has(daysUntilDue)) {
    return;
  }

  const dueDateStr = dueDate.toISOString().slice(0, 10);
  const dayLabel = `${daysUntilDue} Day${daysUntilDue === 1 ? "" : "s"}`;
  const dayLower = `${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;

  const activeApplications = await Application.find({
    job: job._id,
    status: {
      $nin: [
        APPLICATION_STATUSES.REJECTED,
        APPLICATION_STATUSES.OFFER_DECLINED,
        APPLICATION_STATUSES.CANCELLED,
      ],
    },
  });

  for (const application of activeApplications) {
    await createNotificationSafe({
      recipient: application.applicant,
      type: "REMINDER",
      title: `Application Deadline in ${dayLabel}`,
      message: `The application deadline for "${job.title}" at ${job.company} is in ${dayLower}.`,
      relatedJob: job._id,
      relatedApplication: application._id,
      dedupeKey: ["application-deadline", job._id, application._id, dueDateStr, daysUntilDue].join(":"),
    });
  }

  const allApplicationsForJob = await Application.find({ job: job._id }).select("applicant");
  const appliedUserIds = new Set(allApplicationsForJob.map((app) => String(app.applicant)));
  const jobSeekers = await User.find({ role: "job_seeker" }).select("_id savedJobs");

  for (const seeker of jobSeekers) {
    if (appliedUserIds.has(String(seeker._id))) {
      continue;
    }

    const isSaved =
      Array.isArray(seeker.savedJobs) &&
      seeker.savedJobs.some((id) => String(id) === String(job._id));

    await createNotificationSafe({
      recipient: seeker._id,
      type: "REMINDER",
      title: isSaved ? `Saved Job Deadline in ${dayLabel}` : `Job Deadline in ${dayLabel}`,
      message: isSaved
        ? `Your saved job "${job.title}" at ${job.company} closes in ${dayLower}. Apply before the deadline!`
        : `"${job.title}" at ${job.company} closes in ${dayLower}. Apply before the deadline!`,
      relatedJob: job._id,
      dedupeKey: ["job-deadline", job._id, seeker._id, dueDateStr, daysUntilDue].join(":"),
    });
  }
}

async function sendUpcomingInterviewReminders(now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrow = new Date(today + DAY_IN_MILLISECONDS);
  const afterSevenDays = new Date(today + 8 * DAY_IN_MILLISECONDS);

  const scheduledInterviews = await Application.find({
    status: APPLICATION_STATUSES.INTERVIEW,
    interviewDate: { $gte: tomorrow, $lt: afterSevenDays },
  }).populate("job", "title company");

  for (const application of scheduledInterviews) {
    const interviewDate = new Date(application.interviewDate);
    const interviewDay = Date.UTC(
      interviewDate.getUTCFullYear(),
      interviewDate.getUTCMonth(),
      interviewDate.getUTCDate()
    );
    const daysUntil = Math.round((interviewDay - today) / DAY_IN_MILLISECONDS);
    if (!REMINDER_DAYS.has(daysUntil)) {
      continue;
    }

    const dayLabel = `${daysUntil} Day${daysUntil === 1 ? "" : "s"}`;
    const jobLabel = application.job
      ? `"${application.job.title}" at ${application.job.company}`
      : "your job application";
    const formattedDate = interviewDate.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    await createNotificationSafe({
      recipient: application.applicant,
      type: "REMINDER",
      title: `Upcoming Interview in ${dayLabel}`,
      message: `Reminder: Your interview for ${jobLabel} is scheduled for ${formattedDate}.`,
      relatedJob: application.job?._id || application.job,
      relatedApplication: application._id,
      dedupeKey: [
        "interview-reminder",
        application._id,
        interviewDate.toISOString().slice(0, 10),
        daysUntil,
      ].join(":"),
    });
  }
}

async function sendUpcomingApplicationReminders(now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrow = new Date(today + DAY_IN_MILLISECONDS);
  const afterSevenDays = new Date(today + 8 * DAY_IN_MILLISECONDS);
  const jobs = await JobPosting.find({
    isArchived: { $ne: true },
    dueDate: { $gte: tomorrow, $lt: afterSevenDays },
  });

  for (const job of jobs) {
    await sendDeadlineRemindersForJob(job, now);
  }

  await sendUpcomingInterviewReminders(now);
}

function startApplicationReminderScheduler() {
  let running = false;
  const run = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      await sendUpcomingApplicationReminders();
    } catch (error) {
      console.error("Failed to send application deadline reminders:", error);
    } finally {
      running = false;
    }
  };

  void run();
  return setInterval(run, DAY_IN_MILLISECONDS);
}

module.exports = {
  sendDeadlineRemindersForJob,
  sendUpcomingInterviewReminders,
  sendUpcomingApplicationReminders,
  startApplicationReminderScheduler,
};