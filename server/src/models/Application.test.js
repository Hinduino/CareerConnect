const mongoose = require("mongoose");
const Application = require("./Application");
const { APPLICATION_STATUSES } = require("./Application");

function newIds() {
  return {
    applicant: new mongoose.Types.ObjectId(),
    job: new mongoose.Types.ObjectId(),
  };
}

describe("Application schema", () => {
  it("supports the five statuses from the ticket", () => {
    expect(APPLICATION_STATUSES).toEqual([
      "Applied", "Under Review", "Interview", "Offered", "Rejected",
    ]);
  });

  it("starts as Applied with one history entry", async () => {
    const application = new Application(newIds());
    expect(application.status).toBe("Applied");
    expect(application.statusHistory).toHaveLength(1);
    expect(application.statusHistory[0].status).toBe("Applied");
    await expect(application.validate()).resolves.toBeUndefined();
  });

  it("rejects a status that is not in the list", async () => {
    const application = new Application({ ...newIds(), status: "Hired" });
    await expect(application.validate()).rejects.toMatchObject({
      errors: { status: expect.any(Object) },
    });
  });

  it("requires an applicant and a job", async () => {
    await expect(new Application({}).validate()).rejects.toMatchObject({
      errors: { applicant: expect.any(Object), job: expect.any(Object) },
    });
  });

  it("prevents applying to the same job twice", () => {
    expect(Application.schema.indexes()).toContainEqual([
      { applicant: 1, job: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});