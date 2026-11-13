const Application = require("../models/Application");
const JobPosting = require("../models/JobPosting");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");
const { createNotification } = require("../queries/notificationQueries");

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = new Set([1, 3, 7]);

async function sendUpcomingApplicationReminders(now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrow = new Date(today + DAY_IN_MILLISECONDS);
  const afterSevenDays = new Date(today + 8 * DAY_IN_MILLISECONDS);
  const jobs = await JobPosting.find({
    isArchived: { $ne: true },
    dueDate: { $gte: tomorrow, $lt: afterSevenDays },
  });

  for (const job of jobs) {
    const dueDate = new Date(job.dueDate);
    const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
    const daysUntilDue = Math.round((dueDay - today) / DAY_IN_MILLISECONDS);
    if (!REMINDER_DAYS.has(daysUntilDue)) {
      continue;
    }

    const applications = await Application.find({
      job: job._id,
      status: {
        $nin: [
          APPLICATION_STATUSES.REJECTED,
          APPLICATION_STATUSES.OFFER_DECLINED,
          APPLICATION_STATUSES.CANCELLED,
        ],
      },
    });

    for (const application of applications) {
      await createNotification({
        recipient: application.applicant,
        type: "REMINDER",
        title: `Application Deadline in ${daysUntilDue} Day${daysUntilDue === 1 ? "" : "s"}`,
        message: `The application deadline for "${job.title}" at ${job.company} is in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`,
        relatedJob: job._id,
        relatedApplication: application._id,
        dedupeKey: [
          "application-deadline",
          job._id,
          application._id,
          dueDate.toISOString().slice(0, 10),
          daysUntilDue,
        ].join(":"),
      });
    }
  }
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
  sendUpcomingApplicationReminders,
  startApplicationReminderScheduler,
};
