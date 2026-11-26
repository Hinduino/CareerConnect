jest.mock("mongoose", () => ({
  connect: jest.fn()
}));

const mongoose = require("mongoose");
const connectDB = require("./db");

describe("connectDB", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("propagates connection failures to the startup handler", async () => {
    const failure = new Error("database unavailable");
    mongoose.connect.mockRejectedValue(failure);

    await expect(connectDB()).rejects.toBe(failure);
  });
});
