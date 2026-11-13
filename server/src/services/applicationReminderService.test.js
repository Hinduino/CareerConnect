jest.mock("../models/Application", () => ({
  find: jest.fn(),
}));
jest.mock("../models/JobPosting", () => ({
  find: jest.fn(),
}));
jest.mock("../queries/notificationQueries", () => ({
  createNotification: jest.fn(),
}));

const Application = require("../models/Application");
const JobPosting = require("../models/JobPosting");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");
const { createNotification } = require("../queries/notificationQueries");
const {
  sendUpcomingApplicationReminders,
  startApplicationReminderScheduler,
} = require("./applicationReminderService");

const jobId = "507f1f77bcf86cd799439033";
const applicationId = "507f1f77bcf86cd799439044";
const applicantId = "507f1f77bcf86cd799439022";
const job = {
  _id: jobId,
  title: "Software Engineer",
  company: "CareerConnect",
  dueDate: new Date("2026-11-20T00:00:00.000Z"),
};
const application = {
  _id: applicationId,
  applicant: applicantId,
  job: jobId,
};

describe("application deadline reminders", () => {
  const now = new Date("2026-11-13T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    JobPosting.find.mockResolvedValue([job]);
    Application.find.mockResolvedValue([application]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([7, 3, 1])(
    "sends an applicant a reminder %i day(s) before the job deadline",
    async (daysUntilDue) => {
      const dueDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilDue)
      );
      JobPosting.find.mockResolvedValue([{ ...job, dueDate }]);

      await sendUpcomingApplicationReminders(now);

      expect(createNotification).toHaveBeenCalledWith({
        recipient: applicantId,
        type: "REMINDER",
        title: `Application Deadline in ${daysUntilDue} Day${daysUntilDue === 1 ? "" : "s"}`,
        message: `The application deadline for "${job.title}" at ${job.company} is in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`,
        relatedJob: jobId,
        relatedApplication: applicationId,
        dedupeKey: [
          "application-deadline",
          jobId,
          applicationId,
          dueDate.toISOString().slice(0, 10),
          daysUntilDue,
        ].join(":"),
      });
    }
  );

  it("does not send a reminder outside the 7, 3, and 1 day windows", async () => {
    JobPosting.find.mockResolvedValue([
      {
        ...job,
        dueDate: new Date("2026-11-15T00:00:00.000Z"),
      },
    ]);

    await sendUpcomingApplicationReminders(now);

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("only looks up active applicants for each upcoming job", async () => {
    await sendUpcomingApplicationReminders(now);

    expect(Application.find).toHaveBeenCalledWith({
      job: jobId,
      status: {
        $nin: [
          APPLICATION_STATUSES.REJECTED,
          APPLICATION_STATUSES.OFFER_DECLINED,
          APPLICATION_STATUSES.CANCELLED,
        ],
      },
    });
  });

  it("runs immediately, schedules daily work, and skips overlapping runs", async () => {
    let resolveJobs;
    JobPosting.find
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveJobs = resolve;
      }))
      .mockResolvedValue([]);
    const interval = jest.spyOn(global, "setInterval").mockReturnValue(123);

    const timerId = startApplicationReminderScheduler();
    const scheduledRun = interval.mock.calls[0][0];

    expect(timerId).toBe(123);
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 24 * 60 * 60 * 1000);
    expect(JobPosting.find).toHaveBeenCalledTimes(1);

    await scheduledRun();
    expect(JobPosting.find).toHaveBeenCalledTimes(1);

    resolveJobs([]);
    await new Promise((resolve) => setImmediate(resolve));
    await scheduledRun();

    expect(JobPosting.find).toHaveBeenCalledTimes(2);
  });

  it("logs reminder failures and allows the next scheduled run", async () => {
    const error = new Error("database unavailable");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    JobPosting.find
      .mockRejectedValueOnce(error)
      .mockResolvedValue([]);
    const interval = jest.spyOn(global, "setInterval").mockReturnValue(123);

    startApplicationReminderScheduler();
    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to send application deadline reminders:",
      error
    );

    await interval.mock.calls[0][0]();

    expect(JobPosting.find).toHaveBeenCalledTimes(2);
  });
});
